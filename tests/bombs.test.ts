/**
 * Bombs: drops, picking up (light attack or throw), throws charged with any
 * attack and flying almost straight in 8 directions, armed and safe,
 * explosions (the thrower too, and overcharging in the hand), catches,
 * dropping one when hit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { BombState } from '../shared/Bombs.ts';
import { SIM_STEP_MS } from '../shared/FixedStepClock.ts';
import { createMatch, stepMatch, type MatchState } from '../shared/GameSim.ts';
import { emptyInput, type FighterInput } from '../shared/FighterInput.ts';
import type { MatchEvent } from '../shared/MatchEvents.ts';
import { PhysicsConfig } from '../shared/PhysicsConfig.ts';
import { STAGE_LAYOUTS } from '../shared/StageData.ts';

const GROUND_Y = 870 - PhysicsConfig.PLAYER_HEIGHT / 2;

function newMatch(x0 = 700, x1 = 1300, bombs = true): MatchState {
    const match = createMatch([{ character: 'fok', x: x0, y: GROUND_Y }, { character: 'fok', x: x1, y: GROUND_Y }], 1, 'standard', bombs);
    for (let i = 0; i < 5; i++) step(match);
    return match;
}

function step(match: MatchState, a: Partial<FighterInput> = {}, b: Partial<FighterInput> = {}, events: MatchEvent[] = []): void {
    stepMatch(match, [{ ...emptyInput(), ...a }, { ...emptyInput(), ...b }], events);
}

function steps(match: MatchState, count: number, a: Partial<FighterInput> = {}): void {
    for (let i = 0; i < count; i++) step(match, a);
}

/** A loose, safe bomb resting at (x, y). */
function placeBomb(match: MatchState, x: number, y = 870 - PhysicsConfig.BOMB_RADIUS): BombState {
    const bomb: BombState = { id: 99, x, y, vx: 0, vy: 0, holder: -1, thrower: -1, armed: false, graceSteps: 0, lifeSteps: 600, charge: -1, aimX: 0, aimY: 0, flightSteps: 0 };
    match.bombs!.list.push(bomb);
    return bomb;
}

/** Fighter 1 throws the bomb it holds: press, hold `chargeSteps`, let go aiming `aim`. */
function throwHeld(match: MatchState, aim: Partial<FighterInput> = {}, chargeSteps = 0): void {
    step(match, { throw: true, throwHeld: true, ...aim });
    for (let i = 0; i < chargeSteps; i++) step(match, { throwHeld: true, ...aim });
    step(match, aim);
}

test('the first bomb drops in after BOMB_FIRST and comes to rest on a platform', () => {
    const match = newMatch();
    const drop = Math.round(PhysicsConfig.BOMB_FIRST / SIM_STEP_MS);
    for (let i = 5; i < drop - 2; i++) step(match);
    assert.equal(match.bombs!.list.length, 0, 'not yet');
    for (let i = 0; i < 180; i++) step(match);
    const [bomb] = match.bombs!.list;
    assert.ok(bomb, 'dropped');
    const tops = STAGE_LAYOUTS.standard.platforms.map(p => p.y - p.h / 2 - PhysicsConfig.BOMB_RADIUS);
    assert.ok(tops.includes(bomb.y) && bomb.vy === 0, `resting on a platform (y ${bomb.y})`);
    assert.equal(bomb.armed, false);
});

test('no bombs in a match made without them', () => {
    const match = newMatch(700, 1300, false);
    for (let i = 0; i < Math.round(PhysicsConfig.BOMB_FIRST / SIM_STEP_MS) + 120; i++) step(match);
    assert.equal(match.bombs, null);
});

test('throw picks a bomb up and throws it armed; it explodes on the fighter it touches', () => {
    const match = newMatch(700, 1100);
    const [a, b] = match.fighters;
    placeBomb(match, 730);
    step(match, { throw: true });
    const bomb = match.bombs!.list[0];
    assert.equal(bomb.holder, 0, 'picked up');
    step(match);
    throwHeld(match, { aimRight: true });
    assert.equal(bomb.holder, -1);
    assert.equal(bomb.armed, true, 'thrown: armed');
    const events: MatchEvent[] = [];
    for (let i = 0; i < 60 && match.bombs!.list.length > 0; i++) step(match, {}, {}, events);
    assert.equal(match.bombs!.list.length, 0, 'gone off');
    assert.ok(events.some(e => e.type === 'explosion'));
    assert.equal(b.damagePercent, PhysicsConfig.BOMB_DAMAGE, 'the fighter it hit');
    assert.equal(b.isHitStunned, true);
    assert.ok(b.body.vx > 0 && b.body.vy < 0, 'launched up and away from it');
    assert.equal(a.damagePercent, 0, 'the thrower was out of the blast');
});

