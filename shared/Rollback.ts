/**
 * Rollback for a two-player match.
 *
 * Each side simulates right away with its own input and a guess of the
 * opponent's: their last known input, minus new presses. When the opponent's
 * real input for a frame already simulated differs from the guess, the match
 * goes back to the state saved before that frame and is simulated again.
 * Sounds and effects already played are not played twice.
 *
 * A side that gets MAX_ROLLBACK frames past the opponent's inputs waits for
 * them, and a side running ahead of the other skips an occasional frame so
 * that the two stay level. Inputs are sampled `inputDelay` frames ahead, which
 * makes rollbacks shorter; frames before `inputDelay` have no input.
 *
 * Every packet repeats the inputs the other side hasn't acknowledged, and
 * carries a checksum of a confirmed frame every CHECKSUM_INTERVAL frames.
 */

import { PRESS_BITS, unpackInput, type FighterInput } from './FighterInput.js';
import { matchChecksum, stepMatch, type MatchState } from './GameSim.js';
import type { MatchEvent } from './MatchEvents.js';
import { MAX_INPUTS_PER_PACKET, decodeInputPacket, encodeInputPacket } from './NetProtocol.js';

export const MAX_ROLLBACK = 8;
export const CHECKSUM_INTERVAL = 60;
/** Frames over which each side averages its frame advantage. */
const ADVANTAGE_WINDOW = 32;
/** Frames between two skipped frames while evening out the advantage. */
const SKIP_SPACING = 8;

export class RollbackSession {
    readonly matchId: number;
    readonly slot: number;
    readonly inputDelay: number;
    /** The match as simulated so far, including guessed frames. */
    match: MatchState;
    /** Next frame to simulate. Keeps counting after the match ends. */
    frame = 0;
    /** The state at the start of this frame is final: every frame before it used both real inputs. */
    confirmedFrame = 0;
    /** First frame at which the two sides' checksums differed, or -1. */
    desyncFrame = -1;
    /** Called with each newly confirmed frame and the state at its start (tests compare them). */
    onConfirmed: ((frame: number, state: MatchState) => void) | null = null;

    rollbacks = 0;
    lastRollbackDepth = 0;
    maxRollbackDepth = 0;
    /** Steps spent waiting for the opponent's inputs. */
    waits = 0;
    /** Frames skipped to let the other side catch up. */
    skips = 0;

    /** Packed inputs by frame: ours, the opponent's, and what each simulated frame used for the opponent. */
    private readonly local: number[] = [];
    private readonly remote: number[] = [];
    private readonly used: number[] = [];
    /** State at the start of each frame that may still be simulated again. */
    private readonly saved = new Map<number, MatchState>();
    /** Keys of the events already played, by frame. */
    private readonly played = new Map<number, Set<string>>();
    /** Earliest simulated frame whose guess turned out wrong, or -1. */
    private firstWrongGuess = -1;
    /** First frame of ours the other side doesn't have yet. */
    private remoteNeeds: number;
    /** First frame of theirs we don't have yet. */
    private remoteNext: number;

    private readonly localChecksums = new Map<number, number>();
    private readonly remoteChecksums = new Map<number, number>();
    private latestChecksum: { frame: number; value: number } | null = null;

    private remoteFrame = 0;
    private remoteAdvantage = 0;
    private readonly advantages: number[] = [];
    private framesSinceSkip = 0;

    private sentPackets = 0;
    private receivedPackets = 0;
    /** Packets the other side sent before this session started never count as lost. */
    private firstReceivedSeq = -1;
    private highestReceivedSeq = -1;

    /** `matchId` tells this match's packets from a previous one's; both sides use the match seed. */
    constructor(matchId: number, slot: number, inputDelay: number, match: MatchState) {
        this.matchId = matchId >>> 0;
        this.slot = slot;
        this.inputDelay = inputDelay;
        this.match = match;
        this.remoteNeeds = inputDelay;
        this.remoteNext = inputDelay;
    }

