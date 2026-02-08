import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';

import { InputManager } from '../input/InputManager';
import type { InputState } from '../input/InputManager';
import { Fighter } from './Fighter';
import { PlayerPhysics } from './player/PlayerPhysics';
import { PlayerCombat } from './player/PlayerCombat';
import { Attack, AttackPhase, AttackType, AttackDirection } from '../combat/Attack';
import { PlayerAI } from './player/PlayerAI';
import type { PlayerSnapshot } from '../network/StateSnapshot';

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

export class Player extends Fighter {
    private sprite!: Phaser.GameObjects.Sprite;
    public physics: PlayerPhysics; // Public for debugging/GameScene access if needed

    // Combat system delegated to PlayerCombat
    private _isAttacking: boolean = false;
    public get isAttacking(): boolean { return this._isAttacking; }
    public set isAttacking(value: boolean) { this._isAttacking = value; }

    public combat: PlayerCombat;

    // Animation key for network sync (used so remote players play correct animation)
    public animationKey: string = '';

    // Dodge system
    public isDodging: boolean = false; // Public for Physics access

    private dodgeCooldownTimer: number = 0;

    // Facing direction
    private facingDirection: number = 1;
    public getFacingDirection(): number { return this.facingDirection; }
    public setFacingDirection(dir: number): void {
        this.facingDirection = dir;
        if (this.sprite) {
            this.sprite.setFlipX(dir < 0);
        }
    }

    // Damage display


    // Unified input system (keyboard + gamepad)
    private inputManager!: InputManager;
    private currentInput!: InputState;

    // Network input injection
    public useExternalInput: boolean = false; // When true, updatePhysics skips internal polling
    public setInput(input: InputState): void {
        this.currentInput = input;
    }

    // Sprite accessor for external tinting
    public get spriteObject(): Phaser.GameObjects.Sprite {
        return this.sprite;
    }

    // AI Control
    public isAI: boolean = false;
    private ai: PlayerAI | null = null;
    private aiInput: any = {}; // Store AI generated input
    public isTrainingDummy: boolean = false; // Toggle for training mode

    // Player ID (0 = P1, 1 = P2, etc.)
    public playerId: number = 0;

    // Character Type
    // Character config
    public character: 'fok_v3' = 'fok_v3';
    private animPrefix: string = 'alchemist';
    private debugRect!: Phaser.GameObjects.Rectangle;

    public lightAttackVariant: number = 0;

    // Item Holding
    public heldItem: any | null = null; // Typing as any to avoid circular import issues with Bomb for now, or use interface

