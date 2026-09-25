/**
 * Sgalalla online server: gathers players into rooms of 2 to 4 and relays
 * their inputs.
 *
 * Matches run on the players' machines, in rollback on shared/GameSim.ts. The
 * server puts new players in the open room, starts the match once everyone in
 * it is ready (with a random seed and an input delay that suits their pings),
 * and forwards each player's input packets to the others.
 */

import geckos, { type GeckosServer, type ServerChannel } from '@geckos.io/server';
import http from 'http';
import {
    MAX_PLAYERS, MIN_PLAYERS, NetEvent, PROTOCOL_VERSION, inputDelayFor,
    type MatchStart, type RoomState,
} from '../shared/NetProtocol.js';

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
    /** In joining order: a seat's index is its player's slot. */
    seats: Seat[];
    /** Set once the match starts; the room then takes no new players. */
    start: Omit<MatchStart, 'slot'> | null;
    version: number;
}

/** The room new players join. A new one opens once it's full or its match starts. */
let openRoom: Room | null = null;
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
        join(channel);
    });

    channel.on(NetEvent.PING, (data) => channel.emit(NetEvent.PONG, data));

    channel.on(NetEvent.PICK, (data) => {
        const room = roomsByChannel.get(channel.id!);
        const character = characterFrom(data);
        const seat = room && seatOf(room, channel);
        if (!room || !seat || !character || room.start || seat.ready) return;
        seat.character = character;
        sendRoom(room);
    });

    channel.on(NetEvent.READY, (data) => {
        const room = roomsByChannel.get(channel.id!);
        const character = characterFrom(data);
        const seat = room && seatOf(room, channel);
        if (!room || !seat || !character || room.start) return;
        seat.character = character;
        seat.rtt = Number((data as { rtt?: unknown }).rtt) || 0;
        seat.ready = true;
        sendRoom(room);
        startIfReady(room);
    });

    channel.on(NetEvent.REMATCH, () => {
        const room = roomsByChannel.get(channel.id!);
        const seat = room && seatOf(room, channel);
        if (!room?.start || !seat) return;
        seat.wantsRematch = true;
        if (room.seats.every(s => s.wantsRematch)) {
            room.seats.forEach(s => (s.wantsRematch = false));
            startMatch(room, { ...room.start, seed: randomSeed() });
        }
    });

    // Input packets go to everyone else in the room
    channel.onRaw((packet) => {
        const room = roomsByChannel.get(channel.id!);
        if (!room) return;
        for (const seat of room.seats) {
            if (seat.channel !== channel) seat.channel.raw.emit(packet);
        }
    });

    channel.onDisconnect(() => {
        connectedPlayers = Math.max(0, connectedPlayers - 1);
        checkIdleStatus();
        const room = roomsByChannel.get(channel.id!);
        if (room) leave(room, channel);
    });
});

function join(channel: ServerChannel): void {
    if (!openRoom) openRoom = { seats: [], start: null, version: 0 };
    const room = openRoom;
    room.seats.push({ channel, character: 'fok', ready: false, rtt: 0, wantsRematch: false });
    roomsByChannel.set(channel.id!, room);
    if (room.seats.length >= MAX_PLAYERS) openRoom = null;
    sendRoom(room);
    console.log(`[Server] A player joined a room (${room.seats.length}/${MAX_PLAYERS})`);
}

function leave(room: Room, channel: ServerChannel): void {
    const slot = room.seats.findIndex(s => s.channel === channel);
    roomsByChannel.delete(channel.id!);
    if (slot < 0) return;

    if (room.start) {
        // A match can't go on without one of its players: it ends for everyone
        for (const seat of room.seats) {
            roomsByChannel.delete(seat.channel.id!);
            if (seat.channel !== channel) seat.channel.emit(NetEvent.PLAYER_LEFT, { slot }, reliable);
        }
        console.log('[Server] A player left a match; room closed');
        return;
    }

    room.seats.splice(slot, 1);
    if (room.seats.length === 0) {
        if (openRoom === room) openRoom = null;
        return;
    }
    // The room has space again, unless another one opened meanwhile
    if (!openRoom) openRoom = room;
    sendRoom(room);
    startIfReady(room);
}

function startIfReady(room: Room): void {
    if (room.start || room.seats.length < MIN_PLAYERS || !room.seats.every(s => s.ready)) return;
    startMatch(room, {
        seed: randomSeed(),
        inputDelay: inputDelayFor(room.seats.map(s => s.rtt)),
        characters: room.seats.map(s => s.character),
    });
}

function startMatch(room: Room, start: Omit<MatchStart, 'slot'>): void {
    room.start = start;
    if (openRoom === room) openRoom = null;
    room.seats.forEach((seat, slot) => seat.channel.emit(NetEvent.START, { ...start, slot }, reliable));
    console.log(`[Server] Match started: ${start.characters.join(' vs ')}, input delay ${start.inputDelay}`);
}

/** Tells every player in the room who is in it; each one's own index is their slot. */
function sendRoom(room: Room): void {
    room.version++;
    const players = room.seats.map(s => ({ character: s.character, ready: s.ready }));
    room.seats.forEach((seat, you) => {
        const state: RoomState = { version: room.version, you, players };
        seat.channel.emit(NetEvent.ROOM, state, reliable);
    });
}

function seatOf(room: Room, channel: ServerChannel): Seat | undefined {
    return room.seats.find(s => s.channel === channel);
}

function characterFrom(data: unknown): string | null {
    const character = (data as { character?: unknown } | null)?.character;
    return typeof character === 'string' && /^[a-z0-9_]{1,16}$/.test(character) ? character : null;
}

function randomSeed(): number {
    return Math.floor(Math.random() * 0x100000000);
}
