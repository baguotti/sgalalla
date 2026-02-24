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
        if (player.isGrounded) {
            const isMoving = _input.moveLeft || _input.moveRight;
            player.fsm.changeState(isMoving ? 'Run' : 'Idle', player);
            return;
        }

        // Dodge ended
        if (!player.isDodging) {
            player.fsm.changeState('Fall', player);
            return;
        }
    }

    exit(_player: Player): void {
        // Let PlayerPhysics clear isDodging when the timer expires.
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
