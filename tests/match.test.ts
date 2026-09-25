/**
 * KOs, respawns and the end of a match.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMatch, stepMatch, type MatchState } from '../shared/GameSim.ts';
import { emptyInput } from '../shared/FighterInput.ts';
import { isInPlay } from '../shared/FighterState.ts';
import { STAGE_LAYOUT } from '../shared/StageData.ts';

const noInput = [emptyInput(), emptyInput()];

function newMatch(seed: number): MatchState {
    return createMatch([{ character: 'fok', x: 880, y: 300 }, { character: 'fok', x: 1040, y: 300 }], seed);
}

function run(match: MatchState, steps: number): void {
    for (let i = 0; i < steps; i++) stepMatch(match, noInput);
}

/** Moves fighter `id` past the left blast zone. */
function launch(match: MatchState, id: number): void {
    match.fighters[id].body.x = STAGE_LAYOUT.blastZones.left - 200;
}

/** KOs fighter `id` and runs until it is back in play: the KO step, then 120 more. */
function koAndRespawn(match: MatchState, id: number): void {
    launch(match, id);
    run(match, 1 + 120);
}

test('a KO costs a life and 2 s out of play', () => {
    const match = newMatch(1);
    const f = match.fighters[0];
    f.damagePercent = 80;

    launch(match, 0);
    run(match, 1);
    assert.equal(f.lives, 2);
    assert.equal(isInPlay(f), false);
    assert.equal(match.isOver, false);

    run(match, 119);
    assert.equal(isInPlay(f), false);
    run(match, 1);
    assert.equal(isInPlay(f), true, 'back in play on the 120th step after the KO');
    assert.equal(f.damagePercent, 0);
    assert.equal(f.isInvulnerable, true);
    assert.ok(Number.isInteger(f.body.x) && Math.abs(f.body.x - 960) <= 50, `respawned at x = ${f.body.x}`);
});

test('the respawn point comes from the seed', () => {
    const respawnX = (seed: number) => {
        const match = newMatch(seed);
        koAndRespawn(match, 0);
        return match.fighters[0].body.x;
    };
    assert.equal(respawnX(7), respawnX(7));
    assert.notEqual(respawnX(7), respawnX(8));
});

test('blast zones ignore a fighter for 1.5 s after it respawns', () => {
    const match = newMatch(1);
    const f = match.fighters[0];
    koAndRespawn(match, 0);
    assert.equal(isInPlay(f), true);

    launch(match, 0);
    run(match, 88);
    assert.equal(f.lives, 2);
    run(match, 1);
    assert.equal(f.lives, 1);
});

test('losing the last life ends the match', () => {
    const match = newMatch(1);
    match.fighters[1].lives = 1;
    launch(match, 1);
    run(match, 1);
    assert.equal(match.isOver, true);
    assert.equal(match.winnerId, 0);

    const frame = match.frame;
    run(match, 10);
    assert.equal(match.frame, frame, 'a finished match no longer steps');
});

test('a double KO on the last lives is a draw', () => {
    const match = newMatch(1);
    for (const f of match.fighters) f.lives = 1;
    launch(match, 0);
    launch(match, 1);
    run(match, 1);
    assert.equal(match.isOver, true);
    assert.equal(match.winnerId, -1);
});
