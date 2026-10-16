/**
 * Shared Stage Data — Pure geometry, no Phaser dependencies.
 * The single source of truth for stage collision: each match collides against
 * its own layout (STAGE_LAYOUTS[match.stage]); StageFactory draws the art over it.
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

// ─── Stage Layouts ───

/** The collision layouts a match can be played on; a match keeps its own (MatchState.stage). */
export type StageLayoutId = 'standard' | 'grande';

/**
 * The collision layout of the standard stage (every painted stage: only the textures differ).
 * Platform order matters: it is the order collisions are resolved in.
 */
const STANDARD: SimStage = {
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

/** How much wider each half of Londra Grande's main platform is than the standard one's. */
export const GRANDE_WIDEN = 210;

/** A copy of `r` mirrored across the stage's middle (x 960). */
function mirrored<T extends SimRect>(r: T): T {
    return { ...r, x: 1920 - r.x };
}

/** The standard left pillar moved out with the main platform's edge, and its mirror on the right. */
const GRANDE_PILLAR: SimPlatform = { x: 30 - GRANDE_WIDEN, y: 450, w: 315, h: 590, isSoft: false };
const GRANDE_PILLAR_WALLS: SimRect[] = [
    { x: 125 - GRANDE_WIDEN, y: 385, w: 20, h: 450 },
    { x: -50 - GRANDE_WIDEN, y: 500, w: 20, h: 680 },
];
const GRANDE_PILLAR_CEILING: SimRect = { x: 25 - GRANDE_WIDEN, y: 565, w: 170, h: 20 };

/**
 * Londra Grande, for 3 to 5 players: the main platform 1600 px wide instead of
 * 1180, a pillar on each side (each as far from the edge as the standard one),
 * the standard top platform, and two lower soft platforms a jump up. The blast
 * zones move out with the edges, so a KO takes the same flight from the ledge.
 */
const GRANDE: SimStage = {
    platforms: [
        { x: 960, y: 1335, w: 1180 + 2 * GRANDE_WIDEN, h: 930, isSoft: false },
        GRANDE_PILLAR,
        mirrored(GRANDE_PILLAR),
        { x: 960, y: 450, w: 550, h: 20, isSoft: true },
        { x: 420, y: 630, w: 440, h: 20, isSoft: true },
        { x: 1500, y: 630, w: 440, h: 20, isSoft: true },
    ],
    walls: [
        { x: 435 - GRANDE_WIDEN, y: 1140, w: 20, h: 500 },
        { x: 1485 + GRANDE_WIDEN, y: 1140, w: 20, h: 500 },
        ...GRANDE_PILLAR_WALLS,
        ...GRANDE_PILLAR_WALLS.map(mirrored),
    ],
    ceilings: [
        GRANDE_PILLAR_CEILING,
        mirrored(GRANDE_PILLAR_CEILING),
        { x: 960, y: 1380, w: 1070 + 2 * GRANDE_WIDEN, h: 20 },
    ],
    blastZones: {
        left: MapConfig.BLAST_ZONE_LEFT - GRANDE_WIDEN,
        right: MapConfig.BLAST_ZONE_RIGHT + GRANDE_WIDEN,
        top: MapConfig.BLAST_ZONE_TOP,
        bottom: MapConfig.BLAST_ZONE_BOTTOM,
    },
};

export const STAGE_LAYOUTS: Readonly<Record<StageLayoutId, SimStage>> = { standard: STANDARD, grande: GRANDE };
