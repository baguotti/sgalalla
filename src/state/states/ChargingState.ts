import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * ChargingState — Heavy attack charge hold.
 * Player is locked in place charging up a heavy attack.
 * Transitions to: Attack (on button release → executeChargedAttack), HitStun
 */
export class ChargingState implements IState {
    readonly name = 'Charging';

    enter(_player: Player): void {
        // Charge initiation is handled by PlayerCombat.handleInput()
        // which sets isCharging and plays the sound
    }

    update(player: Player, _delta: number, _input: InputState): void {
        if (player.isHitStunned) {
            player.fsm.changeState('HitStun', player);
            return;
        }

        // Charge update and release detection is handled by
        // PlayerCombat.handleInput() → executeChargedAttack()
        // which transitions to Attack state.

        // Safety: if charging was cleared externally, go back to idle
        if (!player.combat.isCharging) {
            if (player.isGrounded) {
                player.fsm.changeState('Idle', player);
            } else {
                player.fsm.changeState('Fall', player);
            }
        }
    }

    exit(_player: Player): void {
        // Charge cleanup is handled by PlayerCombat.clearChargeState()
    }

    getAnimationKey(_player: Player): string {
        return 'charging';
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
