/**
 * Movement rules taken from Brawlhalla: falling, fast fall, dash and dash
 * jump, dodges and their cooldowns, chase dodge, gravity cancel, walls, and
 * what a hit does to the fighter who takes it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AttackPhase } from '../shared/AttackData.ts';
import { checkHit } from '../shared/Combat.ts';
import { countDown, SIM_STEP_MS } from '../shared/FixedStepClock.ts';
import { createMatch, stepMatch, type MatchState } from '../shared/GameSim.ts';
import { emptyInput, type FighterInput } from '../shared/FighterInput.ts';
import type { FighterState } from '../shared/FighterState.ts';
import { PhysicsConfig } from '../shared/PhysicsConfig.ts';

/** Standing on the main stage (top at y = 870). */
const GROUND_Y = 870 - PhysicsConfig.PLAYER_HEIGHT / 2;

function newMatch(x0 = 700, x1 = 1300): MatchState {
    const match = createMatch([{ character: 'fok', x: x0, y: GROUND_Y }, { character: 'fok', x: x1, y: GROUND_Y }], 1);
    for (let i = 0; i < 5; i++) step(match);
    return match;
}

/** One step with fighter 0's input `a` and fighter 1's input `b`. */
function step(match: MatchState, a: Partial<FighterInput> = {}, b: Partial<FighterInput> = {}): void {
    stepMatch(match, [{ ...emptyInput(), ...a }, { ...emptyInput(), ...b }]);
}

function steps(match: MatchState, count: number, a: Partial<FighterInput> = {}, b: Partial<FighterInput> = {}): void {
    for (let i = 0; i < count; i++) step(match, a, b);
}

/** Jumps and rises until the fighter is well off the ground. */
function jump(match: MatchState): void {
    step(match, { jump: true, jumpHeld: true });
    steps(match, 10, { jumpHeld: true });
}

/** Fighter 0 lands a neutral light on fighter 1, standing 80 px to its right. */
function hitWithLight(match: MatchState): void {
    landLight(match);
    // Then out of the hit-stop
    while (match.fighters[0].hitstopSteps > 0 || match.fighters[1].hitstopSteps > 0) step(match);
}

/** Fighter 0's neutral light lands on fighter 1; both are in hit-stop. */
function landLight(match: MatchState): void {
    step(match, { lightAttack: true, lightAttackHeld: true });
    for (let i = 0; i < 10 && !match.fighters[1].isHitStunned; i++) step(match);
    assert.equal(match.fighters[1].isHitStunned, true, 'the light attack hits');
}

/** Fighter 0 high above the main stage. */
function high(match: MatchState): FighterState {
    const f = match.fighters[0];
    f.body.y = -400;
    f.body.isGrounded = false;
    return f;
}

test('gravity accelerates a fall only up to MAX_FALL_SPEED', () => {
    const match = newMatch(500);
    const f = high(match);
    let fastest = 0;
    for (let i = 0; i < 120 && !f.body.isGrounded; i++) {
        step(match);
        fastest = Math.max(fastest, f.body.vy);
    }
    assert.equal(fastest, PhysicsConfig.MAX_FALL_SPEED);
    assert.equal(f.body.isGrounded, true);
});

test('holding down while descending fast falls, and releasing eases back', () => {
    const match = newMatch(500);
    const f = high(match);
    step(match, { moveDown: true });
    assert.equal(f.body.isFastFalling, true);
    assert.ok(f.body.vy >= PhysicsConfig.FAST_FALL_SPEED, `starts at ${f.body.vy}`);

    let fastest = 0;
    for (let i = 0; i < 30; i++) {
        step(match, { moveDown: true });
        fastest = Math.max(fastest, f.body.vy);
    }
    assert.equal(fastest, PhysicsConfig.MAX_FAST_FALL_SPEED);

    step(match);
    assert.equal(f.body.isFastFalling, false);
    assert.ok(f.body.vy < PhysicsConfig.MAX_FAST_FALL_SPEED && f.body.vy > PhysicsConfig.MAX_FALL_SPEED, `eases back: ${f.body.vy}`);
});

