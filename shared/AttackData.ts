/**
 * Attack definitions: pure data shared by the client and the simulation.
 * Forces and stun are Brawlhalla's Unarmed numbers (brawlhalla.wiki.gg, every
 * fighter on the same average stats; forces in Brawlhalla's units, which Combat
 * scales); damage is about 15% below Unarmed's, so damage builds up slower. The timing is our own, quick: lights hit in 3 frames. Timings
 * are in frames, which are sim steps (60 a second).
 */

export const AttackType = {
    LIGHT: 'light',
    HEAVY: 'heavy',
} as const;
export type AttackType = typeof AttackType[keyof typeof AttackType];

export const AttackDirection = {
    NEUTRAL: 'neutral',
    SIDE: 'side',
    UP: 'up',
    DOWN: 'down',
    RUN: 'run',
} as const;
export type AttackDirection = typeof AttackDirection[keyof typeof AttackDirection];

export const AttackPhase = {
    STARTUP: 'startup',
    ACTIVE: 'active',
    RECOVERY: 'recovery',
    NONE: 'none',
} as const;
export type AttackPhase = typeof AttackPhase[keyof typeof AttackPhase];

export interface AttackData {
    type: AttackType;
    direction: AttackDirection;
    isAerial: boolean;
    damage: number;
    /** Knockback: the fixed force is the same at any damage, the variable force grows with the target's damage (and the charge). */
    fixedForce: number;
    variableForce: number;
    knockbackAngle: number; // Angle in degrees (0 = right, 90 = up)
    /** Frames the target can't act after the hit (longer while it still flies fast). */
    stun: number;
    /** Frames: before the hitbox, with the hitbox out, and after it (every move then ends with ATTACK_END_COOLDOWN). */
    startup: number;
    active: number;
    recovery: number;
    /** The hitbox, centred this far from the fighter's centre (x forward). Signatures hit where their ghost is instead. */
    hitboxWidth: number;
    hitboxHeight: number;
    hitboxOffsetX: number;
    hitboxOffsetY: number;
    shouldStallInAir?: boolean; // If true, apply gravity dampening
}

type Hit = Pick<AttackData, 'damage' | 'fixedForce' | 'variableForce' | 'stun'>;
type Timing = Pick<AttackData, 'startup' | 'active' | 'recovery'>;

/** Unarmed's hits (damage 15% lower). A string (neutral light, neutral air) is one hit with the string's damage and its last hit's force. */
const NEUTRAL_LIGHT: Hit = { damage: 10, fixedForce: 52, variableForce: 31, stun: 23 };
const SIDE_LIGHT: Hit = { damage: 11, fixedForce: 75, variableForce: 18, stun: 18 };
const DOWN_LIGHT: Hit = { damage: 7, fixedForce: 45, variableForce: 5, stun: 31 };
const NEUTRAL_AIR: Hit = { damage: 9, fixedForce: 71, variableForce: 37, stun: 19 };
const SIDE_AIR: Hit = { damage: 11, fixedForce: 45, variableForce: 38, stun: 14 };
const DOWN_AIR: Hit = { damage: 9, fixedForce: 65, variableForce: 5, stun: 19 };
const NEUTRAL_HEAVY: Hit = { damage: 17, fixedForce: 40, variableForce: 46, stun: 18 };
const SIDE_HEAVY: Hit = { damage: 15, fixedForce: 45, variableForce: 55, stun: 18 };
const GROUND_POUND: Hit = { damage: 14, fixedForce: 48, variableForce: 46, stun: 19 };

/** Timings: lights quick, slides and the down air a little slower, signatures long and active. */
const LIGHT: Timing = { startup: 3, active: 6, recovery: 3 };
const SLIDE: Timing = { startup: 5, active: 6, recovery: 6 };
const DOWN_AIR_TIMING: Timing = { startup: 6, active: 6, recovery: 8 };
const SIGNATURE: Timing = { startup: 2, active: 18, recovery: 12 };
const SIDE_SIGNATURE: Timing = { startup: 5, active: 18, recovery: 18 };
/** Hangs through its startup, then falls until it lands (no active time or recovery: landing ends it). */
/** Hangs through its startup, falls until it lands; the landing pose lasts its recovery. */
const GROUND_POUND_TIMING: Timing = { startup: 6, active: 0, recovery: 6 };

