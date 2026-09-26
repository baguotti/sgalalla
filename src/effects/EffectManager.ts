import Phaser from 'phaser';

/** Depths: dust, rings and afterimages just behind the fighters (10), sparks in front of them. */
const BEHIND_FIGHTERS = 9;
const IN_FRONT = 20;

const SPARK = 'fx_spark';
const RING = 'fx_ring';
const PUFF = 'fx_puff';
const TEXTURE_SIZE = 128;

/**
 * Pooled visual effects for a match scene: signature ghosts, hit sparks,
 * dust, air-jump rings and dash afterimages. Everything here is meant to be
 * felt more than seen: small, brief and see-through.
 */
export class EffectManager {
    private readonly scene: Phaser.Scene;
    private readonly ghosts: Phaser.GameObjects.Group;
    private readonly flashes: Phaser.GameObjects.Group;
    private readonly afterimages: Phaser.GameObjects.Group;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.ghosts = scene.add.group({ maxSize: 20, runChildUpdate: false });
        this.flashes = scene.add.group({ maxSize: 48, runChildUpdate: false });
        this.afterimages = scene.add.group({ maxSize: 24, runChildUpdate: false });
        createTextures(scene);
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

    /** A burst where a hit landed, sized by its damage; heavier hits add a faint ring. */
    public spawnHitSpark(x: number, y: number, damage: number): void {
        const size = Phaser.Math.Clamp(0.3 + damage * 0.03, 0.35, 0.95);
        const warmth = Phaser.Math.Clamp((damage - 4) / 14, 0, 1);
        const tint = Phaser.Display.Color.GetColor(255, Math.round(250 - 40 * warmth), Math.round(235 - 90 * warmth));
        this.flash(SPARK, x, y, {
            depth: IN_FRONT, tint, alpha: 0.9, blend: Phaser.BlendModes.ADD,
            from: size * 0.6, to: size * 1.1, angle: Phaser.Math.Between(0, 45), duration: 110,
        });
        if (damage >= 8) {
            this.flash(RING, x, y, {
                depth: IN_FRONT, tint, alpha: 0.35, blend: Phaser.BlendModes.ADD,
                from: size * 0.5, to: size * 1.6, duration: 180,
            });
        }
    }

    /** Dust at a fighter's feet: `strength` 0 to 1; `direction` sends it one way (dash), 0 both (landing). */
    public spawnDust(x: number, y: number, strength: number, direction: number): void {
        const puffs = direction === 0 ? [-1, 1] : [-direction];
        for (const side of puffs) {
            this.flash(PUFF, x + side * 14, y - 6, {
                depth: BEHIND_FIGHTERS, tint: 0xe8ddd0, alpha: 0.28 * strength,
                from: 0.25, to: 0.25 + 0.35 * strength, duration: 280, drift: { x: side * 26 * strength, y: -10 },
                squash: 0.55,
            });
        }
    }

    /** A thin flattened ring under the feet on an air jump. */
    public spawnJumpRing(x: number, y: number): void {
        this.flash(RING, x, y, {
            depth: BEHIND_FIGHTERS, tint: 0xffffff, alpha: 0.4,
            from: 0.35, to: 0.8, duration: 220, squash: 0.3,
        });
    }

    /** A fading copy of a fighter's current frame, left behind while dashing. */
    public spawnAfterimage(source: Phaser.GameObjects.Sprite, x: number, y: number): void {
        const image = this.afterimages.get(x, y, source.texture.key, source.frame.name) as Phaser.GameObjects.Image | null;
        if (!image) return;
        this.scene.tweens.killTweensOf(image);
        image.setActive(true).setVisible(true)
            .setTexture(source.texture.key, source.frame.name)
            .setPosition(x, y)
            .setOrigin(source.originX, source.originY)
            .setScale(source.scaleX, source.scaleY)
            .setFlipX(source.flipX)
            .setDepth(BEHIND_FIGHTERS)
            .setTint(0xd6e6ff)
            .setAlpha(0.2);
        this.hideFromUi(image);
        this.scene.tweens.add({
            targets: image,
            alpha: 0,
            duration: 160,
            onComplete: () => image.setActive(false).setVisible(false),
        });
    }