test('a dash is fast, not invincible, and takes no dodge cooldown', () => {
    const match = newMatch();
    const f = match.fighters[0];
    const startX = f.body.x;
    step(match, { dodge: true, dodgeHeld: true, moveRight: true });
    assert.equal(f.state, 'Dash');
    assert.equal(f.body.isInvincible, false);
    assert.equal(f.body.vx, PhysicsConfig.DASH_SPEED);

    let dashedTo = f.body.x;
    for (let i = 0; i < 20 && f.body.isDashing; i++) {
        dashedTo = f.body.x;
        step(match, { moveRight: true });
    }
    assert.equal(f.state, 'Run');
    assert.equal(f.body.dodgeCooldownTimer <= 0, true);
    const distance = dashedTo - startX;
    assert.equal(distance, PhysicsConfig.DASH_SPEED * PhysicsConfig.DASH_DURATION / 1000);
});

test('dashing back the other way is immediate, the same way waits', () => {
    const match = newMatch();
    const f = match.fighters[0];
    step(match, { dodge: true, dodgeHeld: true, moveRight: true });
    step(match, { moveRight: true });
    step(match, { dodge: true, dodgeHeld: true, moveRight: true });
    assert.equal(f.body.vx, PhysicsConfig.DASH_SPEED, 'still the first dash');
    step(match, { dodge: true, dodgeHeld: true, moveLeft: true });
    assert.equal(f.body.vx, -PhysicsConfig.DASH_SPEED);
});

test('a jump out of a dash is low, fast and carries on further', () => {
    const dashJump = newMatch();
    const f = dashJump.fighters[0];
    step(dashJump, { dodge: true, dodgeHeld: true, moveRight: true });
    step(dashJump, { jump: true, jumpHeld: true, moveRight: true });
    assert.equal(f.body.vy > PhysicsConfig.DASH_JUMP_FORCE - 1 && f.body.vy < 0, true, `rising at ${f.body.vy}`);
    assert.ok(f.body.vx > PhysicsConfig.DASH_JUMP_SPEED * 0.95, `moving at ${f.body.vx}`);
    assert.equal(f.body.hasDashMomentum, true);

    let top = f.body.y;
    const startX = f.body.x;
    for (let i = 0; i < 90 && !f.body.isGrounded; i++) {
        step(dashJump, { jumpHeld: true, moveRight: true });
        top = Math.min(top, f.body.y);
    }
    const dashJumpDistance = f.body.x - startX;

    const plain = newMatch();
    const g = plain.fighters[0];
    step(plain, { jump: true, jumpHeld: true, moveRight: true });
    let plainTop = g.body.y;
    for (let i = 0; i < 90 && !g.body.isGrounded; i++) {
        step(plain, { jumpHeld: true, moveRight: true });
        plainTop = Math.min(plainTop, g.body.y);
    }

    assert.ok(GROUND_Y - top < (GROUND_Y - plainTop) * 0.6, `dash jump height ${GROUND_Y - top}, jump ${GROUND_Y - plainTop}`);
    assert.ok(dashJumpDistance > 350, `dash jump covers ${dashJumpDistance} px`);
});

test('a dodge on the ground without a direction is an invincible spot dodge with the ground cooldown', () => {
    const match = newMatch();
    const f = match.fighters[0];
    step(match, { dodge: true, dodgeHeld: true });
    assert.equal(f.state, 'Dodge');
    assert.equal(f.body.isSpotDodging, true);
    assert.equal(f.body.isInvincible, true);
    steps(match, 20);
    assert.equal(f.body.isDodging, false);
    assert.ok(f.body.dodgeCooldownTimer > PhysicsConfig.DODGE_COOLDOWN - 100, `cooldown ${f.body.dodgeCooldownTimer}`);
});

