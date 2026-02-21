/**
 * Shared Stage Data — Pure geometry, no Phaser dependencies.
 * Defines platform and wall collision rectangles for use
 * by both client (prediction) and server (authority).
 */

import { MapConfig } from './MapConfig.js';

// ─── Core Types ───

/** Axis-aligned rectangle for collision. */
export interface SimRect {
    x: number;      // Center X
    y: number;      // Center Y
    w: number;      // Width
    h: number;      // Height
}

/** Platform has an additional "soft" flag for drop-through behavior. */
export interface SimPlatform extends SimRect {
    isSoft: boolean;
}

/** Full stage geometry for server-side physics. */
export interface SimStage {
    platforms: SimPlatform[];
    walls: SimRect[];
    blastZones: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
}

// ─── Adria Stage Data ───

/**
 * The "Adria" stage layout — extracted from StageFactory.ts.
 * Coordinates match the Phaser scene exactly.
 *
 * Wall rects in StageFactory use top-left origin (Phaser.Geom.Rectangle).
 * Here we convert to center-origin for consistency with SimRect.
 */
export const ADRIA_STAGE: SimStage = {
    platforms: [
        // Main platform (center: 960, y: 1335, dimensions: 1180×930)
        { x: 960, y: 1335, w: 1180, h: 930, isSoft: false },
        // Left side platform (center: 5, y: 450, dimensions: 315×590)
        { x: 5, y: 450, w: 315, h: 590, isSoft: false },
        // Top floating platform (center: 960, y: 470, dimensions: 550×20)
        { x: 960, y: 470, w: 550, h: 20, isSoft: true },
    ],
    walls: [
        // Main stage walls (left and right)
        // Original: new Phaser.Geom.Rectangle(375, 890, 20, 500) → center (385, 1140)
        { x: 385, y: 1140, w: 20, h: 500 },
        // Original: new Phaser.Geom.Rectangle(1505, 890, 20, 500) → center (1515, 1140)
        { x: 1515, y: 1140, w: 20, h: 500 },
        // Left platform inner wall
        // Original: new Phaser.Geom.Rectangle(165, 160, 20, 450) → center (175, 385)
        { x: 175, y: 385, w: 20, h: 450 },
        // Left platform outer wall
        // Original: new Phaser.Geom.Rectangle(-110, 160, 20, 680) → center (-100, 500)
        { x: -100, y: 500, w: 20, h: 680 },
        // Left platform bottom wall (horizontal)
        // Original: new Phaser.Geom.Rectangle(-110, 555, 250, 20) → center (15, 565)
        { x: 15, y: 565, w: 250, h: 20 },
    ],
    blastZones: {
        left: MapConfig.BLAST_ZONE_LEFT,
        right: MapConfig.BLAST_ZONE_RIGHT,
        top: MapConfig.BLAST_ZONE_TOP,
        bottom: MapConfig.BLAST_ZONE_BOTTOM,
    },
};
