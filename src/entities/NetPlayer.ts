import Phaser from 'phaser';
import { Fighter } from './Fighter';
import { PhysicsConfig } from '@shared/physics/PhysicsConfig';
import { PlayerState as SharedPlayerState } from '@shared/entities/PlayerState';

// Helper type for State received from Schema
export interface NetPlayerState {
    x: number;
    y: number;
    vx: number;
    vy: number;
    isGrounded: boolean;
    isJumping: boolean;
    isDodging: boolean;
    isAttacking: boolean;
    isHitStunned: boolean;
    facingDirection: number;
    health: number;
}

export class NetPlayer extends Fighter {
    private sprite!: Phaser.GameObjects.Sprite;

    // Interpolation Targets
    private targetX: number = 0;
    private targetY: number = 0;

    public playerId: string;

    private character: string = 'fok';
    private animPrefix: string = 'fok';

    // Visual State
    // Redefining these as public members or using Fighter's where available
    public isDodging: boolean = false;
    public isAttacking: boolean = false;
    // isGrounded, isHitStunned inherited from Fighter

    private facingDirection: number = 1;

    constructor(scene: Phaser.Scene, x: number, y: number, sessionId: string, character: string = 'fok') {
        super(scene, x, y);
        this.playerId = sessionId;
        this.character = character;
        this.animPrefix = character;
        this.setDepth(100); // Ensure render on top of background

        this.targetX = x;
        this.targetY = y;
        // removed unused serverRealm vars

        // Visual Setup
        // Offset Y by 0 (Synced with Player.ts)
        this.sprite = scene.add.sprite(0, 0, `${this.animPrefix}_idle_0`);
        const targetHeight = PhysicsConfig.PLAYER_HEIGHT;
        const scale = (targetHeight / 256) * 1.5;
        this.sprite.setScale(scale);
        this.add(this.sprite);

        // Visual distinction for remote players (ghostly/tint)
        this.sprite.setAlpha(0.8);
        this.sprite.setTint(0xaaaaff); // Blueish tint for "Net" player

        // Name Tag
        const nameTag = scene.add.text(0, -60, `P_${sessionId.substr(0, 4)}`, {
            fontSize: '14px',
            fontFamily: 'Arial',
            color: '#aaaaff',
            stroke: '#000000',
            strokeThickness: 3
        });
        nameTag.setOrigin(0.5);
        this.add(nameTag);

        scene.add.existing(this);
    }

    public sync(state: NetPlayerState): void {
        this.targetX = state.x;
        this.targetY = state.y;

        // Sync flags
        this.isGrounded = state.isGrounded;
        this.isDodging = state.isDodging;
        this.isAttacking = state.isAttacking;
        this.isHitStunned = state.isHitStunned;
        this.facingDirection = state.facingDirection;
        this.damagePercent = state.health;

        // Velocity for animation purposes (not physics)
        this.velocity.x = state.vx;
        this.velocity.y = state.vy;
    }

    update(delta: number): void {
        const _dt = delta;
        // Lower T for smoother interpolation, but increase if far away
        const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetX, this.targetY);
        let t = 0.15; // Smooth base

        if (dist > 200) t = 0.5; // Snap faster if way off
        else if (dist > 50) t = 0.3;

        // Snap if close
        if (dist < 1) {
            this.x = this.targetX;
            this.y = this.targetY;
        } else {
            this.x = Phaser.Math.Linear(this.x, this.targetX, t);
            this.y = Phaser.Math.Linear(this.y, this.targetY, t);
        }

        // Debug Log (Throttled)
        // Debug Log (Throttled)
        if (Math.random() < 0.01) {
            const msg = `[NP ${this.playerId.substr(0, 4)}] ${this.x.toFixed(0)},${this.y.toFixed(0)} V:${this.visible} A:${this.alpha} Z:${this.depth} CamIgnore?`;
            this.scene.events.emit('debugLog', msg);
        }

        this.updateVisuals();
    }

    private updateVisuals(): void {
        // Flip based on server direction
        this.sprite.setFlipX(this.facingDirection < 0);

        if (this.isHitStunned) {
            this.playAnim('hurt', true);
            return;
        }

        if (this.isAttacking) {
            this.playAnim('attack', true);
            return;
        }

        if (this.isDodging) {
            this.playAnim('slide', true);
            return;
        }

        if (!this.isGrounded) {
            if (this.velocity.y < 0) {
                this.playAnim('jump', true);
            } else {
                this.playAnim('fall', true);
            }
            return;
        }

        if (Math.abs(this.velocity.x) > 10) {
            this.playAnim('run', true);
        } else {
            this.playAnim('idle', true);
        }
    }

    private playAnim(key: string, ignoreIfPlaying: boolean = true): void {
        let fullKey = `${this.animPrefix}_${key}`;
        if (this.sprite.anims.exists(fullKey)) {
            this.sprite.anims.play(fullKey, ignoreIfPlaying);
        }
    }

    public respawn(): void {
        this.damagePercent = 0;
        this.sprite.setTint(0xaaaaff);
        this.sprite.setAlpha(0.8);
    }

    setKnockback(_x: number, _y: number): void {
        // No-op
    }

    public setTint(color: number): void {
        this.sprite.setTint(color);
    }
}
