import Phaser from 'phaser';
import { Player } from '../Player';
import type { GameSceneInterface } from '../../scenes/GameSceneInterface';
import { Fighter } from '../Fighter';
import { Attack, AttackType, AttackDirection } from '../../combat/Attack';
import { Hitbox } from '../../combat/Hitbox';
import type { Damageable } from '../../combat/DamageSystem'; // Type import
import { DamageSystem } from '../../combat/DamageSystem';
import { PhysicsConfig } from '../../config/PhysicsConfig';
import type { InputState } from '../../input/InputManager'; // Type import

export class PlayerCombat {
    private player: Player;
    private scene: Phaser.Scene;

    // Combat State
    public currentAttack: Attack | null = null;
    public attackCooldownTimer: number = 0;

    // Hitboxes
    private activeHitbox: Hitbox | null = null;
    private hitTargets: Set<Damageable> = new Set();

    // Ground Pound
    public isGroundPounding: boolean = false;
    public groundPoundStartupTimer: number = 0;
    private groundPoundReleaseBuffer: number = 0; // Buffer time before canceling on release

    // Charge Attack System
    public isCharging: boolean = false;
    public chargeTime: number = 0;
    public lastChargeTime: number = 0; // Snapshot of chargeTime at release (for damage calc)
    public chargeDirection: AttackDirection = AttackDirection.NEUTRAL;

    // Throw Charge System
    public isThrowCharging: boolean = false;
    public throwChargeTime: number = 0;

    // Projectile State
    // private hasSpawnedProjectile: boolean = false; // Removed

    private showDebugHitboxes: boolean = false;

    // Ghost Effect State
    private ghostSprite: Phaser.GameObjects.Sprite | null = null;
    private hasSpawnedGhost: boolean = false;

    constructor(player: Player, scene: Phaser.Scene) {
        this.player = player;
        this.scene = scene;
    }

    // Debug Damage Text
    private debugDamageText: Phaser.GameObjects.Text | null = null;

    public setDebug(visible: boolean): void {
        this.showDebugHitboxes = visible;
        if (this.activeHitbox) {
            this.activeHitbox.setDebug(visible);
        }
        if (this.debugDamageText) {
            this.debugDamageText.setVisible(visible && !!this.currentAttack);
        }
    }

    public update(delta: number): void {
        this.updateTimers(delta);

        if (this.isCharging) {
            this.updateChargeState(delta);
        }

        if (this.isThrowCharging) {
            this.updateThrowCharge(delta);
        }

        if (this.player.isAttacking || this.isGroundPounding) {
            this.updateAttackState(delta);
        } else if (this.player.physics.isRecovering) {
            this.updateRecoveryHitbox();
        } else {
            // Ensure hitbox is visually removed when not in use
            this.deactivateHitbox();
        }
    }

    private updateTimers(delta: number): void {
        if (this.attackCooldownTimer > 0) {
            this.attackCooldownTimer -= delta;
        }
        if (this.groundPoundReleaseBuffer > 0) {
            this.groundPoundReleaseBuffer -= delta;
        }
    }

