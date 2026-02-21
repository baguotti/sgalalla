import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * DodgeState — Grounded dodge (directional dash or spot dodge).
 * Timer-based — exits when dodgeTimer expires in PlayerPhysics.
 * Transitions to: Idle (timer end), HitStun (if somehow hit despite invincibility)
 */
export class DodgeState implements IState {
    readonly name = 'Dodge';

    enter(player: Player): void {
        player.isDodging = true;
        // Actual dodge mechanics (velocity, invincibility, spot vs dash)
        // are handled by PlayerPhysics.startDodge()
    }

    update(player: Player, _delta: number, _input: InputState): void {
        // Dodge end is detected when the physics system clears isDodging
        if (!player.isDodging) {
            player.fsm.changeState('Idle', player);
            return;
        }
    }

    exit(player: Player): void {
        // Ensure flag is cleared if exiting for another reason (e.g. hitstun)
        player.isDodging = false;
    }

    getAnimationKey(player: Player): string {
        // Dash if moving, spot dodge if still
        if (Math.abs(player.velocity.x) > 10) {
            return 'dash';
        }
        return 'spot_dodge';
    }

    canBeInterrupted(): boolean {
        return true; // Can be interrupted by hitstun
    }
}
