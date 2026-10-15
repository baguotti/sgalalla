/**
 * Shared Stage Data — Pure geometry, no Phaser dependencies.
 * The single source of truth for stage collision: StageFactory builds its
 * collision objects from STAGE_LAYOUT, and the simulation collides against it.
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

/** Full stage geometry. */
export interface SimStage {
    platforms: SimPlatform[];
    /** Sides: they stop fighters moving across. */
    walls: SimRect[];
    /** Undersides: they stop fighters moving up. */
    ceilings: SimRect[];
    blastZones: {
        left: number;
        right: number;
        top: number;
        bottom: number;
    };
}

// ─── Stage Layout ───

/**
 * Collision layout shared by every stage (only the textures differ per stage).
 * Platform order matters: it is the order collisions are resolved in.
 */
export const STAGE_LAYOUT: SimStage = {
    platforms: [
        // Main platform: top edge at y=870, extends down to the bottom blast zone
        { x: 960, y: 1335, w: 1180, h: 930, isSoft: false },
        // Left side platform
        { x: 30, y: 450, w: 315, h: 590, isSoft: false },
        // Top floating platform (drop-through)
        { x: 960, y: 470, w: 550, h: 20, isSoft: true },
    ],
    walls: [
        // Main stage sides
        { x: 435, y: 1140, w: 20, h: 500 },
        { x: 1485, y: 1140, w: 20, h: 500 },
        // Left platform inner and outer sides
        { x: 125, y: 385, w: 20, h: 450 },
        { x: -50, y: 500, w: 20, h: 680 },
    ],
    ceilings: [
        // Left platform underside
        { x: 25, y: 565, w: 170, h: 20 },
        // Main stage underside
        { x: 960, y: 1380, w: 1070, h: 20 },
    ],
    blastZones: {
        left: MapConfig.BLAST_ZONE_LEFT,
        right: MapConfig.BLAST_ZONE_RIGHT,
        top: MapConfig.BLAST_ZONE_TOP,
        bottom: MapConfig.BLAST_ZONE_BOTTOM,
    },
};