    /** One pooled image that grows from `from` to `to` scale while fading out. */
    private flash(texture: string, x: number, y: number, o: {
        depth: number; tint: number; alpha: number; from: number; to: number; duration: number;
        blend?: Phaser.BlendModes; angle?: number; drift?: { x: number; y: number }; squash?: number;
    }): void {
        const image = this.flashes.get(x, y, texture) as Phaser.GameObjects.Image | null;
        if (!image) return;
        this.scene.tweens.killTweensOf(image);
        const squash = o.squash ?? 1;
        image.setActive(true).setVisible(true)
            .setTexture(texture)
            .setPosition(x, y)
            .setDepth(o.depth)
            .setTint(o.tint)
            .setAlpha(o.alpha)
            .setAngle(o.angle ?? 0)
            .setBlendMode(o.blend ?? Phaser.BlendModes.NORMAL)
            .setScale(o.from, o.from * squash);
        this.hideFromUi(image);
        this.scene.tweens.add({
            targets: image,
            scaleX: o.to,
            scaleY: o.to * squash,
            alpha: 0,
            x: x + (o.drift?.x ?? 0),
            y: y + (o.drift?.y ?? 0),
            duration: o.duration,
            ease: 'Quad.easeOut',
            onComplete: () => image.setActive(false).setVisible(false),
        });
    }

    private hideFromUi(object: Phaser.GameObjects.GameObject): void {
        (this.scene as Phaser.Scene & { uiCamera?: Phaser.Cameras.Scene2D.Camera | null }).uiCamera?.ignore(object);
    }
}

/** White shapes, tinted per use: a star burst, a thin ring and a soft puff. */
function createTextures(scene: Phaser.Scene): void {
    drawTexture(scene, SPARK, context => {
        const middle = TEXTURE_SIZE / 2;
        const glow = context.createRadialGradient(middle, middle, 0, middle, middle, middle * 0.45);
        glow.addColorStop(0, 'rgba(255,255,255,1)');
        glow.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = glow;
        context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        // Eight rays, long and short in turn
        context.strokeStyle = 'rgba(255,255,255,0.95)';
        context.lineCap = 'round';
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const length = middle * (i % 2 === 0 ? 0.95 : 0.6);
            context.lineWidth = i % 2 === 0 ? 5 : 3;
            context.beginPath();
            context.moveTo(middle + Math.cos(angle) * middle * 0.2, middle + Math.sin(angle) * middle * 0.2);
            context.lineTo(middle + Math.cos(angle) * length, middle + Math.sin(angle) * length);
            context.stroke();
        }
    });
    drawTexture(scene, RING, context => {
        const middle = TEXTURE_SIZE / 2;
        context.strokeStyle = 'rgba(255,255,255,1)';
        context.lineWidth = 4;
        context.beginPath();
        context.arc(middle, middle, middle - 4, 0, Math.PI * 2);
        context.stroke();
    });
    drawTexture(scene, PUFF, context => {
        const middle = TEXTURE_SIZE / 2;
        const soft = context.createRadialGradient(middle, middle, 0, middle, middle, middle);
        soft.addColorStop(0, 'rgba(255,255,255,1)');
        soft.addColorStop(0.5, 'rgba(255,255,255,0.45)');
        soft.addColorStop(1, 'rgba(255,255,255,0)');
        context.fillStyle = soft;
        context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    });
}

function drawTexture(scene: Phaser.Scene, key: string, draw: (context: CanvasRenderingContext2D) => void): void {
    if (scene.textures.exists(key)) return;
    const texture = scene.textures.createCanvas(key, TEXTURE_SIZE, TEXTURE_SIZE);
    if (!texture) return;
    draw(texture.getContext());
    texture.refresh();
}
