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
    knockback: number;
    knockbackAngle: number; // Angle in degrees (0 = right, 90 = up)
    startupDuration: number;
    activeDuration: number;
    recoveryDuration: number;
    hitboxWidth: number;
    hitboxHeight: number;
    hitboxOffsetX: number;
    hitboxOffsetY: number;
}

// Attack data definitions for all attack types
export const AttackRegistry: Record<string, AttackData> = {
    // ========== GROUNDED LIGHT ATTACKS ==========
    'light_neutral_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.NEUTRAL,
        isAerial: false,
        damage: 5,
        knockback: 250,
        knockbackAngle: 45, // Up and forward
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
        hitboxWidth: 50,
        hitboxHeight: 40,
        hitboxOffsetX: 35,
        hitboxOffsetY: 0,
    },
    'light_side_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.SIDE,
        isAerial: false,
        damage: 6,
        knockback: 300,
        knockbackAngle: 30, // More horizontal
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
        hitboxWidth: 70,
        hitboxHeight: 35,
        hitboxOffsetX: 45,
        hitboxOffsetY: 0,
    },
    'light_down_grounded': {
        type: AttackType.LIGHT,
        direction: AttackDirection.DOWN,
        isAerial: false,
        damage: 7,
        knockback: 280,
        knockbackAngle: 80, // Almost straight up (launcher)
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES + 30,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES + 50,
        hitboxWidth: 60,
        hitboxHeight: 30,
        hitboxOffsetX: 30,
        hitboxOffsetY: 20,
    },

    // ========== AERIAL LIGHT ATTACKS ==========
    'light_neutral_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.NEUTRAL,
        isAerial: true,
        damage: 5,
        knockback: 220,
        knockbackAngle: 45,
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES + 30, // Slightly longer active in air
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
        hitboxWidth: 55,
        hitboxHeight: 55, // More circular hitbox
        hitboxOffsetX: 30,
        hitboxOffsetY: 0,
    },
    'light_side_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.SIDE,
        isAerial: true,
        damage: 6,
        knockback: 280,
        knockbackAngle: 20, // Very horizontal - good for edge guarding
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
        hitboxWidth: 65,
        hitboxHeight: 40,
        hitboxOffsetX: 40,
        hitboxOffsetY: 0,
    },
    'light_down_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.DOWN,
        isAerial: true,
        damage: 8,
        knockback: 350,
        knockbackAngle: 270, // Spike! Straight down
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES + 50,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES + 80,
        hitboxWidth: 45,
        hitboxHeight: 50,
        hitboxOffsetX: 0,
        hitboxOffsetY: 45,
    },
    'light_up_aerial': {
        type: AttackType.LIGHT,
        direction: AttackDirection.UP,
        isAerial: true,
        damage: 6,
        knockback: 300,
        knockbackAngle: 90, // Straight up
        startupDuration: PhysicsConfig.LIGHT_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.LIGHT_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.LIGHT_RECOVERY_FRAMES,
        hitboxWidth: 50,
        hitboxHeight: 50,
        hitboxOffsetX: 0,
        hitboxOffsetY: -45,
    },

    // ========== GROUNDED HEAVY ATTACKS ==========
    'heavy_neutral_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.NEUTRAL,
        isAerial: false,
        damage: 12,
        knockback: 500,
        knockbackAngle: 45,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES,
        hitboxWidth: 70,
        hitboxHeight: 50,
        hitboxOffsetX: 45,
        hitboxOffsetY: 0,
    },
    'heavy_side_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.SIDE,
        isAerial: false,
        damage: 14,
        knockback: 600,
        knockbackAngle: 25,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES + 50,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES + 100,
        hitboxWidth: 90,
        hitboxHeight: 45,
        hitboxOffsetX: 55,
        hitboxOffsetY: 0,
    },
    'heavy_down_grounded': {
        type: AttackType.HEAVY,
        direction: AttackDirection.DOWN,
        isAerial: false,
        damage: 15,
        knockback: 550,
        knockbackAngle: 85,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES + 30,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES + 80,
        hitboxWidth: 80,
        hitboxHeight: 40,
        hitboxOffsetX: 40,
        hitboxOffsetY: 25,
    },

    // ========== AERIAL HEAVY ATTACKS ==========
    'heavy_neutral_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.NEUTRAL,
        isAerial: true,
        damage: 11,
        knockback: 450,
        knockbackAngle: 50,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES,
        hitboxWidth: 65,
        hitboxHeight: 65,
        hitboxOffsetX: 35,
        hitboxOffsetY: 0,
    },
    'heavy_side_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.SIDE,
        isAerial: true,
        damage: 13,
        knockback: 550,
        knockbackAngle: 15,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES,
        hitboxWidth: 80,
        hitboxHeight: 50,
        hitboxOffsetX: 50,
        hitboxOffsetY: 0,
    },
    'heavy_down_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.DOWN,
        isAerial: true,
        damage: PhysicsConfig.GROUND_POUND_DAMAGE,
        knockback: PhysicsConfig.GROUND_POUND_KNOCKBACK,
        knockbackAngle: 45, // Diagonal knockback (ground pound sends up-diagonal)
        startupDuration: PhysicsConfig.GROUND_POUND_STARTUP,
        activeDuration: 500, // Active until landing
        recoveryDuration: 150,
        hitboxWidth: 50,
        hitboxHeight: 60,
        hitboxOffsetX: 0,
        hitboxOffsetY: 40,
    },
    'heavy_up_aerial': {
        type: AttackType.HEAVY,
        direction: AttackDirection.UP,
        isAerial: true,
        damage: 12,
        knockback: 500,
        knockbackAngle: 90,
        startupDuration: PhysicsConfig.HEAVY_STARTUP_FRAMES,
        activeDuration: PhysicsConfig.HEAVY_ACTIVE_FRAMES,
        recoveryDuration: PhysicsConfig.HEAVY_RECOVERY_FRAMES,
        hitboxWidth: 60,
        hitboxHeight: 60,
        hitboxOffsetX: 0,
        hitboxOffsetY: -50,
    },
};

export class Attack {
    data: AttackData;
    phase: AttackPhase = AttackPhase.NONE;
    phaseTimer: number = 0;
    facingDirection: number = 1; // 1 = right, -1 = left
    chargePercent: number = 0; // 0-1 charge level

    constructor(attackKey: string, facingDirection: number = 1, chargePercent: number = 0) {
        const data = AttackRegistry[attackKey];
        if (!data) {
            throw new Error(`Unknown attack: ${attackKey}`);
        }

        // Apply charge multipliers if charged
        if (chargePercent > 0 && data.type === AttackType.HEAVY) {
            // Calculate multipliers based on charge (linear interpolation from 1.0 to max)
            const damageMult = 1 + chargePercent * (PhysicsConfig.CHARGE_DAMAGE_MULT - 1);
            const knockbackMult = 1 + chargePercent * (PhysicsConfig.CHARGE_KNOCKBACK_MULT - 1);

            // Create a modified copy of the attack data
            this.data = {
                ...data,
                damage: Math.round(data.damage * damageMult),
                knockback: Math.round(data.knockback * knockbackMult),
            };
        } else {
            this.data = data;
        }

        this.facingDirection = facingDirection;
        this.chargePercent = chargePercent;
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

        switch (this.phase) {
            case AttackPhase.STARTUP:
                if (this.phaseTimer >= this.data.startupDuration) {
                    this.phase = AttackPhase.ACTIVE;
                    this.phaseTimer = 0;
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