test('air dodges go in 8 directions and float', () => {
    const up = newMatch();
    const f = up.fighters[0];
    jump(up);
    const y = f.body.y;
    step(up, { dodge: true, dodgeHeld: true, moveUp: true });
    assert.equal(f.state, 'AirDodge');
    const speed = PhysicsConfig.AIR_DODGE_DISTANCE / (PhysicsConfig.AIR_DODGE_DURATION / 1000);
    assert.equal(f.body.vy, -speed);
    assert.equal(f.body.vx, 0);
    steps(up, 11);
    assert.ok(Math.abs((y - f.body.y) - PhysicsConfig.AIR_DODGE_DISTANCE) < 25, `rose ${y - f.body.y} px`);

    const diagonal = newMatch();
    const g = diagonal.fighters[0];
    jump(diagonal);
    step(diagonal, { dodge: true, dodgeHeld: true, moveDown: true, moveLeft: true });
    assert.equal(g.body.vx, -speed * Math.SQRT1_2);
    assert.equal(g.body.vy, speed * Math.SQRT1_2);
});

test('the air dodge cooldown is long, and landing shortens it', () => {
    const match = newMatch();
    const f = match.fighters[0];
    jump(match);
    step(match, { dodge: true, dodgeHeld: true, moveRight: true });
    for (let i = 0; i < 20 && f.body.isDodging; i++) step(match);
    assert.equal(f.body.isDodging, false);
    assert.equal(f.body.isGrounded, false);
    assert.ok(f.body.dodgeCooldownTimer > PhysicsConfig.AIR_DODGE_COOLDOWN - 100, `cooldown ${f.body.dodgeCooldownTimer}`);

    const sinceDodge = PhysicsConfig.AIR_DODGE_COOLDOWN - f.body.dodgeCooldownTimer;
    let landedAfter = sinceDodge;
    for (let i = 0; i < 120 && !f.body.isGrounded; i++) {
        step(match);
        landedAfter += 1000 / 60;
    }
    assert.equal(f.body.isGrounded, true);
    const expected = Math.max(0, PhysicsConfig.LANDED_AIR_DODGE_COOLDOWN - landedAfter);
    assert.ok(Math.abs(f.body.dodgeCooldownTimer - expected) < 40, `cooldown ${f.body.dodgeCooldownTimer}, expected about ${expected}`);
});

test('a stunned fighter can not jump, dodge or steer', () => {
    const match = newMatch(700, 780);
    const target = match.fighters[1];
    hitWithLight(match);
    const vy = target.body.vy;
    const vx = target.body.vx;
    step(match, {}, { jump: true, jumpHeld: true, moveLeft: true });
    assert.equal(target.state, 'HitStun');
    assert.ok(target.body.vy > vy, 'no jump: gravity keeps pulling');
    assert.ok(Math.abs(target.body.vx) <= Math.abs(vx), 'no steering');
    step(match, {}, { dodge: true, dodgeHeld: true });
    assert.equal(target.body.isDodging, false);
});

test('a hit gives a fighter out of jumps one back', () => {
    const match = newMatch(700, 780);
    const [attacker, target] = match.fighters;
    target.body.isGrounded = false;
    target.body.jumpsRemaining = 0;
    attacker.combat.attack = { key: 'light_neutral_grounded', phase: AttackPhase.ACTIVE, phaseTimer: 0, facing: 1 };
    attacker.isAttacking = true;
    Object.assign(attacker.combat.hitbox, { active: true, x: target.body.x, y: target.body.y, w: 50, h: 50 });
    checkHit(attacker, target, []);
    assert.equal(target.isHitStunned, true);
    assert.equal(target.body.jumpsRemaining, 1);
});

test('a hit opens a chase dodge: it cancels the attack, costs no cooldown, and is invincible only at first', () => {
    const match = newMatch(700, 780);
    const f = match.fighters[0];
    hitWithLight(match);
    assert.equal(f.isAttacking, true);
    assert.ok(f.combat.chaseDodgeTimer > 0);

    step(match, { dodge: true, dodgeHeld: true, moveRight: true });
    assert.equal(f.state, 'Dodge');
    assert.equal(f.body.isChaseDodging, true);
    assert.equal(f.isAttacking, false, 'the attack is cut short');
    assert.equal(f.body.isInvincible, true);

    steps(match, Math.ceil(PhysicsConfig.CHASE_DODGE_INVINCIBLE / (1000 / 60)) + 1);
    assert.equal(f.body.isDodging, true);
    assert.equal(f.body.isInvincible, false, 'vulnerable for the rest of it');

    steps(match, 10);
    assert.equal(f.body.isDodging, false);
    assert.equal(f.body.dodgeCooldownTimer <= 0, true);
});

