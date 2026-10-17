import Phaser from 'phaser';
import { GRANDE_WIDEN } from '../../shared/StageData';
import { STAGES, type StageKey } from './StageBackgrounds';

/** The stage's visuals. Collision lives in shared/StageData.ts. */
export interface StageResult {
    /** The painting; null for a stage drawn in layers. */
    background: Phaser.GameObjects.Image | null;
    platformTextures: Phaser.GameObjects.Image[];
}

/** Platform textures per stage; stages without their own use Adria's. */
const PLATFORM_TEXTURES: Partial<Record<StageKey, { main: string; side: string; top: string }>> = {
    londra_bg: { main: 'platform_londra_main', side: 'platform_londra_side', top: 'platform_londra_top' },
    londra_grande: { main: 'platform_londra_main', side: 'platform_londra_side', top: 'platform_londra_top' },
    sguzia_bg: { main: 'platform_sguzia_main', side: 'platform_sguzia_side', top: 'platform_sguzia_top' },
};
const DEFAULT_PLATFORMS = { main: 'platform_main', side: 'platform_side', top: 'platform_top' };

/** Platform textures are drawn at this scale; a soft platform's art sits this far below its collision (at that scale). */
const SCALE = 0.8;
const TOP_ART_BELOW = 40;

/**
 * Draws a stage: the background painting (unless the stage is drawn in layers,
 * or `painting` is false) and the platform textures laid over its collision
 * layout. Londra Grande moves the main platform's halves and the pillar out by
 * GRANDE_WIDEN, mirrors the pillar on the right, and adds two smaller soft platforms.
 */
export function createStage(scene: Phaser.Scene, stage: StageKey, painting = true): StageResult {
    // The painting is scaled to twice the screen width, and scrolls slightly slower than the stage
    const image = painting && STAGES[stage].image ? scene.add.image(scene.scale.width / 2, scene.scale.height / 2 + 150, stage) : null;
    image?.setScale((scene.scale.width / image.width) * 2).setScrollFactor(0.9).setDepth(-100);

    const textures = PLATFORM_TEXTURES[stage] ?? DEFAULT_PLATFORMS;
    const grande = STAGES[stage].layout === 'grande';
    const widen = grande ? GRANDE_WIDEN : 0;
    const placed: Phaser.GameObjects.Image[] = [];

    // The main platform is two mirrored halves. Its collision spans x 370 to 1550 with its top at 870
    // (wider on Londra Grande); the textures sit 38 px further out to line up with the walls.
    const pTop = 795;
    placed.push(scene.add.image(960 - 590 - 38 - widen, pTop, textures.main).setOrigin(0, 0).setScale(SCALE));
    placed.push(scene.add.image(960 + 590 + 38 + widen, pTop, textures.main).setOrigin(1, 0).setScale(SCALE).setFlipX(true));

    // Pillars and soft platforms at depth -10: above the background (-100), below the main platform (0) and players (10)
    placed.push(scene.add.image(40 - widen, 480, textures.side).setScale(SCALE).setDepth(-10));
    if (grande) placed.push(scene.add.image(1920 - 40 + widen, 480, textures.side).setScale(SCALE).setFlipX(true).setDepth(-10));

    const soft = (x: number, top: number, width: number, flip = false) => {
        // Sized to the collision's width (550 at the standard scale)
        const scale = SCALE * width / 550;
        placed.push(scene.add.image(x, top + TOP_ART_BELOW * scale / SCALE, textures.top).setScale(scale).setFlipX(flip).setDepth(-10));
    };
    if (grande) {
        soft(960, 450, 550);
        soft(420, 630, 440, true);
        soft(1500, 630, 440);
    } else {
        soft(960, 470, 550);
    }

    scene.cameras.main.setZoom(1);
    scene.cameras.main.centerOn(960, 540);

    return { background: image, platformTextures: placed };
}
