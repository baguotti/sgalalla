import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';
import { isInPlay } from '../../shared/FighterState';
import type { MatchState } from '../../shared/GameSim';
import { STAGE_LAYOUT } from '../../shared/StageData';

const TEXTURE = 'contact_shadow';
const TEXTURE_SIZE = 64;
/** The shadow under a fighter standing on the floor, in world pixels. */
const WIDTH = 110;
const HEIGHT = 22;
/** A fighter this high above the floor casts no shadow; below that it shrinks and fades as they rise. */
const FADE_HEIGHT = 450;
/** Just above the platforms (depth 0), below the fighters (10). */
const DEPTH = 1;
export const DEFAULT_SHADOW_DARKNESS = 0.35;

/** A soft dark oval on the floor under each fighter. Drawing only. */
export class ContactShadows {
    private readonly scene: Phaser.Scene;
    private readonly hideFrom: readonly Phaser.Cameras.Scene2D.Camera[];
    private readonly shadows: Phaser.GameObjects.Image[] = [];

    /** Shadows are world objects: the `hideFrom` cameras (the HUD's) don't draw them. */
    constructor(scene: Phaser.Scene, hideFrom: readonly Phaser.Cameras.Scene2D.Camera[]) {
        this.scene = scene;
        this.hideFrom = hideFrom;
        createShadowTexture(scene);
    }

    /** Once per drawn frame; `darkness` from 0 (none) to 1 (black at the middle). */
    update(match: MatchState, darkness: number): void {
        for (let i = 0; i < match.fighters.length; i++) {
            const fighter = match.fighters[i];
            const shadow = this.shadows[i] ?? this.createShadow();
            const body = fighter.body;
            const feetY = body.y + PhysicsConfig.PLAYER_HEIGHT / 2;
            const floorY = isInPlay(fighter) ? floorBelow(body.x, feetY) : null;
            const nearness = floorY === null ? 0 : 1 - Math.min((floorY - feetY) / FADE_HEIGHT, 1);
            shadow.setVisible(nearness > 0 && darkness > 0);
            if (floorY === null || nearness <= 0) continue;

            const size = 0.5 + 0.5 * nearness;
            shadow.setPosition(body.x, floorY)
                .setScale(size * WIDTH / TEXTURE_SIZE, size * HEIGHT / TEXTURE_SIZE)
                .setAlpha(darkness * nearness * nearness);
        }
    }

    destroy(): void {
        for (const shadow of this.shadows) shadow.destroy();
        this.shadows.length = 0;
    }

    private createShadow(): Phaser.GameObjects.Image {
        const shadow = this.scene.add.image(0, 0, TEXTURE).setDepth(DEPTH);
        for (const camera of this.hideFrom) camera.ignore(shadow);
        this.shadows.push(shadow);
        return shadow;
    }
}

/** The top of the highest platform under `x` at or below the feet, or null over the void. */
function floorBelow(x: number, feetY: number): number | null {
    let floor: number | null = null;
    for (const platform of STAGE_LAYOUT.platforms) {
        const top = platform.y - platform.h / 2;
        if (Math.abs(x - platform.x) <= platform.w / 2 && top >= feetY - 2 && (floor === null || top < floor)) floor = top;
    }
    return floor;
}

function createShadowTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(TEXTURE)) return;
    const texture = scene.textures.createCanvas(TEXTURE, TEXTURE_SIZE, TEXTURE_SIZE);
    if (!texture) return;
    const context = texture.getContext();
    const middle = TEXTURE_SIZE / 2;
    const gradient = context.createRadialGradient(middle, middle, 0, middle, middle, middle);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.6)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    texture.refresh();
}
