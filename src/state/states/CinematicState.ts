import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

export class CinematicState implements IState {
    readonly name = 'Cinematic';

    enter(player: Player): void {
        // Stop movement and reset animations
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.playAnim('idle', true);

        // Ensure hitboxes are cleared
        // Since disableAllHitboxes wasn't available, deactivateHitbox serves the identical purpose locally.
        (player.combat as any).deactivateHitbox();
    }

    update(player: Player, _delta: number, _input: InputState): void {
        // Purposely IGNORE all inputs (skip processing input buffer)
        // Allow external tweens to modify player.x and player.y directly.

        // Enforce grounded visual if cinematic requires it
        if (!player.isGrounded) {
            const gravity = player.scene.physics?.config?.gravity?.y ?? 1000;
            player.velocity.y += gravity * (_delta / 1000); // delta is in ms
        }
    }

    exit(_player: Player): void {
        // Cleanup when cutscene ends, usually transitioning to 'Idle'
    }

    getAnimationKey(player: Player): string {
        // External dialogue manager can override player.animationKey if doing a custom animation
        return player.animationKey || 'idle';
    }

    canBeInterrupted(): boolean {
        return false; // Cannot be interrupted by normal combat hits
    }
}
