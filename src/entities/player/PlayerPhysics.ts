import Phaser from 'phaser';
import { Player } from '../Player';
import { PhysicsConfig } from '../../config/PhysicsConfig';
import type { InputState } from '../../input/InputManager';
import { AttackPhase, AttackType } from '../../combat/Attack';

export class PlayerPhysics {
    private player: Player;

    // Physics State
    public acceleration: Phaser.Math.Vector2;
    public isGrounded: boolean = false;
    public isFastFalling: boolean = false;

    // Jump State
    public jumpsRemaining: number = 3; // Will be set by reset()
    public airActionCounter: number = 0;
    public jumpHoldTime: number = 0;
    public wasJumpHeld: boolean = false;

    // Recovery State
    public isRecovering: boolean = false;
    public recoveryAvailable: boolean = true;
    public lastRecoveryTime: number = 0;
    public recoveryTimer: number = 0;

    // Wall Mechanics
    public isWallSliding: boolean = false;
    public wallDirection: number = 0; // -1 = left, 1 = right
    public isTouchingWall: boolean = false;
    public wallTouchesExhausted: boolean = false;
    public lastWallTouchFrame: boolean = false;
    public lastWallTouchTimer: number = 0;
    public lastWallDirection: number = 0;

    // Ledge mechanics removed (User Request)

    // Dodge State
    public isDodging: boolean = false;
    public isSpotDodging: boolean = false;
    public dodgeTimer: number = 0;
    public dodgeCooldownTimer: number = 0;
    public dodgeDirection: number = 0;

    // Platform Logic
    public droppingThroughPlatform: Phaser.GameObjects.Rectangle | null = null;
    public dropGraceTimer: number = 0;
    public currentPlatform: Phaser.GameObjects.Rectangle | null = null;

    constructor(player: Player) {
        this.player = player;
        this.acceleration = new Phaser.Math.Vector2(0, 0);
    }

    public update(delta: number, input: InputState): void {
        const deltaSeconds = delta / 1000;

        // Timers
        this.updateTimers(delta);

        if (this.dropGraceTimer > 0) {
            this.dropGraceTimer -= delta;
            if (this.dropGraceTimer <= 0) {
                this.droppingThroughPlatform = null;
            }
        }

        // 1. Reset Acceleration (Gravity is constant)
        this.isGrounded = false; // Reset grounding at start of frame
        this.acceleration.set(0, PhysicsConfig.GRAVITY);

        // 2. Handle Mechanics
        this.handleWallMechanics(input);
        this.handleHorizontalMovement(input);
        this.handleJump(delta, input);
        this.handleFastFall(input);
        this.handleDodgeInput(input);

        // 4. Apply Physics (Integration)
        this.applyPhysics(deltaSeconds);
    }

    private updateTimers(delta: number): void {
        if (this.lastWallTouchTimer > 0) {
            this.lastWallTouchTimer -= delta;
        }

        if (this.dodgeCooldownTimer > 0) {
            this.dodgeCooldownTimer -= delta;
        }

        if (this.dodgeTimer > 0) {
            this.dodgeTimer -= delta;

            // End invincibility early
            if (this.isSpotDodging) {
                if (this.dodgeTimer < PhysicsConfig.SPOT_DODGE_DURATION - PhysicsConfig.DODGE_INVINCIBILITY) {
                    this.player.isInvincible = false;
                }
            } else {
                if (this.dodgeTimer < PhysicsConfig.DODGE_DURATION - PhysicsConfig.DODGE_INVINCIBILITY) {
                    this.player.isInvincible = false;
                }
            }

            if (this.dodgeTimer <= 0) {
                this.endDodge();
            }
        }
    }