// Attack data definitions for all attack types
export const AttackRegistry: Record<string, AttackData> = {
    // ========== GROUNDED LIGHT ATTACKS ==========
    'light_neutral_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.NEUTRAL,
        isAerial: false,
        ...NEUTRAL_LIGHT,
        ...LIGHT,
        knockbackAngle: 45,
        hitboxWidth: 55,
        hitboxHeight: 27,
        hitboxOffsetX: 37,
        hitboxOffsetY: 0,
    },
    'light_side_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.SIDE,
        isAerial: false,
        ...SIDE_LIGHT,
        ...LIGHT,
        knockbackAngle: 30,
        hitboxWidth: 55,
        hitboxHeight: 24,
        hitboxOffsetX: 40,
        hitboxOffsetY: 0,
    },
    'light_down_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.DOWN,
        isAerial: false,
        ...DOWN_LIGHT,
        ...SLIDE,
        knockbackAngle: 30, // Forward, like side light
        hitboxWidth: 100,
        hitboxHeight: 25,
        hitboxOffsetX: 20,
        hitboxOffsetY: 44,
    },
    'light_run_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.RUN,
        isAerial: false,
        ...SIDE_LIGHT,
        ...SLIDE,
        knockbackAngle: 30, // Drift/Slide physics from Down Light
        // Hitbox covers attacker body + punch reach
        hitboxWidth: 168,
        hitboxHeight: 47,
        hitboxOffsetX: -20,
        hitboxOffsetY: 0,
    },
    'light_up_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.UP,
        isAerial: false,
        ...NEUTRAL_LIGHT,
        ...LIGHT,
        knockbackAngle: 45,
        hitboxWidth: 55,
        hitboxHeight: 27,
        hitboxOffsetX: 37,
        hitboxOffsetY: 0,
    },

    // ========== AERIAL LIGHT ATTACKS ==========
    'light_neutral_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.NEUTRAL,
        isAerial: true,
        ...NEUTRAL_AIR,
        ...LIGHT,
        knockbackAngle: 45,
        hitboxWidth: 55,
        hitboxHeight: 27,
        hitboxOffsetX: 34,
        hitboxOffsetY: 0,
        shouldStallInAir: true,
    },
    'light_side_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.SIDE,
        isAerial: true,
        ...SIDE_AIR,
        ...LIGHT,
        knockbackAngle: 20,
        hitboxWidth: 55,
        hitboxHeight: 27,
        hitboxOffsetX: 40,
        hitboxOffsetY: 0,
    },
    'light_down_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.DOWN,
        isAerial: true,
        ...DOWN_AIR,
        ...DOWN_AIR_TIMING,
        knockbackAngle: 270,
        hitboxWidth: 100,
        hitboxHeight: 25,
        hitboxOffsetX: 20,
        hitboxOffsetY: 44,
    },
    'light_up_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.UP,
        isAerial: true,
        ...NEUTRAL_AIR,
        ...LIGHT,
        knockbackAngle: 20, // Same as side air
        hitboxWidth: 55,
        hitboxHeight: 27,
        hitboxOffsetX: 40,
        hitboxOffsetY: 0,
    },

    // ========== GROUNDED HEAVY ATTACKS ==========
    'heavy_neutral_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.NEUTRAL,
        isAerial: false,
        ...NEUTRAL_HEAVY,
        ...SIGNATURE,
        knockbackAngle: 80,
        hitboxWidth: 67,
        hitboxHeight: 61,
        hitboxOffsetX: 13,
        hitboxOffsetY: -27,
    },
    'heavy_side_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.SIDE,
        isAerial: false,
        ...SIDE_HEAVY,
        ...SIDE_SIGNATURE,
        knockbackAngle: 4, // Changed from 5 to 4
        hitboxWidth: 81,
        hitboxHeight: 47,
        hitboxOffsetX: 0,
        hitboxOffsetY: 0,
    },
    'heavy_up_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.UP,
        isAerial: false,
        ...NEUTRAL_HEAVY,
        ...SIGNATURE,
        knockbackAngle: 80,
        hitboxWidth: 67,
        hitboxHeight: 61,
        hitboxOffsetX: 13,
        hitboxOffsetY: -27,
    },

    // ========== AERIAL HEAVY ATTACKS (neutral and up are the recovery) ==========
    'heavy_side_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.SIDE,
        isAerial: true,
        ...SIDE_HEAVY,
        ...SIGNATURE,
        knockbackAngle: 4,
        hitboxWidth: 74,
        hitboxHeight: 40,
        hitboxOffsetX: 27,
        hitboxOffsetY: 0,
    },
    'heavy_down_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.DOWN,
        isAerial: true,
        ...GROUND_POUND,
        ...GROUND_POUND_TIMING,
        knockbackAngle: 270,
        hitboxWidth: 86,
        hitboxHeight: 20,
        hitboxOffsetX: 0,
        hitboxOffsetY: 62,
    },
};

/** Registry key for an attack, e.g. `light_side_aerial`. */
export function attackKey(type: AttackType, direction: AttackDirection, isAerial: boolean): string {
    return `${type}_${direction}_${isAerial ? 'aerial' : 'grounded'}`;
}
