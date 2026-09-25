import Phaser from 'phaser';

/** The stage's visuals. Collision lives in shared/StageData.ts. */
export interface StageResult {
    background: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;
    platformTextures: Phaser.GameObjects.Image[];
}

/**
 * Creates the standard Sgalalla stage layout.
 */
export function createStage(scene: Phaser.Scene, backgroundTexture: string = 'adria_bg'): StageResult {
    // --- Background ---
    const background = scene.add.image(scene.scale.width / 2, scene.scale.height / 2 + 150, backgroundTexture); // Dynamic BG
    const scaleX = scene.scale.width / background.width;
    // Use width-based scaling to ensure consistent zoom for ultra-wide backgrounds like Adria/Sala Prove
    const scale = scaleX * 2.0;

    background.setScale(scale).setScrollFactor(0.9);
    background.setDepth(-100);

    // --- Texture Selection ---
    // Use map-specific platforms if available, otherwise default to Adria themes.
    let mainTexKey = 'platform_main';
    let sideTexKey = 'platform_side';
    let topTexKey = 'platform_top';

    if (backgroundTexture === 'londra_bg') {
        mainTexKey = 'platform_londra_main';
        sideTexKey = 'platform_londra_side';
        topTexKey = 'platform_londra_top';
    } else if (backgroundTexture === 'sguzia_bg') {
        mainTexKey = 'platform_sguzia_main';
        sideTexKey = 'platform_sguzia_side';
        topTexKey = 'platform_sguzia_top';
    }




    // --- Platform Textures ---
    // User requested "Platform_BH4A_adria.png" (renamed to platform_main.png)
    // The previous implementation used two corner images.
    // If the new asset is the FULL platform, we should center it.
    // If it's still a chunk, we'll need to see.
    // Assuming user provided a single Main Platform image to replace the main platform visual.
    // Let's place it at the center of the physics body top edge.

    // Physics width is 1180 (Edges at 370 and 1550).
    // User reports 35px -> 38px gap on wall slide. Moving textures OUT by 38px to match physics.
    const pLeft = 960 - 590 - 38; // 332
    const pTop = 795; // Top edge

    // Left Texture
    // User requested "Platform_BH4A_adria.png" (renamed to platform_main.png)
    const leftTex = scene.add.image(pLeft, pTop, mainTexKey);
    leftTex.setOrigin(0, 0); // Top-Left
    leftTex.setScale(0.8, 0.8); // Reduce X scale to avoid too much overlap

    // Right Texture
    const pRight = 960 + 590 + 38; // 1588
    const rightTex = scene.add.image(pRight, pTop, mainTexKey);
    rightTex.setOrigin(1, 0); // Top-Right
    rightTex.setScale(0.8, 0.8);
    rightTex.setFlipX(true); // Flip for right side

    // Default depth 0: above the background (-100), below the players (10)


    // --- Side and Top Platform Textures ---
    const leftPlatVisual = scene.add.image(40, 480, sideTexKey);
    leftPlatVisual.setScale(0.8);
    leftPlatVisual.setDepth(-10);

    const topPlatVisual = scene.add.image(960, 510, topTexKey);
    topPlatVisual.setScale(0.8);
    topPlatVisual.setDepth(-10);

    // --- Camera ---
    scene.cameras.main.setZoom(1);
    scene.cameras.main.centerOn(960, 540);



    return {
        background,
        platformTextures: [leftTex, rightTex, leftPlatVisual, topPlatVisual]
    };
}
