import Phaser from 'phaser';


/**
 * Result of creating a stage. Scenes can pick what they need
 * and assign references to their own properties.
 */
export interface StageResult {
    background: Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite;

    mainPlatform: Phaser.GameObjects.Rectangle;
    softPlatforms: Phaser.GameObjects.Rectangle[];
    sidePlatforms: Phaser.GameObjects.Rectangle[]; // Added side platforms

    wallCollisionRects: Phaser.Geom.Rectangle[];
    platformTextures: Phaser.GameObjects.Image[];
}

// Shared color constants for stage visuals


/**
 * Creates the standard Sgalalla stage layout.
 * Shared between GameScene and OnlineGameScene to eliminate duplication.
 */
export function createStage(scene: Phaser.Scene): StageResult {
    // --- Background ---
    // --- Background ---
    const background = scene.add.image(scene.scale.width / 2, scene.scale.height / 2 + 150, 'adria_bg'); // New BG
    const scaleX = scene.scale.width / background.width;
    const scaleY = scene.scale.height / background.height;
    const scale = Math.max(scaleX, scaleY) * 2.0;

    background.setScale(scale).setScrollFactor(0.9);
    background.setDepth(-100);



    // --- Main Platform ---
    // Center: 960. Width 1200. Extended to blast zone (930 height, y=1335)
    // Top Y = 870. Bottom Y = 1800 (BLAST_ZONE_BOTTOM)
    const mainPlatform = scene.add.rectangle(960, 1335, 1180, 930, 0x000000, 0); // Invisible, width 1180
    // mainPlatform.setStrokeStyle(3, PLATFORM_STROKE); // Remove stroke

    (scene as any).matter.add.gameObject(mainPlatform, { isStatic: true });

    // --- Platform Textures ---
    // Top-Left Corner (Anchor to top-left of collision box)
    // Collision box top is 1335 - (930/2) = 1335 - 465 = 870.
    // Textures are approx 830px tall?
    // Platform_BH4A (Left): 1195 x 827
    // Platform_BH4B (Right): 997 x 837

    // Physics width is 1180 (Edges at 370 and 1550).
    // User reports 35px -> 38px gap on wall slide. Moving textures OUT by 38px to match physics.
    const pLeft = 960 - 590 - 38; // 332
    const pTop = 795; // Top edge

    // Left Texture
    const leftTex = scene.add.image(pLeft, pTop, 'platform_corner_left');
    leftTex.setOrigin(0, 0); // Top-Left
    leftTex.setScale(0.8, 1.0); // Reduce X scale to avoid too much overlap

    // Right Texture
    // Right Texture
    const pRight = 960 + 590 + 38; // 1588
    const rightTex = scene.add.image(pRight, pTop, 'platform_corner_right');
    rightTex.setOrigin(1, 0); // Top-Right
    rightTex.setScale(0.8, 1.0);

    // Adjust depths to be behind players (0) but above background (-100)
    // Main Platform rect is added above... wait.
    // Phaser adds to display list in order.
    // mainPlatform is added first. Then these. So these are ON TOP of mainPlatform.
    // Players are added later in GameScene, so players are ON TOP of these.
    // Perfect.


    // --- Side Platforms (Floaters) ---
    // MANUAL TUNING GUIDE (SIDE PLATFORMS):
    // ---------------------------------------------------------
    // 1. VISUAL: Change scene.add.image(X, Y, ...)
    // 2. FLOOR (Walkable): Change matter.add.rectangle(X, Y, W, H) below.
    // 3. WALLS (Slideable): Change wallCollisionRects farther down.
    // ---------------------------------------------------------

    const sidePlatforms: Phaser.GameObjects.Rectangle[] = [];
    const sidePlatVisuals: Phaser.GameObjects.Image[] = [];

    // --- Left Side Platform ---
    // Visual (User set to 40, 450):
    const leftPlatVisual = scene.add.image(40, 450, 'bh_plat_1');
    leftPlatVisual.setScale(0.8);
    leftPlatVisual.setDepth(-10);
    sidePlatVisuals.push(leftPlatVisual);

    // Floor Collision (Invisible Walkable Box):
    // Match visual center initially: 40, 450. Size scaled ~389x731.
    const leftPlatFloor = scene.add.rectangle(25, 450, 315, 690);
    leftPlatFloor.setVisible(false);
    (scene as any).matter.add.gameObject(leftPlatFloor, { isStatic: true });
    sidePlatforms.push(leftPlatFloor);



    // --- Soft Platforms (Top) ---
    // softPlatforms = invisible collision rectangles (debug viz + collision use these).
    // Platform images below are purely visual.
    const softPlatforms: Phaser.GameObjects.Rectangle[] = [];

    // MANUAL TUNING GUIDE:
    // ---------------------------------------------------------
    // VISUAL: Change scene.add.image(X, Y, ...) and .setScale(...).
    // COLLISION: Change scene.add.rectangle(X, Y, WIDTH, HEIGHT).
    //   The collision rectangle is what the debug yellow box shows.
    //   The player walks on this invisible rectangle.
    // ---------------------------------------------------------

    // --- Left Top Platform ---
    // Visual (purely decorative):
    const sp1Visual = scene.add.image(670, 510, 'bh_plat_left');
    sp1Visual.setScale(0.8);
    sp1Visual.setDepth(-10);
    // Collision Rectangle (this is what the player walks on):
    const sp1 = scene.add.rectangle(685, 470, 550, 20);
    sp1.setVisible(false); // Invisible — debug mode draws it
    (scene as any).matter.add.gameObject(sp1, { isStatic: true });
    softPlatforms.push(sp1);

    // --- Right Top Platform --- 
    // Visual (purely decorative):
    const sp2Visual = scene.add.image(1243, 515, 'bh_plat_right');
    sp2Visual.setScale(0.8);
    sp2Visual.setDepth(-10);
    // Collision Rectangle (this is what the player walks on):
    const sp2 = scene.add.rectangle(1258, 470, 575, 20);
    sp2.setVisible(false); // Invisible — debug mode draws it
    (scene as any).matter.add.gameObject(sp2, { isStatic: true });
    softPlatforms.push(sp2);

    // Track visual images for camera ignore
    const topPlatVisuals = [sp1Visual, sp2Visual];


    // --- Wall Collisions (Slideable Surfaces) ---
    // MANUAL TUNING GUIDE (WALLS - RED BOXES):
    // ---------------------------------------------------------
    // Adjust these to match the sides of your platforms.
    // ---------------------------------------------------------
    const wallCollisionRects = [
        // Walls 1 & 2 (Main Stage)
        new Phaser.Geom.Rectangle(350, 890, 40, 430),
        new Phaser.Geom.Rectangle(1530, 890, 40, 430),

        // --- Left Platform Walls ---
        // WALL 3 (Inner/Right side of Left Plat): 
        // Match Visual (40, 450) -> X = 175-20. 
        // Height Extended to 625 to reach closer to bottom, leaving 60px gap for corner chop.
        new Phaser.Geom.Rectangle(175 - 20, 110, 40, 445),
        // WALL 4 (Outer/Left side of Left Plat):
        // X = 40 - (389/2) approx = -154.
        new Phaser.Geom.Rectangle(-135 - 20, 110, 40, 680),

        // WALL 5 (Horizontal Bottom Wall):
        // Connects Wall 4 (x=-135) to Wall 3 (x=175). Width ~310.
        // Y Position: Below Wall 3 (110 + 445 = 555).
        // Let's place it at Y=555 with height 40.
        new Phaser.Geom.Rectangle(-135, 555, 250 + 40, 20),


    ];

    // --- Camera ---
    scene.cameras.main.setZoom(1);
    scene.cameras.main.centerOn(960, 540);



    return {
        background,

        mainPlatform,
        softPlatforms,
        sidePlatforms, // Now Rectangles

        wallCollisionRects,
        platformTextures: [leftTex, rightTex, ...topPlatVisuals, ...sidePlatVisuals]
    };
}
