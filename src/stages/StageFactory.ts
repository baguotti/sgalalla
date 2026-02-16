import Phaser from 'phaser';
import { MapConfig } from '../config/MapConfig';

/**
 * Result of creating a stage. Scenes can pick what they need
 * and assign references to their own properties.
 */
export interface StageResult {
    background: Phaser.GameObjects.Image;
    mainPlatform: Phaser.GameObjects.Rectangle;
    softPlatforms: Phaser.GameObjects.Rectangle[];
    wallVisuals: Phaser.GameObjects.Rectangle[];
    wallTexts: Phaser.GameObjects.Text[];
    wallCollisionRects: Phaser.Geom.Rectangle[];
}

// Shared color constants for stage visuals
const WALL_COLOR = 0x2a3a4e;
const WALL_STROKE = 0x4a6a8e;
const PLATFORM_COLOR = 0x2c3e50;
const PLATFORM_STROKE = 0x3a506b;
const SOFT_PLATFORM_COLOR = 0x0f3460;
const SOFT_PLATFORM_STROKE = 0x1a4d7a;

/**
 * Creates the standard Sgalalla stage layout.
 * Shared between GameScene and OnlineGameScene to eliminate duplication.
 */
export function createStage(scene: Phaser.Scene): StageResult {
    // --- Background ---
    const background = scene.add.image(scene.scale.width / 2, scene.scale.height / 2, 'adria_bg');
    const scaleX = scene.scale.width / background.width;
    const scaleY = scene.scale.height / background.height;
    const scale = Math.max(scaleX, scaleY);
    background.setScale(scale * 1.1).setScrollFactor(0.1);
    background.setDepth(-100);

    // --- Main Platform ---
    // Center: 960. Width 1200. Extended to blast zone (930 height, y=1335)
    // Top Y = 870. Bottom Y = 1800 (BLAST_ZONE_BOTTOM)
    const mainPlatform = scene.add.rectangle(960, 1335, 1200, 930, PLATFORM_COLOR);
    mainPlatform.setStrokeStyle(3, PLATFORM_STROKE);
    (scene as any).matter.add.gameObject(mainPlatform, { isStatic: true });

    // --- Soft Platforms ---
    const softPlatforms: Phaser.GameObjects.Rectangle[] = [];

    const softPlatform1 = scene.add.rectangle(610, 500, 500, 30, SOFT_PLATFORM_COLOR);
    softPlatform1.setStrokeStyle(2, SOFT_PLATFORM_STROKE, 0.8);
    softPlatform1.setAlpha(0.85);
    softPlatforms.push(softPlatform1);
    (scene as any).matter.add.gameObject(softPlatform1, { isStatic: true });

    const softPlatform2 = scene.add.rectangle(1310, 500, 500, 30, SOFT_PLATFORM_COLOR);
    softPlatform2.setStrokeStyle(2, SOFT_PLATFORM_STROKE, 0.8);
    softPlatform2.setAlpha(0.85);
    softPlatforms.push(softPlatform2);
    (scene as any).matter.add.gameObject(softPlatform2, { isStatic: true });

    // --- Wall Visuals ---
    const wallVisuals: Phaser.GameObjects.Rectangle[] = [];

    const leftWall = scene.add.rectangle(MapConfig.WALL_LEFT_X, 560, MapConfig.WALL_THICKNESS, 540, WALL_COLOR);
    leftWall.setStrokeStyle(4, WALL_STROKE);
    leftWall.setAlpha(0.6);
    leftWall.setDepth(-5);
    wallVisuals.push(leftWall);

    const rightWall = scene.add.rectangle(MapConfig.WALL_RIGHT_X, 560, MapConfig.WALL_THICKNESS, 540, WALL_COLOR);
    rightWall.setStrokeStyle(4, WALL_STROKE);
    rightWall.setAlpha(0.6);
    rightWall.setDepth(-5);
    wallVisuals.push(rightWall);

    // --- Wall Collision Rects ---
    const wallCollisionRects: Phaser.Geom.Rectangle[] = [
        // Left Wall
        new Phaser.Geom.Rectangle(MapConfig.WALL_LEFT_X - MapConfig.WALL_THICKNESS / 2, 290, MapConfig.WALL_THICKNESS, 540),
        // Right Wall
        new Phaser.Geom.Rectangle(MapConfig.WALL_RIGHT_X - MapConfig.WALL_THICKNESS / 2, 290, MapConfig.WALL_THICKNESS, 540),
        // Main Platform Walls (For Wall Sliding on the deep floor)
        new Phaser.Geom.Rectangle(360 - 20, 890, 40, 910), // Left Side of Main Plat
        new Phaser.Geom.Rectangle(1560 - 20, 890, 40, 910)  // Right Side of Main Plat
    ];

    // --- Wall Text Labels ---
    const wallTexts: Phaser.GameObjects.Text[] = [];

    const leftWallText = scene.add.text(MapConfig.WALL_LEFT_X - 12, 375, 'WALL', {
        fontSize: '18px',
        color: '#8ab4f8',
        fontFamily: '"Pixeloid Sans"',
        fontStyle: 'bold'
    });
    leftWallText.setRotation(-Math.PI / 2);
    leftWallText.setAlpha(0.5);
    leftWallText.setDepth(-4);
    wallTexts.push(leftWallText);

    const rightWallText = scene.add.text(MapConfig.WALL_RIGHT_X + 12, 525, 'WALL', {
        fontSize: '18px',
        color: '#8ab4f8',
        fontFamily: '"Pixeloid Sans"',
        fontStyle: 'bold'
    });
    rightWallText.setRotation(Math.PI / 2);
    rightWallText.setAlpha(0.5);
    rightWallText.setDepth(-4);
    wallTexts.push(rightWallText);

    // --- Camera ---
    scene.cameras.main.setZoom(1);
    scene.cameras.main.centerOn(960, 540);

    return {
        background,
        mainPlatform,
        softPlatforms,
        wallVisuals,
        wallTexts,
        wallCollisionRects,
    };
}
