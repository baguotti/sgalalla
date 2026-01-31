import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';

export interface Damageable {
    damagePercent: number;
    setKnockback(x: number, y: number): void;
    applyHitStun(): void;
}

export class DamageSystem {
    /**
     * Calculate knockback based on damage percentage and attack strength
     */
    static calculateKnockback(
        _baseDamage: number,
        baseKnockback: number,
        currentDamage: number
    ): number {
        const knockbackMultiplier = 1 + currentDamage * PhysicsConfig.KNOCKBACK_SCALING;
        return baseKnockback * knockbackMultiplier;
    }

    /**
     * Calculate knockback vector based on attacker and victim positions
     */
    static calculateKnockbackVector(
        attackerX: number,
        attackerY: number,
        victimX: number,
        victimY: number,
        knockbackForce: number
    ): Phaser.Math.Vector2 {
        const dx = victimX - attackerX;
        const dy = victimY - attackerY;

        const length = Math.sqrt(dx * dx + dy * dy);
        const normalizedX = length > 0 ? dx / length : 1;
        const normalizedY = length > 0 ? dy / length : 0;

        // Removed upwardBias to allow pure horizontal knockback

        return new Phaser.Math.Vector2(
            normalizedX * knockbackForce,
            normalizedY * knockbackForce
        );
    }

    /**
     * Apply damage and knockback to a damageable target
     */
    static applyDamage(
        victim: Damageable,
        damage: number,
        knockbackVector: Phaser.Math.Vector2
    ): void {
        victim.damagePercent = Math.min(
            victim.damagePercent + damage,
            PhysicsConfig.MAX_DAMAGE
        );

        victim.setKnockback(knockbackVector.x, knockbackVector.y);
        victim.applyHitStun();
    }
}

