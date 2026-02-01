import Phaser from 'phaser';

export class Bomb extends Phaser.Physics.Matter.Sprite {
    private isThrown: boolean = false;
    private fuseTimer: number = 0;
    private isExploded: boolean = false;
    private thrower: any = null;
    private graceTimer: number = 0;
    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Create a temporary texture if it doesn't exist
        const textureKey = 'bomb_v5';
        const radius = 15;
        const diameter = radius * 2;

        if (!scene.textures.exists(textureKey)) {
            const graphics = scene.make.graphics({ x: 0, y: 0 });
            graphics.fillStyle(0x444444, 1); // Dark Grey
            graphics.fillCircle(radius, radius, radius);
            graphics.generateTexture(textureKey, diameter, diameter);
        }

        super(scene.matter.world, x, y, textureKey);

        this.setCircle(radius);
        this.setBounce(0.8); // Higher bounce for bouncing on surfaces
        this.setFriction(0.005);
        this.setDensity(0.01);

        scene.add.existing(this);

        // Register to scene (casted because we added 'bombs' recently)
        const gameScene = scene as any;
        if (gameScene.bombs) {
            gameScene.bombs.push(this);
        }

        this.setDepth(100);

        // Handle collisions
        this.setOnCollide((data: Phaser.Types.Physics.Matter.MatterCollisionData) => {
            this.handleCollision(data);
        });
    }

    public onThrown(thrower: any): void {
        this.isThrown = true;
        this.fuseTimer = 3000; // 3 seconds
        this.thrower = thrower;
        this.graceTimer = 200; // 200ms grace for thrower
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

        // Visual effect: single small yellow circle
        const visualRadius = 30;
        const explosionGraphics = this.scene.add.graphics();
        explosionGraphics.fillStyle(0xffff00, 1);
        explosionGraphics.fillCircle(this.x, this.y, visualRadius);

        // Quick fade out
        this.scene.tweens.add({
            targets: explosionGraphics,
            alpha: 0,
            duration: 150,
            onComplete: () => explosionGraphics.destroy()
        });

        // Damage nearby players (blast radius for logic remains 80 or similar)
        const blastRadius = 80;

        // Damage nearby players
        const players = (this.scene as any).players as any[];
        if (players) {
            players.forEach(player => {
                const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (dist < blastRadius) {
                    const damage = 15;
                    const knockbackForce = 12;
                    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

                    const knockback = new Phaser.Math.Vector2(
                        Math.cos(angle) * knockbackForce,
                        Math.sin(angle) * knockbackForce
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
        this.scene.cameras.main.shake(150, 0.01);

        // Destroy the bomb
        this.destroy();
    }

    destroy(fromScene?: boolean): void {
        // Remove from scene list before clearing scene reference
        if (this.scene) {
            const bombs = (this.scene as any).bombs as Bomb[];
            if (bombs) {
                const index = bombs.indexOf(this);
                if (index > -1) {
                    bombs.splice(index, 1);
                }
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
            const players = (this.scene as any).players as any[];
            if (players) {
                for (const player of players) {
                    // Ignore thrower during grace
                    if (this.graceTimer > 0 && player === this.thrower) continue;

                    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                    if (dist < 45) { // Contact threshold
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
