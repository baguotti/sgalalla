/**
 * Sgalalla online server: gathers players into rooms of 2 to 5 and relays
 * their inputs.
 *
 * Matches run on the players' machines, in rollback on shared/GameSim.ts. The
 * server puts new players in the open room, starts the match once everyone in
 * it is ready (with a random seed and an input delay that suits their pings),
 * and forwards each player's input packets to the others, keeping a copy of
 * every input. When a player leaves mid-match, the others get the last frame
 * the server has from them and their final inputs, and play on without them.
 *
 * Someone who joins while a match is on watches it: the server sends them
 * every input from the start in batches, and their copy of the match runs a
 * moment behind the players'. They can book a seat for the next match.
 */

import geckos, { type GeckosServer, type ServerChannel } from '@geckos.io/server';
import http from 'http';
import {
    MAX_PLAYERS, MAX_SPECTATORS, MIN_PLAYERS, NetEvent, PROTOCOL_VERSION, decodeInputPacket, inputDelayFor,
    type MatchStart, type RoomState, type WatchInputs, type WatchStart,
} from '../shared/NetProtocol.js';

/** When a player leaves, the others get up to this many of their final inputs (10 s), more than anyone can be missing. */
const FINAL_INPUTS = 600;
/**
 * A player in a match who sends nothing for this long has gone (a crash or a dropped connection),
 * without waiting for WebRTC to notice. Long enough to survive a quick switch to another window
 * (browsers pause hidden pages); closing the game's tab is announced straight away.
 */
const SILENCE_MS = 10000;
/** Spectators get inputs this often, at most this many frames per player each time (catching up from the start takes a moment). */
const WATCH_EVERY_MS = 50;
const WATCH_BATCH = 1200;

const PORT = Number(process.env.PORT) || 9208;
const reliable = { reliable: true };

interface Seat {
    channel: ServerChannel;
    character: string;
    ready: boolean;
    rtt: number;
    wantsRematch: boolean;
    /** Left during the match: keeps its slot until the match is over, but gets nothing more. */
    left: boolean;
    /** This match's inputs from this player, by frame, and the first frame not yet received. */
    inputs: number[];
    next: number;
    /** When their last input packet arrived. */
    heardAt: number;
}

/** Someone watching the match. */
interface Spectator {
    channel: ServerChannel;
    /** By slot: the first frame of that player's inputs not sent to this spectator yet. */
    sent: number[];
    /** A seat booked for the next match, with the fighter picked. */
    booked: boolean;
    character: string;
}

