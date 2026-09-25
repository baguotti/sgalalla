/**
 * Sgalalla online server: pairs players two by two and relays their inputs.
 *
 * Matches run on the players' machines, in lockstep on shared/GameSim.ts. The
 * server introduces the two players, starts the match with a random seed and
 * an input delay that suits their pings, and forwards their input packets.
 */

import geckos, { type GeckosServer, type ServerChannel } from '@geckos.io/server';
import http from 'http';
import { NetEvent, PROTOCOL_VERSION, inputDelayFor, type MatchStart } from '../shared/NetProtocol.js';

const PORT = Number(process.env.PORT) || 9208;
const reliable = { reliable: true };

interface Seat {
    channel: ServerChannel;
    character: string;
    ready: boolean;
    rtt: number;
    wantsRematch: boolean;
}

interface Room {
    seats: [Seat, Seat];
    start: MatchStart | null;
}

let waiting: ServerChannel | null = null;
const roomsByChannel = new Map<string, Room>();

// ─── HTTP (health check) ───

const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(`Sgalalla server, protocol ${PROTOCOL_VERSION}\n`);
    }
});

// Unordered and unreliable by default: input packets must never wait for a lost one
const io: GeckosServer = geckos({
    cors: { origin: '*' },
    ordered: false,
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
});
io.addServer(httpServer);

// ─── Idle shutdown (only with AUTO_SHUTDOWN=true, for ephemeral cloud machines) ───

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let connectedPlayers = 0;

function checkIdleStatus(): void {
    if (process.env.AUTO_SHUTDOWN !== 'true') return;
    if (connectedPlayers === 0 && !idleTimer) {
        console.log(`[Server] Nobody connected; shutting down in ${IDLE_TIMEOUT_MS / 1000}s`);
        idleTimer = setTimeout(() => process.exit(0), IDLE_TIMEOUT_MS);
    } else if (connectedPlayers > 0 && idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
    }
}
checkIdleStatus();

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Listening on 0.0.0.0:${PORT}, protocol ${PROTOCOL_VERSION}`);
});

// ─── Players ───

io.onConnection((channel: ServerChannel) => {
    connectedPlayers++;
    checkIdleStatus();
    let greeted = false;

    channel.on(NetEvent.HELLO, (data) => {
        if (greeted) return;
        const version = (data as { version?: unknown } | null)?.version;
        if (version !== PROTOCOL_VERSION) {
            channel.emit(NetEvent.REJECTED, { reason: `Game version ${version}, server version ${PROTOCOL_VERSION}` }, reliable);
            // Give the reliable message time to arrive before closing
            setTimeout(() => void channel.close(), 3000);
            return;
        }
        greeted = true;

        if (waiting) {
            openRoom(waiting, channel);
            waiting = null;
        } else {
            waiting = channel;
            channel.emit(NetEvent.WAITING, {}, reliable);
        }
    });

    channel.on(NetEvent.PING, (data) => channel.emit(NetEvent.PONG, data));

    channel.on(NetEvent.PICK, (data) => {
        const room = roomsByChannel.get(channel.id!);
        const character = characterFrom(data);
        if (!room || !character || room.start) return;
        const slot = slotOf(room, channel);
        room.seats[slot].character = character;
        for (const seat of room.seats) seat.channel.emit(NetEvent.PICK, { slot, character }, reliable);
    });

    channel.on(NetEvent.READY, (data) => {
        const room = roomsByChannel.get(channel.id!);
        const character = characterFrom(data);
        if (!room || !character || room.start) return;
        const seat = room.seats[slotOf(room, channel)];
        seat.character = character;
        seat.rtt = Number((data as { rtt?: unknown }).rtt) || 0;
        seat.ready = true;
        if (room.seats.every(s => s.ready)) {
            const [a, b] = room.seats;
            startMatch(room, {
                seed: randomSeed(),
                inputDelay: inputDelayFor(a.rtt, b.rtt),
                characters: [a.character, b.character],
            });
        }
    });

    channel.on(NetEvent.REMATCH, () => {
        const room = roomsByChannel.get(channel.id!);
        if (!room?.start) return;
        room.seats[slotOf(room, channel)].wantsRematch = true;
        if (room.seats.every(s => s.wantsRematch)) {
            room.seats.forEach(s => (s.wantsRematch = false));
            startMatch(room, { ...room.start, seed: randomSeed() });
        }
    });

    // Input packets go straight to the opponent
    channel.onRaw((packet) => {
        const room = roomsByChannel.get(channel.id!);
        if (!room) return;
        room.seats[1 - slotOf(room, channel)].channel.raw.emit(packet);
    });

    channel.onDisconnect(() => {
        connectedPlayers = Math.max(0, connectedPlayers - 1);
        checkIdleStatus();
        if (waiting === channel) waiting = null;

        const room = roomsByChannel.get(channel.id!);
        if (!room) return;
        for (const seat of room.seats) roomsByChannel.delete(seat.channel.id!);
        const other = room.seats[1 - slotOf(room, channel)].channel;
        other.emit(NetEvent.OPPONENT_LEFT, {}, reliable);
        console.log('[Server] A player left; room closed');
    });
});

function openRoom(first: ServerChannel, second: ServerChannel): void {
    const seat = (channel: ServerChannel): Seat => ({ channel, character: 'fok', ready: false, rtt: 0, wantsRematch: false });
    const room: Room = { seats: [seat(first), seat(second)], start: null };
    room.seats.forEach((s, slot) => {
        roomsByChannel.set(s.channel.id!, room);
        s.channel.emit(NetEvent.MATCHED, { slot }, reliable);
    });
    console.log(`[Server] Paired two players (${roomsByChannel.size / 2} rooms)`);
}

function startMatch(room: Room, start: MatchStart): void {
    room.start = start;
    for (const seat of room.seats) seat.channel.emit(NetEvent.START, start, reliable);
    console.log(`[Server] Match started: ${start.characters.join(' vs ')}, input delay ${start.inputDelay}`);
}

function slotOf(room: Room, channel: ServerChannel): number {
    return room.seats[0].channel === channel ? 0 : 1;
}

function characterFrom(data: unknown): string | null {
    const character = (data as { character?: unknown } | null)?.character;
    return typeof character === 'string' && /^[a-z0-9_]{1,16}$/.test(character) ? character : null;
}

function randomSeed(): number {
    return Math.floor(Math.random() * 0x100000000);
}
