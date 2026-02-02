import { PhysicsConfig } from '../physics/PhysicsConfig';
import { Vector2 } from '../math/Vector2';
import type { InputState } from '../input/InputState';
import { RectUtils, type Rect } from '../math/Rect';
// actually AttackPhase is in src/combat/Attack.ts which is NOT shared. 
// We cannot import from ../../src in shared.
// I must Stub or Move AttackPhase. 
// For now, I'll rely on flags passed in or simpler checks, or just use raw strings/ints if needed.
// Or effectively, I should create a SharedCombatTypes.

export class PlayerState {
    // Physics properties
    public x: number;
    public y: number;
    public velocity: Vector2;
    public acceleration: Vector2;
    public width: number;
    public height: number;
    public prevX: number;
    public prevY: number;

    constructor(x: number, y: number, width: number = PhysicsConfig.PLAYER_WIDTH, height: number = PhysicsConfig.PLAYER_HEIGHT) {
        this.x = x;
        this.y = y;
        this.prevX = x;
        this.prevY = y;
        this.width = width;
        this.height = height;
        this.velocity = new Vector2(0, 0);
        this.acceleration = new Vector2(0, 0);
    }
    public isFastFalling: boolean = false;
    public facingDirection: number = 1;
    public health: number = 0; // damagePercent
    public lives: number = 3;

    // Jump State
    public jumpsRemaining: number = PhysicsConfig.MAX_JUMPS;
    public airActionCounter: number = 0;
    public jumpHoldTime: number = 0;
    public wasJumpHeld: boolean = false;

    // Recovery State
    public isRecovering: boolean = false;
    public recoveryAvailable: boolean = true;
    public recoveryTimer: number = 0;

    // Wall Mechanics
    public isWallSliding: boolean = false;
    public wallDirection: number = 0; // -1 = left, 1 = right
    public isTouchingWall: boolean = false;
    public wallTouchesExhausted: boolean = false;

    // Dodge State
    public isDodging: boolean = false;
    public isSpotDodging: boolean = false;
    public dodgeTimer: number = 0;
    public dodgeCooldownTimer: number = 0;
    public dodgeDirection: number = 0;
    public isInvincible: boolean = false;
    public isRunning: boolean = false;
    public isGrounded: boolean = false; // Restored

    // Status Flags (Set by Combat/Game Logic)
    public isAttacking: boolean = false;
    public isCharging: boolean = false;
    public isHitStunned: boolean = false;
    public isLedgeHanging: boolean = false;
    public isInAttackPhase: boolean = false;
    public isInAttackRecovery: boolean = false;

    // Platform Logic
    public currentPlatform: Rect | null = null;
    public droppingThroughPlatformId: string | null = null;
    public dropGraceTimer: number = 0;


    public attackTimer: number = 0;
    public attackRecoveryTimer: number = 0;