    public applyPhysics(deltaSeconds: number): void {
        const velocity = this.player.velocity;

        // Apply acceleration
        // Soft Cap check: Don't add acceleration if already exceeding max speed in that direction
        let maxSpeedCheck = PhysicsConfig.MAX_SPEED;
        if (this.isRunning) maxSpeedCheck *= PhysicsConfig.RUN_SPEED_MULT;

        // If we are dodging, we ignore cap. If hitstunned, ignore cap.
        if (!this.player.isDodging && !this.player.isHitStunned) {
            const movingSameDir = Math.sign(this.acceleration.x) === Math.sign(velocity.x);
            const overSpeed = Math.abs(velocity.x) > maxSpeedCheck;

            if (movingSameDir && overSpeed) {
                // Don't add acceleration, let friction reduce speed
            } else {
                velocity.x += this.acceleration.x * deltaSeconds;
            }
        } else {
            velocity.x += this.acceleration.x * deltaSeconds;
        }

        velocity.y += this.acceleration.y * deltaSeconds;

        // Apply friction
        let friction: number = this.player.isGrounded ? PhysicsConfig.FRICTION : PhysicsConfig.AIR_FRICTION;

        // Dynamic Friction: Check momentum
        const isHighSpeed = Math.abs(velocity.x) > PhysicsConfig.MAX_SPEED * 1.2;

        if (this.isRunning || (isHighSpeed && this.player.isGrounded)) {
            friction = PhysicsConfig.RUN_FRICTION; // Slidier when running or stopping from run
        }

        // BRAWLHALLA STYLE: Sig Charging stops momentum (Ground & Air)
        if (this.player.combat.isCharging) {
            friction = PhysicsConfig.CHARGE_FRICTION;
            // Counteract gravity to hang in air briefly (Gravity Cancel feel)
            if (!this.player.isGrounded) {
                velocity.y *= PhysicsConfig.CHARGE_GRAVITY_CANCEL;
            }
        }
        else if (this.player.isAttacking) {
            // Check if we're in recovery phase
            const currentAttack = this.player.getCurrentAttack();
            if (currentAttack && currentAttack.phase === AttackPhase.RECOVERY) {
                friction = PhysicsConfig.ATTACK_RECOVERY_FRICTION;
            } else {
                friction = PhysicsConfig.ATTACK_ACTIVE_FRICTION;

                // Aerial Stall for Flurry Attacks
                if (!this.player.isGrounded && currentAttack?.data.shouldStallInAir) {
                    velocity.y *= PhysicsConfig.AERIAL_STALL_GRAVITY_DAMP;
                    velocity.x *= PhysicsConfig.AERIAL_STALL_HORIZONTAL_DAMP;
                }
            }
        }
        else if (this.player.isHitStunned) {
            friction = PhysicsConfig.HITSTUN_FRICTION;
        }

        velocity.x *= friction;

        velocity.x *= friction;

        // Clamp speed
        let maxSpeed = PhysicsConfig.MAX_SPEED;
        if (this.isRunning) {
            maxSpeed *= PhysicsConfig.RUN_SPEED_MULT;
        }

        // Only clamp if NOT dodging (dodging sets its own high velocity)
        // AND not in hitstun (knockback should exceed max speed)
        if (!this.player.isDodging && !this.player.isHitStunned) {
            // Soft Cap: Allow momentum (e.g. from dash) to carry over.
            // If we are over max speed, don't clamp hard, just let friction reduce it.
            // But don't allow accelerating further past max speed.

            if (Math.abs(velocity.x) > maxSpeed) {
                // We are overspeeding (e.g. post-dash)
                // If acceleration is trying to make us go faster in the same direction, cancel it
                if (Math.sign(this.acceleration.x) === Math.sign(velocity.x) && this.acceleration.x !== 0) {
                    // Reduce acceleration contribution to 0 for this frame to prevent infinite speed
                    // But we already added acceleration up top. We should undo it or clamp velocity to previous value?
                    // Simpler: Just clamp to previous frame's speed (effectively no acceleration) minus friction
                    // Actually, friction has already been applied.
                    // Let's just Clamp to the current speed? No, that locks it.

                    // Correct approach: If overspeed, apply decay (friction is already applied). 
                    // Just ensure we don't snap DOWN to maxSpeed. 
                    // And ensure we don't go HIGHER than we currently are.

                    // So... do nothing here? Friction (applied above) naturally reduces speed.
                    // We just need to ensure we don't CLAMP.

                    // However, we added 'acceleration' at line 121. If holding forward, acc is added.
                    // We should probably NOT have added acceleration if overspeed. 
                    // But changing order is risky.

                    // Let's just Clamp to Max(current, maxSpeed) effectively?
                    // No, simpler: 
                    // If overspeed, we don't enforce maxSpeed cap.
                    // But to prevent "run" input from maintaining the "dash" speed forever (balancing friction), we might need extra drag?
                    // PlayerPhysicsConfig.RUN_FRICTION handles that.
                }
            } else {
                // Normal case: Clamp to max speed
                velocity.x = Phaser.Math.Clamp(
                    velocity.x,
                    -maxSpeed,
                    maxSpeed
                );
            }
        }

        // Update Position
        this.player.x += velocity.x * deltaSeconds;
        this.player.y += velocity.y * deltaSeconds;

        // Physics Update for Recovery State
        if (this.isRecovering) {
            this.recoveryTimer -= deltaSeconds * 1000;
            if (this.recoveryTimer <= 0) {
                this.isRecovering = false;
                this.player.resetVisuals();
            }
        }



        // Movement has been applied using the previous frame's grounded state (friction etc)
        // Now we reset it so GameScene collision checks can determine if we are still grounded
        this.player.isGrounded = false;
    }

