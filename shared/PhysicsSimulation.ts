/**
 * Fighter movement physics: plain data and pure functions, no Phaser.
 * Sounds and state changes come back as PhysicsEvent[] for the caller.
 */

import { countDown, SIM_STEP_MS } from './FixedStepClock.js';
import { PhysicsConfig } from './PhysicsConfig.js';

// ─── Attack Phase / Type constants ───
export const ATTACK_PHASE_NONE = 0;
export const ATTACK_PHASE_STARTUP = 1;
export const ATTACK_PHASE_ACTIVE = 2;
export const ATTACK_PHASE_RECOVERY = 3;

export const ATTACK_TYPE_NONE = 0;
export const ATTACK_TYPE_LIGHT = 1;
export const ATTACK_TYPE_HEAVY = 2;

// ─── Physics Events ───

export type PhysicsEvent =
    | { type: 'sfx'; key: string; volume: number }
    | { type: 'consume'; input: 'jump' | 'dodge' }
    | { type: 'dodge_start'; isGrounded: boolean; chase: boolean }
    | { type: 'dash_start' };

// ─── SimBody ───

export interface SimBody {
    // Position & Velocity
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;

    // Acceleration (reset each frame)
    ax: number;
    ay: number;

    // Grounding
    isGrounded: boolean;
    wasGroundedLastFrame: boolean;

    // Jump
    jumpsRemaining: number;
    /** Air jumps, wall jumps and recoveries since landing, hitting or being hit (wall slip). */
    airActionCounter: number;
    isFastFalling: boolean;

    // Wall
    isWallSliding: boolean;
    wallDirection: number;       // -1 = left, 1 = right, 0 = none
    isTouchingWall: boolean;
    lastWallTouchTimer: number;  // ms
    lastWallDirection: number;

    // Dash
    isDashing: boolean;
    dashTimer: number;           // ms
    dashCooldownTimer: number;   // ms
    /** In the air out of a dash: coasting with less air friction. */
    hasDashMomentum: boolean;

    // Dodge
    isDodging: boolean;
    isSpotDodging: boolean;
    isChaseDodging: boolean;
    dodgeTimer: number;          // ms
    dodgeCooldownTimer: number;  // ms
    /** The cooldown came from an air dodge, so landing shortens it. */
    landingShortensDodgeCooldown: boolean;
    chaseDodgesInAir: number;
    /** Dash or dodge direction: -1, 0 or 1. */
    dodgeDirection: number;
    isInvincible: boolean;

    // Platform Drop
    droppingThroughPlatformIdx: number;  // -1 = none
    droppingThroughY: number;            // NaN = none
    dropGraceTimer: number;              // ms
    currentPlatformIdx: number;          // -1 = none

    /** Steps down has been held, for dropping through soft platforms. */
    downHeldSteps: number;
    /** Steps left of the landing recovery: no jump, dodge or attack. */
    landingLagSteps: number;

    // Recovery
    isRecovering: boolean;
    recoveryAvailable: boolean;
    recoveryTimer: number;               // ms

    // Combat state (read-only by physics, managed externally)
    isAttacking: boolean;
    isHitStunned: boolean;
    isCharging: boolean;
    attackPhase: number;       // ATTACK_PHASE_* constants
    attackType: number;        // ATTACK_TYPE_* constants
    shouldStallInAir: boolean;

    // Running (derived during handleMovement)
    isRunning: boolean;

    // Flying from a hit: the launch glides and arcs (see applyPhysics) past the stun, until the
    // fighter lands, jumps, dodges, recovers or slows down
    isLaunched: boolean;
    // Rising from a ground or air jump: letting go of jump cuts the rise short (a short hop)
    isJumpRising: boolean;

    // Facing
    facingDirection: number;   // -1 or 1

}

// ─── SimInput ───

export interface SimInput {
    moveLeft: boolean;
    moveRight: boolean;
    moveDown: boolean;
    moveUp: boolean;
    /** A jump or dodge press is waiting in the fighter's input buffer. */
    jumpBuffered: boolean;
    jumpHeld: boolean;
    dodgeBuffered: boolean;
    /** The fighter's last attack hit recently enough for a chase dodge. */
    chaseDodgeReady: boolean;
}

// ─── Factory ───