    public update(delta: number, input?: InputState): void {
        const deltaSeconds = delta / 1000;

        // Reset per-frame flags before simulation (important for deterministic re-collision)


        // Timers
        this.updateTimers(delta);

        if (this.attackTimer > 0) {
            this.attackTimer -= delta;
            if (this.attackTimer <= 0) {
                this.isAttacking = false;
                this.isInAttackRecovery = true;
                this.attackRecoveryTimer = PhysicsConfig.LIGHT_RECOVERY_FRAMES * (1000 / 60); // Approx
            }
        }

        if (this.attackRecoveryTimer > 0) {
            this.attackRecoveryTimer -= delta;
            if (this.attackRecoveryTimer <= 0) {
                this.isInAttackRecovery = false;
            }
        }

        if (this.dropGraceTimer > 0) {
            this.dropGraceTimer -= delta;
            if (this.dropGraceTimer <= 0) {
                this.droppingThroughPlatformId = null;
            }
        }

        // 1. Reset Acceleration (Gravity is constant)
        this.isGrounded = false; // Reset per-frame before physics
        this.acceleration.set(0, PhysicsConfig.GRAVITY);

        // 2. Handle Mechanics
        if (input && !this.isHitStunned && !this.isLedgeHanging) {
            this.handleWallMechanics(input);
            this.handleHorizontalMovement(input);
            this.handleJump(delta, input);
            this.handleFastFall(input);
            this.handleDodgeInput(input);
            this.handleAttackInput(delta, input);
        }

        // 3. Ledge Hang Logic (Stub)
        if (this.isLedgeHanging) {
            return;
        }

        // 4. Apply Physics & Collisions (Sub-stepped)
        this.executeSubSteppedPhysics(deltaSeconds);

        // Reset Grounded State MOVED to top of loop to persist sub-step grounding
        // this.isGrounded = false; (Deleted)

        // --- PLATFORM & WALL COLLISIONS (Unified Logic) ---
        const { MAIN_PLATFORM, SOFT_PLAT_1, SOFT_PLAT_2 } = PhysicsConfig.STAGE_GEOMETRY;

        // 5. Land on Platforms
        this.checkSolidCollision(MAIN_PLATFORM);
        if (SOFT_PLAT_1.width > 0) this.checkPlatformCollision(SOFT_PLAT_1, true);
        if (SOFT_PLAT_2.width > 0) this.checkPlatformCollision(SOFT_PLAT_2, true);

        // 6. Hit Walls
        this.checkWallCollision(PhysicsConfig.WALL_LEFT, PhysicsConfig.WALL_RIGHT);
    }

    private executeSubSteppedPhysics(totalDelta: number): void {
        const SUB_STEP = 0.005; // 5ms steps (200Hz)
        let remainingTime = totalDelta;

        // 1. Update Velocities (Gravity, Friction, Input) once per frame
        // (Approximation: simpler than integrating forces per sub-step, safe for constant gravity)
        this.updateVelocity(totalDelta);

        // 2. Store Previous State (Start of frame)
        this.prevX = this.x;
        this.prevY = this.y;

        // 3. Sub-step Movement & Collision
        while (remainingTime > 0) {
            const dt = Math.min(remainingTime, SUB_STEP);

            // Move
            this.x += this.velocity.x * dt;
            this.y += this.velocity.y * dt;

            // Collide (Interleaved)
            const { MAIN_PLATFORM, SOFT_PLAT_1, SOFT_PLAT_2 } = PhysicsConfig.STAGE_GEOMETRY;
            this.checkPlatformCollision(MAIN_PLATFORM, false);
            this.checkPlatformCollision(SOFT_PLAT_1, true);
            this.checkPlatformCollision(SOFT_PLAT_2, true);
            this.checkWallCollision(0, 1920);

            remainingTime -= dt;
        }

        // Recovery Timer
        if (this.isRecovering) {
            this.recoveryTimer -= totalDelta * 1000;
            if (this.recoveryTimer <= 0) this.isRecovering = false;
        }
    }

    private updateVelocity(deltaSeconds: number): void {
        // Apply acceleration
        let maxSpeedCheck = PhysicsConfig.MAX_SPEED;
        if (this.isRunning) maxSpeedCheck *= PhysicsConfig.RUN_SPEED_MULT;

        if (!this.isDodging && !this.isHitStunned) {
            const movingSameDir = Math.sign(this.acceleration.x) === Math.sign(this.velocity.x);
            const overSpeed = Math.abs(this.velocity.x) > maxSpeedCheck;

            if (movingSameDir && overSpeed) {
                // Don't add acceleration
            } else {
                this.velocity.x += this.acceleration.x * deltaSeconds;
            }
        } else {
            this.velocity.x += this.acceleration.x * deltaSeconds;
        }

        // Reduce gravity during recovery to prevent "clipping" - REMOVED: Causing floaty jumps
        // if (this.isRecovering) {
        //     this.acceleration.y *= 0.3;
        // }

        this.velocity.y += this.acceleration.y * deltaSeconds;

        // Apply friction
        let friction: number = PhysicsConfig.FRICTION;
        const isHighSpeed = Math.abs(this.velocity.x) > PhysicsConfig.MAX_SPEED * 1.2;

        if (this.isRunning || (isHighSpeed && this.isGrounded)) {
            friction = PhysicsConfig.RUN_FRICTION;
        }

        if (this.isCharging) {
            friction = 0.2;
            if (!this.isGrounded) {
                this.velocity.y *= 0.5;
            }
        } else if (this.isAttacking) {
            if (this.isInAttackRecovery) {
                friction = 0.75;
            } else {
                friction = 0.95;
            }
        } else if (this.isHitStunned) {
            friction = 0.95;
        }

        if (this.isRecovering) {
            friction = 1.0; // No sideways friction during recovery
        }

        this.velocity.x *= friction;

        // Clamp speed
        let maxSpeed = PhysicsConfig.MAX_SPEED;
        if (this.isRunning) maxSpeed *= PhysicsConfig.RUN_SPEED_MULT;

        if (!this.isDodging && !this.isHitStunned) {
            if (Math.abs(this.velocity.x) > maxSpeed) {
                // Decay logic handled by friction
            } else {
                // Hard clamp to prevent micro-acceleration past max
                if (this.velocity.x > maxSpeed) this.velocity.x = maxSpeed;
                if (this.velocity.x < -maxSpeed) this.velocity.x = -maxSpeed;
            }
        }
    }

