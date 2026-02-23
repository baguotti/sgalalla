import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * WallSlideState — Sliding down a wall.
 * Transitions to: WallJump (Jump), Fall (detach), Idle (land), HitStun
 */
export class WallSlideState implements IState {
    readonly name = 'WallSlide';

    enter(_player: Player): void {
        // Wall slide velocity damping is handled by PlayerPhysics
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

        // Detached from wall
        if (!player.physics.isWallSliding) {
            player.fsm.changeState('Fall', player);
            return;
        }

        // Wall jump is handled by PlayerPhysics when jump buffer is consumed
        // After the wall jump impulse, isWallSliding becomes false → transitions to Fall/Jump
    }

    exit(_player: Player): void {
        // Nothing to clean up
    }

    getAnimationKey(_player: Player): string {
        return 'wall_slide';
    }

    canBeInterrupted(): boolean {
        return true;
    }
}
