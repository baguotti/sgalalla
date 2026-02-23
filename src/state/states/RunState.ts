import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * RunState — Grounded horizontal movement.
 * Transitions to: Idle, Jump, Fall, RunAttack, Dodge, HitStun
 */
export class RunState implements IState {
    readonly name = 'Run';

    enter(player: Player): void {
        player.physics.isRunning = true;
    }

    update(player: Player, _delta: number, input: InputState): void {
        if (player.isHitStunned) {
            player.fsm.changeState('HitStun', player);
            return;
        }

        if (!player.isGrounded) {
            player.fsm.changeState('Fall', player);
            return;
        }

        // Dodge
        if (player.inputBuffer.has('dodge') && player.physics.dodgeCooldownTimer <= 0) {
            player.fsm.changeState('Dodge', player);
            return;
        }

        // Jump
        if (player.inputBuffer.has('jump')) {
            player.fsm.changeState('Jump', player);
            return;
        }

        // Combat inputs handled externally by PlayerCombat

        // Stop → Idle
        const isMoving = input.moveLeft || input.moveRight;
        if (!isMoving) {
            player.fsm.changeState('Idle', player);
            return;
        }
    }

    exit(player: Player): void {
        player.physics.isRunning = false;
    }

    getAnimationKey(_player: Player): string {
        return 'run';
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