test('an attack cancels a chase dodge', () => {
    const match = newMatch(700, 780);
    const f = match.fighters[0];
    hitWithLight(match);
    step(match, { dodge: true, dodgeHeld: true, moveRight: true });
    step(match, { moveRight: true });
    step(match, { lightAttack: true, lightAttackHeld: true, moveRight: true, aimRight: true });
    assert.equal(f.state, 'Attack');
    assert.equal(f.body.isDodging, false);
    assert.equal(f.combat.attack?.key, 'light_side_grounded', 'the aimed attack, not the running one');
});

test('without a hit, an attack can not be dodge cancelled', () => {
    const match = newMatch();
    const f = match.fighters[0];
    step(match, { lightAttack: true, lightAttackHeld: true });
    step(match, { dodge: true, dodgeHeld: true, moveRight: true });
    assert.equal(f.body.isDodging, false);
    assert.equal(f.body.isDashing, false);
    assert.equal(f.state, 'Attack');
});

test('gravity cancel: an attack out of an aerial spot dodge is the grounded move, and keeps the full air cooldown', () => {
    const match = newMatch();
    const f = match.fighters[0];
    jump(match);
    step(match, { dodge: true, dodgeHeld: true });
    assert.equal(f.body.isSpotDodging, true);
    step(match, { lightAttack: true, lightAttackHeld: true });
    assert.equal(f.state, 'Attack');
    assert.equal(f.combat.attack?.key, 'light_neutral_grounded');
    assert.equal(f.body.isGrounded, false);
    assert.equal(f.body.isDodging, false);

    for (let i = 0; i < 120 && !f.body.isGrounded; i++) step(match);
    assert.equal(f.body.isGrounded, true);
    assert.ok(f.body.dodgeCooldownTimer > PhysicsConfig.LANDED_AIR_DODGE_COOLDOWN, `cooldown ${f.body.dodgeCooldownTimer}`);
});

/** Fighter 0 in the air against the left side of the main stage. */
function onWall(match: MatchState): FighterState {
    const f = match.fighters[0];
    f.body.x = 370;
    f.body.y = 1000;
    f.body.vy = 0;
    f.body.isGrounded = false;
    return f;
}

test('a wall gives back the air jumps and the recovery', () => {
    const match = newMatch();
    const f = onWall(match);
    f.body.jumpsRemaining = 0;
    f.body.recoveryAvailable = false;
    steps(match, 2, { moveRight: true });
    assert.equal(f.body.isWallSliding, true);
    assert.equal(f.body.jumpsRemaining, PhysicsConfig.MAX_JUMPS - 1);
    assert.equal(f.body.recoveryAvailable, true);
});

test('after MAX_AIR_ACTIONS air actions, walls stop holding the fighter', () => {
    const match = newMatch();
    const f = onWall(match);
    f.body.jumpsRemaining = 0;
    f.body.airActionCounter = PhysicsConfig.MAX_AIR_ACTIONS;
    steps(match, 2, { moveRight: true });
    assert.equal(f.body.isWallSliding, false);
    assert.equal(f.body.jumpsRemaining, 0);
    const vy = f.body.vy;
    step(match, { jump: true, jumpHeld: true, moveRight: true });
    assert.ok(f.body.vy > vy, 'no wall jump');
});

