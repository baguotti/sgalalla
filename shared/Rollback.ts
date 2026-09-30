/**
 * Rollback for an online match of 2 to 5 players.
 *
 * Each player simulates right away with their own input and a guess of every
 * other player's: that player's last known input, minus new presses. When a
 * real input for a frame already simulated differs from the guess, the match
 * goes back to the state saved before that frame and is simulated again.
 * Sounds and effects already played are not played twice.
 *
 * A player who gets MAX_ROLLBACK frames past someone's inputs waits for them,
 * and a player running ahead of anyone skips an occasional frame so that
 * everybody stays level. Inputs are sampled `inputDelay` frames ahead, which
 * makes rollbacks shorter; frames before `inputDelay` have no input.
 *
 * Every packet repeats the inputs some other player hasn't acknowledged, and
 * carries a checksum of a confirmed frame every CHECKSUM_INTERVAL frames.
 *
 * A player who leaves stops counting: the server says the last frame it has
 * their inputs for and sends those final inputs, and from the frame after,
 * every copy of the match retires their fighter (GameSim.retireFighter), so
 * the others play on in sync.
 */

import { PRESS_BITS, unpackInput, type FighterInput } from './FighterInput.js';
import { matchChecksum, retireFighter, stepMatch, type MatchState } from './GameSim.js';
import type { MatchEvent } from './MatchEvents.js';
import { MAX_INPUTS_PER_PACKET, decodeInputPacket, encodeInputPacket } from './NetProtocol.js';

export const MAX_ROLLBACK = 8;
export const CHECKSUM_INTERVAL = 60;
/** Frames over which each player averages their frame advantage. */
const ADVANTAGE_WINDOW = 32;
/** Frames between two skipped frames while evening out the advantage. */
const SKIP_SPACING = 8;
/** Our own checksums kept for comparison, in frames. */
const CHECKSUM_MEMORY = CHECKSUM_INTERVAL * 20;

export class RollbackSession {
    readonly matchId: number;
    /** Our slot. */
    readonly slot: number;
    readonly players: number;
    readonly inputDelay: number;
    /** The match as simulated so far, including guessed frames. */
    match: MatchState;
    /** Next frame to simulate. Keeps counting after the match ends. */
    frame = 0;
    /** The state at the start of this frame is final: every frame before it used real inputs only. */
    confirmedFrame = 0;
    /** First frame at which our checksum differed from another player's, or -1. */
    desyncFrame = -1;
    /** Called with each newly confirmed frame and the state at its start (tests compare them). */
    onConfirmed: ((frame: number, state: MatchState) => void) | null = null;

    rollbacks = 0;
    lastRollbackDepth = 0;
    maxRollbackDepth = 0;
    /** Steps spent waiting for someone's inputs. */
    waits = 0;
    /** Frames skipped to let someone catch up. */
    skips = 0;

    /** Packed inputs by slot, then frame. Our own slot holds ours. */
    private readonly inputs: number[][];
    /** Inputs each simulated frame used, by slot, then frame: real ones and guesses. */
    private readonly used: number[][];
    /** By slot: first frame of that player's inputs we don't have yet. */
    private readonly next: number[];
    /** By slot: first frame of our inputs that player doesn't have yet. */
    private readonly theyNeed: number[];
    /** State at the start of each frame that may still be simulated again. */
    private readonly saved = new Map<number, MatchState>();
    /** Keys of the events already played, by frame. */
    private readonly played = new Map<number, Set<string>>();
    /** Earliest simulated frame with a wrong guess, or -1. */
    private firstWrongGuess = -1;
    /** By slot: the last frame a player who left played, or Infinity while they're in. */
    private readonly leftAfter: number[];

    private readonly localChecksums = new Map<number, number>();
    private readonly remoteChecksums: Map<number, number>[];
    private latestChecksum: { frame: number; value: number } | null = null;

    /** By slot: their latest reported frame, their advantage over us, and our recent advantages over them. */
    private readonly remoteFrame: number[];
    private readonly remoteAdvantage: number[];
    private readonly advantages: number[][];
    private framesSinceSkip = 0;

    private sentPackets = 0;
    /** By slot: packets received, and the first and highest sequence numbers seen. */
    private readonly received: number[];
    private readonly firstSeq: number[];
    private readonly highestSeq: number[];