    private updateTimers(delta: number): void {
        if (this.dodgeCooldownTimer > 0) {
            this.dodgeCooldownTimer -= delta;
        }

        if (this.dodgeTimer > 0) {
            this.dodgeTimer -= delta;

            // End invincibility early
            if (this.isSpotDodging) {
                if (this.dodgeTimer < PhysicsConfig.SPOT_DODGE_DURATION - PhysicsConfig.DODGE_INVINCIBILITY) {
                    this.isInvincible = false;
                }
            } else {
                if (this.dodgeTimer < PhysicsConfig.DODGE_DURATION - PhysicsConfig.DODGE_INVINCIBILITY) {
                    this.isInvincible = false;
                }
            }

            if (this.dodgeTimer <= 0) {
                this.endDodge();
            }
        }
    }


    // Renamed from applyPhysics to part of updateVelocity
    public applyPhysics(deltaSeconds: number): void {
        this.executeSubSteppedPhysics(deltaSeconds);
    }


    private handleHorizontalMovement(input: InputState): void {
        if (this.isWallSliding) return;
        if (this.isDodging && this.isSpotDodging) return;

        // Prevent movement checks
        if (this.isAttacking && !this.isInAttackRecovery) {
            return;
        }

        let moveForce = 0;
        if (this.isDodging) return;

        // Run Mechanic
        const isMoving = input.moveLeft || input.moveRight;
        this.isRunning = this.isGrounded && isMoving && input.dodgeHeld && !this.isAttacking;

        let accel = PhysicsConfig.MOVE_ACCEL;
        if (this.isRunning) {
            accel *= PhysicsConfig.RUN_ACCEL_MULT;
        }

        if (input.moveLeft) {
            moveForce -= accel;
            this.facingDirection = -1;
        }
        if (input.moveRight) {
            moveForce += accel;
            this.facingDirection = 1;
        }

        this.acceleration.x += moveForce;
    }

    private handleJump(delta: number, input: InputState): void {
        if (this.isDodging) return;

        // Platform Drop
        if (input.moveDown && input.jump && this.currentPlatform) {
            this.handlePlatformDrop();
            return;
        }

        // Jump Hold
        if (input.jumpHeld) {
            this.jumpHoldTime += delta;
        } else {
            this.jumpHoldTime = 0;
        }

        // Recovery (Triple Jump)
        if (input.recovery) {
            console.log(`[HandleJump] Recovery Attempt. Rec:${input.recovery} Avail:${this.recoveryAvailable} G:${this.isGrounded} W:${this.isWallSliding} Touch:${this.isTouchingWall}`);
        }
        if (input.recovery && this.recoveryAvailable && !this.isGrounded && !this.isWallSliding && !this.isTouchingWall) {
            this.startRecovery();
            return;
        }

        // Jump Input
        if (input.jump && !this.wasJumpHeld) {
            this.performJump();
        }
        this.wasJumpHeld = input.jumpHeld;

        // Short Hop
        if (!input.jumpHeld && this.velocity.y < 0 && this.velocity.y > PhysicsConfig.SHORT_HOP_FORCE) {
            this.velocity.y *= 0.5;
        }
    }

