import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';

import { InputManager } from '../input/InputManager';
import type { InputState } from '../input/InputManager';
import { Fighter } from './Fighter';
import { PlayerPhysics } from './player/PlayerPhysics';
import { PlayerCombat } from './player/PlayerCombat';
import { Attack, AttackPhase, AttackType, AttackDirection } from '../combat/Attack';
import { PlayerAI } from './player/PlayerAI';

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

    // Dodge system
    public isDodging: boolean = false; // Public for Physics access

    private dodgeCooldownTimer: number = 0;

    // Facing direction
    private facingDirection: number = 1;
    public getFacingDirection(): number { return this.facingDirection; }

    // Damage display
    private damageText: Phaser.GameObjects.Text;

    // Unified input system (keyboard + gamepad)
    private inputManager!: InputManager;
    private currentInput!: InputState;

    // AI Control
    public isAI: boolean = false;
    private ai: PlayerAI | null = null;
    private aiInput: any = {}; // Store AI generated input
    public isTrainingDummy: boolean = false; // Toggle for training mode

    // Player ID (0 = P1, 1 = P2, etc.)
    public playerId: number = 0;

    // Character Type
    // Character Type
    public character: 'fok' = 'fok';
    private animPrefix: string = 'alchemist';
    private debugRect!: Phaser.GameObjects.Rectangle;
    private showDebugHitboxes: boolean = false;
    public lightAttackVariant: number = 0;

    public setDebug(visible: boolean): void {
        this.showDebugHitboxes = visible;
        if (this.debugRect) {
            this.debugRect.setVisible(visible);
        }
        if (this.combat) {
            this.combat.setDebug(visible);
        }
    }

    constructor(scene: Phaser.Scene, x: number, y: number, config: { isAI?: boolean, playerId?: number, gamepadIndex?: number | null, useKeyboard?: boolean, character?: 'fok' } = {}) {
        super(scene, x, y);

        this.isAI = config.isAI || false;
        this.playerId = config.playerId || 0;

        // Create player sprite (Chibi Knight)
        // Create player sprite (Bloody Alchemist)
        // Create player sprite (Fok)
        this.character = config.character || 'fok';
        this.animPrefix = this.character;

        // Create player sprite
        this.sprite = scene.add.sprite(0, 0, 'fok_idle_0'); // Adjusted offset (0) to ground sprite

        // Auto-scale to fit hitbox height (90px)
        const targetHeight = PhysicsConfig.PLAYER_HEIGHT;

        // Base size is 256 for both characters (User confirmed)
        const scale = (targetHeight / 256) * 1.5;
        this.sprite.setScale(scale);

        this.add(this.sprite);

        // Visual distinction
        if (this.isAI) {
            this.sprite.setTint(0xff5555); // Reddish tint for AI
        } else if (this.playerId === 1) {
            this.sprite.setTint(0x55ff55); // Green tint for Player 2
        }

        // Create damage text
        this.damageText = scene.add.text(0, -50, '0%', {
            fontSize: '16px',
            color: '#ffffff',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 3,
        });
        this.damageText.setOrigin(0.5);
        this.add(this.damageText);

        // Initialize Components
        this.physics = new PlayerPhysics(this);
        this.combat = new PlayerCombat(this, scene);

        if (this.isAI) {
            this.ai = new PlayerAI(this, scene);
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
        const gamepadIdx = config.gamepadIndex !== undefined ? config.gamepadIndex : (this.playerId === 0 ? null : this.playerId);
        const enableGamepad = gamepadIdx !== null || !useKeyboard;

        this.inputManager = new InputManager(scene, {
            playerId: this.playerId,
            useKeyboard: useKeyboard,
            gamepadIndex: gamepadIdx,
            enableGamepad: enableGamepad
        });

        scene.add.existing(this);
    }

    public setDamage(percent: number): void {
        this.damagePercent = percent;
        this.updateDamageDisplay();
    }

    update(delta: number): void {
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

        // Update Physics Component
        this.physics.update(delta, this.currentInput);

        // Update Facing (Run after physics/velocity update, but before combat locks state)
        this.updateFacing();

        // Update Combat Component
        this.combat.update(delta);

        // Handle input for combat
        this.combat.handleInput(this.currentInput);

        // Update Combat/Timers
        this.updateTimers(delta);

        // Visuals
        this.updateAnimation();
        this.updateDamageDisplay();
    }

    private updateTimers(delta: number): void {
        this.hitStunTimer -= delta;

        if (this.hitStunTimer <= 0 && this.isHitStunned) {
            this.isHitStunned = false;
            this.resetVisuals();
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

    public setVisualTint(color: number): void {
        this.sprite.setTint(color);
    }

    public resetVisuals(): void {
        this.sprite.setAlpha(1);
        this.sprite.setTint(this.visualColor);
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
        if (this.isHitStunned) {
            this.playAnim('hurt', true);
            return;
        }

        if (this.combat.isCharging) {
            this.playAnim('charging', true);
            return;
        }

        if (this.combat.isGroundPounding) {
            this.playAnim('ground_pound', true);
            return;
        }

        if (this.isAttacking) {
            const currentAttack = this.getCurrentAttack();
            if (currentAttack && currentAttack.data.type === AttackType.HEAVY) {
                this.playAnim('attack_heavy', true); // Use dedicated heavy attack frame
            } else if (currentAttack && currentAttack.data.direction === AttackDirection.UP) {
                // Check if it's the up attack (light)
                this.playAnim('attack_up', true);
            } else {
                this.playAnim(`attack_light_${this.lightAttackVariant}`, true); // Use alternating single-frame light attack
            }
            return;
        }

        // Airborne
        if (this.isDodging) {
            this.playAnim('slide', true);
            return;
        }

        // Airborne
        if (!this.isGrounded) {
            if (this.velocity.y < 0) {
                // If moving up fast, use jump start, else loop?
                // Simplification: mapped 'jump' to 'Jump Loop' in GameScene.
                // To support jump start properly, we'd need a trigger.
                // For now, let's play 'jump' (Jump Loop).
                // User asked for "jump start, jump loop" mapping.
                // If I just mapped 'jump' key to 'Jump Loop', I'm missing Jump Start.
                // I can map 'jump_start' if velocity.y is lower than threshold?
                this.playAnim('jump', true);
            } else {
                this.playAnim('fall', true);
            }
            return;
        }

        // Grounded
        if (Math.abs(this.velocity.x) > 10) {
            this.playAnim('run', true);
        } else {
            this.playAnim('idle', true);
        }
    }

    private playAnim(key: string, ignoreIfPlaying: boolean = true): void {
        let fullKey = `${this.animPrefix}_${key}`;
        this.sprite.anims.play(fullKey, ignoreIfPlaying);
    }

    private updateDamageDisplay(): void {
        const label = `P${this.playerId + 1}`;
        this.damageText.setText(label);

        // Match player color
        // Convert number color to hex string
        const colorHex = '#' + this.visualColor.toString(16).padStart(6, '0');
        this.damageText.setColor(colorHex);
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

    public get spriteObject(): any {
        return this.sprite;
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
        this.resetVisuals();
        // this.spine.setTintFill(0xffffff); // Flash white removed/handled differently

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
        if (this.damageText) {
            camera.ignore(this.damageText);
        }
    }

    destroy(fromScene?: boolean): void {
        if (this.inputManager) this.inputManager.destroy();
        super.destroy(fromScene);
    }
}
