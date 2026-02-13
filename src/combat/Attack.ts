import { PhysicsConfig } from '../config/PhysicsConfig';

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
    knockback: number; // DEPRECATED: Used as fallback/reference for legacy
    baseKnockback?: number; // Fixed Force (Base Impact)
    knockbackGrowth?: number; // Variable Force (Scaling)
    knockbackAngle: number; // Angle in degrees (0 = right, 90 = up)
    startupDuration: number;
    activeDuration: number;
    recoveryDuration: number;
    hitboxWidth: number;
    hitboxHeight: number;
    hitboxOffsetX: number;
    hitboxOffsetY: number;
    isMultiHit?: boolean; // If true, can hit multiple times
    hitInterval?: number; // Time between hits in ms (for multi-hit)
    shouldStallInAir?: boolean; // If true, apply gravity dampening
}

// Attack data definitions for all attack types
export const AttackRegistry: Record<string, AttackData> = {
    // ========== GROUNDED LIGHT ATTACKS ==========
    'light_neutral_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.NEUTRAL,
        isAerial: false,
        damage: 6, // Base damage tripled (Flurry)
        knockback: 90,
        baseKnockback: 120,
        knockbackGrowth: 3,
        knockbackAngle: 90,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: 400,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
        hitboxWidth: 40,
        hitboxHeight: 40,
        hitboxOffsetX: 35,
        hitboxOffsetY: 0,
        isMultiHit: true,
        hitInterval: 100,
    },
    'light_side_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.SIDE,
        isAerial: false,
        damage: 4,
        knockback: 500,
        baseKnockback: 250,
        knockbackGrowth: 7, // Reduced from 9
        knockbackAngle: 270,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
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
        knockback: 470,
        baseKnockback: 180,
        knockbackGrowth: 5, // Slightly less than side light
        knockbackAngle: 30, // Changed from 80 (Now sends forward like side light)
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES + 30,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES + 50,
        hitboxWidth: 99, // Wider for slide (was 90)
        hitboxHeight: 25, // Flatter (was 30)
        hitboxOffsetX: 30,
        hitboxOffsetY: 65, // Lower to feet (was 35)
    },
    'light_run_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.RUN,
        isAerial: false,
        damage: 4,
        knockback: 470,
        baseKnockback: 180,
        knockbackGrowth: 5,
        knockbackAngle: 30, // Drift/Slide physics from Down Light
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES + 30,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES + 50,
        // Hitbox covers attacker body + punch reach
        hitboxWidth: 150, // Extended to include body (was 120)
        hitboxHeight: 70,
        hitboxOffsetX: 0, // Starts at player center (was 60)
        hitboxOffsetY: 0,
    },
    'light_up_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.UP,
        isAerial: false,
        damage: 6, // Base damage tripled (Flurry)
        knockback: 90,
        baseKnockback: 120,
        knockbackGrowth: 3,
        knockbackAngle: 90,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: 400,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
        hitboxWidth: 40,
        hitboxHeight: 40,
        hitboxOffsetX: 35,
        hitboxOffsetY: 0,
        isMultiHit: true,
        hitInterval: 100,
    },

    // ========== AERIAL LIGHT ATTACKS ==========
    'light_neutral_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.NEUTRAL,
        isAerial: true,
        damage: 6, // Base damage tripled (Flurry)
        knockback: 90, // Flurry
        baseKnockback: 120,
        knockbackGrowth: 3,
        knockbackAngle: 90,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: 400, // Flurry
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
        hitboxWidth: 40,
        hitboxHeight: 40,
        hitboxOffsetX: 30,
        hitboxOffsetY: 0,
        isMultiHit: true,
        hitInterval: 100,
        shouldStallInAir: true,
    },
    'light_side_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.SIDE,
        isAerial: true,
        damage: 5,
        knockback: 430,
        baseKnockback: 180,
        knockbackGrowth: 4,
        knockbackAngle: 20,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
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
        knockback: 500,
        baseKnockback: 200,
        knockbackGrowth: 6, // Spike strength
        knockbackAngle: 270,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES + 50,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES + 80,
        hitboxWidth: 99, // Cloned from Down Light
        hitboxHeight: 25,
        hitboxOffsetX: 30,
        hitboxOffsetY: 65,
    },
    'light_up_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.UP,
        isAerial: true,
        damage: 5,
        knockback: 430,
        baseKnockback: 180,
        knockbackGrowth: 4,
        knockbackAngle: 20, // Same as side air
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
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
        knockback: 600,
        baseKnockback: 250, // Heavy Base
        knockbackGrowth: 8, // Reduced from 10
        knockbackAngle: 80,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES,
        hitboxWidth: 80,
        hitboxHeight: 90,
        hitboxOffsetX: 20,
        hitboxOffsetY: -40,
    },
    'heavy_side_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.SIDE,
        isAerial: false,
        damage: 8,
        knockback: 800,
        baseKnockback: 300,
        knockbackGrowth: 9.5, // Reduced from 12
        knockbackAngle: 4, // Changed from 5 to 4
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES + 50,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES + 100,
        hitboxWidth: 100,
        hitboxHeight: 70,
        hitboxOffsetX: 0,
        hitboxOffsetY: 0,
    },
    'heavy_down_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.DOWN,
        isAerial: false,
        damage: 8,
        knockback: 600,
        baseKnockback: 145, // Reduced from 220
        knockbackGrowth: 3.6, // Reduced from 5.5
        knockbackAngle: 85,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES + 30,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES + 80,
        hitboxWidth: 100,
        hitboxHeight: 60,
        hitboxOffsetX: 40,
        hitboxOffsetY: 25,
    },

    'heavy_up_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.UP,
        isAerial: false,
        damage: 6,
        knockback: 580,
        baseKnockback: 145, // Reduced from 220
        knockbackGrowth: 3.6, // Reduced from 5.5
        knockbackAngle: 80,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES,
        hitboxWidth: 80,
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
        knockback: 550,
        baseKnockback: 240,
        knockbackGrowth: 8, // Reduced from 10
        knockbackAngle: 50,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES,
        hitboxWidth: 80,
        hitboxHeight: 80,
        hitboxOffsetX: 30,
        hitboxOffsetY: 0,
    },
    'heavy_side_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.SIDE,
        isAerial: true,
        damage: 7,
        knockback: 800,
        baseKnockback: 280,
        knockbackGrowth: 9, // Reduced from 11
        knockbackAngle: 4, // Changed from 0 to 4
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES,
        hitboxWidth: 90,
        hitboxHeight: 60,
        hitboxOffsetX: 40,
        hitboxOffsetY: 0,
    },
    'heavy_down_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.DOWN,
        isAerial: true,
        damage: PhysicsConfig.GROUND_POUND_DAMAGE,
        knockback: PhysicsConfig.GROUND_POUND_KNOCKBACK,
        baseKnockback: 160, // Reduced from 250
        knockbackGrowth: 4, // Reduced from 6
        knockbackAngle: 270,
        startupDuration: PhysicsConfig.GROUND_POUND_STARTUP,
        activeDuration: 500,
        recoveryDuration: 150,
        hitboxWidth: 80,
        hitboxHeight: 90,
        hitboxOffsetX: 0,
        hitboxOffsetY: 40,
    },
    'heavy_up_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.UP,
        isAerial: true,
        damage: 8,
        knockback: 600,
        baseKnockback: 145, // Reduced from 220
        knockbackGrowth: 3.6, // Reduced from 5.5
        knockbackAngle: 90,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES,
        hitboxWidth: 70,
        hitboxHeight: 70,
        hitboxOffsetX: 0,
        hitboxOffsetY: -40,
    },
};

