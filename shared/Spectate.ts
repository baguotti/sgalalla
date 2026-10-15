/**
 * A spectator's copy of an online match. The server passes on every player's
 * inputs as it relays them; the spectator simulates a frame only once it has
 * every input for it, so there is no guessing and no rollback: its copy is
 * always exactly the players' confirmed match, a moment behind them.
 *
 * Frames before `inputDelay` have no input, and a player who left is retired
 * the frame after their last, exactly as RollbackSession does.
 */

import { unpackInput, type FighterInput } from './FighterInput.js';
import { retireFighter, stepMatch, type MatchState } from './GameSim.js';
import type { MatchEvent } from './MatchEvents.js';

export class SpectatorSession {
    readonly players: number;
    readonly inputDelay: number;
    match: MatchState;
    /** Next frame to simulate. */
    frame = 0;
    /** Called with each frame and the state at its start, before it's simulated (tests compare them). */
    onFrame: ((frame: number, state: MatchState) => void) | null = null;

    /** Packed inputs by slot, then frame. */
    private readonly inputs: number[][];
    /** By slot: the first frame of their inputs not received yet. */
    private readonly next: number[];
    /** By slot: the last frame a player who left played, or Infinity while they're in. */
    private readonly leftAfter: number[];

    constructor(players: number, inputDelay: number, match: MatchState) {
        this.players = players;
        this.inputDelay = inputDelay;
        this.match = match;
        this.inputs = Array.from({ length: players }, () => []);
        this.next = Array.from({ length: players }, () => inputDelay);
        this.leftAfter = Array.from({ length: players }, () => Infinity);
    }

    /** Inputs for `slot` from frame `first`, as the server relays them; repeats and out-of-order batches are fine. */
    addInputs(slot: number, first: number, inputs: readonly number[]): void {
        const theirs = this.inputs[slot];
        if (!theirs) return;
        inputs.forEach((mask, i) => {
            const frame = first + i;
            if (frame >= this.inputDelay && theirs[frame] === undefined) theirs[frame] = mask;
        });
        while (theirs[this.next[slot]] !== undefined) this.next[slot]++;
    }

    /** Player `slot` left after `lastFrame`: their fighter is retired from the next frame. */
    playerLeft(slot: number, lastFrame: number): void {
        if (slot < 0 || slot >= this.players || this.leftAfter[slot] !== Infinity) return;
        this.leftAfter[slot] = Math.max(lastFrame, this.inputDelay - 1);
    }

    isPlaying(slot: number): boolean {
        return this.leftAfter[slot] === Infinity;
    }

    /** The first frame that can't be simulated yet: some player's input for it hasn't arrived. */
    get available(): number {
        let first = Infinity;
        for (let s = 0; s < this.players; s++) {
            // A player who left holds nothing up past their last frame
            if (this.leftAfter[s] !== Infinity && this.next[s] > this.leftAfter[s]) continue;
            first = Math.min(first, this.next[s]);
        }
        return first;
    }

    /** Frames received but not yet simulated. */
    get behind(): number {
        return Math.max(0, Math.min(this.available, this.frame + 100000) - this.frame);
    }

    /** Simulates the next frame if every input for it is here; its events go to `events`. */
    step(events: MatchEvent[]): boolean {
        if (this.frame >= this.available) return false;
        const f = this.frame;
        this.onFrame?.(f, this.match);
        const frameInputs: FighterInput[] = [];
        for (let s = 0; s < this.players; s++) {
            const gone = f > this.leftAfter[s];
            if (gone) retireFighter(this.match, s);
            const mask = f < this.inputDelay || gone ? 0 : this.inputs[s][f];
            frameInputs.push(unpackInput(mask));
        }
        stepMatch(this.match, frameInputs, events);
        this.frame++;
        return true;
    }
}
