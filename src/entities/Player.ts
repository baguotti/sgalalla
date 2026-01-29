import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';

import { InputManager } from '../input/InputManager';
import type { InputState } from '../input/InputManager';
import { Fighter } from './Fighter';
import { PlayerPhysics } from './player/PlayerPhysics';
import { PlayerCombat } from './player/PlayerCombat';
import { Attack, AttackPhase } from '../combat/Attack';
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
    private spine: any; // Using any to avoid SpinePlugin type conflicts in some environments
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

    // Player ID (0 = P1, 1 = P2, etc.)
    public playerId: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number, config: { isAI?: boolean, playerId?: number, gamepadIndex?: number | null, useKeyboard?: boolean } = {}) {
        super(scene, x, y);

        this.isAI = config.isAI || false;
        this.playerId = config.playerId || 0;

        // Create player spine object (Humanoid Placeholder)
        this.spine = (scene.add as any).spine(0, 0, 'humanoid-data', 'humanoid-atlas');

        // Humanoid (Spineboy) scaling and offset
        this.spine.setScale(0.25);
        this.spine.y = 30; // Feet position

        this.add(this.spine);

        // Visual distinction
        if (this.isAI) {
            this.spine.setTint(0xff5555); // Reddish tint for AI
        } else if (this.playerId === 1) {
            this.spine.setTint(0x55ff55); // Green tint for Player 2
        }

        // Create damage text
        this.damageText = scene.add.text(0, -60, '0%', {
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
            this.updateAI(delta);
            this.currentInput = this.aiInput;
        } else {
            this.currentInput = this.inputManager.poll();
        }

        // Update Physics Component
        this.physics.update(delta, this.currentInput);

        // Update Combat Component
        this.combat.update(delta);

        // Handle input for combat
        this.combat.handleInput(this.currentInput);

        // Update Combat/Timers
        this.updateTimers(delta);

        // Visuals
        this.updateFacing();
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

        if (this.isAttacking) {
            const currentAttack = this.getCurrentAttack();
            if (currentAttack && currentAttack.phase !== AttackPhase.RECOVERY) {
                return;
            }
        }

        if (this.physics.isWallSliding) {
            this.facingDirection = this.physics.wallDirection;
        } else if (this.velocity.x > 5) {
            this.facingDirection = 1;
        } else if (this.velocity.x < -5) {
            this.facingDirection = -1;
        }

        // Apply facing to spine object
        this.spine.setScaleX(Math.abs(this.spine.scaleX) * this.facingDirection);
    }

    // Visual Helpers
    public setVisualTint(color: number): void {
        this.spine.setTint(color);
    }

    public resetVisuals(): void {
        this.spine.setAlpha(1);
        if (this.isAI) {
            this.spine.setTint(0xff5555);
        } else {
            this.spine.clearTint();
        }
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
        if (!this.spine.animationState) return;

        let animName = 'idle';
        let loop = true;

        if (this.isHitStunned) {
            animName = 'aim';
            loop = false;
        } else if (!this.isGrounded) {
            animName = 'jump';
            loop = false;
        } else if (Math.abs(this.velocity.x) > 10) {
            animName = 'run';
            loop = true;
        }

        // Only set if different to avoid restarting animation every frame
        const current = this.spine.animationState.getCurrent(0);
        if (!current || current.animation.name !== animName) {
            this.spine.animationState.setAnimation(0, animName, loop);
        }
    }

    private updateDamageDisplay(): void {
        this.damageText.setText(`${Math.floor(this.damagePercent)}%`);
        if (this.damagePercent < 50) this.damageText.setColor('#ffffff');
        else if (this.damagePercent < 100) this.damageText.setColor('#ffff00');
        else if (this.damagePercent < 150) this.damageText.setColor('#ff8800');
        else this.damageText.setColor('#ff0000');
    }

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
        return this.spine;
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
        this.spine.setTintFill(0xffffff);
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
