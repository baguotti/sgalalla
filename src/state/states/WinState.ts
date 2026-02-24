import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * WinState — End-of-match freeze. Cannot be interrupted.
 */
export class WinState implements IState {
    readonly name = 'Win';

    enter(player: Player): void {
        player.isWinner = true;
    }

    update(_player: Player, _delta: number, _input: InputState): void {
        // Frozen — no transitions out
    }

    exit(player: Player): void {
        player.isWinner = false;
    }

    getAnimationKey(_player: Player): string {
        return 'win';
    }

    canBeInterrupted(): boolean {
        return false; // Cannot be interrupted by hitstun
    }
}