    /**
     * Corrects any wrong guess, then simulates the next frame unless this side
     * has to wait or skip. New events are appended to `events`, including those
     * of re-simulated frames. Returns whether a frame was simulated.
     */
    step(readLocal: () => number, events: MatchEvent[]): boolean {
        if (this.firstWrongGuess >= 0) this.rollBack(events);

        let simulated = false;
        if (this.frame - this.remoteNext >= MAX_ROLLBACK) {
            this.waits++;
        } else if (this.shouldSkip()) {
            this.skips++;
        } else {
            this.local[this.frame + this.inputDelay] = readLocal();
            this.simulate(events);
            simulated = true;
        }
        this.confirm();
        return simulated;
    }

    /** True once the match has ended in a confirmed frame, so no rollback can undo it. */
    get isOverConfirmed(): boolean {
        return this.stateAt(this.confirmedFrame)?.isOver ?? false;
    }

    /** Our inputs the other side hasn't acknowledged, plus sync information. */
    buildPacket(): Uint8Array {
        const first = this.remoteNeeds;
        const count = Math.min(Math.max(this.local.length - first, 0), MAX_INPUTS_PER_PACKET);
        return encodeInputPacket({
            match: this.matchId,
            seq: this.sentPackets++,
            ackNext: this.remoteNext,
            frame: this.frame,
            advantage: average(this.advantages),
            first,
            inputs: this.local.slice(first, first + count),
            checksum: this.latestChecksum,
        });
    }

    receivePacket(bytes: Uint8Array): void {
        const packet = decodeInputPacket(bytes);
        if (!packet || packet.match !== this.matchId) return;

        this.receivedPackets++;
        if (this.firstReceivedSeq < 0 || packet.seq < this.firstReceivedSeq) this.firstReceivedSeq = packet.seq;
        this.highestReceivedSeq = Math.max(this.highestReceivedSeq, packet.seq);
        this.remoteNeeds = Math.max(this.remoteNeeds, packet.ackNext);
        if (packet.frame >= this.remoteFrame) {
            this.remoteFrame = packet.frame;
            this.remoteAdvantage = packet.advantage;
        }

        packet.inputs.forEach((mask, i) => {
            const frame = packet.first + i;
            if (frame < this.inputDelay || this.remote[frame] !== undefined) return;
            this.remote[frame] = mask;
            if (frame < this.frame && this.used[frame] !== mask && (this.firstWrongGuess < 0 || frame < this.firstWrongGuess)) {
                this.firstWrongGuess = frame;
            }
        });
        while (this.remote[this.remoteNext] !== undefined) this.remoteNext++;

        if (packet.checksum) {
            this.remoteChecksums.set(packet.checksum.frame, packet.checksum.value);
            this.compareChecksum(packet.checksum.frame);
        }
    }

    /** Share of the other side's packets that never arrived, 0 to 1. */
    get packetLoss(): number {
        const expected = this.highestReceivedSeq - this.firstReceivedSeq + 1;
        return this.receivedPackets > 0 ? 1 - this.receivedPackets / expected : 0;
    }

    // ─── Simulation ───

    private simulate(events: MatchEvent[]): void {
        const f = this.frame;
        this.saved.set(f, structuredClone(this.match));

        const hasInputs = f >= this.inputDelay;
        const opponent = hasInputs ? this.remote[f] ?? this.guess() : 0;
        this.used[f] = opponent;
        const inputs: FighterInput[] = [];
        inputs[this.slot] = unpackInput(hasInputs ? this.local[f] : 0);
        inputs[1 - this.slot] = unpackInput(opponent);

        const frameEvents: MatchEvent[] = [];
        stepMatch(this.match, inputs, frameEvents);
        this.keepNew(f, frameEvents, events);
        this.frame++;
    }

