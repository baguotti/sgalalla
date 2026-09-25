/**
 * Replays matches recorded in the running game (see src/debug/MatchRecorder.ts)
 * through GameSim and checks every fighter's state hash matches the recording
 * at every step.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { createMatch, fighterParityValues, PARITY_FIELDS, stepMatch } from '../shared/GameSim.ts';
import type { FighterSetup } from '../shared/FighterState.ts';
import { unpackInput } from '../shared/FighterInput.ts';
import { hashValues } from '../shared/StateHash.ts';

interface Recording {
    seed: number;
    fighters: FighterSetup[];
    inputs: number[][];
    hashes: number[][];
}

const replaysDir = new URL('./replays/', import.meta.url);

for (const file of readdirSync(replaysDir).filter(name => name.endsWith('.json'))) {
    test(`${file} replays exactly`, () => {
        const recording: Recording = JSON.parse(readFileSync(new URL(file, replaysDir), 'utf8'));
        const match = createMatch(recording.fighters, recording.seed);
        const inputs = recording.fighters.map(() => unpackInput(0));

        recording.inputs.forEach((masks, step) => {
            masks.forEach((mask, i) => unpackInput(mask, inputs[i]));
            stepMatch(match, inputs);

            for (const fighter of match.fighters) {
                const values = fighterParityValues(fighter);
                if (hashValues(values) !== recording.hashes[step][fighter.id]) {
                    const state = PARITY_FIELDS.map((name, k) => `  ${name} = ${values[k]}`).join('\n');
                    assert.fail(`Fighter ${fighter.id} differs from the recording at step ${step}. Replayed state:\n${state}`);
                }
            }
        });
    });
}