test('a thrown bomb flies almost straight', () => {
    const match = newMatch(450, 1500);
    placeBomb(match, 480);
    step(match, { throw: true });
    step(match);
    throwHeld(match, { aimRight: true });
    const bomb = match.bombs!.list[0];
    const y0 = bomb.y;
    for (let i = 0; i < 20; i++) step(match);
    const flown = bomb.x - 480;
    assert.ok(flown > 250, `flies forward (${flown.toFixed(0)} px)`);
    assert.ok(bomb.y - y0 < flown * 0.15, `drops only a little (${(bomb.y - y0).toFixed(0)} px)`);
});

test('an armed bomb goes off near a fighter, not only on the narrow hurtbox', () => {
    const match = newMatch(700, 1100);
    const b = match.fighters[1];
    // Level with the fighter, beside the hurtbox but within the art
    const gap = PhysicsConfig.BOMB_HIT_RANGE - 4;
    const bomb = placeBomb(match, b.body.x - PhysicsConfig.HURTBOX_WIDTH / 2 - gap, b.body.y);
    Object.assign(bomb, { armed: true, thrower: 0, vx: 0, vy: 0 });
    step(match);
    assert.equal(match.bombs!.list.length, 0, 'gone off');
    assert.equal(b.damagePercent, PhysicsConfig.BOMB_DAMAGE);
});

test('a thrown bomb can be caught with throw', () => {
    const match = newMatch(700, 1000);
    const b = match.fighters[1];
    placeBomb(match, 730);
    step(match, { throw: true });
    step(match);
    throwHeld(match, { aimRight: true });
    const bomb = match.bombs!.list[0];
    // Fighter 2 presses throw as it arrives
    for (let i = 0; i < 60 && bomb.holder < 0 && match.bombs!.list.length > 0; i++) step(match, {}, { throw: i % 4 === 0 });
    assert.equal(bomb.holder, 1, 'caught');
    assert.equal(bomb.armed, false);
    assert.equal(b.damagePercent, 0);
});

test('a fighter hit while holding a bomb drops it, safe', () => {
    const match = newMatch(700, 780);
    const [a, b] = match.fighters;
    placeBomb(match, 790);
    step(match, {}, { throw: true });
    const bomb = match.bombs!.list[0];
    assert.equal(bomb.holder, 1);
    a.body.facingDirection = 1;
    step(match, { lightAttack: true, lightAttackHeld: true });
    for (let i = 0; i < 10 && !b.isHitStunned; i++) step(match);
    step(match);
    assert.equal(bomb.holder, -1, 'dropped');
    assert.equal(bomb.armed, false);
});

test('a thrown bomb that slows down after bouncing is safe again', () => {
    const match = newMatch(700, 1500);
    placeBomb(match, 730);
    step(match, { throw: true });
    step(match);
    throwHeld(match, { aimDown: true });
    const bomb = match.bombs!.list[0];
    assert.equal(bomb.armed, true);
    // Walk away from where it bounces
    for (let i = 0; i < 240 && bomb.armed; i++) step(match, { moveLeft: true });
    assert.equal(bomb.armed, false, 'safe');
    assert.equal(match.bombs!.list.length, 1, 'and still there');
});

test('light attack picks a bomb up instead of attacking', () => {
    const match = newMatch(700, 1300);
    const a = match.fighters[0];
    placeBomb(match, 730);
    step(match, { lightAttack: true, lightAttackHeld: true });
    assert.equal(match.bombs!.list[0].holder, 0, 'picked up');
    assert.equal(a.isAttacking, false, 'no attack came out');
});