    private handlePlatformDrop(): void {
        if (!this.currentPlatform) return;

        this.droppingThroughPlatformId = this.currentPlatform.id || null;
        this.dropGraceTimer = PhysicsConfig.PLATFORM_DROP_GRACE_PERIOD;

        this.isGrounded = false;
        this.currentPlatform = null;
        this.y += 1;
        this.velocity.y = 100;
    }


    public startRecovery(): void {
        console.log(`[PlayerState] startRecovery. Available: ${this.recoveryAvailable}`);
        if (!this.recoveryAvailable) return;

        this.isRecovering = true;
        this.recoveryAvailable = false;
        this.recoveryTimer = PhysicsConfig.RECOVERY_DURATION;

        this.velocity.y = PhysicsConfig.RECOVERY_FORCE_Y;
        this.velocity.x = this.facingDirection * PhysicsConfig.RECOVERY_FORCE_X;

        // Reset state
        this.isWallSliding = false;
        this.isFastFalling = false;
    }

    public performJump(): void {
        console.log(`[PlayerState] performJump. Grounded: ${this.isGrounded}, JumpsRemaining: ${this.jumpsRemaining}, Wall: ${this.isTouchingWall}`);
        // Wall Jump
        if (this.isWallSliding || (this.isTouchingWall && !this.isGrounded)) {
            console.log(`[PlayerState] Wall Jump Triggered!`);
            this.wallJump();
            return;
        }
        // Ground Jump
        if (this.isGrounded) {
            console.log(`[PlayerState] Ground Jump Triggered!`);
            this.velocity.y = PhysicsConfig.JUMP_FORCE;
            this.isGrounded = false;
            return;
        }
        // Double Jump
        if (this.jumpsRemaining > 0 && this.airActionCounter < 9) {
            console.log(`[PlayerState] Double Jump Triggered! Jumps Left: ${this.jumpsRemaining - 1}`);
            this.velocity.y = PhysicsConfig.DOUBLE_JUMP_FORCE;
            this.jumpsRemaining--;
            this.airActionCounter++;
        }
    }

    private wallJump(): void {
        this.velocity.y = PhysicsConfig.WALL_JUMP_FORCE_Y;
        this.velocity.x = -this.wallDirection * PhysicsConfig.WALL_JUMP_FORCE_X;
        this.isWallSliding = false;
        this.airActionCounter++;
    }

    private handleFastFall(input: InputState): void {
        if (!this.isGrounded &&
            this.velocity.y >= PhysicsConfig.FAST_FALL_THRESHOLD &&
            input.moveDown &&
            !this.isFastFalling) {

            this.isFastFalling = true;
            this.velocity.y *= PhysicsConfig.FAST_FALL_MULTIPLIER;
        }
    }

    private handleDodgeInput(input: InputState): void {
        if (this.dodgeCooldownTimer > 0) return;
        if (!input.dodge) return;
        this.startDodge(input);
    }

    private startDodge(input: InputState): void {
        this.isDodging = true;
        this.isInvincible = true;

        const hasDirectionalInput = input.moveLeft || input.moveRight;
        const isSpotDodge = !hasDirectionalInput || ((input.aimUp || input.aimDown) && !input.moveLeft && !input.moveRight);

        if (isSpotDodge) {
            this.isSpotDodging = true;
            this.dodgeDirection = 0;
            this.dodgeTimer = PhysicsConfig.SPOT_DODGE_DURATION;
            this.velocity.x = 0;
            if (!this.isGrounded) this.velocity.y *= 0.2;
        } else {
            this.isSpotDodging = false;
            this.dodgeTimer = PhysicsConfig.DODGE_DURATION;

            if (input.moveLeft && !input.moveRight) this.dodgeDirection = -1;
            else if (input.moveRight && !input.moveLeft) this.dodgeDirection = 1;
            else this.dodgeDirection = this.facingDirection;

            const dodgeSpeed = this.dodgeDirection * (PhysicsConfig.DODGE_DISTANCE / (PhysicsConfig.DODGE_DURATION / 1000));
            this.velocity.x = dodgeSpeed;
            if (!this.isGrounded) this.velocity.y *= 0.3;
        }
    }