    public handleInput(input: InputState): void {
        // Allow button release check during ground pound
        if (this.isGroundPounding && this.groundPoundStartupTimer <= 0) {
            // Check if player is still holding Down + Heavy
            if (input.heavyAttackHeld && input.aimDown) {
                // Reset buffer - player is still holding
                this.groundPoundReleaseBuffer = 0;
            } else {
                // Buttons released - start buffer countdown
                if (this.groundPoundReleaseBuffer === 0) {
                    // Just released, start the buffer timer (150ms grace period)
                    this.groundPoundReleaseBuffer = 150;
                } else if (this.groundPoundReleaseBuffer < 0) {
                    // Buffer expired, end ground pound
                    this.endGroundPound();
                    return;
                }
            }
        }

        if (this.attackCooldownTimer > 0) return;

        // Use player.isDodging which is synced from Physics
        if (this.player.isDodging || this.player.isHitStunned || this.player.isAttacking) return;

        // --- Throw Charge Handling ---
        if (this.isThrowCharging) {
            if (!input.lightAttackHeld) {
                // Released - execute throw
                this.executeThrow(input);
                this.isThrowCharging = false;
                this.throwChargeTime = 0;
            }
            return; // Stay in charge state
        }

        // --- Attack Blocker While Holding ---
        // Character cannot attack while carrying a bomb
        const isHolding = !!this.player.heldItem;

        // Light attack - Grab / Start Throw Charge / Attack
        if (input.lightAttack) {
            if (isHolding) {
                // 1. Start Charge Throw
                this.isThrowCharging = true;
                this.throwChargeTime = 0;
                return;
            }

            // 2. Try to Pickup Item
            if (this.player.checkItemPickup()) {
                return; // Picked up item, skip attack
            }

            // 3. Normal Attack
            let direction = this.getInputDirection(input);

            // Any light attack while running OR moving fast (Dash Attack)
            const isRunSpeed = Math.abs(this.player.velocity.x) > PhysicsConfig.MAX_SPEED * 0.8;
            if ((this.player.physics.isRunning || isRunSpeed) && this.player.isGrounded) {
                if (this.player.character === 'fok' || this.player.character === 'sgu' || this.player.character === 'sga') {
                    // Use new Running Light Attack
                    this.startAttack('light_run_grounded');
                    return;
                }
                direction = AttackDirection.DOWN;
            }

            const isAerial = !this.player.isGrounded;
            const attackKey = Attack.getAttackKey(AttackType.LIGHT, direction, isAerial);
            this.startAttack(attackKey);
            return;
        }

        // Prevent heavy attacks if holding item
        if (isHolding && (input.heavyAttack || this.isCharging)) {
            return;
        }

        // Heavy attack - chargeable (except for aerial down = ground pound, and aerial up/neutral = recovery)
        if (input.heavyAttack && !this.isCharging) {
            const direction = this.getInputDirection(input);
            const isAerial = !this.player.isGrounded;

            // Special case: Down + Heavy in air = Ground Pound (starts immediately, no charge)
            if (direction === AttackDirection.DOWN && isAerial) {
                this.startGroundPound();
                return;
            }

            // Special case: Up/Neutral + Heavy in air = Recovery (starts immediately, no charge)
            if ((direction === AttackDirection.UP || direction === AttackDirection.NEUTRAL) && isAerial) {
                this.hitTargets.clear(); // Reset hit tracking for the new move
                this.player.physics.startRecovery();
                return;
            }

            // All other heavy attacks (including grounded neutral sig): Start charging
            this.isCharging = true;
            this.chargeTime = 0;

            // Remap Grounded Down Sig -> Side Sig (User Request)
            if (direction === AttackDirection.DOWN && !isAerial) {
                this.chargeDirection = AttackDirection.SIDE;
            } else {
                this.chargeDirection = direction;
            }

            // Create charge glow effect
            // Removed charge glow
            return;
        }

        // Update charge while holding (handled in update, but we check release here)
        if (this.isCharging) {
            if (input.heavyAttackHeld) {
                return; // Continue charging
            }
            // Release -> Execute
            this.executeChargedAttack();
            return;
        }
    }

    private getInputDirection(input: InputState): AttackDirection {
        // BRAWLHALLA STYLE:
        // Grounded: Up + Light = Neutral Light (NLight)
        // Aerial: Up + Light = Recovery (which is handled separately) or Neutral Air?
        // Actually, Recovery is usually Sig button. Up+Light in air would be Nair or Recovery depending on mapping.
        // For this game:
        // Grounded UP = NEUTRAL (for NLight)
        // Aerial UP = UP (for Recovery/Nair)

        if (input.aimUp && !input.aimDown) {
            return AttackDirection.UP;
        }

        if (input.aimDown && !input.aimUp) return AttackDirection.DOWN;
        if ((input.aimLeft || input.aimRight) && !input.aimUp && !input.aimDown) return AttackDirection.SIDE;
        return AttackDirection.NEUTRAL;
    }