export function createBody(x: number, y: number, facingDirection: number): SimBody {
    return {
        x, y,
        vx: 0, vy: 0,
        width: PhysicsConfig.PLAYER_WIDTH,
        height: PhysicsConfig.PLAYER_HEIGHT,
        ax: 0, ay: 0,

        isGrounded: false,
        wasGroundedLastFrame: false,

        jumpsRemaining: PhysicsConfig.MAX_JUMPS,
        airActionCounter: 0,
        isFastFalling: false,

        isWallSliding: false,
        wallDirection: 0,
        isTouchingWall: false,
        lastWallTouchTimer: 0,
        lastWallDirection: 0,

        isDashing: false,
        dashTimer: 0,
        dashCooldownTimer: 0,
        hasDashMomentum: false,

        isDodging: false,
        isSpotDodging: false,
        isChaseDodging: false,
        dodgeTimer: 0,
        dodgeCooldownTimer: 0,
        landingShortensDodgeCooldown: false,
        chaseDodgesInAir: 0,
        dodgeDirection: 0,
        isInvincible: false,

        droppingThroughPlatformIdx: -1,
        droppingThroughY: NaN,
        dropGraceTimer: 0,
        currentPlatformIdx: -1,

        downHeldSteps: 0,
        landingLagSteps: 0,

        isRecovering: false,
        recoveryAvailable: true,
        recoveryTimer: 0,

        isAttacking: false,
        isHitStunned: false,
        isCharging: false,
        attackPhase: ATTACK_PHASE_NONE,
        attackType: ATTACK_TYPE_NONE,
        shouldStallInAir: false,

        isRunning: false,
        isLaunched: false,
        isJumpRising: false,
        facingDirection,
    };
}

// ═══════════════════════════════════════════════════════════════
//  MAIN STEP FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Runs one physics step on `body` (in place), `dt` in seconds, and appends
 * what happened (sounds, consumed presses, dodge and dash starts) to `events`.
 */
export function stepPhysics(body: SimBody, input: SimInput, dt: number, events: PhysicsEvent[]): void {
    const dtMs = dt * 1000;

    // ── Timers ──
    updateTimers(body, dtMs);

    // ── Drop-through grace timer ──
    if (body.dropGraceTimer > 0) {
        body.dropGraceTimer = countDown(body.dropGraceTimer, dtMs);
        if (body.dropGraceTimer <= 0) {
            body.droppingThroughPlatformIdx = -1;
        }
    }

    // A dash that runs off a platform carries on as momentum
    if (body.isDashing && !body.isGrounded) {
        endDash(body);
        body.hasDashMomentum = true;
    }

    // ── Frame state bookkeeping ──
    // Capture previous grounded state BEFORE resetting
    body.wasGroundedLastFrame = body.isGrounded;
    body.ax = 0;

    // ── Mechanics ──
    // Stunned fighters have no control until the stun ends
    let steer: Steer = null;
    if (!body.isHitStunned) {
        handleWallMechanics(body, input);
        steer = handleHorizontalMovement(body, input);
        handleDropHold(body, input);
        handleJump(body, input, events);
        handleFastFall(body, input);
        handleDodgeInput(body, input, events);
    }

    // Directional dodges in the air float; a launch arcs under lighter gravity
    body.ay = body.isDodging && !body.isSpotDodging && !body.isGrounded ? 0
        : body.isLaunched ? PhysicsConfig.GRAVITY * PhysicsConfig.HITSTUN_GRAVITY : PhysicsConfig.GRAVITY;

    // ── Physics integration ──
    // Ends with isGrounded false: the platform collisions that follow set it again on landing
    applyPhysics(body, dt, steer);
}

// ═══════════════════════════════════════════════════════════════
//  TIMER UPDATE
// ═══════════════════════════════════════════════════════════════

function updateTimers(body: SimBody, dtMs: number): void {
    if (body.lastWallTouchTimer > 0) {
        body.lastWallTouchTimer = countDown(body.lastWallTouchTimer, dtMs);
    }

    if (body.dodgeCooldownTimer > 0) {
        body.dodgeCooldownTimer = countDown(body.dodgeCooldownTimer, dtMs);
    }

    if (body.dodgeTimer > 0) {
        body.dodgeTimer = countDown(body.dodgeTimer, dtMs);
        if (body.dodgeTimer <= 0) {
            endDodge(body);
        } else if (body.isChaseDodging && body.dodgeTimer <= PhysicsConfig.CHASE_DODGE_DURATION - PhysicsConfig.CHASE_DODGE_INVINCIBLE) {
            body.isInvincible = false;
        }
    }

    if (body.dashCooldownTimer > 0) {
        body.dashCooldownTimer = countDown(body.dashCooldownTimer, dtMs);
    }

    if (body.dashTimer > 0) {
        body.dashTimer = countDown(body.dashTimer, dtMs);
        if (body.dashTimer <= 0) {
            endDash(body);
        }
    }

    // The recovery timer runs in applyPhysics
}

// ═══════════════════════════════════════════════════════════════
//  WALL MECHANICS
// ═══════════════════════════════════════════════════════════════

/** After too many air actions, walls stop holding the fighter until it lands, hits or is hit. */
function isWallSlipping(body: SimBody): boolean {
    return body.airActionCounter >= PhysicsConfig.MAX_AIR_ACTIONS;
}

