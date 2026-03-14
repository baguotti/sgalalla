import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * DefeatState — Plays the defeat animation while grounded and idle.
 * Transitions to: Idle (on any input, airborne, or hitstun)
 */
export class DefeatState implements IState {
    readonly name = 'Defeat';

    enter(player: Player): void {
        player.isShowingDefeat = true;
    }

    update(player: Player, _delta: number, input: InputState): void {
        if (player.isHitStunned) {
            player.fsm.changeState('HitStun', player);
            return;
        }

        // Cancel defeat on any action
        if (input.moveLeft || input.moveRight || input.jump ||
            input.lightAttack || input.heavyAttack || input.dodge ||
            !player.isGrounded) {
            player.fsm.changeState('Idle', player);
            return;
        }
    }

    exit(player: Player): void {
        player.isShowingDefeat = false;
    }

    getAnimationKey(_player: Player): string {
        return 'defeat'; 
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
