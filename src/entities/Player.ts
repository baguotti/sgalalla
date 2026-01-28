import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';
import { Attack, AttackType, AttackDirection, AttackPhase } from '../combat/Attack';
import { Hitbox } from '../combat/Hitbox';
import { DamageSystem } from '../combat/DamageSystem';
import { InputManager } from '../input/InputManager';
import type { InputState } from '../input/InputManager';

export const PlayerState = {
    GROUNDED: 'Grounded',
    AIRBORNE: 'Airborne',
    FAST_FALLING: 'Fast-falling',
    RECOVERING: 'Recovering',
    ATTACKING: 'Attacking',
    DODGING: 'Dodging',
    HIT_STUN: 'Hit-Stun',
    GROUND_POUND: 'Ground-Pound',
} as const;

export type PlayerState = typeof PlayerState[keyof typeof PlayerState];

export class Player extends Phaser.GameObjects.Container {
    private bodyRect: Phaser.GameObjects.Rectangle;
    private nose: Phaser.GameObjects.Rectangle;
    private velocity: Phaser.Math.Vector2;
    private acceleration: Phaser.Math.Vector2;

    // Jump mechanics
    private isGrounded: boolean = false;
    private jumpsRemaining: number = 2;

    // Fast-fall
    private isFastFalling: boolean = false;

    // Recovery attack
    private isRecovering: boolean = false;
    private recoveryAvailable: boolean = true;
    private lastRecoveryTime: number = 0;
    private recoveryTimer: number = 0;

    // Platform drop-through
    private droppingThroughPlatform: Phaser.GameObjects.Rectangle | null = null;
    private dropGraceTimer: number = 0;
    private currentPlatform: Phaser.GameObjects.Rectangle | null = null;

    // Combat system
    public damagePercent: number = 0;
    private isAttacking: boolean = false;
    private currentAttack: Attack | null = null;
    private attackCooldownTimer: number = 0;
    private activeHitbox: Hitbox | null = null;
    public hitTargets: Set<Player> = new Set();

    // Ground pound
    private isGroundPounding: boolean = false;
    private groundPoundStartupTimer: number = 0;

    // Charge attack system
    private isCharging: boolean = false;
    private chargeTime: number = 0;
    private chargeDirection: AttackDirection = AttackDirection.NEUTRAL;
    private chargeGlow: Phaser.GameObjects.Graphics | null = null;

    // Dodge system
    private isDodging: boolean = false;
    private dodgeTimer: number = 0;
    private dodgeCooldownTimer: number = 0;
    private isInvincible: boolean = false;
    private dodgeDirection: number = 0;

    // Hit stun
    private isHitStunned: boolean = false;
    private hitStunTimer: number = 0;

    // Facing direction (1 = right, -1 = left)
    private facingDirection: number = 1;

    // Damage display
    private damageText: Phaser.GameObjects.Text;

    // Unified input system (keyboard + gamepad)
    private inputManager!: InputManager;
    private currentInput!: InputState;