function handleWallMechanics(body: SimBody, input: SimInput): void {
    if (body.isGrounded) {
        body.isWallSliding = false;
        return;
    }

    if (body.isTouchingWall && !isWallSlipping(body)) {
        // A wall gives back the air jumps and the recovery, and stops dash momentum
        body.jumpsRemaining = PhysicsConfig.MAX_JUMPS - 1;
        body.recoveryAvailable = true;
        body.hasDashMomentum = false;

        const pushingWall = (body.wallDirection === -1 && input.moveLeft) ||
            (body.wallDirection === 1 && input.moveRight);

        if (pushingWall && body.vy > 0) {
            body.isWallSliding = true;
            body.isFastFalling = false;

            if (body.vy > PhysicsConfig.WALL_SLIDE_SPEED) {
                body.vy = PhysicsConfig.WALL_SLIDE_SPEED;
            }
        } else {
            body.isWallSliding = false;
        }
    } else {
        body.isWallSliding = false;
    }
}

// ═══════════════════════════════════════════════════════════════
//  HORIZONTAL MOVEMENT
// ═══════════════════════════════════════════════════════════════

/** Which way the fighter steers this step (0: lets go), or null when something else moves it (an attack, dash, dodge, wall, dash coast). */
type Steer = -1 | 0 | 1 | null;

function handleHorizontalMovement(body: SimBody, input: SimInput): Steer {
    if (body.isWallSliding) return null;
    // Dodges and dashes set their own speed; charging a heavy move all but stops the fighter (CHARGE_FRICTION)
    if (body.isDodging || body.isDashing) return null;
    if (body.isCharging) {
        body.isRunning = false;
        return null;
    }

    // Heavies own the movement; light attacks hold still on the ground until their recovery, and
    // drift in the air (slower: AIR_ATTACK_DRIFT)
    if (body.isAttacking) {
        if (body.attackType === ATTACK_TYPE_HEAVY || (body.isGrounded && body.attackPhase !== ATTACK_PHASE_RECOVERY)) {
            body.isRunning = false;
            return null;
        }
    }

    // Coasting out of a dash: steering starts once the momentum runs out or the fighter pushes against it
    if (body.hasDashMomentum) {
        const against = body.vx > 0 ? input.moveLeft : input.moveRight;
        if (against || Math.abs(body.vx) < PhysicsConfig.DASH_MOMENTUM_MIN_SPEED) body.hasDashMomentum = false;
        else return null;
    }

    const steer = (input.moveRight ? 1 : 0) - (input.moveLeft ? 1 : 0);
    body.isRunning = body.isGrounded && steer !== 0 && !body.isAttacking;
    // A light attack's recovery on the ground steers only when pushed; otherwise the move's friction stops it
    if (body.isAttacking && body.isGrounded && steer === 0) return null;
    return steer as -1 | 0 | 1;
}

// ═══════════════════════════════════════════════════════════════
//  JUMP
// ═══════════════════════════════════════════════════════════════

/**
 * Holding down on a soft platform drops through it, after long enough for a down attack to come out
 * instead. The hold counts only while free: down still held out of an attack, dodge or charge starts over.
 */
function handleDropHold(body: SimBody, input: SimInput): void {
    const busy = body.isAttacking || body.isDodging || body.isDashing || body.isCharging;
    body.downHeldSteps = input.moveDown && !busy ? body.downHeldSteps + 1 : 0;
    if (body.downHeldSteps >= PhysicsConfig.DROP_HOLD_STEPS && body.isGrounded && body.currentPlatformIdx !== -1) {
        handlePlatformDrop(body);
    }
}

function handleJump(body: SimBody, input: SimInput, events: PhysicsEvent[]): void {
    if (body.isDodging || body.landingLagSteps > 0) return;

    // Heavies commit; a light attack can be jumped out of
    if (body.isAttacking && body.attackType === ATTACK_TYPE_HEAVY) return;

    if (input.jumpBuffered) {
        events.push({ type: 'consume', input: 'jump' });
        // Platform Drop: Down + Jump while on a soft platform
        if (input.moveDown && body.currentPlatformIdx !== -1) handlePlatformDrop(body);
        else {
            // A lunge or slide doesn't carry into the air
            if (body.isAttacking) body.vx = Math.max(-PhysicsConfig.AIR_SPEED, Math.min(body.vx, PhysicsConfig.AIR_SPEED));
            performJump(body, events);
        }
    }

    // Short hop: letting go of jump while a jump's rise has slowed past the cut-off cuts it short
    // (only a jump's: not a dash jump, wall jump, recovery or launch)
    if (body.vy >= 0) body.isJumpRising = false;
    if (body.isJumpRising && !input.jumpHeld && body.vy > PhysicsConfig.SHORT_HOP_FORCE) {
        body.vy *= PhysicsConfig.SHORT_HOP_VELOCITY_DAMP;
    }
}

function handlePlatformDrop(body: SimBody): void {
    body.droppingThroughPlatformIdx = body.currentPlatformIdx;
    // The simulation fills in droppingThroughY from the stage while colliding
    body.dropGraceTimer = PhysicsConfig.PLATFORM_DROP_GRACE_PERIOD;
    body.isGrounded = false;
    body.isDashing = false;
    body.currentPlatformIdx = -1;
    body.y += PhysicsConfig.PLATFORM_DROP_NUDGE_Y;
    body.vy = PhysicsConfig.PLATFORM_DROP_PUSH_Y;
}