    /** `matchId` tells this match's packets from a previous one's; everyone uses the match seed. */
    constructor(matchId: number, slot: number, players: number, inputDelay: number, match: MatchState) {
        this.matchId = matchId >>> 0;
        this.slot = slot;
        this.players = players;
        this.inputDelay = inputDelay;
        this.match = match;

        const each = <T>(make: () => T): T[] => Array.from({ length: players }, make);
        this.inputs = each(() => []);
        this.used = each(() => []);
        this.next = each(() => inputDelay);
        this.theyNeed = each(() => inputDelay);
        this.remoteChecksums = each(() => new Map());
        this.remoteFrame = each(() => 0);
        this.remoteAdvantage = each(() => 0);
        this.advantages = each(() => []);
        this.received = each(() => 0);
        this.firstSeq = each(() => -1);
        this.highestSeq = each(() => -1);
        this.leftAfter = each(() => Infinity);
    }

    /**
     * Player `slot` left after `lastFrame`: their inputs up to it (from `first`,
     * as the server had them) complete ours, and from the next frame on their
     * fighter is retired. Frames already simulated past it are simulated again.
     */
    playerLeft(slot: number, lastFrame: number, first: number, inputs: readonly number[]): void {
        if (slot === this.slot || slot < 0 || slot >= this.players || this.leftAfter[slot] !== Infinity) return;
        const theirs = this.inputs[slot];
        inputs.forEach((mask, i) => {
            const frame = first + i;
            if (frame < this.inputDelay || frame > lastFrame || theirs[frame] !== undefined) return;
            theirs[frame] = mask;
            if (frame < this.frame && this.used[slot][frame] !== mask) this.markWrong(frame);
        });
        while (theirs[this.next[slot]] !== undefined && this.next[slot] <= lastFrame) this.next[slot]++;
        this.leftAfter[slot] = Math.max(lastFrame, this.inputDelay - 1);
        // Frames simulated with their fighter still in play are simulated again without it
        if (this.frame > this.leftAfter[slot] + 1) this.markWrong(this.leftAfter[slot] + 1);
    }

    /** Whether player `slot` is still in the match. */
    isPlaying(slot: number): boolean {
        return this.leftAfter[slot] === Infinity;
    }

    private markWrong(frame: number): void {
        if (this.firstWrongGuess < 0 || frame < this.firstWrongGuess) this.firstWrongGuess = frame;
    }

