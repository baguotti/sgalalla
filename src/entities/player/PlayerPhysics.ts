import Phaser from 'phaser';
import { Player } from '../Player';
import { PhysicsConfig } from '../../config/PhysicsConfig';
import type { InputState } from '../../input/InputManager';

export class PlayerPhysics {
    private player: Player;

    // Physics State
    public acceleration: Phaser.Math.Vector2;
    public isGrounded: boolean = false;
    public isFastFalling: boolean = false;

    // Jump State
    public jumpsRemaining: number = 2;
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

    // Ledge Mechanics
    public isLedgeHanging: boolean = false;
    public ledgeGrabPlatform: any = null;
    public ledgeDirection: number = 0;
    public ledgeHangPosition: { x: number, y: number } = { x: 0, y: 0 };

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
        this.acceleration.set(0, PhysicsConfig.GRAVITY);

        // 2. Handle Mechanics
        if (!this.player.isHitStunned && !this.isLedgeHanging) {
            this.handleWallMechanics(input);
            this.handleHorizontalMovement(input);
            this.handleJump(delta, input);
            this.handleFastFall(input);
            this.handleDodgeInput(input);
        }

        // 3. Ledge Hang Logic
        if (this.isLedgeHanging) {
            this.updateLedgeHang(input);
            return; // Skip physics application
        }

        // 4. Apply Physics (Integration)
        this.applyPhysics(deltaSeconds);
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
        velocity.x += this.acceleration.x * deltaSeconds;
        velocity.y += this.acceleration.y * deltaSeconds;

        // Apply friction
        const friction = this.player.isAttacking ? 0.95 : PhysicsConfig.FRICTION;
        velocity.x *= friction;

        // Clamp speed
        velocity.x = Phaser.Math.Clamp(
            velocity.x,
            -PhysicsConfig.MAX_SPEED,
            PhysicsConfig.MAX_SPEED
        );

        // Update Position
        this.player.x += velocity.x * deltaSeconds;
        this.player.y += velocity.y * deltaSeconds;