    // Run State
    public isRunning: boolean = false;

    private handleHorizontalMovement(input: InputState): void {
        if (this.isWallSliding) return;
        if (this.isDodging && this.isSpotDodging) return; // Spot dodge locks X

        // Prevent movement during attack startup and active frames, but allow during recovery
        if (this.player.isAttacking) {
            const currentAttack = this.player.getCurrentAttack();

            if (currentAttack && currentAttack.data.type === AttackType.HEAVY) {
                this.isRunning = false; // Force sprint off
                return;
            }

            if (currentAttack && currentAttack.phase !== AttackPhase.RECOVERY) {
                return; // Lock movement during STARTUP and ACTIVE phases only for Light attacks
            }
        }

        // Calculate Move Force
        let moveForce = 0;
        // Disable movement if dodging (unless it's a directional dodge which carries momentum, implemented in startDodge)
        if (this.isDodging) return;

        // Run Mechanic: Default movement is RUN
        // Dash input (dodgeHeld) triggers dash (handled in handleDodgeInput), but running is always on if moving.
        const isMoving = input.moveLeft || input.moveRight;
        const inRecovery = this.player.isAttacking;

        // If grounded and moving, we are running.
        this.isRunning = this.player.isGrounded && isMoving && !inRecovery;

        let accel = PhysicsConfig.MOVE_ACCEL;
        if (this.isRunning) {
            accel *= PhysicsConfig.RUN_ACCEL_MULT;
        }

        if (input.moveLeft) moveForce -= accel;
        if (input.moveRight) moveForce += accel;

        this.acceleration.x += moveForce;
    }

    private handleJump(delta: number, input: InputState): void {
        if (this.isDodging) return; // No jumping while dodging

        if (this.player.isAttacking) {
            const currentAttack = this.player.getCurrentAttack();
            if (currentAttack && currentAttack.data.type === AttackType.HEAVY) {
                return;
            }
        }

        // Use buffered jump input
        const buffer = this.player.inputBuffer;
        const jumpRequested = buffer.has('jump');

        // Platform Drop: Down + Jump
        if (input.moveDown && jumpRequested && this.currentPlatform) {
            buffer.consume('jump');
            this.handlePlatformDrop();
            return; // Skip normal jump
        }

        // Jump Hold Logic
        if (input.jumpHeld) {
            this.jumpHoldTime += delta;
        } else {
            this.jumpHoldTime = 0;
        }

        // New Jump Input (buffered)
        if (jumpRequested && !this.wasJumpHeld) {
            buffer.consume('jump');
            this.performJump();
        }
        this.wasJumpHeld = input.jumpHeld;

        // Short Hop Check
        if (!input.jumpHeld && this.player.velocity.y < 0 && this.player.velocity.y > PhysicsConfig.SHORT_HOP_FORCE) {
            this.player.velocity.y *= PhysicsConfig.SHORT_HOP_VELOCITY_DAMP;
        }
    }

    private handlePlatformDrop(): void {
        if (!this.currentPlatform) return;

        // Initiate drop
        this.droppingThroughPlatform = this.currentPlatform;
        this.dropGraceTimer = PhysicsConfig.PLATFORM_DROP_GRACE_PERIOD;

        // Physics updates to start falling
        this.player.isGrounded = false;
        this.currentPlatform = null;
        this.player.y += 1; // Nudge down to ensure we are "in" the platform for the grace period check
        this.player.velocity.y = 100; // Small downward push
    }

    public performJump(): void {
        // Wall Jump
        // Use timer for coyote time, allowing jump shortly after leaving wall
        if (this.isWallSliding || (this.lastWallTouchTimer > 0 && !this.player.isGrounded)) {
            this.wallJump();
            return;
        } else if (this.isTouchingWall) {
        }


        // Ground Jump
        if (this.player.isGrounded) {
            this.player.velocity.y = PhysicsConfig.JUMP_FORCE;
            this.player.isGrounded = false;
            return;
        }

        // Air Jump (Multi-jump)
        if (this.jumpsRemaining > 0 && this.airActionCounter < 9) {
            this.player.velocity.y = PhysicsConfig.DOUBLE_JUMP_FORCE;
            this.jumpsRemaining--;
            this.airActionCounter++;
        }
    }