    public startAttack(attackKey: string): void {
        try {
            const facing = this.player.getFacingDirection();

            // Clear any previous ghost before new attack
            this.clearGhostEffect();
            this.hasSpawnedGhost = false;

            this.currentAttack = new Attack(attackKey, facing);
            this.player.isAttacking = true;
            this.hitTargets.clear();


            // Visual feedback
            // this.player.setVisualTint(0xff0000); // Removed red tint

            // Alternate light attack animation
            if (this.currentAttack.data.type === AttackType.LIGHT) {
                this.player.lightAttackVariant = (this.player.lightAttackVariant + 1) % 2;
            }

            // Trigger network callback
            if (this.player.onAttack) {
                this.player.onAttack(attackKey, facing);
            }

            // SLIDE ATTACK LOGIC
            if (attackKey === 'light_down_grounded') {
                this.player.velocity.x = facing * PhysicsConfig.SLIDE_ATTACK_SPEED;
            } else if (attackKey === 'light_run_grounded') {
                // User Request: "a little more sliding"
                this.player.velocity.x = facing * (PhysicsConfig.SLIDE_ATTACK_SPEED * 1.2);
            }

            // Side Sig Ghost: Spawn immediately so remote players see it
            // (Remote players don't run combat.update(), so updateGhostEffect() never fires)
            if (this.currentAttack.data.type === AttackType.HEAVY &&
                this.currentAttack.data.direction === AttackDirection.SIDE &&
                this.player.character === 'fok') {
                this.updateGhostEffect();
            }
        } catch (e) {
            console.warn('Unknown attack:', attackKey);
        }
    }

    private startChargedAttack(attackKey: string, _chargePercent: number): void {
        try {
            const facing = this.player.getFacingDirection();
            // Clear any previous ghost before new attack
            this.clearGhostEffect();
            this.hasSpawnedGhost = false;

            this.currentAttack = new Attack(attackKey, facing); // Removed chargePercent
            this.player.isAttacking = true;
            this.hitTargets.clear();

            // Trigger network callback (was missing — heavy attacks were never broadcast!)
            if (this.player.onAttack) {
                this.player.onAttack(attackKey, facing);
            }

            // Side Sig Ghost: Spawn immediately so remote players see it
            if (this.currentAttack.data.type === AttackType.HEAVY &&
                this.currentAttack.data.direction === AttackDirection.SIDE &&
                this.player.character === 'fok') {
                this.updateGhostEffect();
            }

            // Set cooldown
            this.attackCooldownTimer = this.currentAttack.data.recoveryDuration;
        } catch (e) {
            console.warn(`Attack ${attackKey} not found`);
        }
    }

    private executeChargedAttack(): void {
        const direction = this.chargeDirection;
        const isAerial = !this.player.isGrounded;

        // Calculate charge multiplier (0 to 1 based on charge time)
        const chargePercent = Math.min(this.chargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);

        // Snapshot charge time BEFORE clearing (so damage calc can read it)
        this.lastChargeTime = this.chargeTime;

        // Get attack key and start charged attack
        const attackKey = Attack.getAttackKey(AttackType.HEAVY, direction, isAerial);
        this.startChargedAttack(attackKey, chargePercent);
        this.clearChargeState();
    }

    private updateChargeState(delta: number): void {
        if (!this.isCharging) return;

        // Accumulate charge time
        this.chargeTime += delta;

        // Auto-release if max charge exceeded
        if (this.chargeTime >= PhysicsConfig.CHARGE_MAX_TIME) {
            this.executeChargedAttack();
            return;
        }

        const chargePercent = Math.min(this.chargeTime / PhysicsConfig.CHARGE_MAX_TIME, 1);

        // Subtle Shake Effect
        // Intensity increases with charge, max 1.5 pixels
        const maxShake = 1.5;
        const intensity = chargePercent * maxShake;

        const offsetX = (Math.random() - 0.5) * 2 * intensity;
        const offsetY = (Math.random() - 0.5) * 2 * intensity;

        this.player.setVisualOffset(offsetX, offsetY);
    }