    /**
     * Corrects any wrong guess, then simulates the next frame unless we have
     * to wait or skip. New events are appended to `events`, including those of
     * re-simulated frames. Returns whether a frame was simulated.
     */
    step(readLocal: () => number, events: MatchEvent[]): boolean {
        if (this.firstWrongGuess >= 0) this.rollBack(events);

        let simulated = false;
        if (this.frame - this.earliestMissing() >= MAX_ROLLBACK) {
            this.waits++;
        } else if (this.shouldSkip()) {
            this.skips++;
        } else {
            this.inputs[this.slot][this.frame + this.inputDelay] = readLocal();
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

    /** Our inputs that someone hasn't acknowledged, plus sync information for everyone. */
    buildPacket(): Uint8Array {
        const ours = this.inputs[this.slot];
        const others = this.others();
        const first = others.length > 0 ? Math.min(...others.map(s => this.theyNeed[s])) : ours.length;
        const count = Math.min(Math.max(ours.length - first, 0), MAX_INPUTS_PER_PACKET);
        return encodeInputPacket({
            match: this.matchId,
            slot: this.slot,
            seq: this.sentPackets++,
            frame: this.frame,
            first,
            inputs: ours.slice(first, first + count),
            ackNext: this.next,
            advantage: this.advantages.map(average),
            checksum: this.latestChecksum,
        });
    }

    receivePacket(bytes: Uint8Array): void {
        const packet = decodeInputPacket(bytes);
        if (!packet || packet.match !== this.matchId || packet.ackNext.length !== this.players) return;
        const s = packet.slot;
        if (s === this.slot || s >= this.players || !this.isPlaying(s)) return;

        this.received[s]++;
        if (this.firstSeq[s] < 0 || packet.seq < this.firstSeq[s]) this.firstSeq[s] = packet.seq;
        this.highestSeq[s] = Math.max(this.highestSeq[s], packet.seq);
        this.theyNeed[s] = Math.max(this.theyNeed[s], packet.ackNext[this.slot]);
        if (packet.frame >= this.remoteFrame[s]) {
            this.remoteFrame[s] = packet.frame;
            this.remoteAdvantage[s] = packet.advantage[this.slot];
        }

        const theirs = this.inputs[s];
        packet.inputs.forEach((mask, i) => {
            const frame = packet.first + i;
            if (frame < this.inputDelay || theirs[frame] !== undefined) return;
            theirs[frame] = mask;
            if (frame < this.frame && this.used[s][frame] !== mask) this.markWrong(frame);
        });
        while (theirs[this.next[s]] !== undefined) this.next[s]++;

        if (packet.checksum) {
            this.remoteChecksums[s].set(packet.checksum.frame, packet.checksum.value);
            this.compareChecksum(s, packet.checksum.frame);
        }
    }

    /** Share of the other players' packets that never arrived, 0 to 1. */
    get packetLoss(): number {
        let received = 0;
        let expected = 0;
        for (const s of this.others()) {
            if (this.received[s] === 0) continue;
            received += this.received[s];
            expected += this.highestSeq[s] - this.firstSeq[s] + 1;
        }
        return expected > 0 ? 1 - received / expected : 0;
    }

    // ─── Simulation ───

    private simulate(events: MatchEvent[]): void {
        const f = this.frame;
        this.saved.set(f, structuredClone(this.match));

        const hasInputs = f >= this.inputDelay;
        const frameInputs: FighterInput[] = [];
        for (let s = 0; s < this.players; s++) {
            // Gone: their fighter leaves the match at the frame after their last
            const gone = f > this.leftAfter[s];
            if (gone) retireFighter(this.match, s);
            const mask = !hasInputs || gone ? 0 : this.inputs[s][f] ?? this.guess(s);
            this.used[s][f] = mask;
            frameInputs.push(unpackInput(mask));
        }

        const frameEvents: MatchEvent[] = [];
        stepMatch(this.match, frameInputs, frameEvents);
        this.keepNew(f, frameEvents, events);
        this.frame++;
    }

    /** A player's latest known input, without presses. */
    private guess(s: number): number {
        const latest = this.inputs[s][this.next[s] - 1];
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

    /** Frames before everyone's first missing input are final: checksum them and forget their saves. */
    private confirm(): void {
        const confirmed = Math.min(this.earliestMissing(), this.frame);
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

    /** First frame for which some other player's input is still missing (Infinity once everyone else left). */
    private earliestMissing(): number {
        return Math.min(...this.others().map(s => this.next[s]));
    }

    /** The other players still in the match. */
    private others(): number[] {
        const slots: number[] = [];
        for (let s = 0; s < this.players; s++) if (s !== this.slot && this.isPlaying(s)) slots.push(s);
        return slots;
    }

    // ─── Staying level with the others ───

    /**
     * Our advantage over a player is how far our frame is past their latest
     * report. Both sides' advantages include the trip time between them, so
     * half their difference is how far we really run ahead of that player.
     */
    private shouldSkip(): boolean {
        let lead = -Infinity;
        for (const s of this.others()) {
            const samples = this.advantages[s];
            samples.push(this.frame - this.remoteFrame[s]);
            if (samples.length > ADVANTAGE_WINDOW) samples.shift();
            lead = Math.max(lead, (average(samples) - this.remoteAdvantage[s]) / 2);
        }
        this.framesSinceSkip++;
        if (lead < 1 || this.framesSinceSkip < SKIP_SPACING) return false;
        this.framesSinceSkip = 0;
        return true;
    }

    // ─── Checksums ───

    private recordChecksum(frame: number, value: number): void {
        this.localChecksums.set(frame, value);
        this.latestChecksum = { frame, value };
        for (const s of this.others()) this.compareChecksum(s, frame);
        for (const f of this.localChecksums.keys()) if (f < frame - CHECKSUM_MEMORY) this.localChecksums.delete(f);
    }

    private compareChecksum(s: number, frame: number): void {
        const local = this.localChecksums.get(frame);
        const remote = this.remoteChecksums[s].get(frame);
        if (local === undefined || remote === undefined) return;
        if (local !== remote && this.desyncFrame < 0) this.desyncFrame = frame;
        // Older checksums whose counterpart was lost will never be compared
        for (const f of this.remoteChecksums[s].keys()) if (f <= frame) this.remoteChecksums[s].delete(f);
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
