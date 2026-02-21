/**
 * Shared Physics Simulation — Phase 3: Real Physics Extraction
 *
 * This module is the EXACT logic from PlayerPhysics.ts, extracted to be
 * platform-agnostic (no Phaser, no Node.js dependencies).
 * Both client and server import this module to ensure identical physics.
 *
 * Visual/audio effects are emitted as PhysicsEvent[] — the client plays
 * them, the server ignores them.
 */

import { PhysicsConfig } from './PhysicsConfig.js';
import type { SimStage } from './StageData.js';

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
    | { type: 'dodge_start'; isSpot: boolean; isGrounded: boolean }
    | { type: 'dodge_end' }
    | { type: 'recovery_end' }
    | { type: 'landing' };

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
    airActionCounter: number;
    jumpHoldTime: number;
    wasJumpHeld: boolean;
    isFastFalling: boolean;

    // Wall
    isWallSliding: boolean;
    wallDirection: number;       // -1 = left, 1 = right, 0 = none
    isTouchingWall: boolean;
    wallTouchesExhausted: boolean;
    lastWallTouchTimer: number;  // ms
    lastWallDirection: number;

    // Dodge
    isDodging: boolean;
    isSpotDodging: boolean;
    dodgeTimer: number;          // ms
    dodgeCooldownTimer: number;  // ms
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
    isThrowCharging: boolean;
    attackPhase: number;       // ATTACK_PHASE_* constants
    attackType: number;        // ATTACK_TYPE_* constants
    shouldStallInAir: boolean;

    // Running (derived during handleMovement)
    isRunning: boolean;

    // Facing
    facingDirection: number;   // -1 or 1

    // Game state
    damagePercent: number;
    lives: number;
}

// ─── SimInput ───

export interface SimInput {
    moveLeft: boolean;
    moveRight: boolean;
    moveDown: boolean;
    moveUp: boolean;
    jumpBuffered: boolean;   // client: inputBuffer.has('jump'); server: raw jump
    jumpHeld: boolean;
    dodgeBuffered: boolean;  // client: inputBuffer.has('dodge'); server: raw dodge
    aimUp: boolean;
    aimDown: boolean;
    recoveryRequested: boolean; // client: up+heavy in air triggers recovery
}

// ─── Constants ───

export const NULL_INPUT: SimInput = {
    moveLeft: false,
    moveRight: false,
    moveDown: false,
    moveUp: false,
    jumpBuffered: false,
    jumpHeld: false,
    dodgeBuffered: false,
    aimUp: false,
    aimDown: false,
    recoveryRequested: false,
};

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
        jumpHoldTime: 0,
        wasJumpHeld: false,
        isFastFalling: false,

        isWallSliding: false,
        wallDirection: 0,
        isTouchingWall: false,
        wallTouchesExhausted: false,
        lastWallTouchTimer: 0,
        lastWallDirection: 0,

        isDodging: false,
        isSpotDodging: false,
        dodgeTimer: 0,
        dodgeCooldownTimer: 0,
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
        isThrowCharging: false,
        attackPhase: ATTACK_PHASE_NONE,
        attackType: ATTACK_TYPE_NONE,
        shouldStallInAir: false,

        isRunning: false,
        facingDirection,
        damagePercent: 0,
        lives: 3,
    };
}

// ═══════════════════════════════════════════════════════════════
//  MAIN STEP FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Run one full physics tick. Matches PlayerPhysics.update() exactly.
 * @param body   - Mutable physics body (modified in place)
 * @param input  - Input state for this frame
 * @param dt     - Delta time in SECONDS (e.g. 1/60)
 * @returns Array of events for the client to process (SFX, state changes)
 */
export function stepPhysics(body: SimBody, input: SimInput, dt: number): PhysicsEvent[] {
    const events: PhysicsEvent[] = [];
    const dtMs = dt * 1000;

    // ── Timers ──
    updateTimers(body, dtMs, events);

    // ── Drop-through grace timer ──
    if (body.dropGraceTimer > 0) {
        body.dropGraceTimer -= dtMs;
        if (body.dropGraceTimer <= 0) {
            body.droppingThroughPlatformIdx = -1;
        }
    }

    // ── Frame state bookkeeping ──
    // Capture previous grounded state BEFORE resetting
    body.wasGroundedLastFrame = body.isGrounded;
    // Acceleration reset: gravity is always applied
    body.ax = 0;
    body.ay = PhysicsConfig.GRAVITY;

    // ── Mechanics (order matches PlayerPhysics.update) ──
    handleWallMechanics(body, input);
    handleHorizontalMovement(body, input);
    handleJump(body, input, dtMs, events);
    handleFastFall(body, input);
    handleDodgeInput(body, input, events);

    // ── Physics integration ──
    applyPhysics(body, dt, events);

    // NOTE: isGrounded is NOT reset here — it's still the previous frame's value.
    // applyPhysics sets body.isGrounded = false at the end (line 263 in PlayerPhysics.ts).
    // Collision checks (called separately) will set it back to true if landing.

    return events;
}

