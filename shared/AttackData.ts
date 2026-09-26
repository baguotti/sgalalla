/**
 * Attack definitions: pure data shared by the client and the simulation.
 * Durations are in milliseconds.
 */
import { PhysicsConfig } from './PhysicsConfig.js';

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
    /** Knockback every hit gives, and how much more per point of the target's damage. */
    baseKnockback?: number;
    knockbackGrowth?: number;
    knockbackAngle: number; // Angle in degrees (0 = right, 90 = up)
    startupDuration: number;
    activeDuration: number;
    recoveryDuration: number;
    hitboxWidth: number;
    hitboxHeight: number;
    hitboxOffsetX: number;
    hitboxOffsetY: number;
    shouldStallInAir?: boolean; // If true, apply gravity dampening
}

// Attack data definitions for all attack types
export const AttackRegistry: Record<string, AttackData> = {
    // ========== GROUNDED LIGHT ATTACKS ==========
    'light_neutral_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.NEUTRAL,
        isAerial: false,
        damage: 4,
        baseKnockback: 180,
        knockbackGrowth: 4,
        knockbackAngle: 45,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_MS,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_MS,
        hitboxWidth: 50,
        hitboxHeight: 40,
        hitboxOffsetX: 35,
        hitboxOffsetY: 0,
    },
    'light_side_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.SIDE,
        isAerial: false,
        damage: 4,
        baseKnockback: 250,
        knockbackGrowth: 7,
        knockbackAngle: 270,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_MS,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_MS,
        hitboxWidth: 60,
        hitboxHeight: 35,
        hitboxOffsetX: 40,
        hitboxOffsetY: 0,
    },
    'light_down_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.DOWN,
        isAerial: false,
        damage: 4,
        baseKnockback: 180,
        knockbackGrowth: 5, // Slightly less than side light
        knockbackAngle: 30, // Changed from 80 (Now sends forward like side light)
        startupDuration: PhysicsConfig.LIGHT_STARTUP_MS + 30,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_MS + 50,
        hitboxWidth: 148, // 1.5x wider for slide (was 99)
        hitboxHeight: 37, // 1.5x flatter (was 25)
        hitboxOffsetX: 30,
        hitboxOffsetY: 65, // Lower to feet (was 35)
    },
    'light_run_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.RUN,
        isAerial: false,
        damage: 4,
        baseKnockback: 180,
        knockbackGrowth: 5,
        knockbackAngle: 30, // Drift/Slide physics from Down Light
        startupDuration: PhysicsConfig.LIGHT_STARTUP_MS + 30,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_MS + 50,
        // Hitbox covers attacker body + punch reach
        hitboxWidth: 250, // Extended massively to catch enemies we slide past at close range
        hitboxHeight: 70,
        hitboxOffsetX: -30, // Shifted slightly backward to hit enemies we slide through
        hitboxOffsetY: 0,
    },
    'light_up_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.UP,
        isAerial: false,
        damage: 4,
        baseKnockback: 180,
        knockbackGrowth: 4,
        knockbackAngle: 45,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_MS,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_MS,
        hitboxWidth: 50,
        hitboxHeight: 40,
        hitboxOffsetX: 35,
        hitboxOffsetY: 0,
    },

    // ========== AERIAL LIGHT ATTACKS ==========
    'light_neutral_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.NEUTRAL,
        isAerial: true,
        damage: 4,
        baseKnockback: 180,
        knockbackGrowth: 4,
        knockbackAngle: 45,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_MS,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_MS,
        hitboxWidth: 50,
        hitboxHeight: 40,
        hitboxOffsetX: 30,
        hitboxOffsetY: 0,
        shouldStallInAir: true,
    },
    'light_side_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.SIDE,
        isAerial: true,
        damage: 5,
        baseKnockback: 180,
        knockbackGrowth: 4,
        knockbackAngle: 20,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_MS,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_MS,
        hitboxWidth: 55,
        hitboxHeight: 40,
        hitboxOffsetX: 40,
        hitboxOffsetY: 0,
    },
    'light_down_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.DOWN,
        isAerial: true,
        damage: 6,
        baseKnockback: 200,
        knockbackGrowth: 6, // Spike strength
        knockbackAngle: 270,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_MS + 50,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_MS + 80,
        hitboxWidth: 148, // 1.5x Cloned from Down Light (was 99)
        hitboxHeight: 37, // 1.5x (was 25)
        hitboxOffsetX: 30,
        hitboxOffsetY: 65,
    },
    'light_up_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.UP,
        isAerial: true,
        damage: 5,
        baseKnockback: 180,
        knockbackGrowth: 4,
        knockbackAngle: 20, // Same as side air
        startupDuration: PhysicsConfig.LIGHT_STARTUP_MS,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_MS,
        hitboxWidth: 55, // Cloned from Side Air
        hitboxHeight: 40,
        hitboxOffsetX: 40,
        hitboxOffsetY: 0,
    },

    // ========== GROUNDED HEAVY ATTACKS ==========
    'heavy_neutral_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.NEUTRAL,
        isAerial: false,
        damage: 6,
        baseKnockback: 250, // Heavy Base
        knockbackGrowth: 3.6,
        knockbackAngle: 80,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_MS,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_MS,
        hitboxWidth: 100,
        hitboxHeight: 90,
        hitboxOffsetX: 20,
        hitboxOffsetY: -40,
    },
    'heavy_side_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.SIDE,
        isAerial: false,
        damage: 8,
        baseKnockback: 300,
        knockbackGrowth: 10.5,
        knockbackAngle: 4, // Changed from 5 to 4
        startupDuration: PhysicsConfig.HEAVY_STARTUP_MS + 50,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_MS + 100,
        hitboxWidth: 120,
        hitboxHeight: 70,
        hitboxOffsetX: 0,
        hitboxOffsetY: 0,
    },
    'heavy_down_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.DOWN,
        isAerial: false,
        damage: 8,
        baseKnockback: 145,
        knockbackGrowth: 3.6,
        knockbackAngle: 85,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_MS + 30,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_MS + 80,
        hitboxWidth: 120,
        hitboxHeight: 60,
        hitboxOffsetX: 40,
        hitboxOffsetY: 25,
    },

    'heavy_up_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.UP,
        isAerial: false,
        damage: 6,
        baseKnockback: 145,
        knockbackGrowth: 3.6,
        knockbackAngle: 80,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_MS,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_MS,
        hitboxWidth: 100,
        hitboxHeight: 90,
        hitboxOffsetX: 20,
        hitboxOffsetY: -40,
    },

    // ========== AERIAL HEAVY ATTACKS ==========
    'heavy_neutral_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.NEUTRAL,
        isAerial: true,
        damage: 6,
        baseKnockback: 240,
        knockbackGrowth: 8,
        knockbackAngle: 50,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_MS,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_MS,
        hitboxWidth: 100,
        hitboxHeight: 80,
        hitboxOffsetX: 30,
        hitboxOffsetY: 0,
    },
    'heavy_side_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.SIDE,
        isAerial: true,
        damage: 7,
        baseKnockback: 280,
        knockbackGrowth: 9,
        knockbackAngle: 4, // Changed from 0 to 4
        startupDuration: PhysicsConfig.HEAVY_STARTUP_MS,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_MS,
        hitboxWidth: 110,
        hitboxHeight: 60,
        hitboxOffsetX: 40,
        hitboxOffsetY: 0,
    },
    'heavy_down_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.DOWN,
        isAerial: true,
        damage: PhysicsConfig.GROUND_POUND_DAMAGE,
        baseKnockback: 160,
        knockbackGrowth: 4,
        knockbackAngle: 270,
        startupDuration: PhysicsConfig.GROUND_POUND_STARTUP,
        activeDuration: 500,
        recoveryDuration: 150,
        hitboxWidth: 100,
        hitboxHeight: 90,
        hitboxOffsetX: 0,
        hitboxOffsetY: 40,
    },
    'heavy_up_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.UP,
        isAerial: true,
        damage: 8,
        baseKnockback: 145,
        knockbackGrowth: 3.6,
        knockbackAngle: 90,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_MS,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_MS,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_MS,
        hitboxWidth: 90,
        hitboxHeight: 70,
        hitboxOffsetX: 0,
        hitboxOffsetY: -40,
    },
};

/** Registry key for an attack, e.g. `light_side_aerial`. */
export function attackKey(type: AttackType, direction: AttackDirection, isAerial: boolean): string {
    return `${type}_${direction}_${isAerial ? 'aerial' : 'grounded'}`;
}