function performJump(body: SimBody, events: PhysicsEvent[]): void {
    body.isFastFalling = false;
    body.isLaunched = false;
    body.isJumpRising = false;

    // Wall Jump (current wall or coyote time)
    if (!body.isGrounded && (body.isWallSliding || body.lastWallTouchTimer > 0) && !isWallSlipping(body)) {
        wallJump(body, events);
        return;
    }

    // Dash Jump: low and fast, keeping the dash's speed
    if (body.isDashing) {
        endDash(body);
        body.hasDashMomentum = true;
        body.isRunning = false;
        body.vx = body.dodgeDirection * PhysicsConfig.DASH_JUMP_SPEED;
        body.vy = PhysicsConfig.DASH_JUMP_FORCE;
        body.isGrounded = false;
        events.push({ type: 'sfx', key: 'sfx_jump_1', volume: 0.5 });
        return;
    }

    // Ground Jump
    if (body.isGrounded) {
        body.vy = PhysicsConfig.JUMP_FORCE;
        body.isGrounded = false;
        body.isJumpRising = true;
        events.push({ type: 'sfx', key: 'sfx_jump_1', volume: 0.5 });
        return;
    }

    // Air Jump (double/triple jump)
    if (body.jumpsRemaining > 0) {
        body.vy = PhysicsConfig.DOUBLE_JUMP_FORCE;
        body.isJumpRising = true;
        body.jumpsRemaining--;
        body.airActionCounter++;
        body.hasDashMomentum = false;
        events.push({ type: 'sfx', key: 'sfx_jump_2', volume: 0.5 });
    }
}

function wallJump(body: SimBody, events: PhysicsEvent[]): void {
    body.vy = PhysicsConfig.WALL_JUMP_FORCE_Y;

    const dir = body.wallDirection !== 0 ? body.wallDirection : body.lastWallDirection;
    body.vx = -dir * PhysicsConfig.WALL_JUMP_FORCE_X;

    body.isWallSliding = false;
    body.hasDashMomentum = false;
    body.airActionCounter++;
    events.push({ type: 'sfx', key: 'sfx_jump_1', volume: 0.5 });
}

// ═══════════════════════════════════════════════════════════════
//  FAST FALL
// ═══════════════════════════════════════════════════════════════

/** Holding down while descending falls faster, up to MAX_FAST_FALL_SPEED. */
function handleFastFall(body: SimBody, input: SimInput): void {
    const busy = body.isWallSliding || body.isDodging || body.isRecovering || body.isCharging ||
        (body.isAttacking && (body.attackType === ATTACK_TYPE_HEAVY || body.shouldStallInAir));
    const fastFalling = input.moveDown && !body.isGrounded && body.vy >= 0 && !busy;
    if (fastFalling && !body.isFastFalling) {
        body.vy = Math.max(body.vy, PhysicsConfig.FAST_FALL_SPEED);
    }
    body.isFastFalling = fastFalling;
}

// ═══════════════════════════════════════════════════════════════
//  DASH AND DODGE
// ═══════════════════════════════════════════════════════════════

/** -1, 0 or 1 from a pair of opposite directions. */
function axis(negative: boolean, positive: boolean): number {
    return (positive ? 1 : 0) - (negative ? 1 : 0);
}

function handleDodgeInput(body: SimBody, input: SimInput, events: PhysicsEvent[]): void {
    if (!input.dodgeBuffered || body.isDodging || body.isCharging || body.landingLagSteps > 0) return;

    const dx = axis(input.moveLeft, input.moveRight);
    const dy = body.isGrounded ? 0 : axis(input.moveUp, input.moveDown);
    const hasDirection = dx !== 0 || dy !== 0;

    // After a hit, a directional dodge chases: it cancels the rest of the attack
    const chase = input.chaseDodgeReady && hasDirection &&
        (body.isGrounded || body.chaseDodgesInAir < PhysicsConfig.MAX_AIR_CHASE_DODGES);
    if (chase) {
        events.push({ type: 'consume', input: 'dodge' });
        startChaseDodge(body, dx, dy, events);
        return;
    }

    // Otherwise attacks and the recovery move are commitments
    if (body.isAttacking || body.isRecovering) return;

    if (body.isGrounded && dx !== 0) {
        // Dashing back the other way is immediate; the same way again waits DASH_REPEAT_DELAY
        if (dx === body.dodgeDirection && (body.isDashing || body.dashCooldownTimer > 0)) return;
        events.push({ type: 'consume', input: 'dodge' });
        startDash(body, dx, events);
        return;
    }

    if (body.dodgeCooldownTimer > 0) return;
    events.push({ type: 'consume', input: 'dodge' });
    startDodge(body, dx, dy, events);
}

function startDash(body: SimBody, direction: number, events: PhysicsEvent[]): void {
    // The dash sets the speed on its own, without this step's running push
    body.ax = 0;
    body.isRunning = false;
    body.isDashing = true;
    body.dashTimer = PhysicsConfig.DASH_DURATION;
    body.dodgeDirection = direction;
    body.vx = direction * PhysicsConfig.DASH_SPEED;
    events.push({ type: 'sfx', key: 'sfx_dash', volume: 0.5 });
    events.push({ type: 'dash_start' });
}