    private endDodge(): void {
        this.isDodging = false;
        this.isInvincible = false;
        this.dodgeCooldownTimer = PhysicsConfig.DODGE_COOLDOWN;
        this.isSpotDodging = false;
    }

    public handleWallMechanics(input: InputState): void {
        if (this.isGrounded) {
            this.isWallSliding = false;
            return;
        }

        if (this.isTouchingWall) {
            const pushingWall = (this.wallDirection === -1 && input.moveLeft) ||
                (this.wallDirection === 1 && input.moveRight);

            if (pushingWall && this.velocity.y > 0 && !this.wallTouchesExhausted) {
                this.isWallSliding = true;
                this.isFastFalling = false;
                if (this.velocity.y > PhysicsConfig.WALL_SLIDE_SPEED) {
                    this.velocity.y = PhysicsConfig.WALL_SLIDE_SPEED;
                }
            } else {
                this.isWallSliding = false;
            }
        } else {
            this.isWallSliding = false;
        }
    }



    public checkSolidCollision(rect: Rect): void {
        const bounds = this.getBounds();

        // Simple AABB overlap check first
        if (!RectUtils.overlaps(bounds, rect)) return;

        // Calculate penetration depths
        const overlapX = (bounds.width / 2 + rect.width / 2) - Math.abs(this.x - rect.x);
        const overlapY = (bounds.height / 2 + rect.height / 2) - Math.abs(this.y - rect.y);

        // Resolve along the axis of least penetration
        if (overlapX < overlapY) {
            // Horizontal Collision (Wall)
            if (this.x < rect.x) {
                // Left side
                this.x -= overlapX;
                this.wallDirection = -1; // Wall is to the right
            } else {
                // Right side
                this.x += overlapX;
                this.wallDirection = 1; // Wall is to the left
            }
            this.velocity.x = 0;
            this.isTouchingWall = true;
        } else {
            // Vertical Collision
            if (this.velocity.y >= 0 && this.y < rect.y) {
                // Landing on Top
                this.y -= overlapY;
                this.velocity.y = 0;
                this.isGrounded = true;
                this.jumpsRemaining = PhysicsConfig.MAX_JUMPS - 1;
                this.recoveryAvailable = true;
                this.droppingThroughPlatformId = null;
                this.airActionCounter = 0;
                this.wallTouchesExhausted = false;
                this.currentPlatform = rect; // Treat as a platform
            } else if (this.velocity.y < 0 && this.y > rect.y) {
                // Hitting Ceiling
                this.y += overlapY;
                this.velocity.y = 0;
            }
        }
    }

    // Checking Collision (Engine Agnostic)
    private handleAttackInput(_delta: number, input: InputState): void {
        if (this.isAttacking || this.isInAttackRecovery || this.isDodging) return;

        if (input.lightAttack || input.heavyAttack) {
            this.isAttacking = true;
            // Use light attack duration as baseline for friction sync
            this.attackTimer = PhysicsConfig.LIGHT_ATTACK_DURATION;
        }
    }

    public checkWallCollision(left: number, right: number): void {
        const bounds = this.getBounds();
        // Swept X Check?
        // Simple clamp is usually enough IF sub-step is small enough (5ms * 1500px/s = 7.5px).
        // Player Width is 60. 7.5px is safe.
        // But let's be robust.

        if (bounds.x <= left) {
            this.x = left + this.width / 2;
            this.velocity.x = 0; // Stop momentum
            this.isTouchingWall = true;
            this.wallDirection = -1;
        } else if (bounds.x + bounds.width >= right) {
            this.x = right - this.width / 2;
            this.velocity.x = 0; // Stop momentum
            this.isTouchingWall = true;
            this.wallDirection = 1;
        }
    }

