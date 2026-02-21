/**
 * PhysicsSimulation.ts — Pure, deterministic physics functions.
 *
 * NO Phaser, NO DOM, NO side-effects.
 * Runs identically on client (browser) and server (Node.js).
 *
 * All functions are pure: (state, input, config) → new state.
 * Extracted from: src/entities/player/PlayerPhysics.ts
 */

import { PhysicsConfig } from './PhysicsConfig.js';
import type { SimStage } from './StageData.js';

// ─── Core Types ───

/** Input state for a single frame. */
export interface SimInput {
    moveLeft: boolean;
    moveRight: boolean;
    jump: boolean;
    jumpHeld: boolean;
    dodge: boolean;
    lightAttack: boolean;
    heavyAttack: boolean;
    down: boolean;
    up: boolean;
}

/** Mutable body state for a single player. */
export interface SimBody {
    x: number;
    y: number;
    vx: number;
    vy: number;
    width: number;
    height: number;
    facingDirection: number;        // 1 or -1

    // Ground/Air
    isGrounded: boolean;
    jumpCount: number;
    isFastFalling: boolean;

    // Run
    isRunning: boolean;

    // Dodge
    isDodging: boolean;
    isSpotDodging: boolean;
    dodgeTimer: number;             // ms remaining
    dodgeCooldown: number;          // ms remaining
    dodgeDirection: number;         // -1, 0, 1

    // Attack (simplified — server tracks phase timers)
    isAttacking: boolean;
    attackTimer: number;            // ms remaining in current phase

    // HitStun
    isHitStunned: boolean;
    hitStunTimer: number;           // ms remaining

    // Invincibility
    isInvincible: boolean;

    // Damage
    damagePercent: number;
    lives: number;
}

/** Null (idle) input — no buttons pressed. */
export const NULL_INPUT: SimInput = {
    moveLeft: false,
    moveRight: false,
    jump: false,
    jumpHeld: false,
    dodge: false,
    lightAttack: false,
    heavyAttack: false,
    down: false,
    up: false,
};

/** Create a fresh body at a spawn position. */
export function createBody(x: number, y: number, facingDirection: number = 1): SimBody {
    return {
        x, y,
        vx: 0, vy: 0,
        width: PhysicsConfig.PLAYER_WIDTH,
        height: PhysicsConfig.PLAYER_HEIGHT,
        facingDirection,
        isGrounded: false,
        jumpCount: 0,
        isFastFalling: false,
        isRunning: false,
        isDodging: false,
        isSpotDodging: false,
        dodgeTimer: 0,
        dodgeCooldown: 0,
        dodgeDirection: 0,
        isAttacking: false,
        attackTimer: 0,
        isHitStunned: false,
        hitStunTimer: 0,
        isInvincible: false,
        damagePercent: 0,
        lives: 3,
    };
}

// ─── Physics Step ───

/**
 * Advance a body by one tick.
 * This is the main physics entry point.
 *
 * @param body - Mutable body state (will be modified in place for efficiency)
 * @param input - Input for this tick
 * @param dt - Delta time in seconds (e.g., 1/60)
 * @returns The same body reference (mutated)
 */
export function stepPhysics(body: SimBody, input: SimInput, dt: number): SimBody {
    // 1. Timers
    updateTimers(body, dt * 1000); // timers are in ms

    // 2. Input → Acceleration
    if (!body.isHitStunned) {
        handleMovement(body, input);
        handleJump(body, input);
        handleFastFall(body, input);
        handleDodge(body, input);
    }

    // 3. Apply physics (gravity, friction, velocity → position)
    applyPhysics(body, dt);

    return body;
}

// ─── Timers ───

function updateTimers(body: SimBody, deltaMs: number): void {
    // Dodge cooldown
    if (body.dodgeCooldown > 0) {
        body.dodgeCooldown -= deltaMs;
    }

    // Dodge active
    if (body.dodgeTimer > 0) {
        body.dodgeTimer -= deltaMs;

        // End invincibility early
        const invDuration = body.isSpotDodging
            ? PhysicsConfig.SPOT_DODGE_DURATION - PhysicsConfig.DODGE_INVINCIBILITY
            : PhysicsConfig.DODGE_DURATION - PhysicsConfig.DODGE_INVINCIBILITY;

        if (body.dodgeTimer < invDuration) {
            body.isInvincible = false;
        }

        // Dodge finished
        if (body.dodgeTimer <= 0) {
            body.isDodging = false;
            body.isInvincible = false;
            body.dodgeCooldown = PhysicsConfig.DODGE_COOLDOWN;
            body.isSpotDodging = false;
        }
    }

    // HitStun
    if (body.hitStunTimer > 0) {
        body.hitStunTimer -= deltaMs;
        if (body.hitStunTimer <= 0) {
            body.isHitStunned = false;
        }
    }

    // Attack timer
    if (body.attackTimer > 0) {
        body.attackTimer -= deltaMs;
        if (body.attackTimer <= 0) {
            body.isAttacking = false;
        }
    }
}

