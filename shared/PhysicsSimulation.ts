/**
 * Fighter movement physics: plain data and pure functions, no Phaser.
 * Sounds and state changes come back as PhysicsEvent[] for the caller.
 */

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
        body.dropGraceTimer -= dtMs;
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
    if (!body.isHitStunned) {
        handleWallMechanics(body, input);
        handleHorizontalMovement(body, input);
        handleJump(body, input, events);
        handleFastFall(body, input);
        handleDodgeInput(body, input, events);
    }

    // Directional dodges in the air float
    body.ay = body.isDodging && !body.isSpotDodging && !body.isGrounded ? 0 : PhysicsConfig.GRAVITY;

    // ── Physics integration ──
    // Ends with isGrounded false: the platform collisions that follow set it again on landing
    applyPhysics(body, dt);
}

// ═══════════════════════════════════════════════════════════════
//  TIMER UPDATE
// ═══════════════════════════════════════════════════════════════

function updateTimers(body: SimBody, dtMs: number): void {
    if (body.lastWallTouchTimer > 0) {
        body.lastWallTouchTimer -= dtMs;
    }

    if (body.dodgeCooldownTimer > 0) {
        body.dodgeCooldownTimer -= dtMs;
    }

    if (body.dodgeTimer > 0) {
        body.dodgeTimer -= dtMs;
        if (body.dodgeTimer <= 0) {
            endDodge(body);
        } else if (body.isChaseDodging && body.dodgeTimer <= PhysicsConfig.CHASE_DODGE_DURATION - PhysicsConfig.CHASE_DODGE_INVINCIBLE) {
            body.isInvincible = false;
        }
    }

    if (body.dashCooldownTimer > 0) {
        body.dashCooldownTimer -= dtMs;
    }

    if (body.dashTimer > 0) {
        body.dashTimer -= dtMs;
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

function handleHorizontalMovement(body: SimBody, input: SimInput): void {
    if (body.isWallSliding) return;
    // Dodges and dashes set their own speed
    if (body.isDodging || body.isDashing) return;

    // Prevent movement during attack startup and active frames
    if (body.isAttacking) {
        if (body.attackType === ATTACK_TYPE_HEAVY) {
            body.isRunning = false;
            return;
        }
        if (body.attackPhase !== ATTACK_PHASE_RECOVERY) {
            return; // Lock during STARTUP and ACTIVE for light attacks
        }
    }

    // Coasting out of a dash: steering starts once the momentum runs out or the fighter pushes against it
    if (body.hasDashMomentum) {
        const against = body.vx > 0 ? input.moveLeft : input.moveRight;
        if (against || Math.abs(body.vx) < PhysicsConfig.DASH_MOMENTUM_MIN_SPEED) body.hasDashMomentum = false;
        else return;
    }

    // Run mechanic: default movement is RUN
    const isMoving = input.moveLeft || input.moveRight;
    body.isRunning = body.isGrounded && isMoving && !body.isAttacking;

    let accel = PhysicsConfig.MOVE_ACCEL;
    if (body.isRunning) {
        accel *= PhysicsConfig.RUN_ACCEL_MULT;
    }

    let moveForce = 0;
    if (input.moveLeft) moveForce -= accel;
    if (input.moveRight) moveForce += accel;

    body.ax += moveForce;
}

// ═══════════════════════════════════════════════════════════════
//  JUMP
// ═══════════════════════════════════════════════════════════════

function handleJump(body: SimBody, input: SimInput, events: PhysicsEvent[]): void {
    if (body.isDodging) return;

    // Block during heavy attacks
    if (body.isAttacking && body.attackType === ATTACK_TYPE_HEAVY) return;

    if (input.jumpBuffered) {
        events.push({ type: 'consume', input: 'jump' });
        // Platform Drop: Down + Jump while on a soft platform
        if (input.moveDown && body.currentPlatformIdx !== -1) handlePlatformDrop(body);
        else performJump(body, events);
    }

    // Short Hop: releasing jump while ascending slowly → dampen
    if (!input.jumpHeld && body.vy < 0 && body.vy > PhysicsConfig.SHORT_HOP_FORCE) {
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
        events.push({ type: 'sfx', key: 'sfx_jump_1', volume: 0.5 });
        return;
    }

    // Air Jump (double/triple jump)
    if (body.jumpsRemaining > 0) {
        body.vy = PhysicsConfig.DOUBLE_JUMP_FORCE;
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
    if (!input.dodgeBuffered || body.isDodging || body.isCharging) return;

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

function applyPhysics(body: SimBody, dt: number): void {
    // ── Acceleration → Velocity ──

    let maxSpeedCheck = PhysicsConfig.MAX_SPEED;
    if (body.isRunning) maxSpeedCheck *= PhysicsConfig.RUN_SPEED_MULT;

    // Soft cap: don't add acceleration if already exceeding max speed in that direction
    if (!body.isDodging && !body.isHitStunned) {
        const movingSameDir = Math.sign(body.ax) === Math.sign(body.vx);
        const overSpeed = Math.abs(body.vx) > maxSpeedCheck;

        if (movingSameDir && overSpeed) {
            // Don't add acceleration, let friction reduce speed
        } else {
            body.vx += body.ax * dt;
        }
    } else {
        body.vx += body.ax * dt;
    }

    // Gravity accelerates a fall up to its terminal speed. Faster falls (knockback, ground pound)
    // keep their speed, except what's left of a fast fall, which eases back.
    const maxFall = body.isFastFalling ? PhysicsConfig.MAX_FAST_FALL_SPEED : PhysicsConfig.MAX_FALL_SPEED;
    if (body.vy < maxFall) {
        body.vy = Math.min(body.vy + body.ay * dt, maxFall);
    } else if (!body.isHitStunned && !body.isAttacking) {
        body.vy = maxFall + (body.vy - maxFall) * PhysicsConfig.FALL_SPEED_EASE;
    }

    // ── Friction ──
    // isGrounded is still the previous step's value here

    let friction: number = body.isGrounded ? PhysicsConfig.FRICTION
        : body.hasDashMomentum ? PhysicsConfig.DASH_JUMP_AIR_FRICTION : PhysicsConfig.AIR_FRICTION;

    // Dynamic friction
    const isHighSpeed = Math.abs(body.vx) > PhysicsConfig.MAX_SPEED * PhysicsConfig.HIGH_SPEED_THRESHOLD_MULT;

    if (body.isRunning || (isHighSpeed && body.isGrounded)) {
        friction = PhysicsConfig.RUN_FRICTION;
    }

    // Charge friction
    if (body.isCharging) {
        friction = PhysicsConfig.CHARGE_FRICTION;
        if (!body.isGrounded) {
            body.vy *= PhysicsConfig.CHARGE_GRAVITY_CANCEL;
        }
    }
    else if (body.isAttacking) {
        if (body.attackPhase === ATTACK_PHASE_RECOVERY) {
            friction = PhysicsConfig.ATTACK_RECOVERY_FRICTION;
        } else {
            friction = PhysicsConfig.ATTACK_ACTIVE_FRICTION;
            // Aerial stall for flurry attacks
            if (!body.isGrounded && body.shouldStallInAir) {
                body.vy *= PhysicsConfig.AERIAL_STALL_GRAVITY_DAMP;
                body.vx *= PhysicsConfig.AERIAL_STALL_HORIZONTAL_DAMP;
            }
        }
    }
    else if (body.isHitStunned) {
        friction = PhysicsConfig.HITSTUN_FRICTION;
    }

    // Dashes and directional dodges keep their exact speed
    if (body.isDashing || (body.isDodging && !body.isSpotDodging)) {
        friction = 1.0;
    }

    // Friction is applied twice per step: every speed in PhysicsConfig is tuned around it
    body.vx *= friction;
    body.vx *= friction;

    // ── Speed Clamp ──

    let maxSpeed = PhysicsConfig.MAX_SPEED;
    if (body.isRunning) {
        maxSpeed *= PhysicsConfig.RUN_SPEED_MULT;
    }

    if (!body.isDodging && !body.isHitStunned) {
        if (Math.abs(body.vx) > maxSpeed) {
            // Overspeeding (e.g. post-dash): let friction reduce, don't clamp
            // But don't accelerate further (already handled above)
        } else {
            body.vx = clamp(body.vx, -maxSpeed, maxSpeed);
        }
    }

    // ── Position Update ──
    body.x += body.vx * dt;
    body.y += body.vy * dt;

    // ── Recovery State ──
    if (body.isRecovering) {
        body.recoveryTimer -= dt * 1000;
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
    if (bodyBottom > platTop + PhysicsConfig.PLATFORM_SNAP_THRESHOLD) return;

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

// ═══════════════════════════════════════════════════════════════
//  RECOVERY
// ═══════════════════════════════════════════════════════════════

/** Starts the recovery move if it's available: false if it isn't. */
export function startRecovery(body: SimBody, events: PhysicsEvent[]): boolean {
    if (!body.recoveryAvailable) return false;

    body.isRecovering = true;
    body.recoveryAvailable = false;
    body.recoveryTimer = PhysicsConfig.RECOVERY_DURATION;
    body.airActionCounter++;

    body.vy = PhysicsConfig.RECOVERY_FORCE_Y;
    body.vx = body.facingDirection * PhysicsConfig.RECOVERY_FORCE_X;

    body.isWallSliding = false;
    body.isFastFalling = false;
    body.hasDashMomentum = false;

    events.push({ type: 'sfx', key: 'sfx_jump_2', volume: 0.6 });
    return true;
}

// ═══════════════════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
