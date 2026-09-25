import type { FighterSetup } from '../../shared/FighterState';
import { packInput, type FighterInput } from '../../shared/FighterInput';
import { fighterParityValues, type MatchState } from '../../shared/GameSim';
import { hashValues } from '../../shared/StateHash';

/**
 * Dev tool: records a local match from its first step — the seed, each
 * fighter's input and a hash of its state per step — so tests/sim.test.ts can
 * replay it and check the simulation still produces the same match. Enabled
 * with `?record` in the URL; F9 saves it to tests/replays/.
 */
export class MatchRecorder {
    private readonly fighters: readonly FighterSetup[];
    private readonly seed: number;
    private readonly inputs: number[][] = [];
    private readonly hashes: number[][] = [];
    private stopped = false;

    constructor(fighters: readonly FighterSetup[], seed: number) {
        this.fighters = fighters.map(setup => ({ ...setup }));
        this.seed = seed;
    }

    captureStep(match: MatchState, inputs: readonly FighterInput[]): void {
        if (this.stopped) return;
        if (match.fighters.length !== this.fighters.length) {
            // A replay starts from the recorded fighters only
            console.warn('[MatchRecorder] A fighter joined mid-match; recording stopped here.');
            this.stopped = true;
            return;
        }
        this.inputs.push(inputs.map(input => packInput(input)));
        this.hashes.push(match.fighters.map(f => hashValues(fighterParityValues(f))));
    }

    /** Saves the match so far through the dev server (vite.config.ts) and returns the file name. */
    async save(): Promise<string> {
        const recording = { version: 1, seed: this.seed, fighters: this.fighters, inputs: this.inputs, hashes: this.hashes };
        const response = await fetch('/__save-replay', { method: 'POST', body: JSON.stringify(recording) });
        const file = await response.text();
        console.log(`[MatchRecorder] Saved tests/replays/${file} (${this.inputs.length} steps)`);
        return file;
    }
}