/** Ends a dash early or on time; another can start after DASH_REPEAT_DELAY. */
export function endDash(body: SimBody): void {
    if (!body.isDashing) return;
    body.isDashing = false;
    body.dashTimer = 0;
    body.dashCooldownTimer = PhysicsConfig.DASH_REPEAT_DELAY;
}

/** A spot dodge, or in the air a dodge in any of 8 directions. */
function startDodge(body: SimBody, dx: number, dy: number, events: PhysicsEvent[]): void {
    body.isLaunched = false;
    body.isJumpRising = false;
    beginDodge(body);

    if (dx === 0 && dy === 0) {
        // SPOT DODGE
        body.isSpotDodging = true;
        body.dodgeDirection = 0;
        body.dodgeTimer = PhysicsConfig.SPOT_DODGE_DURATION;
        body.vx = 0;

        if (!body.isGrounded) {
            body.vy *= PhysicsConfig.SPOT_DODGE_AERIAL_Y_DAMP;
        }
    } else {
        // DIRECTIONAL AIR DODGE
        body.dodgeDirection = dx;
        body.dodgeTimer = PhysicsConfig.AIR_DODGE_DURATION;
        const speed = directionalSpeed(PhysicsConfig.AIR_DODGE_DISTANCE / (PhysicsConfig.AIR_DODGE_DURATION / 1000), dx, dy);
        body.vx = dx * speed;
        body.vy = dy * speed;
        events.push({ type: 'sfx', key: 'sfx_dash', volume: 0.5 });
    }

    events.push({ type: 'dodge_start', isGrounded: body.isGrounded, chase: false });
}

function startChaseDodge(body: SimBody, dx: number, dy: number, events: PhysicsEvent[]): void {
    beginDodge(body);
    body.isChaseDodging = true;
    body.dodgeDirection = dx;
    body.dodgeTimer = PhysicsConfig.CHASE_DODGE_DURATION;
    const speed = directionalSpeed(PhysicsConfig.CHASE_DODGE_SPEED, dx, dy);
    body.vx = dx * speed;
    body.vy = dy * speed;
    body.isRecovering = false;
    if (!body.isGrounded) body.chaseDodgesInAir++;

    events.push({ type: 'sfx', key: 'sfx_dash', volume: 0.5 });
    events.push({ type: 'dodge_start', isGrounded: body.isGrounded, chase: true });
}

function beginDodge(body: SimBody): void {
    // The dodge sets the speed on its own, without this step's movement push
    body.ax = 0;
    endDash(body);
    body.isDodging = true;
    body.isInvincible = true;
    body.isSpotDodging = false;
    body.isChaseDodging = false;
    body.isFastFalling = false;
    body.hasDashMomentum = false;
}

/** Diagonals share the speed between both axes. */
function directionalSpeed(speed: number, dx: number, dy: number): number {
    return dx !== 0 && dy !== 0 ? speed * Math.SQRT1_2 : speed;
}

function endDodge(body: SimBody): void {
    if (!body.isSpotDodging && !body.isGrounded) {
        body.vy *= PhysicsConfig.AIR_DODGE_END_SPEED;
    }
    const chase = body.isChaseDodging;
    stopDodging(body);
    if (chase) return;

    if (body.isGrounded) {
        body.dodgeCooldownTimer = PhysicsConfig.DODGE_COOLDOWN;
        body.landingShortensDodgeCooldown = false;
    } else {
        body.dodgeCooldownTimer = PhysicsConfig.AIR_DODGE_COOLDOWN;
        body.landingShortensDodgeCooldown = true;
    }
}

function stopDodging(body: SimBody): void {
    body.isDodging = false;
    body.isInvincible = false;
    body.isSpotDodging = false;
    body.isChaseDodging = false;
    body.dodgeTimer = 0;
}

/** An attack out of a chase dodge: the dodge ends at no cost, and the attack keeps some of its speed. */
export function endChaseDodge(body: SimBody): void {
    stopDodging(body);
    body.vx *= PhysicsConfig.CHASE_ATTACK_SPEED_KEPT;
    body.vy *= PhysicsConfig.CHASE_ATTACK_SPEED_KEPT;
}

/**
 * Gravity cancel: an attack out of an aerial spot dodge. The dodge ends, and
 * its cooldown is the full air cooldown even after landing.
 */
export function gravityCancel(body: SimBody): void {
    stopDodging(body);
    body.dodgeCooldownTimer = PhysicsConfig.AIR_DODGE_COOLDOWN;
    body.landingShortensDodgeCooldown = false;
}

/** A hit stops whatever the fighter was doing: dash, dodge, fast fall, wall slide, recovery. */
export function interruptMovement(body: SimBody): void {
    endDash(body);
    stopDodging(body);
    body.isFastFalling = false;
    body.isWallSliding = false;
    body.hasDashMomentum = false;
    body.isRunning = false;
    body.isRecovering = false;
    body.recoveryTimer = 0;
}

