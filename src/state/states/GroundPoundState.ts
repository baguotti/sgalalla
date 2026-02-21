import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * GroundPoundState — Aerial down-heavy attack.
 * Holds position briefly (startup), then slams downward.
 * Transitions to: Idle (on landing), HitStun
 */
export class GroundPoundState implements IState {
    readonly name = 'GroundPound';

    enter(player: Player): void {
        player.combat.isGroundPounding = true;
        player.isAttacking = true;
        // Ground pound mechanics handled by PlayerCombat.startGroundPound()
    }

    update(player: Player, _delta: number, _input: InputState): void {
        if (player.isHitStunned) {
            player.fsm.changeState('HitStun', player);
            return;
        }

        // Ground pound ended (combat system cleared it on landing)
        if (!player.combat.isGroundPounding) {
            player.fsm.changeState('Idle', player);
            return;
        }
    }

    exit(player: Player): void {
        player.combat.isGroundPounding = false;
        player.isAttacking = false;
    }

    getAnimationKey(_player: Player): string {
        return 'ground_pound';
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
