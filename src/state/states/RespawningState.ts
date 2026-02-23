import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * RespawningState — Post-death invulnerability window.
 * Player is briefly invulnerable and cannot act.
 * Transitions to: Idle (after invulnerability expires)
 */
export class RespawningState implements IState {
    readonly name = 'Respawning';

    enter(player: Player): void {
        player.isRespawning = true;
    }

    update(player: Player, _delta: number, _input: InputState): void {
        // Invulnerability timer is handled by Fighter.updatePhysics()
        // When the respawn lock period ends, the scene sets isRespawning = false
        if (!player.isRespawning) {
            player.fsm.changeState('Idle', player);
            return;
        }
    }

    exit(player: Player): void {
        player.isRespawning = false;
    }

    getAnimationKey(_player: Player): string {
        return 'idle'; // Respawning looks like idle with invulnerability blinking
    }

    canBeInterrupted(): boolean {
        return false; // Cannot be hit during respawn invulnerability
    }
}