test('a hit freezes both fighters for a moment, longer for harder hits', () => {
    const match = newMatch(700, 780);
    const [attacker, target] = match.fighters;
    landLight(match);
    const expected = PhysicsConfig.HITSTOP_MIN_STEPS + Math.round(4 * PhysicsConfig.HITSTOP_PER_DAMAGE);
    assert.equal(attacker.hitstopSteps, expected);
    assert.equal(target.hitstopSteps, expected);

    // Frozen: the knockback waits, the attack doesn't advance, and the stun doesn't count down
    const at = { x: target.body.x, y: target.body.y, stun: target.hitStunTimer, phase: attacker.combat.attack?.phaseTimer };
    step(match);
    assert.deepEqual({ x: target.body.x, y: target.body.y, stun: target.hitStunTimer, phase: attacker.combat.attack?.phaseTimer }, at);

    steps(match, expected);
    assert.equal(target.hitstopSteps, 0);
    assert.notEqual(target.body.x, at.x, 'flying once it ends');

    // A signature hit lands harder, so it freezes longer
    const heavy = Math.min(PhysicsConfig.HITSTOP_MAX_STEPS,
        PhysicsConfig.HITSTOP_MIN_STEPS + Math.round(PhysicsConfig.SIDE_SIG_MAX_DAMAGE * PhysicsConfig.HITSTOP_PER_DAMAGE));
    assert.ok(heavy > expected);
});

test('presses during hit-stop wait for it to end', () => {
    const match = newMatch(700, 780);
    const attacker = match.fighters[0];
    landLight(match);
    step(match, { dodge: true, dodgeHeld: true, moveRight: true });
    assert.equal(attacker.body.isDodging, false, 'still frozen');
    while (attacker.hitstopSteps > 0) step(match, { moveRight: true });
    step(match, { moveRight: true });
    assert.equal(attacker.body.isChaseDodging, true, 'the chase dodge pressed during the freeze comes out');
});

/** Fighter 0 stunned in the air above the main stage, its stun about to run out, moving at (vx, vy). */
function stunned(match: MatchState, vx: number, vy: number, y = 500): FighterState {
    const f = match.fighters[0];
    Object.assign(f.body, { x: 900, y, vx, vy, isGrounded: false });
    f.isHitStunned = true;
    f.hitStunTimer = 1;
    f.state = 'HitStun';
    return f;
}

test('stun lasts while flying fast across, not while falling', () => {
    const across = newMatch();
    const f = stunned(across, 3000, -200);
    step(across);
    assert.equal(f.isHitStunned, true, 'still flying fast');
    for (let i = 0; i < 60 && f.isHitStunned; i++) step(across);
    assert.equal(f.isHitStunned, false);
    assert.ok(Math.abs(f.body.vx) <= PhysicsConfig.STUN_FLYING_SPEED, `ends once slower, at ${f.body.vx}`);

    const falling = newMatch();
    const g = stunned(falling, 0, 1700, 0);
    step(falling);
    assert.equal(g.isHitStunned, false, 'a fast fall is not flying');
});

test('stun never lasts past its limit', () => {
    const match = newMatch();
    const f = stunned(match, 0, -3000, 300);
    f.hitStunTimer = PhysicsConfig.HIT_STUN_DURATION - PhysicsConfig.MAX_HIT_STUN + 1;
    f.body.vy = -3000;
    step(match);
    assert.equal(f.isHitStunned, false);
});

test('a stunned fighter bounces off the floor and walls', () => {
    const floor = newMatch();
    const f = stunned(floor, 0, 1500, 770);
    f.hitStunTimer = 500;
    step(floor);
    assert.ok(f.body.vy < 0, `bounced up at ${f.body.vy}`);
    assert.equal(f.body.isGrounded, false);

    const wall = newMatch();
    const g = stunned(wall, 1500, 0, 1000);
    g.hitStunTimer = 500;
    // Just left of the main stage's left side
    g.body.x = 360;
    step(wall);
    assert.ok(g.body.vx < 0, `bounced back at ${g.body.vx}`);
});