// ═══════════════════════════════════════════════════════════════
//  PHYSICS INTEGRATION (applyPhysics)
// ═══════════════════════════════════════════════════════════════

function applyPhysics(body: SimBody, dt: number, steer: Steer): void {
    // A launch ends once the stun is over and the fighter stands on the ground (isGrounded is still the
    // previous step's), or on a jump, dodge or recovery; a stunned fighter slides on with it, even along the floor
    if (body.isLaunched && !body.isHitStunned && body.isGrounded) {
        body.isLaunched = false;
    }

    // ── Horizontal speed ──
    // Dashes and directional dodges keep their exact speed (one that started this step too, after steering was read)
    if (body.isDashing || (body.isDodging && !body.isSpotDodging)) steer = null;
    if (body.isLaunched) {
        // Out of stun, the fighter can drift against the launch (or along it below the air speed), not cancel it
        if (steer && (Math.sign(body.vx) !== steer || Math.abs(body.vx) < PhysicsConfig.AIR_SPEED)) steerTowards(body, steer, dt);
    } else if (steer !== null) {
        steerTowards(body, steer, dt);
    } else if (!body.isHitStunned) {
        body.vx += body.ax * dt;
        applyStateFriction(body, dt);
    }

    // A launch slows by a steady amount along its angle, as in Brawlhalla: soft hits barely push, and the
    // flight grows with the square of the speed, so hard hits fly far. Below LAUNCH_EASE_SPEED the slowing
    // eases off with the speed, so the launch fades out instead of stopping dead. Past the top of the arc
    // (falling, slower than a fall) the sideways speed only fades by LAUNCH_FALL_DRAG a second, and gravity
    // bends the fall into a curve. Math.sqrt, not Math.hypot: it rounds the same in every browser
    if (body.isLaunched || body.isHitStunned) {
        if (body.vy >= 0 && body.vy <= PhysicsConfig.MAX_FALL_SPEED) {
            body.vx *= Math.max(0, 1 - PhysicsConfig.LAUNCH_FALL_DRAG * dt);
        } else {
            const speed = Math.sqrt(body.vx * body.vx + body.vy * body.vy);
            const decel = PhysicsConfig.LAUNCH_DECEL * Math.min(1, speed / PhysicsConfig.LAUNCH_EASE_SPEED);
            const kept = Math.max(speed - decel * dt, 0) / speed;
            body.vx *= kept;
            body.vy *= kept;
        }
    }

    // Gravity accelerates a fall up to its terminal speed. Faster falls (knockback, ground pound)
    // keep their speed, except what's left of a fast fall, which eases back.
    const maxFall = body.isFastFalling ? PhysicsConfig.MAX_FAST_FALL_SPEED : PhysicsConfig.MAX_FALL_SPEED;
    if (body.vy < maxFall) {
        body.vy = Math.min(body.vy + body.ay * dt, maxFall);
    } else if (!body.isHitStunned && !body.isLaunched && !body.isAttacking) {
        body.vy = maxFall + (body.vy - maxFall) * PhysicsConfig.FALL_SPEED_EASE;
    }

    // Charging in the air hangs; moves that stall in the air hang while they hit
    if (body.isCharging && !body.isGrounded) {
        body.vy *= PhysicsConfig.CHARGE_GRAVITY_CANCEL;
    } else if (body.isAttacking && !body.isCharging && body.attackPhase !== ATTACK_PHASE_RECOVERY && !body.isGrounded && body.shouldStallInAir) {
        body.vy *= PhysicsConfig.AERIAL_STALL_GRAVITY_DAMP;
        body.vx *= PhysicsConfig.AERIAL_STALL_HORIZONTAL_DAMP;
    }

    // ── Position Update ──
    body.x += body.vx * dt;
    body.y += body.vy * dt;

    // ── Recovery State ──
    if (body.isRecovering) {
        body.recoveryTimer = countDown(body.recoveryTimer, dt * 1000);
        if (body.recoveryTimer <= 0) {
            body.isRecovering = false;
        }
    }

    // ── Reset grounded for collision phase ──
    body.isGrounded = false;
}

// ═══════════════════════════════════════════════════════════════
//  COLLISION: PLATFORMS
// ═══════════════════════════════════════════════════════════════

/**
 * Lands the body on one platform (centre-origin coordinates) if it's falling
 * onto it; a landing sound goes to `events`.
 */
