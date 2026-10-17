/**
 * Shared Stage Data — Pure geometry, no Phaser dependencies.
 * The single source of truth for stage collision: each match collides against
 * its own layout (STAGE_LAYOUTS[match.stage]); StageFactory draws the art over it.
 */

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
    blastZones: Bounds;
    /** What the camera may show (inside the blast zones): fighters beyond it show as bubbles at the screen's edge. */
    camera: Bounds;
}

export interface Bounds {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

/** The camera stays this far inside the blast zones. */
const CAMERA_INSET = 300;

function inset(zone: Bounds, by: number): Bounds {
    return { left: zone.left + by, right: zone.right - by, top: zone.top + by, bottom: zone.bottom - by };
}

// ─── Stage Layouts ───

/** The collision layouts a match can be played on; a match keeps its own (MatchState.stage). */
export type StageLayoutId = 'standard' | 'grande';

/** Crossing these KOs a fighter. */
const STANDARD_BLAST_ZONES: Bounds = { left: -1020, right: 2940, top: -1000, bottom: 1800 };

/** How much wider each half of Londra Grande's main platform is than the standard one's. */
export const GRANDE_WIDEN = 210;

/** A copy of `r` mirrored across the stage's middle (x 960). */
function mirrored<T extends SimRect>(r: T): T {
    return { ...r, x: 1920 - r.x };
}

/** A copy of `r` moved `dx` across. */
function moved<T extends SimRect>(r: T, dx: number): T {
    return { ...r, x: r.x + dx };
}

/*
 * Walls and undersides follow the art (traced from the platform textures' outlines). A fighter
 * sliding down a wall has its sprite's back 7 px short of its body's side, so each wall's face
 * sits 7 px into the rock: the fighter's hand is on it.
 */

/** The main platform's left side (the rock face at x 410), and the right one mirrored. */
const MAIN_LEFT_WALL: SimRect = { x: 427, y: 1140, w: 20, h: 500 };

/** The left pillar: its top at y 155, the rock hanging down and narrowing to a tip at about y 800. */
const PILLAR: SimPlatform = { x: 30, y: 450, w: 315, h: 590, isSoft: false };
const PILLAR_WALLS: SimRect[] = [
    // Inner side (the rock at x 149 to 154), down to where it starts narrowing
    { x: 135, y: 410, w: 20, h: 500 },
    // Outer side (the rock at x -66 to -70)
    { x: -51, y: 480, w: 20, h: 640 },
];
const PILLAR_CEILINGS: SimRect[] = [
    // Undersides, stepping up the tapering rock from its tip to the inner side
    { x: -30, y: 795, w: 80, h: 20 },
    { x: 30, y: 770, w: 40, h: 20 },
    { x: 65, y: 735, w: 30, h: 20 },
    { x: 105, y: 685, w: 50, h: 20 },
    { x: 140, y: 655, w: 20, h: 20 },
];

/**
 * The collision layout of the standard stage (every painted stage: only the textures differ).
 * Platform order matters: it is the order collisions are resolved in.
 */
const STANDARD: SimStage = {
    platforms: [
        // Main platform: top edge at y=870, extends down to the bottom blast zone
        { x: 960, y: 1335, w: 1180, h: 930, isSoft: false },
        PILLAR,
        // Top floating platform (drop-through)
        { x: 960, y: 470, w: 550, h: 20, isSoft: true },
    ],
    walls: [MAIN_LEFT_WALL, mirrored(MAIN_LEFT_WALL), ...PILLAR_WALLS],
    ceilings: [
        ...PILLAR_CEILINGS,
        // Main stage underside
        { x: 960, y: 1380, w: 1070, h: 20 },
    ],
    blastZones: STANDARD_BLAST_ZONES,
    camera: inset(STANDARD_BLAST_ZONES, CAMERA_INSET),
};

/** The standard pillar moved out with the main platform's edge; its mirror is on the right. */
const GRANDE_PILLAR = moved(PILLAR, -GRANDE_WIDEN);
const GRANDE_PILLAR_WALLS = PILLAR_WALLS.map(w => moved(w, -GRANDE_WIDEN));
const GRANDE_PILLAR_CEILINGS = PILLAR_CEILINGS.map(c => moved(c, -GRANDE_WIDEN));

const GRANDE_BLAST_ZONES: Bounds = {
    ...STANDARD_BLAST_ZONES,
    left: STANDARD_BLAST_ZONES.left - GRANDE_WIDEN,
    right: STANDARD_BLAST_ZONES.right + GRANDE_WIDEN,
};

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
        moved(MAIN_LEFT_WALL, -GRANDE_WIDEN),
        mirrored(moved(MAIN_LEFT_WALL, -GRANDE_WIDEN)),
        ...GRANDE_PILLAR_WALLS,
        ...GRANDE_PILLAR_WALLS.map(mirrored),
    ],
    ceilings: [
        ...GRANDE_PILLAR_CEILINGS,
        ...GRANDE_PILLAR_CEILINGS.map(mirrored),
        { x: 960, y: 1380, w: 1070 + 2 * GRANDE_WIDEN, h: 20 },
    ],
    blastZones: GRANDE_BLAST_ZONES,
    camera: inset(GRANDE_BLAST_ZONES, CAMERA_INSET),
};

export const STAGE_LAYOUTS: Readonly<Record<StageLayoutId, SimStage>> = { standard: STANDARD, grande: GRANDE };
