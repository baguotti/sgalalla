import Phaser from 'phaser';
import type { BombState } from '../../shared/Bombs';
import { SIM_STEP_MS } from '../../shared/FixedStepClock';
import type { MatchState } from '../../shared/GameSim';
import { PhysicsConfig } from '../../shared/PhysicsConfig';

const BOMB = 'fx_bomb_16';
/** Behind the fighters (10) while loose, in front while held. */
const LOOSE_DEPTH = 9;
const HELD_DEPTH = 11;
/** A loose bomb blinks for its last BLINK_STEPS before it's gone. */
const BLINK_STEPS = Math.round(2500 / SIM_STEP_MS);

/**
 * Draws the match's bombs (shared/Bombs.ts): rolling as they move, blinking
 * before a loose one is gone, swelling while a throw charges towards going off;
 * and their explosions.
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
            sprite = this.scene.add.image(bomb.x, bomb.y, BOMB).setOrigin(ORIGIN_X, ORIGIN_Y);
            this.hideFrom.ignore(sprite);
            this.sprites.set(bomb.id, sprite);
        }
        const held = bomb.holder >= 0;
        // Charging: bigger as it nears going off
        const danger = bomb.charge >= 0 ? Math.min(bomb.charge / PhysicsConfig.BOMB_OVERCHARGE, 1) : 0;
        sprite.setPosition(bomb.x, bomb.y)
            .setScale(pixelScale() * (1 + 0.35 * danger)).setDepth(held ? HELD_DEPTH : LOOSE_DEPTH);
        // Rolls the way it moves; upright in a hand
        if (held) sprite.setRotation(0);
        else sprite.rotation += (bomb.vx * SIM_STEP_MS / 1000) / PhysicsConfig.BOMB_RADIUS;
        const fading = !held && !bomb.armed && bomb.lifeSteps < BLINK_STEPS;
        sprite.setVisible(!fading || Math.floor(bomb.lifeSteps / 6) % 2 === 0);
    }
}

/** The bomb as 16-bit pixel art: a round shell with a highlight, a cap, a fuse and its spark. One character per pixel; the ball is 14 px across. */
const PIXELS = [
    '........OSO.....',
    '.........S......',
    '........F.......',
    '.......FF.......',
    '......KKKK......',
    '....KKMMMMKK....',
    '...KMLWWMMMDK...',
    '..KMLWWMMMMDDK..',
    '..KMLWMMMMMDDK..',
    '.KMLLMMMMMMDDDK.',
    '.KMLMMMMMMMMDDK.',
    '.KMMMMMMMMMDDDK.',
    '.KDMMMMMMMMDDDK.',
    '..KDMMMMMMDDDK..',
    '..KDDMMMMDDDDK..',
    '...KDDDDDDDDK...',
    '....KKDDDDKK....',
    '......KKKK......',
];
const BALL_PIXELS = 14;
/** The ball's centre in the texture, as an origin (rolling turns about it). */
const ORIGIN_X = 8 / 16;
const ORIGIN_Y = 11 / 18;
const SHELL: Record<string, number> = {
    K: 0x14161d, D: 0x2b2f3a, M: 0x3e4453, L: 0x5d6678, W: 0xd6dde6, F: 0x8a6a3e, S: 0xffe066, O: 0xff8a1e,
};

/** Texture pixels to world pixels: the ball as wide as the bomb. */
function pixelScale(): number {
    return (PhysicsConfig.BOMB_RADIUS * 2) / BALL_PIXELS;
}

function createTextures(scene: Phaser.Scene): void {
    if (scene.textures.exists(BOMB)) return;
    const canvas = scene.textures.createCanvas(BOMB, PIXELS[0].length, PIXELS.length);
    if (!canvas) return;
    const ctx = canvas.getContext();
    PIXELS.forEach((row, y) => [...row].forEach((ch, x) => {
        const colour = SHELL[ch];
        if (colour === undefined) return;
        ctx.fillStyle = '#' + colour.toString(16).padStart(6, '0');
        ctx.fillRect(x, y, 1, 1);
    }));
    canvas.refresh();
    // Hard pixels when scaled up
    canvas.setFilter(Phaser.Textures.FilterMode.NEAREST);
}