        // Floor collision (simplified fallback)
        if (this.player.y > 600 && velocity.y > 0) {
            // Let the game scene kill mechanic handle falling off screen
        }
    }

    private handleHorizontalMovement(input: InputState): void {
        if (this.isWallSliding) return;
        if (this.isDodging && this.isSpotDodging) return; // Spot dodge locks X

        // Calculate Move Force
        let moveForce = 0;
        // Disable movement if dodging
        if (this.isDodging) return;

        if (input.moveLeft) moveForce -= PhysicsConfig.MOVE_ACCEL;
        if (input.moveRight) moveForce += PhysicsConfig.MOVE_ACCEL;

        this.acceleration.x += moveForce;
    }

    private handleJump(delta: number, input: InputState): void {
        if (this.isDodging) return; // No jumping while dodging

        // Jump Hold Logic
        if (input.jumpHeld) {
            this.jumpHoldTime += delta;
        } else {
            this.jumpHoldTime = 0;
        }

        // New Jump Input
        if (input.jump && !this.wasJumpHeld) {
            this.performJump();
        }
        this.wasJumpHeld = input.jumpHeld;

        // Short Hop Check
        if (!input.jumpHeld && this.player.velocity.y < 0 && this.player.velocity.y > PhysicsConfig.SHORT_HOP_FORCE) {
            this.player.velocity.y *= 0.5;
        }
    }

    public performJump(): void {
        // Wall Jump
        if (this.isWallSliding || (this.isTouchingWall && !this.player.isGrounded)) {
            this.wallJump();
            return;
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

    private wallJump(): void {
        this.player.velocity.y = PhysicsConfig.WALL_JUMP_FORCE_Y;
        this.player.velocity.x = -this.wallDirection * PhysicsConfig.WALL_JUMP_FORCE_X;
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
        if (!input.dodge) return;

        this.startDodge(input);
    }

    private startDodge(input: InputState): void {
        this.isDodging = true;
        this.player.isInvincible = true;
        this.player.isDodging = true; // Sync with Player state

        const hasDirectionalInput = input.moveLeft || input.moveRight;

        // Spot Dodge conditions
        const isSpotDodge = !hasDirectionalInput || (input.aimUp && !input.moveLeft && !input.moveRight);

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

            // Apply dodge velocity
            if (this.player.isGrounded) {
                this.player.velocity.x = this.dodgeDirection * (PhysicsConfig.DODGE_DISTANCE / (PhysicsConfig.DODGE_DURATION / 1000));
            } else {
                this.player.velocity.x = this.dodgeDirection * (PhysicsConfig.DODGE_DISTANCE / (PhysicsConfig.DODGE_DURATION / 1000)) * 0.7;
                this.player.velocity.y *= 0.3;
            }

            this.player.setVisualTint(0x8888ff);
            this.player.spriteObject.setAlpha(0.5);
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

    private updateLedgeHang(input: InputState): void {
        if (input.moveDown) {
            this.dropFromLedge();
        } else if (input.moveUp) {
            this.climbFromLedge();
        } else if (input.jump) {
            this.jumpFromLedge();
        }
    }

    public dropFromLedge(): void {
        this.isLedgeHanging = false;
        this.ledgeGrabPlatform = null;
    }

    public climbFromLedge(): void {
        this.isLedgeHanging = false;
        this.player.velocity.y = PhysicsConfig.LEDGE_CLIMB_SPEED;
        this.player.x += this.ledgeDirection * 20;
    }

    public jumpFromLedge(): void {
        this.isLedgeHanging = false;
        this.player.velocity.y = PhysicsConfig.LEDGE_JUMP_Y;
        this.player.velocity.x = this.ledgeDirection * -1 * 200;
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
            if (playerBounds.bottom > platBounds.top + 10) {
                return;
            }
        }

        if (this.player.velocity.y >= 0) {
            this.player.y = platBounds.top - PhysicsConfig.PLAYER_HEIGHT / 2;
            this.player.velocity.y = 0;
            this.player.isGrounded = true;
            this.isFastFalling = false;
            this.isRecovering = false;
            this.jumpsRemaining = 2;
            this.recoveryAvailable = true;
            this.droppingThroughPlatform = null;
            this.airActionCounter = 0;
            this.wallTouchesExhausted = false;
            this.currentPlatform = isSoft ? platform : null;
        }
    }

    public checkWallCollision(leftBound: number, rightBound: number): void {
        const playerBounds = this.player.getBounds();

        this.isTouchingWall = false;
        this.wallDirection = 0;

        if (playerBounds.left <= leftBound) {
            this.player.x = leftBound + PhysicsConfig.PLAYER_WIDTH / 2;
            this.isTouchingWall = true;
            this.wallDirection = -1;
        }
        else if (playerBounds.right >= rightBound) {
            this.player.x = rightBound - PhysicsConfig.PLAYER_WIDTH / 2;
            this.isTouchingWall = true;
            this.wallDirection = 1;
        }
    }

    public checkLedgeGrab(_platforms: Array<{ rect: Phaser.GameObjects.Rectangle; isSoft?: boolean }>): void {
        if (this.player.isGrounded || this.player.isAttacking || this.isLedgeHanging || this.player.isDodging) {
            return;
        }

        if (this.player.velocity.y <= 0) {
            return;
        }

        // Implementation usually requires loop over platforms checking bounds near ledge
        // Placeholder for now
    }

    public resetOnGround(): void {
        this.player.isGrounded = true;
        this.jumpsRemaining = 2;
        this.airActionCounter = 0;
        this.isFastFalling = false;
        this.isWallSliding = false;
        this.wallTouchesExhausted = false;
        this.droppingThroughPlatform = null;
    }
}
