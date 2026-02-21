import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';

export class EffectManager {
    private scene: Phaser.Scene;

    // Pools
    private explosions!: Phaser.GameObjects.Group;
    // private hitSparks!: Phaser.GameObjects.Group; // Reserved for future use
    private ghosts!: Phaser.GameObjects.Group;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.createPools();
    }

    private createPools(): void {
        // --- Explosions (Sprites) ---
        this.explosions = this.scene.add.group({
            defaultKey: 'fx_explosion',
            maxSize: 20,
            runChildUpdate: false
        });

        // --- Ghosts (Sprites) ---
        this.ghosts = this.scene.add.group({
            defaultKey: 'fok', // Default, will be overridden
            maxSize: 20,
            runChildUpdate: false
        });

        // --- Hit Sparks (Graphics/Sprites) ---
        // Currently hit sparks are not fully implemented as separate entities in existing code 
        // (PlayerCombat just shakes screen/flashes), but we'll prep the pool.
        // If we want visual sparks later:
        /*
        this.hitSparks = this.scene.add.group({
            defaultKey: 'spark', // Placeholder
            maxSize: 20
        });
        */
    }

    public spawnExplosion(x: number, y: number, _radius: number, _color: number): void {
        let explosion = this.explosions.get(x, y) as Phaser.GameObjects.Sprite;
        if (!explosion) return;

        explosion.setActive(true).setVisible(true).setPosition(x, y);

        // Exact 1x scale, no variation, no rotation
        explosion.setRotation(0);
        explosion.setScale(1.0);
        explosion.setAlpha(1);

        // Ignore on UI camera to prevent double-rendering glitch
        if ((this.scene as any).uiCamera) {
            (this.scene as any).uiCamera.ignore(explosion);
        }

        this.scene.tweens.add({
            targets: explosion,
            alpha: { from: 1, to: 0 },
            duration: PhysicsConfig.BOMB_EXPLOSION_FADE_MS,
            ease: 'Linear',
            onComplete: () => {
                explosion.setActive(false).setVisible(false);
            }
        });
    }

    public spawnDeathExplosion(_x: number, _y: number, _color: number): void {
        // Disabled by user request
        // const explosion = this.explosions.get() as Phaser.GameObjects.Graphics;
        // if (!explosion) return;
    }

    public spawnGhost(x: number, y: number, texture: string, frame: string, animKey: string, facing: number, options: { tint?: number, alpha?: number } = {}): Phaser.GameObjects.Sprite | null {
        let ghost = this.ghosts.get(x, y, texture, frame) as Phaser.GameObjects.Sprite;

        if (!ghost) return null;

        ghost.setActive(true);
        ghost.setVisible(true);
        ghost.setTexture(texture, frame);
        ghost.setDepth(options.alpha !== undefined ? 5 : 10); // Check depth needs

        ghost.setScale(facing, 1);
        ghost.play(animKey);

        if (options.tint !== undefined) ghost.setTint(options.tint);
        else ghost.clearTint(); // Reset tint

        if (options.alpha !== undefined) ghost.setAlpha(options.alpha);
        else ghost.setAlpha(1); // Reset alpha

        return ghost;
    }

    public releaseGhost(ghost: Phaser.GameObjects.Sprite): void {
        if (!ghost) return;

        // Kill tweens
        this.scene.tweens.killTweensOf(ghost);

        ghost.setActive(false);
        ghost.setVisible(false);
        // Clean up FX if any added
        if (ghost.preFX) ghost.preFX.clear();
    }

    public spawnWallDust(x: number, y: number, facing: number): void {
        // Simple "puff" cloud
        const p = this.scene.add.circle(x + (facing * 10), y, 3, 0xffffff);
        p.setAlpha(0.6);
        p.setDepth(20);

        this.scene.tweens.add({
            targets: p,
            x: p.x + (facing * 15), // Drift away from wall
            y: p.y - 10,            // Drift up
            alpha: 0,
            scale: 0.1,
            duration: 300,
            onComplete: () => {
                p.destroy();
            }
        });
    }
}
