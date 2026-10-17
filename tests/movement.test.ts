/**
 * Movement rules taken from Brawlhalla: quick starts and stops, momentum in
 * the air, short hops, falling, fast fall, dash and dash jump, dodges and
 * their cooldowns, chase dodge, gravity cancel, walls, and what a hit does to
 * the fighter who takes it (a launch that glides and outlasts the stun).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AttackPhase, AttackRegistry } from '../shared/AttackData.ts';
import { applyHit, findHit } from '../shared/Combat.ts';
import { countDown, SIM_STEP_MS } from '../shared/FixedStepClock.ts';
import { createMatch, stepMatch, type MatchState } from '../shared/GameSim.ts';
import { emptyInput, type FighterInput } from '../shared/FighterInput.ts';
import type { FighterState } from '../shared/FighterState.ts';
import { PhysicsConfig } from '../shared/PhysicsConfig.ts';
import { STAGE_LAYOUTS } from '../shared/StageData.ts';

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
    assert.ok(dashJumpDistance > 1.5 * PhysicsConfig.PLAYER_HEIGHT, `dash jump covers ${dashJumpDistance} px`);
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
    applyHit(findHit(attacker, target)!, []);
    assert.equal(target.isHitStunned, true);
    assert.equal(target.body.jumpsRemaining, 1);
});

test('two fighters hitting each other on the same step both get hit, whatever their slots', () => {
    const match = newMatch(700, 780);
    const [a, b] = match.fighters;
    a.body.facingDirection = 1;
    b.body.facingDirection = -1;
    step(match, { lightAttack: true, lightAttackHeld: true }, { lightAttack: true, lightAttackHeld: true });
    for (let i = 0; i < 10 && !a.isHitStunned && !b.isHitStunned; i++) step(match);
    assert.equal(a.isHitStunned, true, 'fighter 1 hit');
    assert.equal(b.isHitStunned, true, 'fighter 2 hit');
    assert.equal(a.damagePercent, b.damagePercent);
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

/** Fighter 0 in the air against the left side of the main stage (its wall's left face is at x 405.5). */
function onWall(match: MatchState): FighterState {
    const f = match.fighters[0];
    f.body.x = 405.5 - PhysicsConfig.PLAYER_WIDTH / 2 + 1;
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
    const hitstopFor = (knockback: number) => Math.min(PhysicsConfig.HITSTOP_MAX_STEPS,
        PhysicsConfig.HITSTOP_MIN_STEPS + Math.floor(knockback / PhysicsConfig.HITSTOP_SPEED_PER_STEP));
    const expected = target.hitstopSteps;
    assert.equal(attacker.hitstopSteps, expected);
    assert.ok(expected >= PhysicsConfig.HITSTOP_MIN_STEPS && expected <= 3, `a light hit barely stops (${expected})`);

    // Frozen: the knockback waits, the attack doesn't advance, and the stun doesn't count down
    const at = { x: target.body.x, y: target.body.y, stun: target.hitStunTimer, phase: attacker.combat.attack?.phaseTimer };
    step(match);
    assert.deepEqual({ x: target.body.x, y: target.body.y, stun: target.hitStunTimer, phase: attacker.combat.attack?.phaseTimer }, at);

    steps(match, expected);
    assert.equal(target.hitstopSteps, 0);
    assert.notEqual(target.body.x, at.x, 'flying once it ends');

    // A hit launching at KO speed freezes longer
    assert.ok(hitstopFor(6000) > expected);
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
    f.hitStunTimer = -PhysicsConfig.STUN_EXTENSION_MAX + 1;
    f.body.vy = -3000;
    step(match);
    assert.equal(f.isHitStunned, false);
});