    private clearChargeState(): void {
        this.isCharging = false;
        this.chargeTime = 0;
        // Reset body color and offset
        this.player.resetVisuals();
    }

    private updateThrowCharge(delta: number): void {
        this.throwChargeTime += delta;
        const maxChargeTime = 1000; // 1 second for max power
        const overchargeTime = 2000; // 2 seconds to explode in hand

        if (this.throwChargeTime >= overchargeTime) {
            // Explode in hand!
            if (this.player.heldItem) {
                this.player.heldItem.explode();
                this.player.heldItem = null;
            }
            this.isThrowCharging = false;
            this.throwChargeTime = 0;
            this.player.resetVisuals();
            return;
        }

        const chargePercent = Math.min(this.throwChargeTime / maxChargeTime, 1);

        // Visual shake for the bomb/char
        const intensity = chargePercent * 2;
        const offsetX = (Math.random() - 0.5) * 2 * intensity;
        const offsetY = (Math.random() - 0.5) * 2 * intensity;
        this.player.setVisualOffset(offsetX, offsetY);
    }

    private executeThrow(input: InputState): void {
        // 8-Directional Aiming
        let dirX = 0;
        let dirY = 0;

        if (input.aimUp) dirY = -1;
        if (input.aimDown) dirY = 1;
        if (input.aimLeft) dirX = -1;
        if (input.aimRight) dirX = 1;

        // If no direction held, throw forward
        if (dirX === 0 && dirY === 0) {
            dirX = this.player.getFacingDirection();
        }

        // Normalize diagonals
        if (dirX !== 0 && dirY !== 0) {
            const mag = Math.sqrt(dirX * dirX + dirY * dirY);
            dirX /= mag;
            dirY /= mag;
        }

        // Calculate power based on charge
        const maxChargeTime = 1000;
        const chargePercent = Math.min(this.throwChargeTime / maxChargeTime, 1);

        // Base speed 18, Max speed 38
        const powerMultiplier = 18 + (chargePercent * 20);

        if (this.player.heldItem) {
            const bomb = this.player.heldItem;
            this.player.throwItem(dirX * powerMultiplier, dirY * powerMultiplier);
            // Start the 3s fuse on the bomb
            if (bomb.onThrown) {
                bomb.onThrown(this.player);
            }
        }

        this.player.resetVisuals();
    }

    private startGroundPound(): void {
        this.isGroundPounding = true;
        this.groundPoundStartupTimer = PhysicsConfig.GROUND_POUND_STARTUP;
        this.player.velocity.set(0, 0); // Pause in air

        // Start the attack for hitbox purposes
        const facing = this.player.getFacingDirection();
        const attackKey = Attack.getAttackKey(AttackType.HEAVY, AttackDirection.DOWN, true);
        try {
            this.currentAttack = new Attack(attackKey, facing);
            this.player.isAttacking = true;
            this.hitTargets.clear();
        } catch (e) {
            console.warn('Ground pound attack not found');
        }
    }