test('holding a bomb, light or heavy charges a throw instead of attacking, like a heavy', () => {
    for (const [press, held] of [['lightAttack', 'lightAttackHeld'], ['heavyAttack', 'heavyAttackHeld']] as const) {
        const match = newMatch(700, 1500);
        const a = match.fighters[0];
        placeBomb(match, 730);
        step(match, { throw: true });
        step(match);
        const bomb = match.bombs!.list[0];
        step(match, { [press]: true, [held]: true, aimRight: true });
        steps(match, 20, { [held]: true, moveRight: true });
        assert.equal(a.isAttacking, false, `${press}: no attack`);
        assert.ok(bomb.charge > 0 && bomb.holder === 0, `${press}: charging`);
        assert.ok(Math.abs(a.body.vx) < 50, `${press}: all but still while charging`);
        step(match, { aimRight: true });
        assert.equal(bomb.holder, -1, `${press}: thrown on letting go`);
        assert.ok(bomb.armed && bomb.vx > 0);
    }
});

test('a charged throw goes faster than a tapped one, the way the thrower aims as they let go', () => {
    const speedOf = (chargeSteps: number, aim: Partial<FighterInput>) => {
        const match = newMatch(700, 1500);
        placeBomb(match, 730);
        step(match, { throw: true });
        step(match);
        throwHeld(match, aim, chargeSteps);
        const bomb = match.bombs!.list[0];
        return { vx: bomb.vx, vy: bomb.vy, speed: Math.hypot(bomb.vx, bomb.vy) };
    };
    const tapped = speedOf(0, { aimRight: true });
    const charged = speedOf(Math.round(PhysicsConfig.BOMB_CHARGE_FULL / SIM_STEP_MS), { aimRight: true });
    assert.ok(Math.abs(charged.vy) < 1, 'straight ahead');
    assert.ok(charged.speed > tapped.speed * 1.5, `charged ${charged.speed.toFixed(0)}, tapped ${tapped.speed.toFixed(0)}`);
    const diagonal = speedOf(10, { aimRight: true, aimUp: true });
    assert.ok(diagonal.vx > 0 && diagonal.vy < 0 && Math.abs(diagonal.vx + diagonal.vy) < 80, 'up and forward at 45°');
});

test('8 directions, from the last direction held while charging (released with nothing held)', () => {
    const dirs: [Partial<FighterInput>, number, number][] = [
        [{ aimRight: true }, 1, 0], [{ aimLeft: true }, -1, 0], [{ aimUp: true }, 0, -1], [{ aimDown: true }, 0, 1],
        [{ aimUp: true, aimRight: true }, 1, -1], [{ aimUp: true, aimLeft: true }, -1, -1],
        [{ moveDown: true, moveRight: true }, 1, 1], [{ moveDown: true, moveLeft: true }, -1, 1],
    ];
    for (const [aim, sx, sy] of dirs) {
        const match = newMatch(900, 1500);
        placeBomb(match, 930);
        step(match, { throw: true });
        step(match);
        step(match, { throw: true, throwHeld: true });
        steps(match, 10, { throwHeld: true, ...aim });
        steps(match, 5, { throwHeld: true });
        step(match);
        const bomb = match.bombs!.list[0];
        // (a step of gravity aside)
        const sign = (v: number) => (Math.abs(v) < 100 ? 0 : Math.sign(v));
        assert.equal(sign(bomb.vx), sx, `${JSON.stringify(aim)}: x`);
        assert.equal(sign(bomb.vy), sy, `${JSON.stringify(aim)}: y`);
    }
});

test('a throw up comes back down soon', () => {
    const match = newMatch(450, 1500);
    placeBomb(match, 480);
    step(match, { throw: true });
    step(match);
    throwHeld(match, { aimUp: true }, Math.round(PhysicsConfig.BOMB_CHARGE_FULL / SIM_STEP_MS));
    const bomb = match.bombs!.list[0];
    let steps = 0;
    while (bomb.vy < 0 && steps < 300) { step(match); steps++; }
    assert.ok(steps < 75, `at the top after ${steps} steps`);
});

test('a throw charged too long blows up in the holder\'s hand', () => {
    const match = newMatch(700, 1500);
    const a = match.fighters[0];
    placeBomb(match, 730);
    step(match, { throw: true });
    step(match);
    const events: MatchEvent[] = [];
    step(match, { throw: true, throwHeld: true });
    for (let i = 0; i < Math.round(PhysicsConfig.BOMB_OVERCHARGE / SIM_STEP_MS) + 2 && match.bombs!.list.length > 0; i++) {
        step(match, { throwHeld: true }, {}, events);
    }
    assert.equal(match.bombs!.list.length, 0, 'gone off');
    assert.ok(events.some(e => e.type === 'explosion'));
    assert.equal(a.damagePercent, PhysicsConfig.BOMB_DAMAGE);
    assert.equal(a.isHitStunned, true);
});

