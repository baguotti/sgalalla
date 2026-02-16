import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';

export interface Damageable {
    damagePercent: number;
    setKnockback(x: number, y: number): void;
    applyHitStun(): void;
    takeDamage(amount: number): void;
}

export class DamageSystem {
    /**
     * Calculate knockback based on damage percentage and attack strength
     */
    static calculateKnockback(
        baseDamage: number,
        baseKnockback: number, // Treated as FIXED FORCE
        knockbackGrowth: number, // Treated as VARIABLE FORCE
        currentDamage: number // Victim's accumulated damage
    ): number {
        // Brawlhalla-style Logic:
        // Force = Fixed Force + (Variable Force * Scaling Factor * (Damage + 10))

        // Our Adaptation:
        // KB = Base + (Growth * Scaling * (CurrentDamage + AttackDamage))

        const scaling = PhysicsConfig.GLOBAL_KNOCKBACK_SCALING; // Global scaling factor to map force to pixels/sec
        // Include attack damage in the scaling so strong moves scale harder
        const damageFactor = currentDamage + baseDamage;

        // Calculate Variable Component
        const variableForce = knockbackGrowth * scaling * damageFactor;

        // Total Knockback
        const totalKnockback = baseKnockback + variableForce;

        return totalKnockback;
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
        // Use method to allow overrides (e.g. for remote players)
        victim.takeDamage(damage);

        victim.setKnockback(knockbackVector.x, knockbackVector.y);
        victim.applyHitStun();
    }
}

