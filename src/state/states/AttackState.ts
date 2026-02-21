import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';
import { AttackType, AttackDirection } from '../../combat/Attack';

/**
 * AttackState — All attack variants (light/heavy/run/air).
 * The specific animation is determined from the current attack data.
 * Transitions to: Idle/Fall (on attack end), HitStun
 */
export class AttackState implements IState {
    readonly name = 'Attack';

    enter(player: Player): void {
        player.isAttacking = true;
    }

    update(player: Player, _delta: number, _input: InputState): void {
        if (player.isHitStunned) {
            player.fsm.changeState('HitStun', player);
            return;
        }

        // Attack lifecycle is managed by PlayerCombat.updateAttackState()
        // When the attack ends, PlayerCombat.endAttack() will call fsm.changeState()
        // For now, this state just holds the "attacking" flag.

        // If the attack was cleared externally (e.g. endAttack was called),
        // transition out:
        if (!player.isAttacking) {
            if (player.isGrounded) {
                player.fsm.changeState('Idle', player);
            } else {
                player.fsm.changeState('Fall', player);
            }
        }
    }

    exit(player: Player): void {
        player.isAttacking = false;
    }

    getAnimationKey(player: Player): string {
        const currentAttack = player.getCurrentAttack();
        if (!currentAttack) return 'attack_light_neutral';

        if (currentAttack.data.type === AttackType.HEAVY) {
            switch (currentAttack.data.direction) {
                case AttackDirection.DOWN: return 'attack_heavy_down';
                case AttackDirection.SIDE: return 'attack_heavy_side';
                case AttackDirection.UP: return 'attack_heavy_up';
                default: return 'attack_heavy_neutral';
            }
        }

        // Light attacks
        switch (currentAttack.data.direction) {
            case AttackDirection.RUN: return 'attack_light_run';
            case AttackDirection.UP:
                return player.isGrounded ? 'attack_light_up' : 'attack_light_up_air';
            case AttackDirection.DOWN: return 'attack_light_down';
            case AttackDirection.SIDE:
                return player.isGrounded ? 'attack_light_side' : 'attack_light_side_air';
            default: return 'attack_light_neutral';
        }
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