    private updateAttackState(delta: number): void {
        if (!this.currentAttack) {
            this.endAttack();
            return;
        }

        // Ground pound startup
        if (this.isGroundPounding && this.groundPoundStartupTimer > 0) {
            this.groundPoundStartupTimer -= delta;
            this.player.velocity.set(0, 0); // Stay suspended
            if (this.groundPoundStartupTimer <= 0) {
                // this.player.setVisualTint(0xff0000); // Switch to attack color
            }
            return;
        }

        // During ground pound descent, always keep hitbox active
        if (this.isGroundPounding && this.groundPoundStartupTimer <= 0) {
            // Check if we hit the ground
            if (this.player.isGrounded) {
                this.endGroundPound();
                return;
            }

            this.updateHitbox();
            // Ground pounding players fall faster
            this.player.velocity.y = PhysicsConfig.MAX_FALL_SPEED * 1.5;
            return; // Skip normal attack phase update during ground pound
        }

        // Update attack phase
        const attackComplete = this.currentAttack.update(delta);

        // Check for Multi-Hit Reset
        if (this.currentAttack.shouldResetHits()) {
            this.hitTargets.clear();
        }

        // Handle hitbox
        if (this.currentAttack.isHitboxActive()) {
            this.updateHitbox();

            // Side Sig Projectile (Seal) - REVERTED
            // if (!this.hasSpawnedProjectile &&
            //     this.currentAttack.data.type === AttackType.HEAVY &&
            //     this.currentAttack.data.direction === AttackDirection.SIDE &&
            //     this.player.character === 'fok_v3') {
            //
            //     this.spawnSeal();
            //     this.hasSpawnedProjectile = true;
            // }

        } else {
            this.deactivateHitbox();
        }

        // Side Sig Ghost Effect (Fok only)
        if (this.currentAttack.data.type === AttackType.HEAVY &&
            this.currentAttack.data.direction === AttackDirection.SIDE &&
            this.player.character === 'fok') {

            this.updateGhostEffect();
        } else {
            // Ensure ghost is cleared if we switch phases or something weird happens
            this.clearGhostEffect();
        }



        if (attackComplete) {
            this.endAttack();
        } else {
            // Apply Drag for Slide Attack
            if (this.currentAttack.data.type === AttackType.LIGHT &&
                this.currentAttack.data.direction === AttackDirection.DOWN &&
                !this.currentAttack.data.isAerial) {
                this.player.velocity.x *= PhysicsConfig.SLIDE_ATTACK_DECELERATION;
            }
        }
    }

    public endAttack(): void {
        this.player.isAttacking = false;
        this.isGroundPounding = false;
        this.currentAttack = null;
        this.deactivateHitbox();
        this.player.resetVisuals();
        this.clearGhostEffect();

        // Set cooldown — scale recovery with charge for Side Sig
        if (this.player.character === 'fok' &&
            this.lastChargeTime > 0) {
            // Longer charge = longer recovery (punishable)
            // Base 100ms + up to 600ms based on charge
            const maxCharge = PhysicsConfig.CHARGE_MAX_TIME;
            const chargeRatio = Math.min(this.lastChargeTime / maxCharge, 1);
            this.attackCooldownTimer = 100 + (chargeRatio * 600);
        } else {
            this.attackCooldownTimer = 100;
        }

        // Reset snapshot
        this.lastChargeTime = 0;
    }

    private endGroundPound(): void {
        // End the ground pound and enter recovery state
        this.player.isAttacking = false;
        this.isGroundPounding = false;
        this.currentAttack = null;
        this.deactivateHitbox();
        this.player.resetVisuals();

        // Enter recovery frames (endlag)
        // Ground pounds have significant recovery on landing or cancellation
        this.attackCooldownTimer = PhysicsConfig.GROUND_POUND_STARTUP; // Use startup time as recovery duration

        // Apply landing lag if on ground
        if (this.player.isGrounded) {
            this.player.velocity.x *= 0.5; // Reduce horizontal momentum on landing
        }
    }