export class Attack {
    public data: AttackData;
    public phase: AttackPhase = AttackPhase.NONE;
    public phaseTimer: number = 0; // Restored
    public timer: number = 0;
    public hasHit: boolean = false;
    public facingDirection: number;
    public hitsRegistered: number = 0;
    public nextHitTimer: number = 0; // For multi-hit attacks

    constructor(key: string, facing: number) {
        const data = AttackRegistry[key];
        if (!data) {
            throw new Error(`Attack ${key} not found`);
        }

        // Clone data to avoid mutating registry
        this.data = { ...data };
        this.facingDirection = facing;

        this.phase = AttackPhase.STARTUP;
        this.phaseTimer = 0;
    }

    /**
     * Get the attack key based on input state
     */
    static getAttackKey(
        type: AttackType,
        direction: AttackDirection,
        isAerial: boolean
    ): string {
        return `${type}_${direction}_${isAerial ? 'aerial' : 'grounded'}`;
    }

    /**
     * Update attack phase, returns true when attack is complete
     */
    update(deltaMs: number): boolean {
        this.phaseTimer += deltaMs;

        // Handle multi-hit reset timer
        if (this.phase === AttackPhase.ACTIVE && this.data.isMultiHit && this.data.hitInterval) {
            this.nextHitTimer += deltaMs;
            // The actual reset is handled by the consumer (PlayerCombat) querying shouldResetHits()
        }

        switch (this.phase) {
            case AttackPhase.STARTUP:
                if (this.phaseTimer >= this.data.startupDuration) {
                    this.phase = AttackPhase.ACTIVE;
                    this.phaseTimer = 0;
                    this.nextHitTimer = this.data.hitInterval || 0; // Trigger first hit immediately? No, hitTargets is cleared on start.
                    // Actually, hitTargets is cleared at start of attack.
                    // We need to clear it AGAIN after hitInterval.
                    this.nextHitTimer = 0;
                }
                break;
            case AttackPhase.ACTIVE:
                if (this.phaseTimer >= this.data.activeDuration) {
                    this.phase = AttackPhase.RECOVERY;
                    this.phaseTimer = 0;
                }
                break;
            case AttackPhase.RECOVERY:
                if (this.phaseTimer >= this.data.recoveryDuration) {
                    this.phase = AttackPhase.NONE;
                    return true; // Attack complete
                }
                break;
        }
        return false;
    }

    /**
     * Check if hits should be reset for multi-hit attacks
     */
    shouldResetHits(): boolean {
        if (this.phase !== AttackPhase.ACTIVE || !this.data.isMultiHit || !this.data.hitInterval) {
            return false;
        }

        if (this.nextHitTimer >= this.data.hitInterval) {
            this.nextHitTimer = 0;
            return true;
        }
        return false;
    }

    /**
     * Check if hitbox should be active
     */
    isHitboxActive(): boolean {
        return this.phase === AttackPhase.ACTIVE;
    }

    /**
     * Get hitbox position relative to player center
     */
    getHitboxOffset(): { x: number; y: number } {
        return {
            x: this.data.hitboxOffsetX * this.facingDirection,
            y: this.data.hitboxOffsetY,
        };
    }

    /**
     * Get total duration of the attack
     */
    getTotalDuration(): number {
        return this.data.startupDuration + this.data.activeDuration + this.data.recoveryDuration;
    }
}
