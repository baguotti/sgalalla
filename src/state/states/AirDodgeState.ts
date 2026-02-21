import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * AirDodgeState — Aerial dodge (directional or spot).
 * Timer-based exit to Fall.
 * Transitions to: Fall (timer end), Idle (if landed during dodge), HitStun
 */
export class AirDodgeState implements IState {
    readonly name = 'AirDodge';

    enter(player: Player): void {
        player.isDodging = true;
        // Actual dodge mechanics handled by PlayerPhysics.startDodge()
    }

    update(player: Player, _delta: number, _input: InputState): void {
        // Landed during air dodge
        if (player.isGrounded) {
            player.fsm.changeState('Idle', player);
            return;
        }

        // Dodge ended
        if (!player.isDodging) {
            player.fsm.changeState('Fall', player);
            return;
        }
    }

    exit(player: Player): void {
        player.isDodging = false;
    }

    getAnimationKey(player: Player): string {
        if (Math.abs(player.velocity.x) > 10) {
            return 'dash';
        }
        return 'spot_dodge';
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