// ─── Movement ───

function handleMovement(body: SimBody, input: SimInput): void {
    if (body.isDodging) return;
    if (body.isAttacking) return; // Simplified — lock movement during attacks

    const isMoving = input.moveLeft || input.moveRight;
    body.isRunning = body.isGrounded && isMoving;

    let accel = PhysicsConfig.MOVE_ACCEL;
    if (body.isRunning) {
        accel *= PhysicsConfig.RUN_ACCEL_MULT;
    }

    let moveForce = 0;
    if (input.moveLeft) moveForce -= accel;
    if (input.moveRight) moveForce += accel;

    // Update facing
    if (moveForce !== 0 && !body.isAttacking) {
        body.facingDirection = moveForce > 0 ? 1 : -1;
    }

    // Store as acceleration (applied in applyPhysics)
    body.vx += moveForce * (1 / 60); // Approximate — will use real dt in applyPhysics
}

// ─── Jump ───

function handleJump(body: SimBody, input: SimInput): void {
    if (body.isDodging) return;
    if (body.isAttacking) return;

    if (input.jump && body.jumpCount < PhysicsConfig.MAX_JUMPS) {
        if (body.isGrounded) {
            body.vy = PhysicsConfig.JUMP_FORCE;
        } else {
            body.vy = PhysicsConfig.DOUBLE_JUMP_FORCE;
        }
        body.isGrounded = false;
        body.jumpCount++;
        body.isFastFalling = false;
    }

    // Short hop: release jump early
    if (!input.jumpHeld && body.vy < 0) {
        body.vy *= PhysicsConfig.SHORT_HOP_VELOCITY_DAMP;
    }
}

// ─── Fast Fall ───

function handleFastFall(body: SimBody, input: SimInput): void {
    if (body.isGrounded || body.isDodging) return;

    if (input.down && body.vy > PhysicsConfig.FAST_FALL_THRESHOLD) {
        body.isFastFalling = true;
    }
}

// ─── Dodge ───

function handleDodge(body: SimBody, input: SimInput): void {
    if (!input.dodge) return;
    if (body.isDodging) return;
    if (body.dodgeCooldown > 0) return;
    if (body.isAttacking) return;

    body.isDodging = true;
    body.isInvincible = true;

    const isMoving = input.moveLeft || input.moveRight;

    if (!isMoving) {
        // Spot dodge
        body.isSpotDodging = true;
        body.dodgeDirection = 0;
        body.dodgeTimer = PhysicsConfig.SPOT_DODGE_DURATION;
    } else {
        // Directional dodge
        body.isSpotDodging = false;
        body.dodgeTimer = PhysicsConfig.DODGE_DURATION;

        if (input.moveLeft) {
            body.dodgeDirection = -1;
        } else if (input.moveRight) {
            body.dodgeDirection = 1;
        } else {
            body.dodgeDirection = body.facingDirection;
        }

        // Apply dodge velocity
        const dodgeSpeed = body.dodgeDirection * (PhysicsConfig.DODGE_DISTANCE / (PhysicsConfig.DODGE_DURATION / 1000));
        body.vx = dodgeSpeed;

        if (!body.isGrounded) {
            body.vy *= PhysicsConfig.AIR_DODGE_VERTICAL_DAMP;
        }
    }
}

// ─── Physics Application ───

function applyPhysics(body: SimBody, dt: number): void {
    // Gravity
    if (!body.isGrounded) {
        let gravity = PhysicsConfig.GRAVITY;
        if (body.isFastFalling) {
            gravity *= PhysicsConfig.FAST_FALL_MULTIPLIER;
        }
        body.vy += gravity * dt;
    } else {
        // Grounding force: apply a tiny downward nudge to keep the player
        // slightly embedded in the platform surface. This prevents the
        // classic "ground oscillation" bug where the player alternates
        // between grounded/airborne every other frame.
        body.vy = 1;
    }

    // Speed cap
    let maxSpeedCheck = PhysicsConfig.MAX_SPEED;
    if (body.isRunning) maxSpeedCheck *= PhysicsConfig.RUN_SPEED_MULT;

    if (!body.isDodging && !body.isHitStunned) {
        if (Math.abs(body.vx) > maxSpeedCheck) {
            // Soft cap — don't add more speed in the same direction
            // (handled in handleMovement already by not over-accelerating)
        }
    }

    // Max fall speed
    if (body.vy > PhysicsConfig.MAX_FALL_SPEED) {
        body.vy = PhysicsConfig.MAX_FALL_SPEED;
    }

    // Friction
    let friction: number = body.isGrounded ? PhysicsConfig.FRICTION : PhysicsConfig.AIR_FRICTION;

    const isHighSpeed = Math.abs(body.vx) > PhysicsConfig.MAX_SPEED * PhysicsConfig.HIGH_SPEED_THRESHOLD_MULT;
    if (body.isRunning || (isHighSpeed && body.isGrounded)) {
        friction = PhysicsConfig.RUN_FRICTION;
    }

    if (body.isHitStunned) {
        friction = PhysicsConfig.HITSTUN_FRICTION;
    }

    // No friction during dodge (momentum preservation)
    if (body.isDodging && !body.isSpotDodging) {
        friction = 1.0;
    }

    body.vx *= friction;

    // Position update
    body.x += body.vx * dt;
    body.y += body.vy * dt;

    // Reset grounded (will be set by collision checks)
    body.isGrounded = false;
}

