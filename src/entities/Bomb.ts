import Phaser from 'phaser';
import type { GameSceneInterface } from '../scenes/GameSceneInterface';
import { PhysicsConfig } from '../config/PhysicsConfig';

export class Bomb extends Phaser.Physics.Matter.Sprite {
    private isThrown: boolean = false;
    private fuseTimer: number = 0;
    private isExploded: boolean = false;
    private thrower: any = null;
    private graceTimer: number = 0;
    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Create a temporary texture if it doesn't exist
        const textureKey = 'bomb_v6';
        const radius = PhysicsConfig.BOMB_RADIUS;
        const diameter = radius * 2;

        if (!scene.textures.exists(textureKey)) {
            const graphics = scene.make.graphics({ x: 0, y: 0 });
            graphics.fillStyle(0x444444, 1); // Dark Grey
            graphics.fillCircle(radius, radius, radius);
            graphics.generateTexture(textureKey, diameter, diameter);
        }

        super(scene.matter.world, x, y, textureKey);

        // Initial setup (Physics properties that don't change)
        this.setCircle(radius);
        this.setBounce(PhysicsConfig.BOMB_BOUNCE);
        this.setFriction(PhysicsConfig.BOMB_FRICTION);
        this.setDensity(PhysicsConfig.BOMB_DENSITY);

        this.setDepth(100);

        // Handle collisions
        this.setOnCollide((data: Phaser.Types.Physics.Matter.MatterCollisionData) => {
            if (this.active) {
                this.handleCollision(data);
            }
        });

        // Start disabled for pooling
        this.setActive(false);
        this.setVisible(false);
        if (this.world) {
            this.scene.matter.world.remove(this.body as MatterJS.BodyType);
        }
    }

    public enable(x: number, y: number): void {
        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);

        // Reset state
        this.isThrown = false;
        this.fuseTimer = 0;
        this.isExploded = false;
        this.thrower = null;
        this.graceTimer = 0;

        // Re-enable physics
        if (this.body) {
            this.scene.matter.world.add(this.body as MatterJS.BodyType);
            this.setVelocity(0, 0);
            this.setAngularVelocity(0);
            this.setIgnoreGravity(false);
            this.setSensor(false);
        }

        // Register to scene via Interface (Legacy support if needed, or removed if using Group)
        const gameScene = this.scene as GameSceneInterface;
        if (gameScene.addBomb) {
            gameScene.addBomb(this);
        }
    }

    public disable(): void {
        this.setActive(false);
        this.setVisible(false);

        // Remove from physics world
        if (this.body && this.world) {
            this.scene.matter.world.remove(this.body as MatterJS.BodyType);
        }

        // Remove from scene list
        const gameScene = this.scene as GameSceneInterface;
        if (gameScene.removeBomb) {
            gameScene.removeBomb(this);
        }
    }

    private throwPowerMultiplier: number = 1;

    public onThrown(thrower: any, power: number): void {
        this.isThrown = true;
        this.fuseTimer = PhysicsConfig.BOMB_FUSE_TIME;
        this.thrower = thrower;
        this.graceTimer = PhysicsConfig.BOMB_GRACE_TIME;
        this.throwPowerMultiplier = power;
    }

    private handleCollision(data: Phaser.Types.Physics.Matter.MatterCollisionData): void {
        if (this.isExploded) return;

        // Check for collision with players
        const bodyA = data.bodyA as any;
        const bodyB = data.bodyB as any;

        // Find the other object in the collision
        const otherBody = (bodyA === this.body) ? bodyB : bodyA;
        const gameObject = otherBody.gameObject;

        // Explode on contact with any player (Fighter)
        if (gameObject && gameObject.constructor && (gameObject as any).damagePercent !== undefined) {
            // Ignore thrower during grace period
            if (this.graceTimer <= 0 || gameObject !== this.thrower) {
                this.explode();
            }
        }
    }

    public explode(): void {
        if (this.isExploded) return;
        this.isExploded = true;

        // Use Effect Manager for explosion visual
        const gameScene = this.scene as GameSceneInterface;
        if (gameScene.effectManager) {
            gameScene.effectManager.spawnExplosion(this.x, this.y, PhysicsConfig.BOMB_EXPLOSION_VISUAL_RADIUS, 0xffff00);
        } else {
            // Fallback (should not happen if GameScene is initialized correctly)
            const explosionGraphics = this.scene.add.graphics();
            explosionGraphics.fillStyle(0xffff00, 1);
            explosionGraphics.fillCircle(this.x, this.y, PhysicsConfig.BOMB_EXPLOSION_VISUAL_RADIUS);
            this.scene.tweens.add({
                targets: explosionGraphics,
                alpha: 0,
                duration: PhysicsConfig.BOMB_EXPLOSION_FADE_MS,
                onComplete: () => explosionGraphics.destroy()
            });
        }

        // Damage nearby players (blast radius for logic remains 80 or similar)
        const blastRadius = PhysicsConfig.BOMB_BLAST_RADIUS;

        // Damage nearby players
        const players = gameScene.getPlayers ? gameScene.getPlayers() : [];
        if (players) {
            players.forEach(player => {
                const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (dist < blastRadius) {
                    const damage = PhysicsConfig.BOMB_EXPLOSION_DAMAGE * this.throwPowerMultiplier;
                    const baseKnockbackForce = PhysicsConfig.BOMB_EXPLOSION_KNOCKBACK * this.throwPowerMultiplier;
                    const finalKnockback = baseKnockbackForce * (1 + (player.damagePercent / 100));

                    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

                    const knockback = new Phaser.Math.Vector2(
                        Math.cos(angle) * finalKnockback,
                        Math.sin(angle) * finalKnockback
                    );

                    if (player.setDamage && player.setKnockback) {
                        player.setDamage(player.damagePercent + damage);
                        player.setKnockback(knockback.x, knockback.y);
                        player.applyHitStun();
                    }
                }
            });
        }

        // Camera shake
        this.scene.cameras.main.shake(PhysicsConfig.BOMB_SHAKE_DURATION, PhysicsConfig.BOMB_SHAKE_INTENSITY);

        // Destroy the bomb
        // Disable instead of destroy
        this.disable();
    }

    destroy(fromScene?: boolean): void {
        // Remove from scene list before clearing scene reference
        if (this.scene) {
            const gameScene = this.scene as GameSceneInterface;
            if (gameScene.removeBomb) {
                gameScene.removeBomb(this);
            }
        }
        super.destroy(fromScene);
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        if (this.isExploded) return;

        if (this.graceTimer > 0) {
            this.graceTimer -= delta;
        }

        // Check contact with players if thrown
        if (this.isThrown) {
            const gameScene = this.scene as GameSceneInterface;
            const players = gameScene.getPlayers ? gameScene.getPlayers() : [];
            if (players) {
                for (const player of players) {
                    // Ignore thrower during grace
                    if (this.graceTimer > 0 && player === this.thrower) continue;

                    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                    if (dist < PhysicsConfig.BOMB_CONTACT_THRESHOLD) {
                        this.explode();
                        return;
                    }
                }
            }
        }

        if (this.isThrown && !this.isExploded) {
            this.fuseTimer -= delta;
            if (this.fuseTimer <= 0) {
                this.explode();
            }
        }
    }
}