    public startRecovery(): void {
        if (!this.recoveryAvailable) return;

        this.isRecovering = true;
        this.recoveryAvailable = false; // Consumed until grounded
        this.recoveryTimer = PhysicsConfig.RECOVERY_DURATION;

        this.player.velocity.y = PhysicsConfig.RECOVERY_FORCE_Y;
        // Horizontal drift
        const facing = this.player.getFacingDirection();
        this.player.velocity.x = facing * PhysicsConfig.RECOVERY_FORCE_X;

        // Reset state
        this.isWallSliding = false;
        this.isFastFalling = false;

        // Visuals
        // this.player.setVisualTint(0x00ffff); // Removed: User request "remove color change effect"
    }

    private wallJump(): void {
        this.player.velocity.y = PhysicsConfig.WALL_JUMP_FORCE_Y;

        // Use lastWallDirection if current is 0 (coyote time)
        const dir = this.wallDirection !== 0 ? this.wallDirection : this.lastWallDirection;
        this.player.velocity.x = -dir * PhysicsConfig.WALL_JUMP_FORCE_X;

        this.isWallSliding = false;
        this.airActionCounter++;
    }

    private handleFastFall(input: InputState): void {
        if (!this.player.isGrounded &&
            this.player.velocity.y >= PhysicsConfig.FAST_FALL_THRESHOLD &&
            input.moveDown &&
            !this.isFastFalling) {

            this.isFastFalling = true;
            this.player.velocity.y *= PhysicsConfig.FAST_FALL_MULTIPLIER;
        }
    }

    private handleDodgeInput(input: InputState): void {
        if (this.dodgeCooldownTimer > 0) return;

        if (this.player.isAttacking) {
            const currentAttack = this.player.getCurrentAttack();
            if (currentAttack && currentAttack.data.type === AttackType.HEAVY) {
                return;
            }
        }

        // Use buffered dodge input
        if (!this.player.inputBuffer.consume('dodge')) return;

        this.startDodge(input);
    }

    private startDodge(input: InputState): void {
        this.isDodging = true;
        this.player.isInvincible = true;
        this.player.isDodging = true; // Sync with Player state

        const hasDirectionalInput = input.moveLeft || input.moveRight;

        // Spot Dodge conditions: No horizontal input, OR holding Up/Down without horizontal
        // Brawlhalla: Neutral Dodge or Down Dodge = Spot Dodge
        const isSpotDodge = !hasDirectionalInput || ((input.aimUp || input.aimDown) && !input.moveLeft && !input.moveRight);

        if (isSpotDodge) {
            // SPOT DODGE
            this.isSpotDodging = true;
            this.dodgeDirection = 0;
            this.dodgeTimer = PhysicsConfig.SPOT_DODGE_DURATION;
            this.player.velocity.x = 0;

            if (!this.player.isGrounded) {
                this.player.velocity.y *= 0.2;
            }

            // Visual feedback
            this.player.setVisualTint(0xffffff);
            this.player.spriteObject.setAlpha(0.7);
        } else {
            // DIRECTIONAL DODGE
            this.isSpotDodging = false;
            this.dodgeTimer = PhysicsConfig.DODGE_DURATION;

            if (input.moveLeft && !input.moveRight) {
                this.dodgeDirection = -1;
            } else if (input.moveRight && !input.moveLeft) {
                this.dodgeDirection = 1;
            } else {
                this.dodgeDirection = this.player.getFacingDirection();
            }

            // Apply dodge velocity (same distance for ground and air)
            const dodgeSpeed = this.dodgeDirection * (PhysicsConfig.DODGE_DISTANCE / (PhysicsConfig.DODGE_DURATION / 1000));
            this.player.velocity.x = dodgeSpeed;

            if (!this.player.isGrounded) {
                // Reduce vertical velocity during air dodge for better control
                this.player.velocity.y *= 0.3;
            }

            // No visual effects for dash (user request)
            // Keep sprite fully visible and untinted
        }
    }

    private endDodge(): void {
        this.isDodging = false;
        this.player.isDodging = false; // Sync
        this.player.isInvincible = false;
        this.dodgeCooldownTimer = PhysicsConfig.DODGE_COOLDOWN;
        this.player.resetVisuals();
        this.player.spriteObject.setAlpha(1);
        this.isSpotDodging = false;
    }