test('a stunned fighter bounces off the floor and walls', () => {
    const floor = newMatch();
    const f = stunned(floor, 0, 1500, 870 - PhysicsConfig.PLAYER_HEIGHT / 2 - 10);
    f.hitStunTimer = 500;
    step(floor);
    assert.ok(f.body.vy < 0, `bounced up at ${f.body.vy}`);
    assert.equal(f.body.isGrounded, false);

    const wall = newMatch();
    const g = stunned(wall, 1500, 0, 1000);
    g.hitStunTimer = 500;
    // Just left of the main stage's left wall
    g.body.x = 405.5 - PhysicsConfig.PLAYER_WIDTH / 2 - 10;
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
    steps(match, 16);
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

test('running reaches its top speed and slides to a stop as in Brawlhalla; in the air, letting go eases off', () => {
    // At the stage's right end, clear of the soft platform above
    const match = newMatch(1330, 500);
    const f = match.fighters[0];
    // Read fresh each time (an assertion would otherwise narrow the type to the value it checked)
    const speed = (): number => f.body.vx;
    const stepsFor = (top: number, rate: number) => Math.ceil(top / (rate * SIM_STEP_MS / 1000));
    const toTop = stepsFor(PhysicsConfig.RUN_SPEED, PhysicsConfig.GROUND_ACCEL);
    assert.ok(toTop >= 15 && toTop <= 20, `about 17 steps to top speed (${toTop})`);
    steps(match, toTop, { moveRight: true });
    assert.ok(speed() === PhysicsConfig.RUN_SPEED, `top speed (${speed()})`);
    steps(match, stepsFor(PhysicsConfig.RUN_SPEED, PhysicsConfig.GROUND_DECEL));
    assert.ok(Math.abs(speed()) < 1e-9, `stopped (${speed()})`);
    jump(match);
    steps(match, stepsFor(PhysicsConfig.AIR_SPEED, PhysicsConfig.AIR_ACCEL), { moveRight: true, jumpHeld: true });
    assert.ok(speed() === PhysicsConfig.AIR_SPEED, `air speed (${speed()})`);
    const toStop = stepsFor(PhysicsConfig.AIR_SPEED, PhysicsConfig.AIR_DECEL);
    steps(match, Math.round(toStop / 2), { jumpHeld: true });
    assert.ok(speed() > PhysicsConfig.AIR_SPEED * 0.3 && speed() < PhysicsConfig.AIR_SPEED * 0.7, `still drifting at ${speed().toFixed(0)} px/s halfway`);
    steps(match, toStop, { jumpHeld: true });
    assert.ok(Math.abs(speed()) < 1e-9, 'stopped');
});

test('letting go of jump cuts a jump short, but not a dash jump or a recovery', () => {
    const full = newMatch();
    step(full, { jump: true, jumpHeld: true });
    steps(full, 30, { jumpHeld: true });
    const hop = newMatch();
    step(hop, { jump: true, jumpHeld: true });
    steps(hop, 30);
    assert.ok(hop.fighters[0].body.y > full.fighters[0].body.y + 80, 'the short hop is lower');

    const dash = newMatch();
    step(dash, { dodge: true, dodgeHeld: true, moveRight: true });
    step(dash, { jump: true, jumpHeld: true });
    const rising = dash.fighters[0].body.vy;
    step(dash);
    assert.ok(dash.fighters[0].body.vy < rising * 0.8, 'the dash jump keeps rising: no cut');
    assert.ok(dash.fighters[0].body.vy < 0);
});

test('a launch slows by a steady amount along its angle, and carries on past the stun', () => {
    const match = newMatch();
    const f = high(match);
    Object.assign(f.body, { vx: 3000, vy: -1000, isLaunched: true });
    f.isHitStunned = true;
    f.hitStunTimer = 18 * SIM_STEP_MS;
    step(match);
    const lost = PhysicsConfig.LAUNCH_DECEL * SIM_STEP_MS / 1000;
    const expected = 3000 * (1 - lost / Math.sqrt(3000 * 3000 + 1000 * 1000));
    assert.ok(Math.abs(f.body.vx - expected) < 1e-6, `slows by a steady amount (${f.body.vx.toFixed(0)})`);
    assert.ok(Math.abs(f.body.vy / f.body.vx - -1000 / 3000) < 0.05, 'still along its angle');

    // Out of stun but still fast, the launch carries on
    Object.assign(f.body, { vx: 900, vy: -300 });
    f.hitStunTimer = 1;
    step(match);
    assert.equal(f.isHitStunned, false, 'the stun is over');
    assert.equal(f.body.isLaunched, true, 'the launch still carries');
    const vx = f.body.vx;
    step(match);
    assert.ok(f.body.vx < vx, 'still slowing');
});

test('a launch ends on a jump, dodge or recovery, and once it has slowed down', () => {
    const match = newMatch();
    const f = high(match);
    f.body.vx = 700;
    f.body.isLaunched = true;
    step(match, { jump: true, jumpHeld: true });
    assert.equal(f.body.isLaunched, false, 'a jump ends it');
    f.body.isLaunched = true;
    f.body.vx = PhysicsConfig.LAUNCH_END_SPEED - 50;
    f.body.vy = 0;
    step(match);
    assert.equal(f.body.isLaunched, false, 'slow enough: over');
});

test('charging a heavy move all but stops the fighter, even holding a direction', () => {
    const match = newMatch(500, 1450);
    const f = match.fighters[0];
    steps(match, 10, { moveRight: true });
    const x = f.body.x;
    step(match, { heavyAttack: true, heavyAttackHeld: true, moveRight: true, aimRight: true });
    steps(match, 40, { heavyAttackHeld: true, moveRight: true, aimRight: true });
    assert.equal(f.combat.isCharging, true);
    assert.ok(f.body.x - x < 30, `moved ${(f.body.x - x).toFixed(0)} px while charging`);
    assert.ok(Math.abs(f.body.vx) < 1, 'standing still');
});

// ─── Brawlhalla's Unarmed rules ───

test('a hit launches with Brawlhalla\'s force and stuns for the move\'s frames', () => {
    const match = newMatch(700, 780);
    const target = match.fighters[1];
    target.damagePercent = 100;
    landLight(match);
    const move = AttackRegistry.light_neutral_grounded;
    const d = 100 + move.damage;
    const force = move.fixedForce + move.variableForce * (d / 100 + (d * d) / 20000);
    assert.ok(Math.abs(Math.hypot(target.body.vx, target.body.vy) - force * PhysicsConfig.FORCE_SCALE) < 1e-6);
    assert.equal(target.hitStunTimer, move.stun * SIM_STEP_MS);
});

test('every move ends with the same short cooldown before any attack', () => {
    const match = newMatch(700, 1300);
    const f = match.fighters[0];
    step(match, { lightAttack: true, lightAttackHeld: true });
    while (f.isAttacking) step(match);
    assert.equal(f.combat.attackCooldownTimer, PhysicsConfig.ATTACK_END_COOLDOWN);
    step(match, { lightAttack: true, lightAttackHeld: true, aimRight: true });
    assert.equal(f.isAttacking, false, 'another attack waits too');
    // The press stays buffered and comes out once the cooldown is over
    while (f.combat.attackCooldownTimer > 0) step(match, { aimRight: true });
    assert.equal(f.combat.attack?.key, 'light_side_grounded');
});

test('a light attack can be jumped out of, and steered in its recovery; a heavy can\'t', () => {
    const match = newMatch(700, 1300);
    const f = match.fighters[0];
    step(match, { lightAttack: true, lightAttackHeld: true, aimRight: true });
    steps(match, 2);
    step(match, { jump: true, jumpHeld: true });
    assert.ok(f.body.vy < 0, 'jumped');
    assert.ok(Math.abs(f.body.vx) <= PhysicsConfig.AIR_SPEED, 'the lunge doesn\'t carry into the air');

    const match2 = newMatch(700, 1300);
    const h = match2.fighters[0];
    step(match2, { lightAttack: true, lightAttackHeld: true });
    while (h.combat.attack?.phase !== AttackPhase.RECOVERY) step(match2);
    const x = h.body.x;
    steps(match2, 2, { moveRight: true });
    assert.ok(h.body.x > x, 'steers in the recovery');

    const match3 = newMatch(700, 1300);
    const k = match3.fighters[0];
    step(match3, { heavyAttack: true, heavyAttackHeld: true });
    step(match3);
    assert.ok(k.isAttacking);
    step(match3, { jump: true, jumpHeld: true });
    assert.ok(k.body.isGrounded, 'no jump out of a heavy');
});

test('the ground pound charges hanging in the air, then falls; landing is its pose', () => {
    const match = newMatch(500);
    const f = high(match);
    f.body.y = 300;
    step(match, { heavyAttack: true, heavyAttackHeld: true, aimDown: true });
    assert.equal(f.combat.isCharging, true);
    steps(match, 20, { heavyAttackHeld: true, aimDown: true });
    assert.ok(f.body.y - 300 < 10, 'hangs while charging');
    step(match, { aimDown: true });
    assert.equal(f.combat.isGroundPounding, true);
    for (let i = 0; i < 120 && !f.body.isGrounded; i++) step(match);
    step(match);
    assert.equal(f.isAttacking, false);
    assert.equal(f.combat.isGroundPoundLanding, true);
    while (f.combat.attackCooldownTimer > 0) step(match);
    assert.equal(f.combat.isGroundPoundLanding, false);
});

test('side heavy in the air is a charged signature; up and neutral are the recovery', () => {
    const match = newMatch(500);
    const f = high(match);
    f.body.y = 300;
    step(match, { heavyAttack: true, heavyAttackHeld: true, aimRight: true });
    assert.equal(f.combat.isCharging, true);
    step(match, { aimRight: true });
    assert.equal(f.combat.attack?.key, 'heavy_side_aerial');

    const m2 = newMatch(500);
    const g = high(m2);
    g.body.y = 300;
    step(m2, { heavyAttack: true, heavyAttackHeld: true, aimUp: true });
    assert.equal(g.body.isRecovering, true);
});

test('down light true-combos into a neutral light', () => {
    for (const percent of [0, 80]) {
        const match = newMatch(700, 880);
        const [attacker, target] = match.fighters;
        target.damagePercent = percent;
        step(match, { lightAttack: true, lightAttackHeld: true, aimDown: true });
        for (let i = 0; i < 30 && !target.isHitStunned; i++) step(match);
        assert.equal(target.isHitStunned, true, 'the slide hits');
        const damage = target.damagePercent;
        let stunnedWhenHit = false;
        for (let i = 0; i < 60 && target.damagePercent === damage; i++) {
            stunnedWhenHit = target.isHitStunned;
            step(match, { lightAttack: !attacker.isAttacking, lightAttackHeld: true });
        }
        assert.ok(target.damagePercent > damage, `the neutral light hits at ${percent}%`);
        assert.equal(stunnedWhenHit, true, 'before the stun ends');
    }
});

test('sizes and jumps match the Brawlhalla recordings, in fighter heights (H)', () => {
    const H = PhysicsConfig.PLAYER_HEIGHT;
    // The standard main platform is 9.5 H wide, as Brawlhalla's main stage against a legend
    assert.ok(Math.abs(STAGE_LAYOUTS.standard.platforms[0].w / H - 9.5) < 0.1);
    // A full jump rises about 1.95 H and peaks in about 27 frames; an air jump rises as high
    const rise = (airJump: boolean) => {
        const match = newMatch(500);
        const f = match.fighters[0];
        if (airJump) {
            step(match, { jump: true, jumpHeld: true });
            while (f.body.vy < 0) step(match, { jumpHeld: true });
        }
        const y0 = f.body.y;
        step(match, { jump: true, jumpHeld: true });
        let top = y0, apex = 0;
        for (let i = 1; i < 60; i++) {
            step(match, { jumpHeld: true });
            if (f.body.y < top) { top = f.body.y; apex = i; }
        }
        return { height: (y0 - top) / H, apex };
    };
    const ground = rise(false);
    const air = rise(true);
    assert.ok(Math.abs(ground.height - 1.95) < 0.1 && Math.abs(ground.apex - 27) <= 2, `jump ${ground.height.toFixed(2)} H, apex ${ground.apex}`);
    assert.ok(Math.abs(air.height - ground.height) < 0.1, `air jump ${air.height.toFixed(2)} H`);
});