export function checkSinglePlatformCollision(
    body: SimBody, platIdx: number,
    platCx: number, platCy: number, platW: number, platH: number,
    isSoft: boolean, events: PhysicsEvent[],
): void {
    const halfW = body.width / 2;
    const halfH = body.height / 2;

    const platLeft = platCx - platW / 2;
    const platRight = platCx + platW / 2;
    const platTop = platCy - platH / 2;

    const bodyLeft = body.x - halfW;
    const bodyRight = body.x + halfW;
    const bodyTop = body.y - halfH;
    const bodyBottom = body.y + halfH;

    // AABB overlap (strict inequalities, matching Phaser)
    if (bodyRight <= platLeft || bodyLeft >= platRight ||
        bodyBottom <= platTop || bodyTop >= platCy + platH / 2) {
        if (body.currentPlatformIdx === platIdx) body.currentPlatformIdx = -1;
        return;
    }

    // Soft platform logic
    // Soft platforms let a fighter who just dropped through keep falling, including through any at the same height
    if (isSoft && body.dropGraceTimer > 0) {
        if (body.droppingThroughPlatformIdx === platIdx) return;
        if (!isNaN(body.droppingThroughY) && Math.abs(platCy - body.droppingThroughY) < 5) return;
    }
    if (body.vy < 0) return;
    // Lands if its feet were above the top before this step's move: a fast fall can't skip past the top
    const bottomBefore = bodyBottom - body.vy * SIM_STEP_MS / 1000;
    if (bottomBefore > platTop + PhysicsConfig.PLATFORM_SNAP_THRESHOLD) return;

    // A stunned fighter coming down hard bounces off
    if (body.isHitStunned && body.vy > PhysicsConfig.BOUNCE_SPEED) {
        body.y = platTop - halfH;
        body.vy = -body.vy * PhysicsConfig.BOUNCE_KEEP;
        events.push({ type: 'sfx', key: 'sfx_landing', volume: 0.6 });
        return;
    }

    // Landing
    if (body.vy >= 0) {
        const wasGrounded = body.wasGroundedLastFrame;

        body.y = platTop - halfH;
        body.vy = 0;
        body.isGrounded = true;
        body.isFastFalling = false;
        body.hasDashMomentum = false;

        body.isRecovering = false;
        body.jumpsRemaining = PhysicsConfig.MAX_JUMPS - 1;
        body.recoveryAvailable = true;
        body.droppingThroughPlatformIdx = -1;
        body.droppingThroughY = NaN;
        body.airActionCounter = 0;
        body.chaseDodgesInAir = 0;
        body.currentPlatformIdx = isSoft ? platIdx : -1;

        if (body.landingShortensDodgeCooldown) {
            body.landingShortensDodgeCooldown = false;
            body.dodgeCooldownTimer = Math.max(0,
                body.dodgeCooldownTimer - (PhysicsConfig.AIR_DODGE_COOLDOWN - PhysicsConfig.LANDED_AIR_DODGE_COOLDOWN));
        }

        if (!wasGrounded) {
            body.landingLagSteps = PhysicsConfig.LANDING_LAG_STEPS;
            events.push({ type: 'sfx', key: 'sfx_landing', volume: 0.8 });
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  COLLISION: WALLS
// ═══════════════════════════════════════════════════════════════

/** Reset wall state before iterating walls. */
export function resetWallState(body: SimBody): void {
    body.isTouchingWall = false;
    body.wallDirection = 0;
}

/** Check collision against a single wall (center-origin coordinates). */
export function checkSingleWallCollision(
    body: SimBody,
    wallCx: number, wallCy: number, wallW: number, wallH: number
): void {
    const halfW = body.width / 2;

    const wallLeft = wallCx - wallW / 2;
    const wallRight = wallCx + wallW / 2;
    const wallTop = wallCy - wallH / 2;
    const wallBottom = wallCy + wallH / 2;

    const bodyLeft = body.x - halfW;
    const bodyRight = body.x + halfW;
    const bodyTop = body.y - body.height / 2;
    const bodyBottom = body.y + body.height / 2;

    const overlaps = bodyRight > wallLeft && bodyLeft < wallRight &&
        bodyBottom > wallTop && bodyTop < wallBottom;

    if (overlaps) {
        // A stunned fighter flying into a wall bounces off it
        const intoWall = body.x < wallCx ? body.vx > 0 : body.vx < 0;
        if (body.isHitStunned && intoWall && Math.abs(body.vx) > PhysicsConfig.BOUNCE_SPEED) {
            body.vx = -body.vx * PhysicsConfig.BOUNCE_KEEP;
        }
        if (body.x < wallCx) {
            body.x = wallLeft - halfW;
            body.isTouchingWall = true;
            body.lastWallTouchTimer = PhysicsConfig.WALL_COYOTE_TIME;
            body.wallDirection = 1;
            body.lastWallDirection = 1;
        } else {
            body.x = wallRight + halfW;
            body.isTouchingWall = true;
            body.lastWallTouchTimer = PhysicsConfig.WALL_COYOTE_TIME;
            body.wallDirection = -1;
            body.lastWallDirection = -1;
        }
    }
}

/**
 * Check collision against a platform's underside (center-origin coordinates):
 * a fighter moving up into it stops below it, or bounces off it while stunned.
 */
export function checkSingleCeilingCollision(
    body: SimBody,
    ceilingCx: number, ceilingCy: number, ceilingW: number, ceilingH: number
): void {
    const halfW = body.width / 2;
    const halfH = body.height / 2;
    const bottom = ceilingCy + ceilingH / 2;
    const overlaps = body.x + halfW > ceilingCx - ceilingW / 2 && body.x - halfW < ceilingCx + ceilingW / 2 &&
        body.y + halfH > ceilingCy - ceilingH / 2 && body.y - halfH < bottom;
    // Only from below: a fighter's middle under the underside's middle
    if (!overlaps || body.y < ceilingCy) return;

    body.y = bottom + halfH;
    if (body.vy < 0) {
        const bounce = body.isHitStunned && -body.vy > PhysicsConfig.BOUNCE_SPEED;
        body.vy = bounce ? -body.vy * PhysicsConfig.BOUNCE_KEEP : 0;
    }
}

// ═══════════════════════════════════════════════════════════════
//  RECOVERY
// ═══════════════════════════════════════════════════════════════

/**
 * Starts the recovery move: false if it can't. Once used, it can go again
 * before landing as a weaker, exhausted recovery that costs an air jump.
 */
export function startRecovery(body: SimBody, events: PhysicsEvent[]): boolean {
    const exhausted = !body.recoveryAvailable;
    if (exhausted && body.jumpsRemaining <= 0) return false;

    body.isRecovering = true;
    body.isLaunched = false;
    body.isJumpRising = false;
    if (exhausted) body.jumpsRemaining--;
    body.recoveryAvailable = false;
    body.recoveryTimer = PhysicsConfig.RECOVERY_DURATION;
    body.airActionCounter++;

    const push = exhausted ? PhysicsConfig.EXHAUSTED_RECOVERY_FORCE : 1;
    body.vy = PhysicsConfig.RECOVERY_FORCE_Y * push;
    body.vx = body.facingDirection * PhysicsConfig.RECOVERY_FORCE_X * push;

    body.isWallSliding = false;
    body.isFastFalling = false;
    body.hasDashMomentum = false;

    events.push({ type: 'sfx', key: 'sfx_jump_2', volume: 0.6 });
    return true;
}

// ═══════════════════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════════════════

/**
 * Free movement: towards the top speed the way the fighter steers (or towards
 * a stop when it lets go), at the ground's or the air's rates. Turning round
 * accelerates the other way; above the top speed the way it's going (a dash's
 * run-on, the end of a launch) it eases down instead of stopping.
 * isGrounded is still the previous step's value here.
 */
function steerTowards(body: SimBody, steer: -1 | 0 | 1, dt: number): void {
    const ground = body.isGrounded;
    // An attack in the air drifts slower: the move carries the fighter a little, not across the stage
    const top = ground ? PhysicsConfig.RUN_SPEED
        : body.isAttacking ? PhysicsConfig.AIR_SPEED * PhysicsConfig.AIR_ATTACK_DRIFT : PhysicsConfig.AIR_SPEED;
    const overSpeed = Math.abs(body.vx) > top && (steer === 0 || Math.sign(body.vx) === steer);
    if (ground && !overSpeed) {
        // Main's run: push, then keep a share of the speed twice; the push settles the run at RUN_SPEED
        const kept = steer === 0 ? PhysicsConfig.STOP_FRICTION : PhysicsConfig.RUN_FRICTION;
        const keptSq = PhysicsConfig.RUN_FRICTION * PhysicsConfig.RUN_FRICTION;
        const push = top * (1 - keptSq) / keptSq;
        body.vx = (body.vx + steer * push) * kept * kept;
        if (Math.abs(body.vx) < 1) body.vx = 0;
        return;
    }
    let rate: number;
    if (overSpeed) rate = ground ? PhysicsConfig.GROUND_OVERSPEED_DECEL : PhysicsConfig.AIR_DECEL;
    else rate = steer === 0 ? PhysicsConfig.AIR_DECEL : PhysicsConfig.AIR_ACCEL;
    const target = overSpeed ? Math.sign(body.vx) * top : steer * top;
    const change = rate * dt;
    body.vx = body.vx < target ? Math.min(body.vx + change, target) : Math.max(body.vx - change, target);
}

/**
 * Speed kept twice a step when something other than steering moves the
 * fighter: charging, an attack coming out or ending, a dash jump's coast
 * (dashes and directional dodges keep their exact speed). Anything else on
 * the ground (a spot dodge) stops as letting go does.
 */
function applyStateFriction(body: SimBody, dt: number): void {
    if (body.isDashing || (body.isDodging && !body.isSpotDodging)) return;
    let friction = 1;
    if (body.isCharging) friction = PhysicsConfig.CHARGE_FRICTION;
    else if (body.isAttacking) friction = body.attackPhase === ATTACK_PHASE_RECOVERY ? PhysicsConfig.ATTACK_RECOVERY_FRICTION : PhysicsConfig.ATTACK_ACTIVE_FRICTION;
    else if (body.hasDashMomentum) friction = PhysicsConfig.DASH_JUMP_AIR_FRICTION;
    else if (body.isGrounded) return steerTowards(body, 0, dt);
    body.vx *= friction * friction;
}