    /** The opponent's latest known input, without presses. */
    private guess(): number {
        const latest = this.remote[this.remoteNext - 1];
        return latest === undefined ? 0 : latest & ~PRESS_BITS;
    }

    private rollBack(events: MatchEvent[]): void {
        const from = this.firstWrongGuess;
        const to = this.frame;
        this.firstWrongGuess = -1;

        this.match = this.saved.get(from)!;
        this.frame = from;
        while (this.frame < to) this.simulate(events);

        this.rollbacks++;
        this.lastRollbackDepth = to - from;
        this.maxRollbackDepth = Math.max(this.maxRollbackDepth, this.lastRollbackDepth);
    }

    /** Adds the frame's events that weren't played the first time it was simulated. */
    private keepNew(frame: number, frameEvents: MatchEvent[], out: MatchEvent[]): void {
        let played = this.played.get(frame);
        if (!played) this.played.set(frame, played = new Set());
        const seen = new Map<string, number>();
        for (const event of frameEvents) {
            const key = eventKey(event);
            const n = (seen.get(key) ?? 0) + 1;
            seen.set(key, n);
            if (played.has(`${key}#${n}`)) continue;
            played.add(`${key}#${n}`);
            out.push(event);
        }
    }

    /** Frames before the first missing opponent input are final: checksum them and forget their saves. */
    private confirm(): void {
        const confirmed = Math.min(this.remoteNext, this.frame);
        for (let f = this.confirmedFrame + 1; f <= confirmed; f++) {
            const state = this.stateAt(f)!;
            this.onConfirmed?.(f, state);
            if (f % CHECKSUM_INTERVAL === 0) this.recordChecksum(f, matchChecksum(state));
        }
        this.confirmedFrame = Math.max(this.confirmedFrame, confirmed);
        for (const f of this.saved.keys()) if (f < this.confirmedFrame) this.saved.delete(f);
        for (const f of this.played.keys()) if (f < this.confirmedFrame) this.played.delete(f);
    }

    /** The match at the start of `frame`, if still known. */
    private stateAt(frame: number): MatchState | undefined {
        return frame === this.frame ? this.match : this.saved.get(frame);
    }

    // ─── Staying level with the other side ───

    /**
     * Each side's advantage is how far its frame is past the other side's latest
     * report. Both include the trip time, so half their difference is how far
     * this side really runs ahead.
     */
    private shouldSkip(): boolean {
        this.advantages.push(this.frame - this.remoteFrame);
        if (this.advantages.length > ADVANTAGE_WINDOW) this.advantages.shift();
        this.framesSinceSkip++;

        const lead = (average(this.advantages) - this.remoteAdvantage) / 2;
        if (lead < 1 || this.framesSinceSkip < SKIP_SPACING) return false;
        this.framesSinceSkip = 0;
        return true;
    }

    // ─── Checksums ───

    private recordChecksum(frame: number, value: number): void {
        this.localChecksums.set(frame, value);
        this.latestChecksum = { frame, value };
        this.compareChecksum(frame);
    }

    private compareChecksum(frame: number): void {
        const local = this.localChecksums.get(frame);
        const remote = this.remoteChecksums.get(frame);
        if (local === undefined || remote === undefined) return;
        if (local !== remote && this.desyncFrame < 0) this.desyncFrame = frame;
        // Older checksums whose counterpart was lost will never be compared
        for (const checksums of [this.localChecksums, this.remoteChecksums]) {
            for (const f of checksums.keys()) if (f <= frame) checksums.delete(f);
        }
    }
}

/** Identifies an event within its frame, whatever the positions in it. */
function eventKey(event: MatchEvent): string {
    switch (event.type) {
        case 'sound': return `sound:${event.fighter}:${event.key}`;
        case 'attack': return `attack:${event.fighter}:${event.key}`;
        case 'hit': return `hit:${event.attacker}:${event.target}:${event.attackKey}`;
        default: return `${event.type}:${event.fighter}`;
    }
}

function average(values: readonly number[]): number {
    return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}
