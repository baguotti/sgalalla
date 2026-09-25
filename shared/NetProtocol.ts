/**
 * Online protocol shared by the game client and the relay server.
 *
 * Control messages are Geckos events sent reliably. Inputs travel as raw
 * binary packets that repeat every input the other side hasn't acknowledged,
 * so a lost packet needs no resend of its own.
 */

/** Bump whenever client and server no longer understand each other. */
export const PROTOCOL_VERSION = 1;

export const NetEvent = {
    /** client → server `{ version }` */
    HELLO: 'hello',
    /** server → client `{ reason }`, then the server closes the connection */
    REJECTED: 'rejected',
    /** server → client: waiting for an opponent */
    WAITING: 'waiting',
    /** server → client `{ slot }`: paired with an opponent */
    MATCHED: 'matched',
    /** client → server `{ character }`; server → both `{ slot, character }` */
    PICK: 'pick',
    /** client → server `{ character, rtt }` */
    READY: 'ready',
    /** server → both: a MatchStart */
    START: 'start',
    /** client → server: vote for a rematch */
    REMATCH: 'rematch',
    /** server → client: the opponent disconnected */
    OPPONENT_LEFT: 'opponent_left',
    /** client → server `{ t }`, echoed back unchanged as PONG */
    PING: 'ping',
    PONG: 'pong',
} as const;

export interface MatchStart {
    seed: number;
    /** Frames between sampling an input and the frame it applies to. */
    inputDelay: number;
    /** Character by slot. */
    characters: [string, string];
}

// ─── Input packets ───

export interface InputPacket {
    /** The match's seed: packets from a previous match (before a rematch) are ignored. */
    match: number;
    /** Sender's packet counter, for loss statistics. */
    seq: number;
    /** First frame of the receiver's inputs the sender doesn't have yet. */
    ackNext: number;
    /** Frame of inputs[0]. */
    first: number;
    inputs: number[];
    /** The sender's latest match checksum, if any. */
    checksum: { frame: number; value: number } | null;
}

const HEADER_BYTES = 17;
const TRAILER_BYTES = 8;
export const MAX_INPUTS_PER_PACKET = 255;

export function encodeInputPacket(packet: InputPacket): Uint8Array {
    const count = packet.inputs.length;
    const view = new DataView(new ArrayBuffer(HEADER_BYTES + count * 4 + TRAILER_BYTES));
    view.setUint32(0, packet.match, true);
    view.setUint32(4, packet.seq, true);
    view.setUint32(8, packet.ackNext, true);
    view.setUint32(12, packet.first, true);
    view.setUint8(16, count);
    for (let i = 0; i < count; i++) {
        view.setUint32(HEADER_BYTES + i * 4, packet.inputs[i], true);
    }
    const trailer = HEADER_BYTES + count * 4;
    // Frame + 1 so that 0 means "no checksum yet"
    view.setUint32(trailer, packet.checksum ? packet.checksum.frame + 1 : 0, true);
    view.setUint32(trailer + 4, packet.checksum?.value ?? 0, true);
    return new Uint8Array(view.buffer);
}

/** Null for anything that isn't a well-formed input packet. */
export function decodeInputPacket(bytes: Uint8Array): InputPacket | null {
    if (bytes.byteLength < HEADER_BYTES + TRAILER_BYTES) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = view.getUint8(16);
    if (bytes.byteLength !== HEADER_BYTES + count * 4 + TRAILER_BYTES) return null;

    const inputs: number[] = [];
    for (let i = 0; i < count; i++) {
        inputs.push(view.getUint32(HEADER_BYTES + i * 4, true));
    }
    const trailer = HEADER_BYTES + count * 4;
    const checksumFrame = view.getUint32(trailer, true);
    return {
        match: view.getUint32(0, true),
        seq: view.getUint32(4, true),
        ackNext: view.getUint32(8, true),
        first: view.getUint32(12, true),
        inputs,
        checksum: checksumFrame === 0 ? null : { frame: checksumFrame - 1, value: view.getUint32(trailer + 4, true) },
    };
}

/**
 * Input delay for two players, from each one's round trip to the server:
 * enough frames to cover the one-way trip between them plus a margin for
 * jitter and one lost packet.
 */
export function inputDelayFor(rttA: number, rttB: number): number {
    const oneWayMs = (rttA + rttB) / 2;
    const frames = Math.ceil((oneWayMs + 25) / (1000 / 60));
    return Math.min(Math.max(frames, 2), 12);
}
