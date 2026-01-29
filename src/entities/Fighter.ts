import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';
import type { Damageable } from '../combat/DamageSystem';

export abstract class Fighter extends Phaser.GameObjects.Container implements Damageable {
    public velocity: Phaser.Math.Vector2;
    public damagePercent: number = 0;
    public isGrounded: boolean = false;

    // Combat State
    public isHitStunned: boolean = false;
    protected hitStunTimer: number = 0;
    public isInvincible: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        // Use inherited width/height from Container/GameObject but initialize them
        this.width = PhysicsConfig.PLAYER_WIDTH;
        this.height = PhysicsConfig.PLAYER_HEIGHT;
        this.velocity = new Phaser.Math.Vector2(0, 0);
        scene.add.existing(this);
    }

    /**
     * Apply hit stun state
     */
    public applyHitStun(): void {
        this.isHitStunned = true;
        this.hitStunTimer = PhysicsConfig.HIT_STUN_DURATION;
        this.onHitStun();
    }

    /**
     * Set knockback velocity
     */
    public setKnockback(x: number, y: number): void {
        this.velocity.x = x;
        this.velocity.y = y;
    }

    /**
     * Optional hook for subclasses to handle hit stun visuals
     */
    protected onHitStun(): void { }

    /**
     * Abstract method for respawning
     */
    public abstract respawn(): void;

    /**
     * Common physics update
     */
    protected updatePhysics(delta: number): void {
        const deltaSeconds = delta / 1000;

        // Handle hit stun timer
        if (this.isHitStunned) {
            this.hitStunTimer -= delta;
            if (this.hitStunTimer <= 0) {
                this.isHitStunned = false;
                this.onHitStunEnd();
            }
        }

        // Apply gravity
        this.velocity.y += PhysicsConfig.GRAVITY * deltaSeconds;
    }

    protected onHitStunEnd(): void { }

    /**
     * Get bounding box
     */
    public getBounds(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
    }
}