    private updateHitbox(): void {
        if (!this.currentAttack) return;

        let offset = this.currentAttack.getHitboxOffset();
        let width = this.currentAttack.data.hitboxWidth;
        let height = this.currentAttack.data.hitboxHeight;

        // Custom Overrides
        // Down Sig: Center Bottom
        if (this.currentAttack.data.type === AttackType.HEAVY &&
            this.currentAttack.data.direction === AttackDirection.DOWN) {

            // Position at bottom of player collision box
            // Player Y is center, so add half height
            // We want the CENTER of the hitbox to be at the BOTTOM of the player
            offset.x = 0;
            offset.y = PhysicsConfig.PLAYER_HEIGHT / 2;

            // Adjust dimensions: Wider and Less Tall
            width = 127; // Round 12: +15% (was 110)
            height = 30;
        }

        // Neutral/Up Sig: Center Top, Flat and Wide
        if (this.currentAttack.data.type === AttackType.HEAVY &&
            (this.currentAttack.data.direction === AttackDirection.UP ||
                this.currentAttack.data.direction === AttackDirection.NEUTRAL)) {

            // Position at top of player collision box
            offset.x = 0;
            offset.y = -PhysicsConfig.PLAYER_HEIGHT / 2;

            // Adjust dimensions: Wider and Flat (but slightly taller than DownSig)
            width = PhysicsConfig.UP_SIG_HITBOX_WIDTH;
            height = PhysicsConfig.UP_SIG_HITBOX_HEIGHT;
        }



        // Side/Neutral/Up Light Attacks - Easy Tweak Block
        if (this.currentAttack.data.type === AttackType.LIGHT &&
            (this.currentAttack.data.direction === AttackDirection.SIDE ||
                this.currentAttack.data.direction === AttackDirection.NEUTRAL ||
                this.currentAttack.data.direction === AttackDirection.UP)) {

            width = PhysicsConfig.SIDE_LIGHT_HITBOX_WIDTH;
            const facing = this.player.getFacingDirection();
            offset.x += facing * PhysicsConfig.SIDE_LIGHT_OFFSET_EXTRA;
        }

        let hitboxX = this.player.x + offset.x;
        let hitboxY = this.player.y + offset.y;

        // Custom Override for Side Sig Ghost (Fok)
        // Hitbox must follow the ghost sprite
        if (this.currentAttack.data.type === AttackType.HEAVY &&
            this.currentAttack.data.direction === AttackDirection.SIDE &&
            this.player.character === 'fok' &&
            this.ghostSprite && this.ghostSprite.active) {

            // Override position to match ghost
            hitboxX = this.ghostSprite.x;
            hitboxY = this.ghostSprite.y;

            // Override size to match ghost
            if (this.ghostSprite.width > 0) {
                width = this.ghostSprite.width * PhysicsConfig.GHOST_HITBOX_SCALE;
                height = this.ghostSprite.height * PhysicsConfig.GHOST_HITBOX_SCALE;
            }
        }

        this.updateActiveHitbox(hitboxX, hitboxY, width, height);
    }

    public updateRecoveryHitbox(): void {
        // Centered hitbox for recovery - surrounds player (Player is 40x60)
        this.updateActiveHitbox(this.player.x, this.player.y, PhysicsConfig.RECOVERY_HITBOX_SIZE, PhysicsConfig.RECOVERY_HITBOX_SIZE);
    }

    public calculateCurrentDamage(): number {
        if (this.currentAttack) {
            let damage = this.currentAttack.data.damage;

            // Side Sig Damage Scaling (Fok)
            // Min 6 -> Max 20 based on charge
            if (this.player.character === 'fok' &&
                this.currentAttack.data.type === AttackType.HEAVY &&
                this.currentAttack.data.direction === AttackDirection.SIDE) {

                const maxCharge = PhysicsConfig.CHARGE_MAX_TIME;
                const chargeRatio = Math.min(this.lastChargeTime / maxCharge, 1);
                damage = PhysicsConfig.SIDE_SIG_MIN_DAMAGE + (chargeRatio * (PhysicsConfig.SIDE_SIG_MAX_DAMAGE - PhysicsConfig.SIDE_SIG_MIN_DAMAGE));
            }
            return Math.floor(damage);
        } else if (this.player.physics.isRecovering) {
            return PhysicsConfig.RECOVERY_DAMAGE;
        }
        return 0;
    }

    private updateActiveHitbox(x: number, y: number, width: number, height: number): void {
        if (!this.activeHitbox) {
            this.activeHitbox = new Hitbox(
                this.scene,
                x,
                y,
                width,
                height
            );
            // Sync current debug state
            this.activeHitbox.setDebug(this.showDebugHitboxes);
        }
        this.activeHitbox.setSize(width, height);
        this.activeHitbox.activate(x, y);

        // Update Debug Damage Text
        if (this.showDebugHitboxes) {
            if (!this.debugDamageText) {
                this.debugDamageText = this.scene.add.text(x, y, '', {
                    fontSize: '14px',
                    color: '#ff0000',
                    backgroundColor: '#ffffff',
                    padding: { x: 2, y: 2 }
                });
                this.debugDamageText.setDepth(100);

                // Fix Double Render Glitch (Ignore in UI Camera)
                const scene = this.scene as unknown as GameSceneInterface;
                if (scene.uiCamera) {
                    scene.uiCamera.ignore(this.debugDamageText);
                }
            }

            const damage = this.calculateCurrentDamage();

            this.debugDamageText.setText(`${damage}`);
            this.debugDamageText.setPosition(x, y - height / 2 - 20); // Place above hitbox
            this.debugDamageText.setVisible(true);
        }
    }