    // Track jump hold time for variable jump height
    private jumpHoldTime: number = 0;
    private wasJumpHeld: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);

        // Create player body (main rectangle)
        this.bodyRect = scene.add.rectangle(
            0,
            0,
            PhysicsConfig.PLAYER_WIDTH,
            PhysicsConfig.PLAYER_HEIGHT,
            0x4a90e2
        );
        this.add(this.bodyRect);

        // Create nose (directional indicator)
        this.nose = scene.add.rectangle(
            PhysicsConfig.PLAYER_WIDTH / 2,
            0,
            PhysicsConfig.NOSE_SIZE,
            PhysicsConfig.NOSE_SIZE,
            0xffffff
        );
        this.add(this.nose);

        // Create damage text
        this.damageText = scene.add.text(0, -40, '0%', {
            fontSize: '16px',
            color: '#ffffff',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 3,
        });
        this.damageText.setOrigin(0.5);
        this.add(this.damageText);

        // Initialize physics
        this.velocity = new Phaser.Math.Vector2(0, 0);
        this.acceleration = new Phaser.Math.Vector2(0, 0);

        // Setup input
        this.setupInput();

        scene.add.existing(this);
    }

    private setupInput(): void {
        this.inputManager = new InputManager(this.scene);
        this.currentInput = this.inputManager.poll();
    }

    update(delta: number): void {
        const deltaSeconds = delta / 1000;

        // Poll input at start of frame
        this.currentInput = this.inputManager.poll();

        // Update timers
        this.updateTimers(delta);

        // Handle hit stun (disables input)
        if (this.isHitStunned) {
            this.hitStunTimer -= delta;
            if (this.hitStunTimer <= 0) {
                this.isHitStunned = false;
                this.bodyRect.setFillStyle(0x4a90e2);
            }
            this.applyPhysics(deltaSeconds);
            return;
        }

        // Handle attack state (limited movement during attacks)
        if (this.isAttacking || this.isGroundPounding) {
            this.updateAttackState(delta);
            if (this.isGroundPounding && this.groundPoundStartupTimer <= 0) {
                this.velocity.y = PhysicsConfig.GROUND_POUND_SPEED;
            }
            this.applyPhysics(deltaSeconds);
            this.updateDamageDisplay();
            return;
        }

        // Handle dodge state
        if (this.isDodging) {
            this.updateDodgeState(delta);
            this.applyPhysics(deltaSeconds);
            return;
        }

        // Reset acceleration
        this.acceleration.set(0, PhysicsConfig.GRAVITY);

        // Normal input handling using unified input
        this.handleHorizontalMovement();
        this.handleRecovery();
        this.handleJump(delta);
        this.handleFastFall();
        this.handleAttackInput();
        this.updateChargeState(delta); // Update charge visual effects
        this.handleDodgeInput();

        // Apply physics
        this.applyPhysics(deltaSeconds);

        // Update facing direction
        this.updateFacing();

        // Update damage display
        this.updateDamageDisplay();
    }

    private updateTimers(delta: number): void {
        if (this.dropGraceTimer > 0) {
            this.dropGraceTimer -= delta;
            if (this.dropGraceTimer <= 0) {
                this.droppingThroughPlatform = null;
            }
        }

        if (this.recoveryTimer > 0) {
            this.recoveryTimer -= delta;
            if (this.recoveryTimer <= 0) {
                this.isRecovering = false;
                this.bodyRect.setFillStyle(0x4a90e2);
            }
        }

        if (this.attackCooldownTimer > 0) {
            this.attackCooldownTimer -= delta;
        }

        if (this.dodgeCooldownTimer > 0) {
            this.dodgeCooldownTimer -= delta;
        }
    }

    private applyPhysics(deltaSeconds: number): void {
        // Apply acceleration to velocity
        this.velocity.x += this.acceleration.x * deltaSeconds;
        this.velocity.y += this.acceleration.y * deltaSeconds;

        // Apply friction to horizontal movement (less during attacks)
        const friction = this.isAttacking ? 0.95 : PhysicsConfig.FRICTION;
        this.velocity.x *= friction;

        // Clamp horizontal speed
        this.velocity.x = Phaser.Math.Clamp(
            this.velocity.x,
            -PhysicsConfig.MAX_SPEED,
            PhysicsConfig.MAX_SPEED
        );

        // Update position
        this.x += this.velocity.x * deltaSeconds;
        this.y += this.velocity.y * deltaSeconds;
    }

    private handleHorizontalMovement(): void {
        const input = this.currentInput;

        // Use analog input if available, otherwise digital
        if (Math.abs(input.moveX) > 0.1) {
            this.acceleration.x = input.moveX * PhysicsConfig.MOVE_ACCEL;
            this.facingDirection = input.moveX > 0 ? 1 : -1;
        } else if (input.moveLeft && !input.moveRight) {
            this.acceleration.x = -PhysicsConfig.MOVE_ACCEL;
            this.facingDirection = -1;
        } else if (input.moveRight && !input.moveLeft) {
            this.acceleration.x = PhysicsConfig.MOVE_ACCEL;
            this.facingDirection = 1;
        }
    }

    private handleJump(delta: number): void {
        const input = this.currentInput;

        // Platform drop-through: Jump + Down while grounded on soft platform
        if (input.jump && input.moveDown && this.isGrounded && this.currentPlatform) {
            this.droppingThroughPlatform = this.currentPlatform;
            this.dropGraceTimer = PhysicsConfig.PLATFORM_DROP_GRACE_PERIOD;
            this.isGrounded = false;
            return;
        }

        // Jump on button press
        if (input.jump && this.jumpsRemaining > 0) {
            this.performJump();
            this.jumpHoldTime = 0;
        }

        // Track jump hold for variable jump height
        if (input.jumpHeld && this.wasJumpHeld) {
            this.jumpHoldTime += delta;
        } else if (!input.jumpHeld && this.wasJumpHeld) {
            // Released jump early - cut velocity for short hop
            if (this.jumpHoldTime < PhysicsConfig.JUMP_HOLD_THRESHOLD && this.velocity.y < 0) {
                this.velocity.y *= 0.5;
            }
        }

        this.wasJumpHeld = input.jumpHeld;
    }

    private performJump(): void {
        this.velocity.y = PhysicsConfig.JUMP_FORCE;
        this.jumpsRemaining--;
        this.isGrounded = false;
        this.isFastFalling = false;
    }

    private handleFastFall(): void {
        const input = this.currentInput;

        if (
            input.moveDown &&
            !this.isGrounded &&
            !this.isFastFalling &&
            this.velocity.y < PhysicsConfig.FAST_FALL_THRESHOLD &&
            this.velocity.y > -PhysicsConfig.FAST_FALL_THRESHOLD
        ) {
            this.isFastFalling = true;
            this.velocity.y *= PhysicsConfig.FAST_FALL_MULTIPLIER;
        }
    }

    private handleRecovery(): void {
        const input = this.currentInput;
        const currentTime = this.scene.time.now;

        if (
            input.recovery &&
            !this.isGrounded &&
            this.recoveryAvailable &&
            currentTime - this.lastRecoveryTime > PhysicsConfig.RECOVERY_COOLDOWN
        ) {
            this.velocity.y = PhysicsConfig.RECOVERY_FORCE_Y;
            this.velocity.x += this.facingDirection * PhysicsConfig.RECOVERY_FORCE_X;

            this.isRecovering = true;
            this.recoveryAvailable = false;
            this.lastRecoveryTime = currentTime;
            this.recoveryTimer = PhysicsConfig.RECOVERY_DURATION;
            this.isFastFalling = false;

            this.bodyRect.setFillStyle(0xff9500);
        }
    }

    private handleAttackInput(): void {
        if (this.attackCooldownTimer > 0) return;

        const input = this.currentInput;

        // Light attack - instant activation
        if (input.lightAttack) {
            const direction = this.getInputDirection();
            const isAerial = !this.isGrounded;
            const attackKey = Attack.getAttackKey(AttackType.LIGHT, direction, isAerial);
            this.startAttack(attackKey);
            return;
        }

        // Heavy attack - chargeable
        if (input.heavyAttack && !this.isCharging) {
            // Start charging
            this.isCharging = true;
            this.chargeTime = 0;
            this.chargeDirection = this.getInputDirection();

            // Create charge glow effect
            if (!this.chargeGlow) {
                this.chargeGlow = this.scene.add.graphics();
                this.add(this.chargeGlow);
            }
            return;
        }

        // Update charge while holding
        if (this.isCharging && input.heavyAttackHeld) {
            // Charge continues in update loop
            return;
        }

        // Release charge - execute attack
        if (this.isCharging && !input.heavyAttackHeld) {
            const direction = this.chargeDirection;
            const isAerial = !this.isGrounded;

            // Special case: down + heavy in air = ground pound (not chargeable)
            if (direction === AttackDirection.DOWN && isAerial) {
                this.clearChargeState();
                this.startGroundPound();
                return;
            }

            // Calculate charge multiplier (0 to 1 based on charge time)
            const chargePercent = Math.min(this.chargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);

            // Get attack key and start charged attack
            const attackKey = Attack.getAttackKey(AttackType.HEAVY, direction, isAerial);
            this.startChargedAttack(attackKey, chargePercent);
            this.clearChargeState();
            return;
        }
    }

    private updateChargeState(delta: number): void {
        if (!this.isCharging) return;

        // Accumulate charge time
        this.chargeTime += delta;
        const chargePercent = Math.min(this.chargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);

        // Update visual glow effect
        if (this.chargeGlow) {
            this.chargeGlow.clear();

            // Pulsing glow that intensifies with charge
            const pulseSpeed = 5 + chargePercent * 10; // Faster pulse at higher charge
            const pulse = 0.5 + Math.sin(this.scene.time.now / 100 * pulseSpeed) * 0.5;
            const glowIntensity = 0.3 + chargePercent * 0.7;
            const alpha = glowIntensity * pulse;

            // Color shifts from yellow to orange to red as charge builds
            let color: number;
            if (chargePercent < 0.5) {
                color = 0xffff00; // Yellow
            } else if (chargePercent < 0.8) {
                color = 0xff8800; // Orange
            } else {
                color = 0xff0000; // Red at max charge
            }

            // Draw glow ring around player
            const radius = 35 + chargePercent * 15;
            this.chargeGlow.lineStyle(3 + chargePercent * 4, color, alpha);
            this.chargeGlow.strokeCircle(0, 0, radius);

            // At full charge, add extra particles/sparkles
            if (chargePercent >= 1) {
                const sparkleAngle = (this.scene.time.now * 0.01) % (Math.PI * 2);
                for (let i = 0; i < 4; i++) {
                    const angle = sparkleAngle + (i * Math.PI / 2);
                    const sparkleX = Math.cos(angle) * (radius + 10);
                    const sparkleY = Math.sin(angle) * (radius + 10);
                    this.chargeGlow.fillStyle(0xffffff, alpha);
                    this.chargeGlow.fillCircle(sparkleX, sparkleY, 4);
                }
            }
        }

        // Flash body color based on charge
        if (chargePercent >= 1) {
            // Full charge - flash rapidly
            const flash = Math.sin(this.scene.time.now / 50) > 0;
            this.bodyRect.setFillStyle(flash ? 0xffff00 : 0x4a90e2);
        } else if (chargePercent > 0.5) {
            // Partial charge - tint slightly
            this.bodyRect.setFillStyle(0x7ab0e2);
        }
    }

    private clearChargeState(): void {
        this.isCharging = false;
        this.chargeTime = 0;
        if (this.chargeGlow) {
            this.chargeGlow.clear();
        }
        // Reset body color
        this.bodyRect.setFillStyle(0x4a90e2);
    }

    private startChargedAttack(attackKey: string, chargePercent: number): void {
        try {
            this.currentAttack = new Attack(attackKey, this.facingDirection, chargePercent);
            this.isAttacking = true;
            this.hitTargets.clear();

            // Set cooldown
            this.attackCooldownTimer = this.currentAttack.data.recoveryDuration;
        } catch (e) {
            console.warn(`Attack ${attackKey} not found`);
        }
    }

    private getInputDirection(): AttackDirection {
        const input = this.currentInput;

        if (input.aimUp && !input.aimDown) return AttackDirection.UP;
        if (input.aimDown && !input.aimUp) return AttackDirection.DOWN;
        if ((input.aimLeft || input.aimRight) && !input.aimUp && !input.aimDown) return AttackDirection.SIDE;
        return AttackDirection.NEUTRAL;
    }

    private startAttack(attackKey: string): void {
        try {
            this.currentAttack = new Attack(attackKey, this.facingDirection);
            this.isAttacking = true;
            this.hitTargets.clear();

            // Visual feedback
            this.bodyRect.setFillStyle(0xe74c3c); // Red during attack
        } catch (e) {
            console.warn('Unknown attack:', attackKey);
        }
    }

    private startGroundPound(): void {
        this.isGroundPounding = true;
        this.groundPoundStartupTimer = PhysicsConfig.GROUND_POUND_STARTUP;
        this.velocity.set(0, 0); // Pause in air

        // Start the attack for hitbox purposes
        const attackKey = Attack.getAttackKey(AttackType.HEAVY, AttackDirection.DOWN, true);
        try {
            this.currentAttack = new Attack(attackKey, this.facingDirection);
            this.isAttacking = true;
            this.hitTargets.clear();
        } catch (e) {
            console.warn('Ground pound attack not found');
        }

        this.bodyRect.setFillStyle(0x9b59b6); // Purple for ground pound startup
    }

    private updateAttackState(delta: number): void {
        if (!this.currentAttack) {
            this.endAttack();
            return;
        }

        // Ground pound startup
        if (this.isGroundPounding && this.groundPoundStartupTimer > 0) {
            this.groundPoundStartupTimer -= delta;
            this.velocity.set(0, 0); // Stay suspended
            if (this.groundPoundStartupTimer <= 0) {
                this.bodyRect.setFillStyle(0xe74c3c); // Switch to attack color
            }
            return;
        }

        // During ground pound descent, always keep hitbox active
        if (this.isGroundPounding && this.groundPoundStartupTimer <= 0) {
            this.updateHitbox();
            return; // Skip normal attack phase update during ground pound
        }

        // Update attack phase
        const attackComplete = this.currentAttack.update(delta);

        // Handle hitbox
        if (this.currentAttack.isHitboxActive()) {
            this.updateHitbox();
        } else {
            this.deactivateHitbox();
        }

        // Visual feedback based on phase
        if (this.currentAttack.phase === AttackPhase.STARTUP) {
            this.bodyRect.setFillStyle(0xf39c12); // Orange during startup
        } else if (this.currentAttack.phase === AttackPhase.ACTIVE) {
            this.bodyRect.setFillStyle(0xe74c3c); // Red during active
        } else if (this.currentAttack.phase === AttackPhase.RECOVERY) {
            this.bodyRect.setFillStyle(0x95a5a6); // Gray during recovery
        }

        if (attackComplete) {
            this.endAttack();
        }
    }

    private updateHitbox(): void {
        if (!this.currentAttack) return;

        const offset = this.currentAttack.getHitboxOffset();
        const hitboxX = this.x + offset.x;
        const hitboxY = this.y + offset.y;

        if (!this.activeHitbox) {
            this.activeHitbox = new Hitbox(
                this.scene,
                hitboxX,
                hitboxY,
                this.currentAttack.data.hitboxWidth,
                this.currentAttack.data.hitboxHeight
            );
        }

        this.activeHitbox.activate(hitboxX, hitboxY);
    }

    private deactivateHitbox(): void {
        if (this.activeHitbox) {
            this.activeHitbox.deactivate();
        }
    }

    private endAttack(): void {
        this.isAttacking = false;
        this.isGroundPounding = false;
        this.currentAttack = null;
        this.deactivateHitbox();
        this.bodyRect.setFillStyle(0x4a90e2);

        // Set cooldown (shorter for light attacks)
        this.attackCooldownTimer = 100;
    }

    private handleDodgeInput(): void {
        if (this.dodgeCooldownTimer > 0) return;

        const input = this.currentInput;

        if (!input.dodge) return;

        this.startDodge();
    }

    private startDodge(): void {
        this.isDodging = true;
        this.dodgeTimer = PhysicsConfig.DODGE_DURATION;
        this.isInvincible = true;

        // Determine dodge direction from current input
        const input = this.currentInput;

        if (input.moveLeft && !input.moveRight) {
            this.dodgeDirection = -1;
        } else if (input.moveRight && !input.moveLeft) {
            this.dodgeDirection = 1;
        } else {
            this.dodgeDirection = this.facingDirection;
        }

        // Apply dodge velocity
        if (this.isGrounded) {
            // Grounded dash
            this.velocity.x = this.dodgeDirection * (PhysicsConfig.DODGE_DISTANCE / (PhysicsConfig.DODGE_DURATION / 1000));
        } else {
            // Air dodge - less horizontal, some vertical freeze
            this.velocity.x = this.dodgeDirection * (PhysicsConfig.DODGE_DISTANCE / (PhysicsConfig.DODGE_DURATION / 1000)) * 0.7;
            this.velocity.y *= 0.3;
        }

        // Visual feedback
        this.bodyRect.setFillStyle(0x3498db);
        this.bodyRect.setAlpha(0.5);
    }

    private updateDodgeState(delta: number): void {
        this.dodgeTimer -= delta;

        // End invincibility after DODGE_INVINCIBILITY ms
        if (this.dodgeTimer < PhysicsConfig.DODGE_DURATION - PhysicsConfig.DODGE_INVINCIBILITY) {
            this.isInvincible = false;
        }

        if (this.dodgeTimer <= 0) {
            this.endDodge();
        }
    }

    private endDodge(): void {
        this.isDodging = false;
        this.isInvincible = false;
        this.dodgeCooldownTimer = PhysicsConfig.DODGE_COOLDOWN;
        this.bodyRect.setFillStyle(0x4a90e2);
        this.bodyRect.setAlpha(1);

        // Brawlhalla-style: maintain dodge velocity as run momentum
        // The velocity from dodge carries into movement
        // (Don't reset velocity.x here - let it carry over)
    }

    private updateFacing(): void {
        if (this.velocity.x > 10) {
            this.facingDirection = 1;
            this.nose.x = PhysicsConfig.PLAYER_WIDTH / 2;
        } else if (this.velocity.x < -10) {
            this.facingDirection = -1;
            this.nose.x = -PhysicsConfig.PLAYER_WIDTH / 2;
        }
    }

    private updateDamageDisplay(): void {
        this.damageText.setText(`${Math.floor(this.damagePercent)}%`);

        // Color based on damage
        if (this.damagePercent < 50) {
            this.damageText.setColor('#ffffff');
        } else if (this.damagePercent < 100) {
            this.damageText.setColor('#ffff00');
        } else if (this.damagePercent < 150) {
            this.damageText.setColor('#ff8800');
        } else {
            this.damageText.setColor('#ff0000');
        }
    }

    // Called by GameScene to check hits against other players
    checkHitAgainst(target: Player): void {
        if (!this.activeHitbox || !this.currentAttack) return;
        if (this.hitTargets.has(target)) return; // Already hit this target
        if (target.isInvincible) return; // Target is invincible

        const targetBounds = target.getBounds();
        if (this.activeHitbox.checkCollision(targetBounds)) {
            this.hitTargets.add(target);
            this.applyHitTo(target);
        }
    }

    private applyHitTo(target: Player): void {
        if (!this.currentAttack) return;

        const attackData = this.currentAttack.data;

        // Calculate knockback
        const knockbackForce = DamageSystem.calculateKnockback(
            attackData.damage,
            attackData.knockback,
            target.damagePercent
        );

        // Calculate knockback direction based on attack angle
        const angleRad = (attackData.knockbackAngle * Math.PI) / 180;
        const knockbackVector = new Phaser.Math.Vector2(
            Math.cos(angleRad) * knockbackForce * this.facingDirection,
            -Math.sin(angleRad) * knockbackForce
        );

        // Apply damage and knockback (also calls applyHitStun)
        DamageSystem.applyDamage(target, attackData.damage, knockbackVector);
    }

    setKnockback(x: number, y: number): void {
        this.velocity.x = x;
        this.velocity.y = y;
    }

    applyHitStun(): void {
        this.isHitStunned = true;
        this.hitStunTimer = PhysicsConfig.HIT_STUN_DURATION;
        this.isAttacking = false;
        this.isDodging = false;
        this.isGroundPounding = false;
        this.currentAttack = null;
        this.deactivateHitbox();

        // Visual feedback
        this.bodyRect.setFillStyle(0xffffff);
    }

    // Platform collision handling
    checkPlatformCollision(platform: Phaser.GameObjects.Rectangle, isSoft: boolean = false): void {
        if (this.droppingThroughPlatform === platform && this.dropGraceTimer > 0) {
            return;
        }

        const playerBounds = this.getBounds();
        const platformBounds = platform.getBounds();

        if (this.velocity.y <= 0 && isSoft) return;

        if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, platformBounds)) {
            const playerBottom = playerBounds.bottom;
            const platformTop = platformBounds.top;

            if (playerBottom - this.velocity.y * (1 / 60) <= platformTop + 5) {
                this.y = platformTop - PhysicsConfig.PLAYER_HEIGHT / 2;
                this.velocity.y = 0;
                this.isGrounded = true;
                this.isFastFalling = false;
                this.isRecovering = false;
                this.jumpsRemaining = 2;
                this.recoveryAvailable = true;
                this.currentPlatform = isSoft ? platform : null;

                // End ground pound on landing
                if (this.isGroundPounding) {
                    this.endAttack();
                }

                if (!this.isAttacking && !this.isDodging && !this.isHitStunned) {
                    this.bodyRect.setFillStyle(0x4a90e2);
                }
            }
        }
    }

    // Getters
    getVelocity(): Phaser.Math.Vector2 {
        return this.velocity;
    }

    getState(): PlayerState {
        if (this.isHitStunned) return PlayerState.HIT_STUN;
        if (this.isDodging) return PlayerState.DODGING;
        if (this.isGroundPounding) return PlayerState.GROUND_POUND;
        if (this.isAttacking) return PlayerState.ATTACKING;
        if (this.isRecovering) return PlayerState.RECOVERING;
        if (this.isGrounded) return PlayerState.GROUNDED;
        if (this.isFastFalling) return PlayerState.FAST_FALLING;
        return PlayerState.AIRBORNE;
    }

    getRecoveryAvailable(): boolean {
        return this.recoveryAvailable;
    }

    getIsInvincible(): boolean {
        return this.isInvincible;
    }

    getCurrentAttack(): Attack | null {
        return this.currentAttack;
    }

    getBounds(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(
            this.x - PhysicsConfig.PLAYER_WIDTH / 2,
            this.y - PhysicsConfig.PLAYER_HEIGHT / 2,
            PhysicsConfig.PLAYER_WIDTH,
            PhysicsConfig.PLAYER_HEIGHT
        );
    }

    isGamepadConnected(): boolean {
        return this.inputManager.isGamepadConnected();
    }
}
