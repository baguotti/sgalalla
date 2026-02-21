import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * RecoveryState — Up-B style recovery move.
 * Player launches upward with a hitbox. Timer-based.
 * Transitions to: Fall (recovery end), Idle (landed), HitStun
 */
export class RecoveryState implements IState {
    readonly name = 'Recovery';

    enter(_player: Player): void {
        // Actual recovery impulse and ghost spawning handled by
        // PlayerPhysics.startRecovery()
    }

    update(player: Player, _delta: number, _input: InputState): void {
        if (player.isHitStunned) {
            player.fsm.changeState('HitStun', player);
            return;
        }

        // Landed
        if (player.isGrounded) {
            player.fsm.changeState('Idle', player);
            return;
        }

        // Recovery ended (timer expired in physics)
        if (!player.physics.isRecovering) {
            player.fsm.changeState('Fall', player);
            return;
        }
    }

    exit(_player: Player): void {
        // Recovery cleanup handled by PlayerPhysics
    }

    getAnimationKey(_player: Player): string {
        return 'recovery';
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
