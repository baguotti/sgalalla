import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * IdleState — Grounded, no movement.
 * Transitions to: Run, Jump, LightAttack, Charging, Dodge, Taunt, Fall, HitStun
 */
export class IdleState implements IState {
    readonly name = 'Idle';

    enter(_player: Player): void {
        // Nothing special — just stop any residual state
    }

    update(player: Player, _delta: number, input: InputState): void {
        // HitStun override (handled globally, but defensive check)
        if (player.isHitStunned) {
            player.fsm.changeState('HitStun', player);
            return;
        }

        // Fell off edge?
        if (!player.isGrounded) {
            player.fsm.changeState('Fall', player);
            return;
        }

        // Taunt
        if (input.taunt) {
            player.fsm.changeState('Taunt', player);
            return;
        }

        // Dodge (buffered)
        if (player.inputBuffer.has('dodge') && player.physics.dodgeCooldownTimer <= 0) {
            player.fsm.changeState('Dodge', player);
            return;
        }

        // Jump (buffered)
        if (player.inputBuffer.has('jump')) {
            player.fsm.changeState('Jump', player);
            return;
        }

        // Combat inputs handled by PlayerCombat (attacks, charge, etc.)
        // The combat system will call fsm.changeState('Attack'/etc) internally

        // Movement → Run
        if (input.moveLeft || input.moveRight) {
            player.fsm.changeState('Run', player);
            return;
        }
    }

    exit(_player: Player): void {
        // Nothing to clean up
    }

    getAnimationKey(_player: Player): string {
        return 'idle';
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
