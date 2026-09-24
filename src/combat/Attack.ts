import { AttackRegistry, AttackPhase, attackKey } from '../../shared/AttackData';
import type { AttackData, AttackType, AttackDirection } from '../../shared/AttackData';

export { AttackType, AttackDirection, AttackPhase } from '../../shared/AttackData';
export type { AttackData } from '../../shared/AttackData';

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
        return attackKey(type, direction, isAerial);
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
