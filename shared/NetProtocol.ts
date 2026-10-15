/**
 * Online protocol shared by the game client and the relay server.
 *
 * Control messages are Geckos events sent reliably. Inputs travel as raw
 * binary packets that the server forwards to every other player in the room.
 * Each packet repeats all the inputs some other player hasn't acknowledged, so
 * a lost packet needs no resend of its own.
 */

/** Bump whenever two builds can no longer play each other. */
export const PROTOCOL_VERSION = 8;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
/** People watching a match, besides its players. */
export const MAX_SPECTATORS = 4;

export const NetEvent = {
    /** client → server `{ version }` */
    HELLO: 'hello',
    /** server → client `{ reason }`, then the server closes the connection */
    REJECTED: 'rejected',
    /** server → each player in a room: a RoomState, whenever the room changes */
    ROOM: 'room',
    /** client → server `{ character }` */
    PICK: 'pick',
    /** client → server `{ character, rtt }` */
    READY: 'ready',
    /** server → each player: a MatchStart */
    START: 'start',
    /** client → server: vote for a rematch */
    REMATCH: 'rematch',
    /** server → the players still in the match, a PlayerLeft: someone left, and the match goes on without them */
    PLAYER_LEFT: 'player_left',
    /** server → someone who joined while a match runs: a WatchStart; they watch it */
    WATCH: 'watch',
    /** server → spectators: WatchInputs, the players' inputs in batches, from the match's start */
    WATCH_INPUTS: 'watch_inputs',
    /** server → spectators `{ reason }`: the match they watched is over for good (its players all left) */
    WATCH_END: 'watch_end',
    /** client (spectating) → server `{ character, book }`: book a place in the next match, or cancel it */
    SEAT: 'seat',
    /** server → players `{ count }`: how many people are watching */
    SPECTATORS: 'spectators',
    /** client → server `{ t }`, echoed back unchanged as PONG */
    PING: 'ping',
    PONG: 'pong',
} as const;

export interface RoomPlayer {
    character: string;
    ready: boolean;
}

export interface RoomState {
    /** Counts up with every change, since reliable messages can arrive out of order. */
    version: number;
    /** The receiving player's index in `players`. */
    you: number;
    /** In joining order; a player's index becomes their slot in the match. */
    players: RoomPlayer[];
}

/** A player left mid-match: the last frame the server has their inputs for, and those final inputs from `first`. */
export interface PlayerLeft {
    slot: number;
    lastFrame: number;
    first: number;
    inputs: number[];
}

/** Watching a match: its start (no slot of our own) and the players who already left. */
export interface WatchStart {
    seed: number;
    inputDelay: number;
    characters: string[];
    left: { slot: number; lastFrame: number }[];
}

/** Players' inputs for spectators: for each batch, inputs of `slot` from frame `first`. */
export interface WatchInputs {
    batches: { slot: number; first: number; inputs: number[] }[];
}

export interface MatchStart {
    seed: number;
    /** Frames between sampling an input and the frame it applies to. */
    inputDelay: number;
    /** Character by slot; one per player. */
    characters: string[];
    /** The receiving player's slot. */
    slot: number;
}

// ─── Input packets ───

export interface InputPacket {
    /** The match's seed: packets from a previous match (before a rematch) are ignored. */
    match: number;
    /** The sender's slot. */
    slot: number;
    /** Sender's packet counter, for loss statistics. */
    seq: number;
    /** The frame the sender is about to simulate. */
    frame: number;
    /** Frame of inputs[0]; the inputs are the sender's own. */
    first: number;
    inputs: number[];
    /** By slot: first frame of that player's inputs the sender doesn't have yet. */
    ackNext: number[];
    /** By slot: how many frames the sender thinks it runs ahead of that player, averaged. */
    advantage: number[];
    /** The sender's latest match checksum, if any. */
    checksum: { frame: number; value: number } | null;
}

export const MAX_INPUTS_PER_PACKET = 255;
const HEADER_BYTES = 19;
const TRAILER_BYTES = 8;

function packetBytes(count: number, players: number): number {
    return HEADER_BYTES + count * 4 + players * 6 + TRAILER_BYTES;
}

export function encodeInputPacket(packet: InputPacket): Uint8Array {
    const count = packet.inputs.length;
    const players = packet.ackNext.length;
    const view = new DataView(new ArrayBuffer(packetBytes(count, players)));
    view.setUint32(0, packet.match, true);
    view.setUint8(4, packet.slot);
    view.setUint8(5, players);
    view.setUint32(6, packet.seq, true);
    view.setUint32(10, packet.frame, true);
    view.setUint32(14, packet.first, true);
    view.setUint8(18, count);

    let at = HEADER_BYTES;
    for (const input of packet.inputs) {
        view.setUint32(at, input, true);
        at += 4;
    }
    for (const ack of packet.ackNext) {
        view.setUint32(at, ack, true);
        at += 4;
    }
    for (const advantage of packet.advantage) {
        // Hundredths of a frame, clamped to the Int16 range
        view.setInt16(at, Math.max(-32768, Math.min(32767, Math.round(advantage * 100))), true);
        at += 2;
    }
    // Frame + 1 so that 0 means "no checksum yet"
    view.setUint32(at, packet.checksum ? packet.checksum.frame + 1 : 0, true);
    view.setUint32(at + 4, packet.checksum?.value ?? 0, true);
    return new Uint8Array(view.buffer);
}

/** Null for anything that isn't a well-formed input packet. */
export function decodeInputPacket(bytes: Uint8Array): InputPacket | null {
    if (bytes.byteLength < HEADER_BYTES + TRAILER_BYTES) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const players = view.getUint8(5);
    const count = view.getUint8(18);
    if (players < 1 || players > MAX_PLAYERS || bytes.byteLength !== packetBytes(count, players)) return null;

    let at = HEADER_BYTES;
    const read = (n: number, size: number, get: (offset: number) => number): number[] => {
        const values: number[] = [];
        for (let i = 0; i < n; i++, at += size) values.push(get(at));
        return values;
    };
    const inputs = read(count, 4, offset => view.getUint32(offset, true));
    const ackNext = read(players, 4, offset => view.getUint32(offset, true));
    const advantage = read(players, 2, offset => view.getInt16(offset, true) / 100);
    const checksumFrame = view.getUint32(at, true);

    return {
        match: view.getUint32(0, true),
        slot: view.getUint8(4),
        seq: view.getUint32(6, true),
        frame: view.getUint32(10, true),
        first: view.getUint32(14, true),
        inputs,
        ackNext,
        advantage,
        checksum: checksumFrame === 0 ? null : { frame: checksumFrame - 1, value: view.getUint32(at + 4, true) },
    };
}

/**
 * Input delay for a match, from each player's round trip to the server. It
 * covers about half the one-way trip between the two furthest players;
 * rollback hides the rest.
 */
export function inputDelayFor(rtts: readonly number[]): number {
    const [worst, second] = [...rtts].sort((a, b) => b - a);
    const oneWayFrames = (worst + (second ?? worst)) / 2 / (1000 / 60);
    return Math.min(Math.max(Math.round(oneWayFrames / 2), 1), 3);
}