interface Room {
    /** In joining order: a seat's index is its player's slot. */
    seats: Seat[];
    spectators: Spectator[];
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
    // Who is where, for checking on the server: rooms, whether their match runs, each seat's state
    if (req.url === '/rooms' && req.method === 'GET') {
        const now = Date.now();
        const rooms = [...new Set(roomsByChannel.values())].map(room => ({
            playing: room.start !== null,
            seats: room.seats.map(s => ({ character: s.character, ready: s.ready, left: s.left, inputsUpTo: s.next - 1, silentFor: room.start ? now - s.heardAt : 0 })),
            spectators: room.spectators.map(s => ({ booked: s.booked, character: s.character, sentUpTo: s.sent.map(f => f - 1) })),
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ protocol: PROTOCOL_VERSION, rooms }, null, 2));
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

    channel.on(NetEvent.SEAT, (data) => {
        const room = roomsByChannel.get(channel.id!);
        const spectator = room?.spectators.find(s => s.channel === channel);
        if (!room || !spectator) return;
        spectator.character = characterFrom(data) ?? spectator.character;
        spectator.booked = (data as { book?: unknown } | null)?.book === true;
        startRematchIfAgreed(room);
    });

    channel.on(NetEvent.REMATCH, () => {
        const room = roomsByChannel.get(channel.id!);
        const seat = room && seatOf(room, channel);
        if (!room?.start || !seat || seat.left) return;
        seat.wantsRematch = true;
        startRematchIfAgreed(room);
    });

    // Input packets go to everyone else in the room still playing; the server keeps the inputs too
    channel.onRaw((packet) => {
        const room = roomsByChannel.get(channel.id!);
        if (!room) return;
        const seat = seatOf(room, channel);
        if (seat && room.start) {
            seat.heardAt = Date.now();
            record(seat, room.start.seed, packet);
        }
        for (const other of room.seats) {
            if (other.channel !== channel && !other.left) other.channel.raw.emit(packet);
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
    // A match is on: watch it, if there's room to
    const playing = [...new Set(roomsByChannel.values())].find(r => r.start !== null && r.spectators.length < MAX_SPECTATORS);
    if (playing && !openRoom) {
        watch(playing, channel);
        return;
    }
    if (!openRoom) openRoom = { seats: [], spectators: [], start: null, version: 0 };
    const room = openRoom;
    room.seats.push({ channel, character: 'fok', ready: false, rtt: 0, wantsRematch: false, left: false, inputs: [], next: 0, heardAt: 0 });
    roomsByChannel.set(channel.id!, room);
    if (room.seats.length >= MAX_PLAYERS) openRoom = null;
    sendRoom(room);
    console.log(`[Server] A player joined a room (${room.seats.length}/${MAX_PLAYERS})`);
}

/** `channel` starts watching the room's match: the start now, the inputs from the next batch on. */
function watch(room: Room, channel: ServerChannel): void {
    const start = room.start!;
    room.spectators.push({ channel, sent: room.seats.map(() => start.inputDelay), booked: false, character: 'fok' });
    roomsByChannel.set(channel.id!, room);
    const left = room.seats.flatMap((seat, slot) => seat.left ? [{ slot, lastFrame: seat.next - 1 }] : []);
    const message: WatchStart = { seed: start.seed, inputDelay: start.inputDelay, characters: start.characters, left };
    channel.emit(NetEvent.WATCH, message, reliable);
    tellSpectatorCount(room);
    console.log(`[Server] Someone is watching a match (${room.spectators.length} watching)`);
}

/** Players hear how many people are watching. */
function tellSpectatorCount(room: Room): void {
    for (const seat of room.seats) if (!seat.left) seat.channel.emit(NetEvent.SPECTATORS, { count: room.spectators.length }, reliable);
}

// Spectators get every input they don't have yet, a batch per player
setInterval(() => {
    for (const room of new Set(roomsByChannel.values())) {
        if (!room.start) continue;
        for (const spectator of room.spectators) {
            const message: WatchInputs = { batches: [] };
            room.seats.forEach((seat, slot) => {
                const from = spectator.sent[slot];
                const to = Math.min(seat.next, from + WATCH_BATCH);
                if (to <= from) return;
                message.batches.push({ slot, first: from, inputs: seat.inputs.slice(from, to) });
                spectator.sent[slot] = to;
            });
            if (message.batches.length > 0) spectator.channel.emit(NetEvent.WATCH_INPUTS, message, reliable);
        }
    }
}, WATCH_EVERY_MS);

function leave(room: Room, channel: ServerChannel): void {
    const slot = room.seats.findIndex(s => s.channel === channel);
    roomsByChannel.delete(channel.id!);
    const watching = room.spectators.findIndex(s => s.channel === channel);
    if (watching >= 0) {
        room.spectators.splice(watching, 1);
        tellSpectatorCount(room);
        return;
    }
    if (slot < 0) return;

    if (room.start) {
        // The match goes on without them: everyone else gets their last frame and final inputs
        const seat = room.seats[slot];
        if (seat.left) return;
        seat.left = true;
        const lastFrame = seat.next - 1;
        const first = Math.max(room.start.inputDelay, lastFrame - FINAL_INPUTS + 1);
        const inputs = seat.inputs.slice(first, lastFrame + 1).map(mask => mask ?? 0);
        const playing = room.seats.filter(s => !s.left);
        for (const other of playing) other.channel.emit(NetEvent.PLAYER_LEFT, { slot, lastFrame, first, inputs }, reliable);
        for (const spectator of room.spectators) spectator.channel.emit(NetEvent.PLAYER_LEFT, { slot, lastFrame, first, inputs: [] }, reliable);
        console.log(`[Server] Player ${slot + 1} left a match after frame ${lastFrame}; ${playing.length} play on`);
        if (playing.length === 0) {
            // Nobody left to play: the spectators' match is over too
            for (const spectator of room.spectators) spectator.channel.emit(NetEvent.WATCH_END, { reason: 'I GIOCATORI SONO USCITI' }, reliable);
            for (const other of [...room.seats, ...room.spectators]) roomsByChannel.delete(other.channel.id!);
            room.spectators = [];
        } else {
            startRematchIfAgreed(room);
        }
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

// Players gone silent mid-match are treated as having left, and their connection closed
setInterval(() => {
    const now = Date.now();
    for (const room of new Set(roomsByChannel.values())) {
        if (!room.start) continue;
        for (const seat of room.seats) {
            if (seat.left || now - seat.heardAt < SILENCE_MS) continue;
            console.log('[Server] A player went silent mid-match');
            leave(room, seat.channel);
            void seat.channel.close();
        }
    }
}, 1000);

function startIfReady(room: Room): void {
    if (room.start || room.seats.length < MIN_PLAYERS || !room.seats.every(s => s.ready)) return;
    startMatch(room, {
        seed: randomSeed(),
        inputDelay: inputDelayFor(room.seats.map(s => s.rtt)),
        characters: room.seats.map(s => s.character),
    });
}

/**
 * Everyone still playing wants a rematch: it starts with them and the
 * spectators who booked a seat (as many as there's room for), in new slots,
 * once there are at least two of them. The other spectators watch it.
 */
function startRematchIfAgreed(room: Room): void {
    const playing = room.seats.filter(s => !s.left);
    const booked = room.spectators.filter(s => s.booked).slice(0, MAX_PLAYERS - playing.length);
    if (!room.start || playing.length === 0 || playing.length + booked.length < MIN_PLAYERS || !playing.every(s => s.wantsRematch)) return;
    const newcomers: Seat[] = booked.map(s => ({
        channel: s.channel, character: s.character, ready: true, rtt: 0, wantsRematch: false, left: false, inputs: [], next: 0, heardAt: 0,
    }));
    room.spectators = room.spectators.filter(s => !booked.includes(s));
    room.seats = [...playing, ...newcomers];
    room.seats.forEach(s => (s.wantsRematch = false));
    startMatch(room, { ...room.start, seed: randomSeed(), characters: room.seats.map(s => s.character) });
}

/** Keeps a copy of the inputs in a player's packet for this match. */
function record(seat: Seat, match: number, raw: unknown): void {
    const bytes = raw instanceof ArrayBuffer ? new Uint8Array(raw)
        : ArrayBuffer.isView(raw) ? new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength) : null;
    const packet = bytes && decodeInputPacket(bytes);
    if (!packet || packet.match !== match) return;
    packet.inputs.forEach((mask, i) => {
        const frame = packet.first + i;
        if (frame >= seat.next && seat.inputs[frame] === undefined) seat.inputs[frame] = mask;
    });
    while (seat.inputs[seat.next] !== undefined) seat.next++;
}

function startMatch(room: Room, start: Omit<MatchStart, 'slot'>): void {
    room.start = start;
    // A fresh record of inputs, which start at the input delay
    for (const seat of room.seats) {
        seat.inputs = [];
        seat.next = start.inputDelay;
        seat.heardAt = Date.now();
    }
    if (openRoom === room) openRoom = null;
    room.seats.forEach((seat, slot) => seat.channel.emit(NetEvent.START, { ...start, slot }, reliable));
    // Spectators watch the new match from its start
    const watching = room.spectators;
    room.spectators = [];
    for (const spectator of watching) watch(room, spectator.channel);
    tellSpectatorCount(room);
    console.log(`[Server] Match started: ${start.characters.join(' vs ')}, input delay ${start.inputDelay}, ${watching.length} watching`);
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