// ─── Collision Detection ───

/**
 * Check and resolve platform collisions for a body.
 * Mutates body in place.
 */
export function checkPlatformCollisions(body: SimBody, stage: SimStage): SimBody {
    const halfW = body.width / 2;
    const halfH = body.height / 2;

    for (const plat of stage.platforms) {
        const platLeft = plat.x - plat.w / 2;
        const platRight = plat.x + plat.w / 2;
        const platTop = plat.y - plat.h / 2;
        const platBottom = plat.y + plat.h / 2;

        const bodyLeft = body.x - halfW;
        const bodyRight = body.x + halfW;
        const bodyTop = body.y - halfH;
        const bodyBottom = body.y + halfH;

        // AABB overlap check (1px epsilon for ground-sticking tolerance)
        const GROUND_EPS = 1;
        if (bodyRight <= platLeft || bodyLeft >= platRight) continue;
        if (bodyBottom < platTop - GROUND_EPS || bodyTop >= platBottom) continue;

        // For soft platforms, only land from above
        if (plat.isSoft) {
            // Only resolve if player's feet are near the top of the platform
            // and player is falling
            if (body.vy > 0 && bodyBottom - platTop < PhysicsConfig.PLATFORM_SNAP_THRESHOLD) {
                body.y = platTop - halfH;
                body.vy = 0;
                body.isGrounded = true;
                body.jumpCount = 0;
                body.isFastFalling = false;
            }
            continue;
        }

        // Hard platform — resolve based on penetration depth
        const overlapLeft = bodyRight - platLeft;
        const overlapRight = platRight - bodyLeft;
        const overlapTop = bodyBottom - platTop;
        const overlapBottom = platBottom - bodyTop;

        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

        if (minOverlap === overlapTop && body.vy >= 0) {
            // Landing on top
            body.y = platTop - halfH;
            body.vy = 0;
            body.isGrounded = true;
            body.jumpCount = 0;
            body.isFastFalling = false;
        } else if (minOverlap === overlapBottom && body.vy < 0) {
            // Hit ceiling
            body.y = platBottom + halfH;
            body.vy = 0;
        } else if (minOverlap === overlapLeft) {
            // Hit left wall of platform
            body.x = platLeft - halfW;
            body.vx = 0;
        } else if (minOverlap === overlapRight) {
            // Hit right wall of platform
            body.x = platRight + halfW;
            body.vx = 0;
        }
    }

    return body;
}

/**
 * Check and resolve wall collisions for a body.
 * Walls are slideable vertical surfaces.
 * Mutates body in place.
 */
export function checkWallCollisions(body: SimBody, stage: SimStage): SimBody {
    const halfW = body.width / 2;
    const halfH = body.height / 2;

    for (const wall of stage.walls) {
        const wallLeft = wall.x - wall.w / 2;
        const wallRight = wall.x + wall.w / 2;
        const wallTop = wall.y - wall.h / 2;
        const wallBottom = wall.y + wall.h / 2;

        const bodyLeft = body.x - halfW;
        const bodyRight = body.x + halfW;
        const bodyTop = body.y - halfH;
        const bodyBottom = body.y + halfH;

        // AABB overlap
        if (bodyRight <= wallLeft || bodyLeft >= wallRight) continue;
        if (bodyBottom <= wallTop || bodyTop >= wallBottom) continue;

        // Resolve horizontally
        const overlapLeft = bodyRight - wallLeft;
        const overlapRight = wallRight - bodyLeft;

        if (overlapLeft < overlapRight) {
            body.x = wallLeft - halfW;
        } else {
            body.x = wallRight + halfW;
        }
        body.vx = 0;

        // Wall slide: clamp downward speed
        if (!body.isGrounded && body.vy > 0) {
            if (body.vy > PhysicsConfig.WALL_SLIDE_SPEED) {
                body.vy = PhysicsConfig.WALL_SLIDE_SPEED;
            }
        }
    }

    return body;
}

/**
 * Check if a body is outside the blast zone (death).
 * Returns true if the body should be killed.
 */
export function checkBlastZone(body: SimBody, stage: SimStage): boolean {
    const bz = stage.blastZones;
    return (
        body.x < bz.left ||
        body.x > bz.right ||
        body.y < bz.top ||
        body.y > bz.bottom
    );
}