    public deactivateHitbox(): void {
        if (this.activeHitbox) {
            this.activeHitbox.deactivate();
        }
        if (this.debugDamageText) {
            this.debugDamageText.setVisible(false);
        }
    }

    public checkAttackCollision(target: Fighter): void {
        // Already hit this target?
        if (this.hitTargets.has(target)) return;

        // Cannot hit self, invincible targets, or respawning targets
        if (target === this.player || target.isInvincible || target.isInvulnerable) return;

        // Need source data (Attack or Recovery)
        if (!this.currentAttack && !this.player.physics.isRecovering) return;

        // Use activeHitbox
        if (!this.activeHitbox || !this.activeHitbox.active) return;


        const targetBounds = target.getBounds();
        if (this.activeHitbox.checkCollision(targetBounds)) {
            this.hitTargets.add(target);
            this.applyHitTo(target);
        }
    }

    private applyHitTo(target: Fighter): void {
        let damage = 0;
        // let knockback = 0; // Legacy removed
        let baseKnockback = 100; // Default fallback
        let knockbackGrowth = 5; // Default fallback
        let knockbackAngle = 45;
        let isHeavy = false;

        if (this.currentAttack) {
            const data = this.currentAttack.data;
            damage = this.calculateCurrentDamage();
            // knockback = data.knockback; // Legacy removed
            baseKnockback = data.baseKnockback || 150;
            knockbackGrowth = data.knockbackGrowth || 5;
            knockbackAngle = data.knockbackAngle;
            isHeavy = data.type === AttackType.HEAVY;

            // Side Sig Knockback Scaling (Fok) — reward for risky full charge
            if (this.player.character === 'fok' &&
                data.type === AttackType.HEAVY &&
                data.direction === AttackDirection.SIDE) {

                const maxCharge = PhysicsConfig.CHARGE_MAX_TIME;
                const chargeRatio = Math.min(this.lastChargeTime / maxCharge, 1);
                // Scale knockback: 1.0x at no charge -> 1.5x at full charge
                baseKnockback = baseKnockback * (1.0 + (chargeRatio * 0.5));
                knockbackGrowth = knockbackGrowth * (1.0 + (chargeRatio * 0.3));
            }
        } else if (this.player.physics.isRecovering) {
            // Recovery Hit Data
            damage = 8;
            baseKnockback = 250;
            knockbackGrowth = 8;
            knockbackAngle = 80; // Upwards
            isHeavy = false;
        } else {
            return;
        }

        // Calculate knockback
        const knockbackForce = DamageSystem.calculateKnockback(
            damage,
            baseKnockback,
            knockbackGrowth,
            target.damagePercent
        );

        // Facing direction needed from player
        const facing = this.player.getFacingDirection();

        // Calculate knockback direction based on attack angle
        const angleRad = (knockbackAngle * Math.PI) / 180;
        const knockbackVector = new Phaser.Math.Vector2(
            Math.cos(angleRad) * knockbackForce * facing,
            -Math.sin(angleRad) * knockbackForce
        );

        // Ground Bounce: If knocking down into floor while grounded, bounce up
        if (target.isGrounded && knockbackVector.y > 0) {
            knockbackVector.y *= -0.8; // Bounce up with 80% force
            target.y -= 10; // Lift off ground to prevent immediate snap-back
            target.isGrounded = false; // Mark as airborne
        }

        // Apply damage and knockback (also calls applyHitStun)
        DamageSystem.applyDamage(target, damage, knockbackVector);

        // Reset air action counter on hit - Check if target is Player
        if (target instanceof Player) {
            target.physics.airActionCounter = 0;
            target.physics.wallTouchesExhausted = false;
        }

        // Screen Shake (Heavy Attacks)
        if (isHeavy) {
            this.scene.cameras.main.shake(100, 0.005);
        }

        // Trigger network callback
        if (this.player.onHit) {
            this.player.onHit(target, damage, knockbackVector.x, knockbackVector.y);
        }

        // Visual Effects for Down Air (Spike)
        // Removed down arrow visual
    }

