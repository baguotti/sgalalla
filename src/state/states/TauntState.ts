import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * TauntState — Plays the win/taunt animation while grounded and idle.
 * Transitions to: Idle (on any input, airborne, or hitstun)
 */
export class TauntState implements IState {
    readonly name = 'Taunt';

    enter(player: Player): void {
        player.isTaunting = true;
    }

    update(player: Player, _delta: number, input: InputState): void {
        if (player.isHitStunned) {
            player.fsm.changeState('HitStun', player);
            return;
        }

        // Cancel taunt on any action
        if (input.moveLeft || input.moveRight || input.jump ||
            input.lightAttack || input.heavyAttack || input.dodge ||
            !player.isGrounded) {
            player.fsm.changeState('Idle', player);
            return;
        }
    }

    exit(player: Player): void {
        player.isTaunting = false;
    }

    getAnimationKey(_player: Player): string {
        return 'win'; // Taunt reuses win animation
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