// ═══════════════════════════════════════════════════════════════
//  TIMER UPDATE
// ═══════════════════════════════════════════════════════════════

function updateTimers(body: SimBody, dtMs: number, events: PhysicsEvent[]): void {
    if (body.lastWallTouchTimer > 0) {
        body.lastWallTouchTimer -= dtMs;
    }

    if (body.dodgeCooldownTimer > 0) {
        body.dodgeCooldownTimer -= dtMs;
    }

    if (body.dodgeTimer > 0) {
        body.dodgeTimer -= dtMs;
        if (body.dodgeTimer <= 0) {
            endDodge(body, events);
        }
    }

    // Recovery timer is handled in applyPhysics (like PlayerPhysics)
}

// ═══════════════════════════════════════════════════════════════
//  WALL MECHANICS
// ═══════════════════════════════════════════════════════════════

function handleWallMechanics(body: SimBody, input: SimInput): void {
    if (body.isGrounded) {
        body.isWallSliding = false;
        return;
    }

    if (body.isTouchingWall) {
        const pushingWall = (body.wallDirection === -1 && input.moveLeft) ||
            (body.wallDirection === 1 && input.moveRight);

        if (pushingWall && body.vy > 0 && !body.wallTouchesExhausted) {
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
    if (body.isDodging && body.isSpotDodging) return; // Spot dodge locks X

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

    if (body.isDodging) return;

    // Run mechanic: default movement is RUN
    const isMoving = input.moveLeft || input.moveRight;
    const inRecovery = body.isAttacking;
    body.isRunning = body.isGrounded && isMoving && !inRecovery;

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

function handleJump(body: SimBody, input: SimInput, dtMs: number, events: PhysicsEvent[]): void {
    if (body.isDodging) return;

    // Block during heavy attacks
    if (body.isAttacking && body.attackType === ATTACK_TYPE_HEAVY) return;

    const jumpRequested = input.jumpBuffered;

    // Platform Drop: Down + Jump while on a soft platform
    if (input.moveDown && jumpRequested && body.currentPlatformIdx !== -1) {
        events.push({ type: 'consume', input: 'jump' });
        handlePlatformDrop(body);
        return;
    }

    // Jump Hold tracking
    if (input.jumpHeld) {
        body.jumpHoldTime += dtMs;
    } else {
        body.jumpHoldTime = 0;
    }

    // New Jump (first frame of press, not held from previous)
    if (jumpRequested && !body.wasJumpHeld) {
        events.push({ type: 'consume', input: 'jump' });
        performJump(body, events);
    }
    body.wasJumpHeld = input.jumpHeld;

    // Short Hop: releasing jump while ascending slowly → dampen
    if (!input.jumpHeld && body.vy < 0 && body.vy > PhysicsConfig.SHORT_HOP_FORCE) {
        body.vy *= PhysicsConfig.SHORT_HOP_VELOCITY_DAMP;
    }
}

function handlePlatformDrop(body: SimBody): void {
    if (body.currentPlatformIdx === -1) return;

    body.droppingThroughPlatformIdx = body.currentPlatformIdx;
    // Store the platform's center Y for same-height detection
    // (will be set by caller based on stage data — see note below)
    // For now, store from the current position context
    body.dropGraceTimer = PhysicsConfig.PLATFORM_DROP_GRACE_PERIOD;
    body.isGrounded = false;
    body.currentPlatformIdx = -1;
    body.y += PhysicsConfig.PLATFORM_DROP_NUDGE_Y;
    body.vy = PhysicsConfig.PLATFORM_DROP_PUSH_Y;
}

/**
 * Set the droppingThroughY from stage data.
 * Called externally after handlePlatformDrop if needed.
 */
export function setDropThroughY(body: SimBody, stage: SimStage): void {
    if (body.droppingThroughPlatformIdx >= 0 && body.droppingThroughPlatformIdx < stage.platforms.length) {
        body.droppingThroughY = stage.platforms[body.droppingThroughPlatformIdx].y;
    }
}

function performJump(body: SimBody, events: PhysicsEvent[]): void {
    // Wall Jump (current wall or coyote time)
    if (body.isWallSliding || (body.lastWallTouchTimer > 0 && !body.isGrounded)) {
        wallJump(body, events);
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
    if (body.jumpsRemaining > 0 && body.airActionCounter < PhysicsConfig.MAX_AIR_ACTIONS) {
        body.vy = PhysicsConfig.DOUBLE_JUMP_FORCE;
        body.jumpsRemaining--;
        body.airActionCounter++;
        events.push({ type: 'sfx', key: 'sfx_jump_2', volume: 0.5 });
    }
}

function wallJump(body: SimBody, events: PhysicsEvent[]): void {
    body.vy = PhysicsConfig.WALL_JUMP_FORCE_Y;

    const dir = body.wallDirection !== 0 ? body.wallDirection : body.lastWallDirection;
    body.vx = -dir * PhysicsConfig.WALL_JUMP_FORCE_X;

    body.isWallSliding = false;
    body.airActionCounter++;
    events.push({ type: 'sfx', key: 'sfx_jump_1', volume: 0.5 });
}

// ═══════════════════════════════════════════════════════════════
//  FAST FALL
// ═══════════════════════════════════════════════════════════════

function handleFastFall(body: SimBody, input: SimInput): void {
    if (!body.isGrounded &&
        body.vy >= PhysicsConfig.FAST_FALL_THRESHOLD &&
        input.moveDown &&
        !body.isFastFalling) {
        body.isFastFalling = true;
        body.vy *= PhysicsConfig.FAST_FALL_MULTIPLIER;
    }
}

// ═══════════════════════════════════════════════════════════════
//  DODGE
// ═══════════════════════════════════════════════════════════════

function handleDodgeInput(body: SimBody, input: SimInput, events: PhysicsEvent[]): void {
    if (body.dodgeCooldownTimer > 0) return;

    if (body.isAttacking && body.attackType === ATTACK_TYPE_HEAVY) return;

    if (!input.dodgeBuffered) return;
    events.push({ type: 'consume', input: 'dodge' });

    startDodge(body, input, events);
}

function startDodge(body: SimBody, input: SimInput, events: PhysicsEvent[]): void {
    body.isDodging = true;
    body.isInvincible = true;

    const hasDirectionalInput = input.moveLeft || input.moveRight;
    const isSpotDodge = !hasDirectionalInput ||
        ((input.aimUp || input.aimDown) && !input.moveLeft && !input.moveRight);

    if (isSpotDodge) {
        // SPOT DODGE
        body.isSpotDodging = true;
        body.dodgeDirection = 0;
        body.dodgeTimer = PhysicsConfig.SPOT_DODGE_DURATION;
        body.vx = 0;

        if (!body.isGrounded) {
            body.vy *= PhysicsConfig.SPOT_DODGE_AERIAL_Y_DAMP;
        }

        events.push({ type: 'dodge_start', isSpot: true, isGrounded: body.isGrounded });
    } else {
        // DIRECTIONAL DODGE
        body.isSpotDodging = false;
        body.dodgeTimer = PhysicsConfig.DODGE_DURATION;

        if (input.moveLeft && !input.moveRight) {
            body.dodgeDirection = -1;
        } else if (input.moveRight && !input.moveLeft) {
            body.dodgeDirection = 1;
        } else {
            body.dodgeDirection = body.facingDirection;
        }

        const dodgeSpeed = body.dodgeDirection * (PhysicsConfig.DODGE_DISTANCE / (PhysicsConfig.DODGE_DURATION / 1000));
        body.vx = dodgeSpeed;

        if (!body.isGrounded) {
            body.vy *= PhysicsConfig.AIR_DODGE_VERTICAL_DAMP;
        }

        events.push({ type: 'sfx', key: 'sfx_dash', volume: 0.5 });
        events.push({ type: 'dodge_start', isSpot: false, isGrounded: body.isGrounded });
    }
}

function endDodge(body: SimBody, events: PhysicsEvent[]): void {
    body.isDodging = false;
    body.isInvincible = false;
    body.dodgeCooldownTimer = PhysicsConfig.DODGE_COOLDOWN;
    body.isSpotDodging = false;
    events.push({ type: 'dodge_end' });
}

// ═══════════════════════════════════════════════════════════════
//  PHYSICS INTEGRATION (applyPhysics)
// ═══════════════════════════════════════════════════════════════

function applyPhysics(body: SimBody, dt: number, events: PhysicsEvent[]): void {
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

    body.vy += body.ay * dt;

    // ── Friction ──
    // NOTE: body.isGrounded here is the PREVIOUS frame's value (matches PlayerPhysics behavior)

    let friction: number = body.isGrounded ? PhysicsConfig.FRICTION : PhysicsConfig.AIR_FRICTION;

    // Dynamic friction
    const isHighSpeed = Math.abs(body.vx) > PhysicsConfig.MAX_SPEED * PhysicsConfig.HIGH_SPEED_THRESHOLD_MULT;

    if (body.isRunning || (isHighSpeed && body.isGrounded)) {
        friction = PhysicsConfig.RUN_FRICTION;
    }

    // Charge friction
    if (body.isCharging || body.isThrowCharging) {
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

    // Dash: maintain exact velocity (friction = 1.0)
    if (body.isDodging && !body.isSpotDodging) {
        friction = 1.0;
    }

    // Apply friction TWICE (matches PlayerPhysics.ts lines 185+187 — tuned around this)
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
            events.push({ type: 'recovery_end' });
        }
    }

    // ── Reset grounded for collision phase ──
    body.isGrounded = false;
}

// ═══════════════════════════════════════════════════════════════
//  COLLISION: SINGLE PLATFORM (per-element, for client wrapper)
// ═══════════════════════════════════════════════════════════════

/**
 * Check collision against a single platform.
 * Uses center-origin coordinates for the platform.
 * Called by the client wrapper (per-platform iteration) and by checkPlatformCollisions.
 */
export function checkSinglePlatformCollision(
    body: SimBody, platIdx: number,
    platCx: number, platCy: number, platW: number, platH: number,
    isSoft: boolean
): PhysicsEvent[] {
    const events: PhysicsEvent[] = [];
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
        return events;
    }

    // Soft platform logic
    if (isSoft) {
        if (body.dropGraceTimer > 0) {
            if (body.droppingThroughPlatformIdx === platIdx) return events;
            if (!isNaN(body.droppingThroughY) && Math.abs(platCy - body.droppingThroughY) < 5) return events;
        }
        if (body.vy < 0) return events;
        if (bodyBottom > platTop + PhysicsConfig.PLATFORM_SNAP_THRESHOLD) return events;
    } else {
        if (body.vy < 0) return events;
        if (bodyBottom > platTop + PhysicsConfig.PLATFORM_SNAP_THRESHOLD) return events;
    }

    // Landing
    if (body.vy >= 0) {
        const wasGrounded = body.wasGroundedLastFrame;

        body.y = platTop - halfH;
        body.vy = 0;
        body.isGrounded = true;
        body.isFastFalling = false;

        if (body.isRecovering) {
            body.isRecovering = false;
            events.push({ type: 'recovery_end' });
        }

        body.jumpsRemaining = PhysicsConfig.MAX_JUMPS - 1;
        body.recoveryAvailable = true;
        body.droppingThroughPlatformIdx = -1;
        body.droppingThroughY = NaN;
        body.airActionCounter = 0;
        body.wallTouchesExhausted = false;
        body.currentPlatformIdx = isSoft ? platIdx : -1;

        if (!wasGrounded) {
            events.push({ type: 'sfx', key: 'sfx_landing', volume: 0.8 });
            events.push({ type: 'landing' });
        }
    }

    return events;
}

/**
 * Check all platform collisions (convenience for server).
 */
export function checkPlatformCollisions(body: SimBody, stage: SimStage): PhysicsEvent[] {
    const events: PhysicsEvent[] = [];
    for (let i = 0; i < stage.platforms.length; i++) {
        const p = stage.platforms[i];
        events.push(...checkSinglePlatformCollision(body, i, p.x, p.y, p.w, p.h, p.isSoft));
    }
    return events;
}

// ═══════════════════════════════════════════════════════════════
//  COLLISION: WALLS (per-element + bulk)
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

/** Check all wall collisions (convenience for server). */
export function checkWallCollisions(body: SimBody, stage: SimStage): void {
    resetWallState(body);
    for (const w of stage.walls) {
        checkSingleWallCollision(body, w.x, w.y, w.w, w.h);
    }
}

// ═══════════════════════════════════════════════════════════════
//  BLAST ZONE
// ═══════════════════════════════════════════════════════════════

export function checkBlastZone(body: SimBody, stage: SimStage): boolean {
    const bz = stage.blastZones;
    return body.x < bz.left || body.x > bz.right ||
        body.y < bz.top || body.y > bz.bottom;
}

// ═══════════════════════════════════════════════════════════════
//  STANDALONE ACTIONS (called externally)
// ═══════════════════════════════════════════════════════════════

/** Perform a jump (for external callers like FSM states). */
export function doJump(body: SimBody): PhysicsEvent[] {
    const events: PhysicsEvent[] = [];
    performJump(body, events);
    return events;
}

/**
 * Start a recovery move. Sets velocity and state.
 * Visual effects (ghost sprite) are handled by the client.
 */
export function startRecovery(body: SimBody): PhysicsEvent[] {
    if (!body.recoveryAvailable) return [];

    body.isRecovering = true;
    body.recoveryAvailable = false;
    body.recoveryTimer = PhysicsConfig.RECOVERY_DURATION;

    body.vy = PhysicsConfig.RECOVERY_FORCE_Y;
    body.vx = body.facingDirection * PhysicsConfig.RECOVERY_FORCE_X;

    body.isWallSliding = false;
    body.isFastFalling = false;

    return [
        { type: 'sfx', key: 'sfx_jump_2', volume: 0.6 },
    ];
}

// ═══════════════════════════════════════════════════════════════
//  UTILITY
// ═══════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