    public checkItemPickup(): boolean {
        // Access bombs from scene
        const bombs = (this.scene as any).bombs;
        if (!bombs || bombs.length === 0) return false;

        const pickupRange = 60; // Interaction radius

        // Find closest bomb
        let closestBomb = null;
        let minDist = pickupRange;

        for (const bomb of bombs) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, bomb.x, bomb.y);
            if (dist < minDist) {
                minDist = dist;
                closestBomb = bomb;
            }
        }

        if (closestBomb) {
            this.pickupItem(closestBomb);
            return true;
        }
        return false;
    }

    public pickupItem(item: any): void {
        this.heldItem = item;
        // Disable physics for the item while holding
        item.setSensor(true);
        item.setIgnoreGravity(true);
        item.setVelocity(0, 0);
        item.setAngularVelocity(0);
    }

    public throwItem(velocityX: number, velocityY: number): void {
        if (!this.heldItem) return;

        const item = this.heldItem;
        this.heldItem = null;

        // Re-enable physics
        item.setSensor(false);
        item.setIgnoreGravity(false);

        item.setVelocity(velocityX, velocityY);
        // Add some spin
        item.setAngularVelocity(0.2 * this.getFacingDirection());

        // Offset spawn slightly so it doesn't clip immediately (though sensor is off now.. wait, might need to re-enable sensor after a frame if we want it to hit player? No, usually ignore thrower).
        // For now, simple throw.
    }

    public updateHeldItemPosition(): void {
        if (this.heldItem) {
            // Position in front of the character, towards the bottom
            const offsetForward = 55 * this.getFacingDirection(); // Increased from 25 to 55
            const offsetDown = 25; // Relative to center (Bottom is 45)

            this.heldItem.setPosition(this.x + offsetForward, this.y + offsetDown);
            this.heldItem.setVelocity(0, 0); // Force stay
        }
    }

    public setDebug(visible: boolean): void {

        if (this.debugRect) {
            this.debugRect.setVisible(visible);
        }
        if (this.nameTag) {
            this.nameTag.setVisible(visible);
        }
        if (this.combat) {
            this.combat.setDebug(visible);
        }
    }

    constructor(scene: Phaser.Scene, x: number, y: number, config: { isAI?: boolean, isTrainingDummy?: boolean, playerId?: number, gamepadIndex?: number | null, useKeyboard?: boolean, character?: 'fok_v3' } = {}) {
        super(scene, x, y);

        this.isAI = config.isAI || false;
        this.isTrainingDummy = config.isTrainingDummy || false;
        this.playerId = config.playerId || 0;

        // Character Selection
        this.character = config.character || 'fok_v3'; // Default is fok_v3
        this.animPrefix = this.character;

        // Create player sprite
        const initialFrame = 'Fok_v3_Idle_000';
        this.sprite = scene.add.sprite(0, 0, this.character, initialFrame); // Adjusted offset (0) to ground sprite



        // Base size is 256 for both characters (User confirmed 1:1 scale)
        const scale = 1;
        this.sprite.setScale(scale);

        this.add(this.sprite);

        // Visual distinction
        // Visual distinction
        // REMOVED: Legacy tinting (red for AI, green for P2) caused persistent visual bugs.
        // Players should spawn with natural colors.
        // if (this.isAI) { ... }



        // Create Name Tag (Player Indicator)
        // Logic: specific name for human (FOK), CPU N for AI
        let displayName = '';
        if (this.isAI) {
            displayName = `CPU ${this.playerId + 1}`;
        } else {
            // Use character name in uppercase
            displayName = this.character.toUpperCase();
        }

        this.nameTag = scene.add.text(0, -100, displayName, {
            fontSize: '18px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.nameTag.setOrigin(0.5);
        this.add(this.nameTag);
        this.nameTag.setVisible(false); // Hidden by default, shown in debug mode

        // Initialize Components
        this.physics = new PlayerPhysics(this);
        this.combat = new PlayerCombat(this, scene);

        if (this.isAI) {
            this.ai = new PlayerAI(this, scene);
        }

        // Explicitly set size (BEFORE Debug Hitbox creation)
        this.setSize(60, 120); // Default size

        // Refinement Round 9: Wider hitbox for fok_v3 (40px width - +5px each side)
        if (this.character === 'fok_v3') {
            this.setSize(40, 120);
        }

        // Create Debug Hitbox (Hidden by default)
        this.debugRect = scene.add.rectangle(0, 0, this.width, this.height);
        this.debugRect.setStrokeStyle(2, 0x00ff00);
        this.debugRect.setFillStyle(0x00ff00, 0.2);
        this.debugRect.setVisible(false);
        this.add(this.debugRect);

        // Setup input manager
        const defaultKeyboard = this.playerId === 0 && !this.isAI;
        const useKeyboard = config.useKeyboard !== undefined ? config.useKeyboard : defaultKeyboard;
        const gamepadIdx = config.gamepadIndex !== undefined ? config.gamepadIndex : null;
        // STRICT ROUTING: enableGamepad only when gamepadIndex is explicitly assigned
        const enableGamepad = gamepadIdx !== null;

        console.log(`[Player ${this.playerId}] Input Config: useKeyboard=${useKeyboard}, gamepadIndex=${gamepadIdx}, enableGamepad=${enableGamepad}, config.gamepadIndex=${config.gamepadIndex}`);


        // Physics Body Creation happens in PlayerPhysics using this.width/height
        // OR it uses its own constants. Let's check PlayerPhysics.

        this.inputManager = new InputManager(scene, {
            playerId: this.playerId,
            useKeyboard: useKeyboard,
            gamepadIndex: gamepadIdx,
            enableGamepad: enableGamepad
        });

        this.resetVisuals(); // Ensure clean visual state (no tints)
        scene.add.existing(this);
    }

    public setDamage(percent: number): void {
        this.damagePercent = percent;
        this.updateDamageDisplay();
    }

    public updatePhysics(delta: number): void {
        // Get input
        if (this.isAI) {
            if (this.isTrainingDummy) {
                this.currentInput = this.inputManager.getEmptyInput();
            } else {
                this.updateAI(delta);
                this.currentInput = this.aiInput;
            }
        } else {
            this.currentInput = this.inputManager.poll();
        }

        // Update Physics Component (Resets isGrounded, Applies Gravity & Move)
        this.physics.update(delta, this.currentInput);

        // Update Facing (Run after physics/velocity update)
        this.updateFacing();
    }

    public updateLogic(delta: number): void {
        // Remote players don't run combat logic (it's synced from network)
        // Only local players run combat update/handleInput
        if (this.currentInput) {
            // Update Combat Component
            this.combat.update(delta);

            // Handle input for combat
            this.combat.handleInput(this.currentInput);
        }

        // Update Combat/Timers (everyone needs this for cooldowns)
        this.updateTimers(delta);

        // Visuals (Now sees correct isGrounded state from Scene Collisions)
        this.updateAnimation();
        this.updateDamageDisplay();
        this.updateHeldItemPosition();
    }

    // Legacy update for safety (deprecate?)
    update(delta: number): void {
        this.updatePhysics(delta);
        this.updateLogic(delta);
    }

    private updateTimers(delta: number): void {
        this.hitStunTimer -= delta;

        if (this.hitStunTimer <= 0 && this.isHitStunned) {
            this.isHitStunned = false;
            this.isHitStunned = false;
            this.resetVisuals();
        }

        if (this.invulnerabilityTimer > 0) {
            this.invulnerabilityTimer -= delta;

            // Visual Flash (Alpha toggle every 50ms)
            // 6 frames is very short (100ms), so this will blink once or twice.
            const blink = Math.floor(this.invulnerabilityTimer / 50) % 2 === 0;
            this.sprite.setAlpha(blink ? 0.5 : 1);

            if (this.invulnerabilityTimer <= 0) {
                this.isInvulnerable = false;
                this.sprite.setAlpha(1); // Ensure visual reset
            }
        }

        if (this.dodgeCooldownTimer > 0) {
            this.dodgeCooldownTimer -= delta;
        }
    }

    private updateFacing(): void {
        if (this.isHitStunned) return;

        // Special case: Ground Pound sprite is inverted (faces LEFT?)
        // So we invert the flip logic: Flip if facing Right (1), Don't flip if facing Left (-1)
        if (this.combat.isGroundPounding) {
            this.sprite.setFlipX(this.facingDirection > 0);
            return;
        }

        if (this.isAttacking) {
            const currentAttack = this.getCurrentAttack();
            if (currentAttack && currentAttack.phase !== AttackPhase.RECOVERY) {
                return;
            }
        }

        if (this.physics.isWallSliding) {
            this.facingDirection = -this.physics.wallDirection; // Look away from wall
        } else if (this.velocity.x > 5) {
            this.facingDirection = 1;
        } else if (this.velocity.x < -5) {
            this.facingDirection = -1;
        }

        // Apply facing to sprite
        // FlipX true means face LEFT (if original faces Right).
        // If original faces RIGHT:
        //   Facing 1 (Right): Flip false.
        //   Facing -1 (Left): Flip true.
        // User reported opposite, so trying < 0 to flip when facing LEFT.
        this.sprite.setFlipX(this.facingDirection < 0);
    }

    // Visual Helpers
    public visualColor: number = 0xffffff;
    public nameTag: Phaser.GameObjects.Text;

    public setVisualTint(color: number): void {
        this.sprite.setTint(color);
    }

    public resetVisuals(): void {
        this.sprite.setAlpha(1);
        // Do NOT tint the body with player color (User request)
        // Only use tint if we are flashing damage
        this.sprite.clearTint();

        // Update Name Tag Color
        if (this.nameTag) {
            const colorHex = '#' + this.visualColor.toString(16).padStart(6, '0');
            this.nameTag.setColor(colorHex);
        }

        this.sprite.setPosition(0, 0);
    }

    public setVisualOffset(x: number, y: number): void {
        this.sprite.setPosition(x, y);
    }

    public flashDamageColor(damage: number): void {
        let colorObj: Phaser.Types.Display.ColorObject;

        if (damage < 50) {
            // White to Pastel Yellow (0-50)
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 255, 255),
                new Phaser.Display.Color(255, 245, 150), // 0xfff596
                50,
                damage
            );
        } else if (damage < 100) {
            // Pastel Yellow to Pastel Orange (50-100)
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 245, 150),
                new Phaser.Display.Color(255, 200, 150), // 0xffc896
                50,
                damage - 50
            );
        } else if (damage < 150) {
            // Pastel Orange to Pastel Red (100-150)
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 200, 150),
                new Phaser.Display.Color(255, 150, 150), // 0xff9696
                50,
                damage - 100
            );
        } else {
            // Cap at Pastel Red
            const r = 255;
            const g = 150;
            const b = 150;
            colorObj = {
                r, g, b, a: 255,
                color: Phaser.Display.Color.GetColor(r, g, b)
            };
        }

        const color = Phaser.Display.Color.GetColor(colorObj.r, colorObj.g, colorObj.b);

        // Tint (multiplicative)
        this.sprite.setTint(color);
        this.sprite.setAlpha(1);

        // Restore after short duration
        this.scene.time.delayedCall(150, () => {
            // Only reset if we are not flashing for other reasons (like charge)
            // But charge stops on hit.
            this.resetVisuals();
        });
    }

    // Delegated Methods
    public checkPlatformCollision(platform: Phaser.GameObjects.Rectangle, isSoft: boolean = false): void {
        this.physics.checkPlatformCollision(platform, isSoft);
    }

    public checkWallCollision(left: number, right: number): void {
        this.physics.checkWallCollision(left, right);
    }

    public checkLedgeGrab(platforms: Array<{ rect: Phaser.GameObjects.Rectangle; isSoft?: boolean }>): void {
        this.physics.checkLedgeGrab(platforms);
    }

    public checkHitAgainst(target: Player): void {
        this.combat.checkAttackCollision(target);
    }

    private updateAnimation(): void {
        // onFloor removed (unused)
        const velocity = this.velocity;

        // Dynamic Run Speed (Refinement Round 5)
        // Aggressively separate Walk vs Run using physics state
        if (this.sprite.anims.currentAnim && this.sprite.anims.currentAnim.key.includes('run')) {
            const speed = Math.abs(velocity.x);

            if (this.physics.isRunning) {
                // RUNNING: Fast playback logic
                // Refinement Round 6: User says "running slides", so reducing speed again
                // Previous: 1.2 + (speed / 2000)
                // New: 0.8 + (speed / 3000) -> Matches ground speed better
                const normalizedSpeed = 0.8 + (speed / 3000);
                this.sprite.anims.timeScale = normalizedSpeed;
            } else {
                // Should not happen if isRunning covers all grounded movement, 
                // but if we are decelerating, default to normal speed?
                // Or just keep the scaling logic if speed > 0
                this.sprite.anims.timeScale = 1;
            }
        } else {
            // Reset timeScale for non-run animations
            this.sprite.anims.timeScale = 1;
        }

        // Priority 1: Combat / Hittable (Locked animations)
        // If an attack or hitstun is playing, ensure timeScale is reset.
        // DO NOT RETURN HERE: Let the logic below select and play the specific 'attack' or 'hurt' animation key.
        if (this.isAttacking || this.isHitStunned) {
            this.sprite.anims.timeScale = 1;
        }

        // Remote players use synced animationKey directly (set from network)
        // We detect remote players by checking if they have no current input
        const isRemotePlayer = !this.currentInput;

        if (isRemotePlayer && this.animationKey) {
            this.playAnim(this.animationKey, true);
            return;
        }

        // Local player: calculate animation from state and set animationKey for sync
        if (this.isHitStunned) {
            this.animationKey = 'hurt';
            this.playAnim('hurt', true);
            return;
        }

        if (this.combat.isCharging) {
            this.animationKey = 'charging';
            this.playAnim('charging', true);
            return;
        }

        if (this.combat.isGroundPounding) {
            this.animationKey = 'ground_pound';
            this.playAnim('ground_pound', true);
            return;
        }

        if (this.isAttacking) {
            // Determine attack animation from currentAttack
            const currentAttack = this.getCurrentAttack();
            if (currentAttack) {
                if (currentAttack.data.type === AttackType.HEAVY) {
                    if (currentAttack.data.direction === AttackDirection.DOWN) {
                        this.animationKey = 'attack_heavy_down';
                    } else if (currentAttack.data.direction === AttackDirection.SIDE) {
                        this.animationKey = 'attack_heavy_side';
                    } else if (currentAttack.data.direction === AttackDirection.UP) {
                        this.animationKey = 'attack_heavy_up';
                    } else {
                        this.animationKey = 'attack_heavy_neutral';
                    }
                } else {
                    // LIGHT ATTACKS
                    if (currentAttack.data.direction === AttackDirection.UP) {
                        this.animationKey = 'attack_light_up';
                    } else if (currentAttack.data.direction === AttackDirection.DOWN) {
                        this.animationKey = 'attack_light_down';
                    } else if (currentAttack.data.direction === AttackDirection.SIDE) {
                        if (!this.isGrounded) {
                            this.animationKey = 'attack_light_side_air';
                        } else {
                            this.animationKey = 'attack_light_side';
                        }
                    } else {
                        // Neutral Light
                        this.animationKey = 'attack_light_neutral';
                    }
                }
            } else {
                this.animationKey = 'attack_light_neutral';
            }
            this.playAnim(this.animationKey, true);
            return;
        }

        if (this.isDodging) {
            // User Request 5: Dash if moving, Spot Dodge if still
            // Using logic similar to run threshold
            if (Math.abs(this.velocity.x) > 10) {
                this.animationKey = 'dash';
                this.playAnim('dash', true);
            } else {
                this.animationKey = 'spot_dodge';
                this.playAnim('spot_dodge', true);
            }
            return;
        }

        // Airborne
        if (!this.isGrounded) {
            if (this.physics.isRecovering) {
                this.animationKey = 'recovery';
                this.playAnim('recovery', true);
                return;
            }

            if (this.physics.isWallSliding) {
                this.animationKey = 'wall_slide';
                this.playAnim('wall_slide', true);
                return;
            }

            if (this.velocity.y < 0) {
                this.animationKey = 'jump';
                this.playAnim('jump', true);
            } else {
                this.animationKey = 'fall';
                this.playAnim('fall', true);
            }
            return;
        }

        // Grounded
        // Refinement 13: Increased threshold from 10 to 100 to stop run animation earlier
        // This prevents the "slide completely into stop" look
        // Refinement Round 4: Keeping this high threshold (100) but combining with low friction
        if (Math.abs(this.velocity.x) > 20) { // Reverted to 20 per request (user says "sliding")
            this.animationKey = 'run';
            this.playAnim('run', true);
        } else {
            this.animationKey = 'idle';
            this.playAnim('idle', true);
        }
    }

    // Add recovery to updateAnimation?
    // Wait, let's look at updateAnimation again. Where is RECOVERING handled?
    // It's part of !isGrounded usually?
    // Ah, logic:
    // ...
    // Airborne
    // if (!this.isGrounded) {
    //     if (this.physics.isWallSliding) ...
    //     if (this.velocity.y < 0) ...
    // }
    //
    // Recovery is an airborne state initiated by Up Special usually.
    // If PlayerState.RECOVERING is true (this.physics.isRecovering), we should play it.
    // But isRecovering is a flag in Physics.
    // Let's Insert it before general airborne check.

    /* 
        Correct insertion point:
        Inside updateAnimation(), before or inside '!this.isGrounded' check.
    */

    public playAnim(key: string, ignoreIfPlaying: boolean = true): void {
        const fullKey = `${this.animPrefix}_${key}`;

        // Opt-out if already playing to avoid resetting visual offsets (like shake)
        if (ignoreIfPlaying && this.sprite.anims.currentAnim && this.sprite.anims.currentAnim.key === fullKey) {
            return;
        }

        this.sprite.anims.play(fullKey, ignoreIfPlaying);

        // Apply custom offsets for misaligned sprites
        // Apply custom offsets for misaligned sprites
        if (key === 'wall_slide' && this.character === 'fok_v3') {
            // Refinement 8: Offset towards the wall by 2px to close gap
            this.sprite.x = this.physics.wallDirection * 2;
        } else if (key === 'attack_heavy_side' && this.character === 'fok_v3') {
            // Refinement Round 7: Offset animation further (was 80 -> 130)
            // Shifts sprite in facing direction to simulate stepping forward
            this.sprite.x = this.getFacingDirection() * 130;
        } else {
            this.sprite.x = 0;
        }
    }

    private updateDamageDisplay(): void {
        // Damage display removed from player sprite (User request)
        // Only PlayerHUD shows damage now.
    }

    // Getters for HUD
    public get damage(): number { return this.damagePercent; }
    // Lives are public in Fighter, but let's add accessor if needed or just use property
    // But GameScene expects .lives, which is on Fighter (superclass). So it should be fine if we fix the 'lives does not exist on Player' error by ensuring TS knows Player extends Fighter.
    // However, the error 'Property lives does not exist on type Player' usually means it wasn't on Fighter when TS checked.
    // I added it to Fighter just now. So it should be fine.
    // But let's add explicit getters just in case or for cleaner API.
    // actually, public lives on Fighter is enough.


    setKnockback(x: number, y: number): void {
        this.velocity.x = x;
        this.velocity.y = y;
    }

    // Getters
    getVelocity(): Phaser.Math.Vector2 { return this.velocity; }

    getState(): PlayerState {
        if (this.isHitStunned) return PlayerState.HIT_STUN;
        if (this.isDodging) return PlayerState.DODGING;
        if (this.combat.isGroundPounding) return PlayerState.GROUND_POUND;
        if (this.isAttacking) return PlayerState.ATTACKING;
        if (this.physics.isRecovering) return PlayerState.RECOVERING;
        if (this.isGrounded) return PlayerState.GROUNDED;
        if (this.physics.isFastFalling) return PlayerState.FAST_FALLING;
        return PlayerState.AIRBORNE;
    }

    getRecoveryAvailable(): boolean { return this.physics.recoveryAvailable; }
    getIsInvincible(): boolean { return this.isInvincible; }
    getCurrentAttack(): Attack | null { return this.combat.currentAttack; }



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

    private updateAI(delta: number): void {
        if (!this.ai) return;
        this.aiInput = this.ai.update(delta);
    }

    public applyHitStun(): void {
        super.applyHitStun();
        this.isAttacking = false;
        if (this.combat) {
            this.combat.isCharging = false;
            this.combat.isGroundPounding = false;
            this.combat.currentAttack = null;
            this.combat.deactivateHitbox();
        }
        this.isDodging = false;
        this.resetVisuals();

        // Trigger subtle damage flash
        this.flashDamageColor(this.damagePercent);
    }

    public respawn(): void {
        this.velocity.set(0, 0);
        this.physics.acceleration.set(0, 0);
        this.damagePercent = 0;
        this.isHitStunned = false;
        this.isInvincible = false;
        this.resetVisuals();
        this.physics.resetOnGround();
    }

    public addToCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
        camera.ignore(this);

    }

    // ============ NETWORK HELPERS ============

    public onAttack: ((attackKey: string, facingDirection: number) => void) | null = null;
    public onHit: ((victim: Fighter, damage: number, knockbackX: number, knockbackY: number) => void) | null = null;

    public playAttackAnimation(attackKey: string): void {
        // e.g. 'light_neutral_grounded' -> 'attack_light_0'
        // For now, simpler mapping or just pass the anim key directly if possible.
        // The OnlineGameScene passes 'light_neutral_grounded'. We need to map it or play a generic one.
        // Actually, let's just expose a way to play specific animation keys if we knew them.
        // But better: use the attack logic to set state, but that might duplicate logic.
        // Simplest: just play a generic attack animation based on type.

        if (attackKey.includes('heavy')) {
            this.playAnim('attack_heavy', true);
        } else {
            this.playAnim('attack_light_0', true);
        }

        // Also force facing update if needed
    }

    public takeDamage(amount: number): void {
        this.damagePercent = Math.min(this.damagePercent + amount, PhysicsConfig.MAX_DAMAGE);
        this.flashDamageColor(this.damagePercent);
    }

    public setVelocity(x: number, y: number): void {
        this.velocity.set(x, y);
    }

    public playHurtAnimation(): void {
        console.log(`[Player ${this.playerId}] playHurtAnimation called, setting animationKey='hurt'`);
        this.animationKey = 'hurt';
        this.playAnim('hurt', true);
        // Use hitStunTimer for proper timing (200ms = 0.2s * 1000)
        this.isHitStunned = true;
        this.hitStunTimer = 200; // Will be decremented in updateTimers
    }

    // ============ ROLLBACK NETCODE SUPPORT ============

    /**
     * Capture the current player state for rollback
     */
    public captureSnapshot(): PlayerSnapshot {
        // Derive state from flags
        let state = 'idle';
        if (this.isAttacking) state = 'attacking';
        else if (this.isDodging) state = 'dodging';
        else if (this.isHitStunned) state = 'hitstun';
        else if (!this.physics.isGrounded) state = 'airborne';

        return {
            playerId: this.playerId,
            x: this.x,
            y: this.y,
            velocityX: this.velocity.x,
            velocityY: this.velocity.y,
            isGrounded: this.physics.isGrounded,
            jumpsRemaining: this.physics.jumpsRemaining,
            facingDirection: this.facingDirection,
            damagePercent: this.damagePercent,
            playerState: state,
            isAttacking: this.isAttacking,
            animationKey: this.animationKey,
            isDodging: this.isDodging,
            isInvincible: this.isInvincible,
            lives: this.lives
        };
    }

    /**
     * Restore player state from a snapshot (for rollback)
     */
    public restoreSnapshot(snapshot: PlayerSnapshot): void {
        this.x = snapshot.x;
        this.y = snapshot.y;
        this.velocity.x = snapshot.velocityX;
        this.velocity.y = snapshot.velocityY;
        this.physics.isGrounded = snapshot.isGrounded;
        this.physics.jumpsRemaining = snapshot.jumpsRemaining;
        this.facingDirection = snapshot.facingDirection;
        this.damagePercent = snapshot.damagePercent;
        // playerState is derived, restore via flags
        this.isAttacking = snapshot.isAttacking;
        this.isDodging = snapshot.isDodging;
        this.isInvincible = snapshot.isInvincible;
        this.lives = snapshot.lives;

        // Update sprite position to match
        this.sprite.setPosition(this.x, this.y);
    }

    destroy(fromScene?: boolean): void {
        if (this.inputManager) this.inputManager.destroy();
        super.destroy(fromScene);
    }
}