    public checkPlatformCollision(platform: Rect, isSoft: boolean = false): void {
        const playerBounds = this.getBounds();

        const platTop = platform.y - platform.height / 2;
        const playerPrevBottom = this.prevY - this.height / 2 + this.height; // prevY is center
        const currentBottom = this.y - this.height / 2 + this.height;

        // SWEPT COLLISION CHECK:
        // Did we cross the platform top boundary in this frame?
        // Tolerance: +10px (for floating point/substep errors)
        // CRITICAL FIX: Must also check X-axis overlap! passedThrough was previously infinite-width.
        const xOverlap = (playerBounds.x < platform.x + platform.width / 2 && playerBounds.x + playerBounds.width > platform.x - platform.width / 2);
        const passedThrough = (xOverlap && playerPrevBottom <= platTop + 10 && currentBottom >= platTop);

        // Standard Discrete Overlap
        const discreteOverlap = RectUtils.overlaps(playerBounds, platform);

        if (!discreteOverlap && !passedThrough) {
            if (this.currentPlatform === platform && isSoft) { // Only unset if it was THIS soft platform
                // Don't unset currentPlatform if we are on Main Platform (handled by Solid Check)
                if (this.currentPlatform.id === platform.id) {
                    this.currentPlatform = null;
                }
            }
            return;
        }

        if (isSoft) {
            if (this.droppingThroughPlatformId && this.droppingThroughPlatformId === platform.id && this.dropGraceTimer > 0) return;
            if (this.velocity.y < 0) return;

            // STRICTER LANDING CHECK:
            // 1. passedThrough: We crossed the top boundary strictly this frame.
            // 2. OR: We are overlapping, but our feet are VERY close to the top (within 15px).
            //    (This protects against "Invisible Floor" hovering from below)
            const feetDist = (playerBounds.y + playerBounds.height) - platTop;
            const isFeetNearTop = (feetDist >= -5 && feetDist <= 15);

            if (!passedThrough && !isFeetNearTop) return;
        }

        // Only land if falling
        if (this.velocity.y >= 0) {
            // SNAP TO SURFACE
            // If we detected a collision (either discrete or swept), we snap the player to the top of the platform.
            // avoiding any 'sinking' feeling.

            // Re-calculate top edge strictly
            const snapY = platTop - this.height / 2;

            this.y = snapY;
            this.velocity.y = 0;
            this.isGrounded = true;

            this.jumpsRemaining = PhysicsConfig.MAX_JUMPS - 1; // Reset jumps (consume 1 for ground jump possibility)
            this.recoveryAvailable = true;
            this.droppingThroughPlatformId = null;
            this.airActionCounter = 0;
            this.wallTouchesExhausted = false;
            this.currentPlatform = isSoft ? platform : null;
        }
    }

    public getBounds(): Rect {
        return {
            x: this.x - this.width / 2,
            y: this.y - this.height / 2,
            width: this.width,
            height: this.height
        };
    }

    public resetOnGround(): void {
        this.isGrounded = true;
        this.jumpsRemaining = PhysicsConfig.MAX_JUMPS - 1;
        this.airActionCounter = 0;
        this.isFastFalling = false;
        this.isWallSliding = false;
        this.wallTouchesExhausted = false;
        this.droppingThroughPlatformId = null;
    }

    public reset(): void {
        this.velocity.set(0, 0);
        this.acceleration.set(0, 0);
        this.isGrounded = false;
        this.jumpsRemaining = PhysicsConfig.MAX_JUMPS;
        this.airActionCounter = 0;
        this.isFastFalling = false;
        this.isWallSliding = false;
        this.wallTouchesExhausted = false;
        this.droppingThroughPlatformId = null;
        this.recoveryAvailable = true;
        this.dodgeTimer = 0;
        this.dodgeCooldownTimer = 0;
        this.isRecovering = false;
        this.isAttacking = false;
        this.isCharging = false;
        this.isHitStunned = false;
        this.isLedgeHanging = false;
    }
}
