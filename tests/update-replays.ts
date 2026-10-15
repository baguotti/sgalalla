/**
 * After an intentional gameplay change: replays every recording's inputs
 * through the current simulation and stores the new per-step hashes, so
 * `npm test` checks the new rules from then on. Run with `npm run replays:update`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createMatch, fighterParityValues, stepMatch } from '../shared/GameSim.ts';
import type { FighterSetup } from '../shared/FighterState.ts';
import { unpackInput } from '../shared/FighterInput.ts';
import { hashValues } from '../shared/StateHash.ts';

interface Recording {
    version: number;
    seed: number;
    fighters: FighterSetup[];
    inputs: number[][];
    hashes: number[][];
}

const replaysDir = new URL('./replays/', import.meta.url);

for (const file of readdirSync(replaysDir).filter(name => name.endsWith('.json'))) {
    const url = new URL(file, replaysDir);
    const recording: Recording = JSON.parse(readFileSync(url, 'utf8'));
    const match = createMatch(recording.fighters, recording.seed);
    const inputs = recording.fighters.map(() => unpackInput(0));
    let changed = 0;

    recording.hashes = recording.inputs.map((masks, step) => {
        masks.forEach((mask, i) => unpackInput(mask, inputs[i]));
        stepMatch(match, inputs);
        const hashes = match.fighters.map(f => hashValues(fighterParityValues(f)));
        if (hashes.some((hash, i) => hash !== recording.hashes[step]?.[i])) changed++;
        return hashes;
    });

    writeFileSync(url, JSON.stringify(recording));
    console.log(`${file}: ${changed} of ${recording.inputs.length} steps changed`);
}
