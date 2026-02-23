import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * JumpState — Ascending phase of a jump.
 * Transitions to: Fall, AirAttack, AirDodge, Recovery, GroundPound, HitStun
 */
export class JumpState implements IState {
    readonly name = 'Jump';

    enter(_player: Player): void {
        // The actual jump impulse is applied by PlayerPhysics.performJump()
        // which is called from the physics system when it consumes the jump buffer.
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

        // Transition to fall when velocity goes downward
        if (player.velocity.y > 0) {
            player.fsm.changeState('Fall', player);
            return;
        }

        // Air dodge
        if (player.inputBuffer.has('dodge') && player.physics.dodgeCooldownTimer <= 0) {
            player.fsm.changeState('AirDodge', player);
            return;
        }

        // Double jump (handled by physics — it consumes the jump buffer)
        // Combat inputs handled by PlayerCombat
    }

    exit(_player: Player): void {
        // Nothing to clean up
    }

    getAnimationKey(_player: Player): string {
        return 'jump';
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