    private updateGhostEffect(): void {
        // If already spawned, do not update (Fire and Forget)
        if (this.hasSpawnedGhost) return;

        const facing = this.player.getFacingDirection();

        // Create Ghost Sprite
        // Use 'fok' atlas and the first frame of the ghost animation
        const ghost = this.scene.add.sprite(this.player.x, this.player.y, 'fok', 'fok_side_sig_ghost_000');
        ghost.setDepth(this.player.depth - 1); // Behind player
        ghost.play('fok_side_sig_ghost');
        // Faint glow effect (Diffused White)
        let glowFx: Phaser.FX.Glow | null = null;
        if (ghost.preFX) {
            // Color: White (0xffffff), Strength: 2, Quality: 0.1, Distance: 90 (very soft/diffused)
            glowFx = ghost.preFX.addGlow(0xffffff, 2, 0, false, 0.1, 90);
        }

        // Fix Double Sprite Glitch (Ignore in UI Camera)
        const scene = this.scene as unknown as GameSceneInterface;
        if (scene.uiCamera) {
            scene.uiCamera.ignore(ghost);
        }

        // Initial Position: Player X + (15 * facing)
        const startX = this.player.x + (15 * facing);
        ghost.setPosition(startX, this.player.y);

        this.hasSpawnedGhost = true;
        // Restore reference for Hitbox tracking
        this.ghostSprite = ghost;

        // Flip logic: Use scaleX to ensure correct orientation
        // If firing left (-1), scaleX becomes -1 (flipped)
        // If firing right (1), scaleX becomes 1 (normal)
        ghost.setScale(facing, 1);

        // Tween 1: Propel forward — distance scales with charge (110px min, 145px max)
        const maxChg = PhysicsConfig.CHARGE_MAX_TIME;
        const chgRatio = Math.min(this.lastChargeTime / maxChg, 1);
        const travelDist = 110 + (chgRatio * 35); // 110 to 145

        this.scene.tweens.add({
            targets: ghost,
            x: startX + (travelDist * facing),
            duration: 300,
            ease: 'Cubic.easeOut'
        });

        // Calculate ghost linger time to match recovery window
        // Recovery = 100 + chargeRatio * 600  (from endAttack)
        const maxCharge = PhysicsConfig.CHARGE_MAX_TIME;
        const chargeRatio = Math.min(this.lastChargeTime / maxCharge, 1);
        const recoveryTime = 100 + (chargeRatio * 600);
        // Ghost stays solid during movement (300ms), then visible for remaining recovery
        const fadeDelay = Math.max(recoveryTime - 300, 50); // At least 50ms delay

        // Tween 2: Fade Out after recovery-scaled delay
        this.scene.tweens.add({
            targets: ghost,
            alpha: 0,
            delay: fadeDelay,
            duration: 600, // Even smoother fade (was 500)
            onComplete: () => {
                if (ghost && ghost.active) {
                    ghost.destroy();
                }
            }
        });

        // Tween 3: Fade Glow Strength (starts slightly earlier or with alpha)
        if (glowFx) {
            this.scene.tweens.add({
                targets: glowFx,
                outerStrength: 0,
                delay: fadeDelay,
                duration: 600,
            });
        }
    }

    private clearGhostEffect(): void {
        // Do NOT destroy the ghost here. Let it fade out naturally via tween.
        // Just reset the flag so we can spawn a new one next attack.
        this.hasSpawnedGhost = false;
        this.ghostSprite = null; // Forget reference
    }
}