    private handleWallMechanics(input: InputState): void {
        if (this.player.isGrounded) {
            this.isWallSliding = false;
            return;
        }

        if (this.isTouchingWall) {
            const pushingWall = (this.wallDirection === -1 && input.moveLeft) ||
                (this.wallDirection === 1 && input.moveRight);

            if (pushingWall && this.player.velocity.y > 0 && !this.wallTouchesExhausted) {
                this.isWallSliding = true;
                this.isFastFalling = false;

                if (this.player.velocity.y > PhysicsConfig.WALL_SLIDE_SPEED) {
                    this.player.velocity.y = PhysicsConfig.WALL_SLIDE_SPEED;
                }
            } else {
                this.isWallSliding = false;
            }
        } else {
            this.isWallSliding = false;
        }
    }



    public checkPlatformCollision(platform: Phaser.GameObjects.Rectangle, isSoft: boolean = false): void {
        const playerBounds = this.player.getBounds();
        const platBounds = platform.getBounds();

        if (!Phaser.Geom.Rectangle.Overlaps(playerBounds, platBounds)) {
            if (this.currentPlatform === platform) {
                this.currentPlatform = null;
            }
            return;
        }

        if (isSoft) {
            if (this.droppingThroughPlatform === platform && this.dropGraceTimer > 0) {
                return;
            }
            if (this.player.velocity.y < 0) return;
            // FIX: Increased threshold from 10 to 45 to catch high-speed fallers (Max Fall Speed ~43px/frame)
            if (playerBounds.bottom > platBounds.top + 45) {
                return;
            }
        } else {
            // Hard platform: Only ground if player is near the top surface, not beside it
            // This prevents the tall main platform from grounding players who are wall sliding alongside it
            if (this.player.velocity.y < 0) return; // Moving upward, skip
            if (playerBounds.bottom > platBounds.top + 45) {
                return; // Player is too far below the surface — they're beside the platform, not on top
            }
        }

        if (this.player.velocity.y >= 0) {
            this.player.y = platBounds.top - this.player.height / 2;
            this.player.velocity.y = 0;
            this.player.isGrounded = true;
            this.isFastFalling = false;
            this.isRecovering = false;
            this.jumpsRemaining = PhysicsConfig.MAX_JUMPS - 1;
            this.recoveryAvailable = true;
            this.droppingThroughPlatform = null;
            this.airActionCounter = 0;
            this.wallTouchesExhausted = false;
            this.currentPlatform = isSoft ? platform : null;
        }
    }

    public checkWallCollision(walls: Phaser.Geom.Rectangle[]): void {
        const playerBounds = this.player.getBounds();
        const halfW = this.player.width / 2;

        this.isTouchingWall = false;
        this.wallDirection = 0;

        for (const wall of walls) {
            if (Phaser.Geom.Rectangle.Overlaps(playerBounds, wall)) {
                const pCx = playerBounds.centerX;
                const wCx = wall.centerX;

                if (pCx < wCx) {
                    this.player.x = wall.left - halfW;
                    this.isTouchingWall = true;
                    this.lastWallTouchTimer = PhysicsConfig.WALL_COYOTE_TIME;
                    this.wallDirection = 1;
                    this.lastWallDirection = 1;
                } else {
                    this.player.x = wall.right + halfW;
                    this.isTouchingWall = true;
                    this.lastWallTouchTimer = PhysicsConfig.WALL_COYOTE_TIME;
                    this.wallDirection = -1;
                    this.lastWallDirection = -1;
                }
            }
        }
    }



    public resetOnGround(): void {
        this.player.isGrounded = true;
        this.jumpsRemaining = PhysicsConfig.MAX_JUMPS - 1;
        this.airActionCounter = 0;
        this.isFastFalling = false;
        this.isWallSliding = false;
        this.wallTouchesExhausted = false;
        this.droppingThroughPlatform = null;
    }

    public reset(): void {
        if (this.player.body) {
            this.player.body.velocity.x = 0;
            this.player.body.velocity.y = 0;
        }
        this.acceleration.set(0, 0);
        this.isGrounded = false;
        this.jumpsRemaining = PhysicsConfig.MAX_JUMPS;
        this.airActionCounter = 0;
        this.isFastFalling = false;
        this.isWallSliding = false;
        this.wallTouchesExhausted = false;
        this.droppingThroughPlatform = null;
        this.recoveryAvailable = true;
        this.dodgeTimer = 0;
        this.dodgeCooldownTimer = 0;
    }
}
