import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * FallState — Descending / airborne with no upward velocity.
 * Transitions to: Idle (on land), WallSlide, AirDodge, AirAttack, Recovery, HitStun
 */
export class FallState implements IState {
    readonly name = 'Fall';

    enter(_player: Player): void {
        // Nothing special
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

        // Wall slide
        if (player.physics.isWallSliding) {
            player.fsm.changeState('WallSlide', player);
            return;
        }

        // Air dodge
        if (player.inputBuffer.has('dodge') && player.physics.dodgeCooldownTimer <= 0) {
            player.fsm.changeState('AirDodge', player);
            return;
        }

        // Combat inputs handled by PlayerCombat
    }

    exit(_player: Player): void {
        // Nothing to clean up
    }

    getAnimationKey(_player: Player): string {
        return 'fall';
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
