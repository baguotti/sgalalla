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
    const leftTex = scene.add.image(pLeft, pTop, 'platform_main');
    leftTex.setOrigin(0, 0); // Top-Left
    leftTex.setScale(0.8, 0.8); // Reduce X scale to avoid too much overlap

    // Right Texture
    const pRight = 960 + 590 + 38; // 1588
    const rightTex = scene.add.image(pRight, pTop, 'platform_main');
    rightTex.setOrigin(1, 0); // Top-Right
    rightTex.setScale(0.8, 0.8);
    rightTex.setFlipX(true); // Flip for right side

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
    const leftPlatVisual = scene.add.image(40, 480, 'platform_side');
    leftPlatVisual.setScale(0.8);
    leftPlatVisual.setDepth(-10)
    sidePlatVisuals.push(leftPlatVisual);

    // Floor Collision (Invisible Walkable Box):
    // Match visual center initially: 40, 450. Size scaled ~389x731.
    const leftPlatFloor = scene.add.rectangle(5, 450, 315, 590
    );
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

    // --- Single Top Platform (Centered) ---
    // User requested "just have one floating platform at the center".
    // Visual:
    const topPlatVisual = scene.add.image(960, 510, 'platform_top');
    topPlatVisual.setScale(0.8);
    topPlatVisual.setDepth(-10);
    // Collision Rectangle (this is what the player walks on):
    // Physics Width: 550? Let's keep it same size as before for now.
    const topPlat = scene.add.rectangle(960, 470, 550, 20);
    topPlat.setVisible(false); // Invisible — debug mode draws it
    (scene as any).matter.add.gameObject(topPlat, { isStatic: true });
    softPlatforms.push(topPlat);

    // Track visual images for camera ignore
    const topPlatVisuals = [topPlatVisual];


    // --- Wall Collisions (Slideable Surfaces) ---
    // MANUAL TUNING GUIDE (WALLS - RED BOXES):
    // ---------------------------------------------------------
    // Adjust these to match the sides of your platforms.
    // ---------------------------------------------------------
    const wallCollisionRects = [
        // Walls 1 & 2 (Main Stage)
        new Phaser.Geom.Rectangle(375, 890, 20, 500),
        new Phaser.Geom.Rectangle(1505, 890, 20, 500),

        // --- Left Platform Walls ---
        // WALL 3 (Inner/Right side of Left Plat): 
        // Match Visual (40, 450) -> X = 175-20. 
        // Height Extended to 625 to reach closer to bottom, leaving 60px gap for corner chop.
        new Phaser.Geom.Rectangle(180 - 15, 160, 20, 450),
        // WALL 4 (Outer/Left side of Left Plat):
        // X = 40 - (389/2) approx = -154.
        new Phaser.Geom.Rectangle(-110, 160, 20, 680),

        // WALL 5 (Horizontal Bottom Wall):
        // Connects Wall 4 (x=-135) to Wall 3 (x=175). Width ~310.
        // Y Position: Below Wall 3 (110 + 445 = 555).
        // Let's place it at Y=555 with height 40.
        new Phaser.Geom.Rectangle(-110, 555, 250, 20),


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
        platformTextures: [leftTex, rightTex, ...sidePlatVisuals, ...topPlatVisuals]
    };
}
