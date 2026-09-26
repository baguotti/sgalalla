import Phaser from 'phaser';

/** The stage's visuals. Collision lives in shared/StageData.ts. */
export interface StageResult {
    /** The painting; null for a stage drawn in layers. */
    background: Phaser.GameObjects.Image | null;
    platformTextures: Phaser.GameObjects.Image[];
}

/** Platform textures per stage background; stages without their own use Adria's. */
const PLATFORM_TEXTURES: Record<string, { main: string; side: string; top: string }> = {
    londra_bg: { main: 'platform_londra_main', side: 'platform_londra_side', top: 'platform_londra_top' },
    sguzia_bg: { main: 'platform_sguzia_main', side: 'platform_sguzia_side', top: 'platform_sguzia_top' },
};
const DEFAULT_PLATFORMS = { main: 'platform_main', side: 'platform_side', top: 'platform_top' };

/**
 * Draws the standard Sgalalla stage: the background painting (unless the stage
 * is drawn in layers) and the platform textures laid over the collision layout.
 */
export function createStage(scene: Phaser.Scene, backgroundTexture: string = 'adria_bg', painting = true): StageResult {
    // The painting is scaled to twice the screen width, and scrolls slightly slower than the stage
    const background = painting ? scene.add.image(scene.scale.width / 2, scene.scale.height / 2 + 150, backgroundTexture) : null;
    background?.setScale((scene.scale.width / background.width) * 2).setScrollFactor(0.9).setDepth(-100);

    const textures = PLATFORM_TEXTURES[backgroundTexture] ?? DEFAULT_PLATFORMS;

    // The main platform is two mirrored halves. Its collision spans x 370 to 1550 with its top at 870;
    // the textures sit 38 px further out to line up with the walls.
    const pTop = 795;
    const leftTex = scene.add.image(960 - 590 - 38, pTop, textures.main);
    leftTex.setOrigin(0, 0);
    leftTex.setScale(0.8, 0.8);

    const rightTex = scene.add.image(960 + 590 + 38, pTop, textures.main);
    rightTex.setOrigin(1, 0);
    rightTex.setScale(0.8, 0.8);
    rightTex.setFlipX(true);

    // Main platform halves at depth 0: above the background (-100), below the players (10)
    const leftPlatVisual = scene.add.image(40, 480, textures.side);
    leftPlatVisual.setScale(0.8);
    leftPlatVisual.setDepth(-10);

    const topPlatVisual = scene.add.image(960, 510, textures.top);
    topPlatVisual.setScale(0.8);
    topPlatVisual.setDepth(-10);

    scene.cameras.main.setZoom(1);
    scene.cameras.main.centerOn(960, 540);

    return {
        background,
        platformTextures: [leftTex, rightTex, leftPlatVisual, topPlatVisual],
    };
}