test('a second recovery before landing is weaker and costs an air jump', () => {
    const match = newMatch();
    const f = match.fighters[0];
    jump(match);
    step(match, { heavyAttack: true, heavyAttackHeld: true, aimUp: true });
    assert.equal(f.state, 'Recovery');
    const first = f.body.vy;
    for (let i = 0; i < 40 && f.body.isRecovering; i++) step(match);
    steps(match, 10);
    const jumps = f.body.jumpsRemaining;
    step(match, { heavyAttack: true, heavyAttackHeld: true, aimUp: true });
    assert.equal(f.state, 'Recovery');
    assert.equal(f.body.jumpsRemaining, jumps - 1);
    assert.ok(Math.abs(f.body.vy) < Math.abs(first) * 0.7, `weaker: ${f.body.vy} against ${first}`);

    // Out of air jumps: no more recoveries
    for (let i = 0; i < 40 && f.body.isRecovering; i++) step(match);
    f.body.jumpsRemaining = 0;
    steps(match, 10);
    step(match, { heavyAttack: true, heavyAttackHeld: true, aimUp: true });
    assert.notEqual(f.state, 'Recovery');
});

/** Fighter 0 standing on the top soft platform. */
function onSoftPlatform(match: MatchState): FighterState {
    const f = match.fighters[0];
    Object.assign(f.body, { x: 960, y: 460 - PhysicsConfig.PLAYER_HEIGHT / 2, vx: 0, vy: 0 });
    steps(match, 5);
    assert.equal(f.body.currentPlatformIdx, 2, 'standing on the soft platform');
    return f;
}

test('holding down drops through a soft platform; a quick tap does not', () => {
    const tap = newMatch();
    const f = onSoftPlatform(tap);
    steps(tap, PhysicsConfig.DROP_HOLD_STEPS - 1, { moveDown: true });
    steps(tap, 10);
    assert.equal(f.body.currentPlatformIdx, 2, 'still on it after a tap');

    const hold = newMatch();
    const g = onSoftPlatform(hold);
    steps(hold, PhysicsConfig.DROP_HOLD_STEPS + 10, { moveDown: true });
    assert.ok(g.body.y > 460, `dropped through, at ${g.body.y}`);
});

test('landing takes a moment before the next jump, dodge or attack', () => {
    const match = newMatch();
    const f = match.fighters[0];
    jump(match);
    for (let i = 0; i < 90 && !f.body.isGrounded; i++) step(match);
    assert.equal(f.body.landingLagSteps > 0, true);
    step(match, { lightAttack: true, lightAttackHeld: true });
    assert.equal(f.isAttacking, false, 'not yet');
    // The press waits in the buffer and comes out once the landing is over
    for (let i = 0; i < PhysicsConfig.LANDING_LAG_STEPS + 1 && !f.isAttacking; i++) step(match);
    assert.equal(f.isAttacking, true);
});

test('jumping up into a platform from below stops under it, without a shove sideways', () => {
    const match = newMatch();
    const f = match.fighters[0];
    // Under the left platform, whose underside is at y 575
    Object.assign(f.body, { x: 40, y: 760, vx: 0, vy: -900, isGrounded: false });
    steps(match, 12);
    assert.equal(f.body.x, 40, 'no shove');
    assert.ok(f.body.y - PhysicsConfig.PLAYER_HEIGHT / 2 >= 575, `stopped below, head at ${f.body.y - PhysicsConfig.PLAYER_HEIGHT / 2}`);
    assert.ok(f.body.vy >= 0, 'falling again');
});

test('timers last exactly their length in steps', () => {
    for (const ms of [50, 100, 150, 200, 250, 300, 1000, 2700]) {
        let timer = ms;
        let steps = 0;
        while (timer > 0) {
            timer = countDown(timer);
            steps++;
        }
        assert.equal(steps, Math.round(ms / SIM_STEP_MS), `${ms} ms`);
    }

    // A spot dodge of 300 ms: invincible for 18 steps
    const match = newMatch();
    const f = match.fighters[0];
    step(match, { dodge: true, dodgeHeld: true });
    let dodging = 0;
    while (f.body.isDodging) {
        dodging++;
        step(match);
    }
    assert.equal(dodging, Math.round(PhysicsConfig.SPOT_DODGE_DURATION / SIM_STEP_MS));
});
