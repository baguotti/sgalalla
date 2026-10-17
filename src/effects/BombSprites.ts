import Phaser from 'phaser';
import type { BombState } from '../../shared/Bombs';
import { SIM_STEP_MS } from '../../shared/FixedStepClock';
import type { MatchState } from '../../shared/GameSim';
import { PhysicsConfig } from '../../shared/PhysicsConfig';

const SAFE = 'fx_bomb_safe';
const ARMED = 'fx_bomb_armed';
/** Behind the fighters (10) while loose, in front while held. */
const LOOSE_DEPTH = 9;
const HELD_DEPTH = 11;
/** A loose bomb blinks for its last BLINK_STEPS before it's gone. */
const BLINK_STEPS = Math.round(2500 / SIM_STEP_MS);

/**
 * Draws the match's bombs (shared/Bombs.ts): blue while safe, red while
 * armed, rolling as they move, blinking before a loose one is gone, swelling
 * and flickering faster while a throw charges towards going off; and their
 * explosions.
 */
export class BombSprites {
    private readonly scene: Phaser.Scene;
    private readonly hideFrom: Phaser.Cameras.Scene2D.Camera;
    private readonly sprites = new Map<number, Phaser.GameObjects.Image>();

    constructor(scene: Phaser.Scene, hideFrom: Phaser.Cameras.Scene2D.Camera) {
        this.scene = scene;
        this.hideFrom = hideFrom;
        createTextures(scene);
    }

    /** Matches the sprites to the match's bombs. */
    update(match: MatchState): void {
        const bombs = match.bombs?.list ?? [];
        for (const [id, sprite] of this.sprites) {
            if (!bombs.some(b => b.id === id)) {
                sprite.destroy();
                this.sprites.delete(id);
            }
        }
        for (const bomb of bombs) this.draw(bomb);
    }

    /** A bomb went off at (x, y): a burst the size of its blast. */
    explode(x: number, y: number): void {
        const burst = this.scene.add.image(x, y, 'fx_explosion').setDepth(20).setScale(0.5);
        this.hideFrom.ignore(burst);
        const size = (PhysicsConfig.BOMB_BLAST_RADIUS * 2) / burst.width;
        this.scene.tweens.add({ targets: burst, scale: size, duration: 120, ease: 'Cubic.easeOut' });
        this.scene.tweens.add({ targets: burst, alpha: 0, delay: 180, duration: 260, onComplete: () => burst.destroy() });
    }

    destroy(): void {
        for (const sprite of this.sprites.values()) sprite.destroy();
        this.sprites.clear();
    }

    private draw(bomb: BombState): void {
        let sprite = this.sprites.get(bomb.id);
        if (!sprite) {
            sprite = this.scene.add.image(bomb.x, bomb.y, SAFE);
            this.hideFrom.ignore(sprite);
            this.sprites.set(bomb.id, sprite);
        }
        const held = bomb.holder >= 0;
        // Charging: red and blue in turn, faster and bigger as it nears going off
        const danger = bomb.charge >= 0 ? Math.min(bomb.charge / PhysicsConfig.BOMB_OVERCHARGE, 1) : 0;
        const flicker = bomb.charge >= 0 && Math.floor(bomb.charge / (220 - 180 * danger)) % 2 === 1;
        sprite.setPosition(bomb.x, bomb.y).setTexture(bomb.armed || flicker ? ARMED : SAFE)
            .setScale(1 + 0.35 * danger).setDepth(held ? HELD_DEPTH : LOOSE_DEPTH);
        // Rolls the way it moves; upright in a hand
        if (held) sprite.setRotation(0);
        else sprite.rotation += (bomb.vx * SIM_STEP_MS / 1000) / PhysicsConfig.BOMB_RADIUS;
        const fading = !held && !bomb.armed && bomb.lifeSteps < BLINK_STEPS;
        sprite.setVisible(!fading || Math.floor(bomb.lifeSteps / 6) % 2 === 0);
    }
}

/** A round bomb with a fuse and a coloured band: blue safe, red armed. */
function createTextures(scene: Phaser.Scene): void {
    const r = PhysicsConfig.BOMB_RADIUS;
    for (const [key, color] of [[SAFE, 0x4a8cff], [ARMED, 0xff3b3b]] as const) {
        if (scene.textures.exists(key)) continue;
        const size = r * 2 + 16;
        const c = size / 2;
        const g = scene.make.graphics({}, false);
        g.fillStyle(0x000000).fillCircle(c, c + 4, r + 2);
        g.fillStyle(0x23262f).fillCircle(c, c + 4, r);
        g.fillStyle(color).fillRect(c - r + 3, c + 1, (r - 3) * 2, 6);
        g.fillStyle(0xffffff, 0.35).fillCircle(c - r * 0.35, c + 4 - r * 0.4, r * 0.25);
        // Fuse and spark
        g.fillStyle(0x6b5a46).fillRect(c - 2, c + 4 - r - 8, 4, 9);
        g.fillStyle(0xffd34d).fillCircle(c, c + 4 - r - 10, 4);
        g.fillStyle(color).fillCircle(c, c + 4 - r - 10, 2);
        g.generateTexture(key, size, size);
        g.destroy();
    }
}
