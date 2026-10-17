/**
 * Attack definitions: pure data shared by the client and the simulation.
 * The numbers are Brawlhalla's Unarmed frame data (brawlhalla.wiki.gg), with
 * every fighter on the same average stats: timings are in frames, which are
 * sim steps (60 a second), and forces in Brawlhalla's units (Combat scales them).
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
    /** Frames: before the hitbox, with the hitbox out, and stuck after it, on a hit or a miss. */
    startup: number;
    active: number;
    recovery: number;
    recoveryMiss: number;
    /** Frames after the recovery when this same attack can't be used again, on a hit or a miss. */
    cooldown: number;
    cooldownMiss: number;
    /** The hitbox, centred this far from the fighter's centre (x forward). Signatures hit where their ghost is instead. */
    hitboxWidth: number;
    hitboxHeight: number;
    hitboxOffsetX: number;
    hitboxOffsetY: number;
    shouldStallInAir?: boolean; // If true, apply gravity dampening
}

type Frames = Pick<AttackData, 'damage' | 'fixedForce' | 'variableForce' | 'stun' | 'startup' | 'active' | 'recovery' | 'recoveryMiss' | 'cooldown' | 'cooldownMiss'>;

/** Unarmed's moves. A string (neutral light, neutral air) is one hit with the string's damage and its last hit's force. */
const NEUTRAL_LIGHT: Frames = { damage: 12, fixedForce: 52, variableForce: 31, stun: 23, startup: 5, active: 6, recovery: 13, recoveryMiss: 20, cooldown: 11, cooldownMiss: 16 };
const SIDE_LIGHT: Frames = { damage: 13, fixedForce: 75, variableForce: 18, stun: 18, startup: 8, active: 4, recovery: 12, recoveryMiss: 14, cooldown: 9, cooldownMiss: 10 };
const DOWN_LIGHT: Frames = { damage: 8, fixedForce: 45, variableForce: 5, stun: 31, startup: 8, active: 9, recovery: 3, recoveryMiss: 16, cooldown: 13, cooldownMiss: 13 };
const NEUTRAL_AIR: Frames = { damage: 11, fixedForce: 71, variableForce: 37, stun: 19, startup: 7, active: 8, recovery: 15, recoveryMiss: 16, cooldown: 7, cooldownMiss: 7 };
const SIDE_AIR: Frames = { damage: 13, fixedForce: 45, variableForce: 38, stun: 14, startup: 13, active: 7, recovery: 10, recoveryMiss: 18, cooldown: 9, cooldownMiss: 14 };
const DOWN_AIR: Frames = { damage: 10, fixedForce: 65, variableForce: 5, stun: 19, startup: 6, active: 16, recovery: 18, recoveryMiss: 18, cooldown: 9, cooldownMiss: 9 };
const NEUTRAL_HEAVY: Frames = { damage: 20, fixedForce: 40, variableForce: 46, stun: 18, startup: 16, active: 6, recovery: 17, recoveryMiss: 17, cooldown: 0, cooldownMiss: 0 };
const SIDE_HEAVY: Frames = { damage: 18, fixedForce: 45, variableForce: 55, stun: 18, startup: 20, active: 8, recovery: 23, recoveryMiss: 23, cooldown: 0, cooldownMiss: 0 };
/** Falls until it lands (active), then the recovery. */
const GROUND_POUND: Frames = { damage: 17, fixedForce: 48, variableForce: 46, stun: 19, startup: 17, active: 0, recovery: 20, recoveryMiss: 8, cooldown: 11, cooldownMiss: 19 };

// Attack data definitions for all attack types
export const AttackRegistry: Record<string, AttackData> = {
    // ========== GROUNDED LIGHT ATTACKS ==========
    'light_neutral_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.NEUTRAL,
        isAerial: false,
        ...NEUTRAL_LIGHT,
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
        knockbackAngle: 80,
        hitboxWidth: 67,
        hitboxHeight: 61,
        hitboxOffsetX: 13,
        hitboxOffsetY: -27,
    },

    // ========== AERIAL HEAVY ATTACK (the others are the recovery) ==========
    'heavy_down_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.DOWN,
        isAerial: true,
        ...GROUND_POUND,
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
