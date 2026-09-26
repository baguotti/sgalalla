import Phaser from 'phaser';

/** Pooled visual effects for a match scene. Signature ghosts, for now. */
export class EffectManager {
    private readonly scene: Phaser.Scene;
    private readonly ghosts: Phaser.GameObjects.Group;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.ghosts = scene.add.group({ maxSize: 20, runChildUpdate: false });
    }

    /** A ghost sprite playing `animKey`, or null when the pool is exhausted. The caller sets its depth. */
    public spawnGhost(x: number, y: number, texture: string, frame: string, animKey: string, facing: number, alpha: number): Phaser.GameObjects.Sprite | null {
        const ghost = this.ghosts.get(x, y, texture, frame) as Phaser.GameObjects.Sprite | null;
        if (!ghost) return null;

        ghost.setActive(true)
            .setVisible(true)
            .setTexture(texture, frame)
            .setScale(facing, 1)
            .setAlpha(alpha)
            .clearTint();
        ghost.play(animKey);
        return ghost;
    }

    public releaseGhost(ghost: Phaser.GameObjects.Sprite): void {
        this.scene.tweens.killTweensOf(ghost);
        ghost.setActive(false).setVisible(false);
        ghost.preFX?.clear();
    }
}
