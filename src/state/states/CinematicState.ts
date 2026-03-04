import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

export class CinematicState implements IState {
    readonly name = 'Cinematic';

    enter(player: Player): void {
        // Stop movement
        player.velocity.x = 0;
        player.velocity.y = 0;

        // Start cinematic in idle, but allow events to change player.animationKey later
        if (!player.animationKey) {
            player.animationKey = 'idle';
        }

        // Ensure hitboxes are cleared
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
        // Allow DialogueScene or tweens to set custom animationKeys (like 'taunt')
        // We do NOT append character prefixes here. The player's updateAnimation logic 
        // expects base keys ('idle', 'taunt') so we just return the currently requested key.
        return player.animationKey || 'idle';
    }

    canBeInterrupted(): boolean {
        return false; // Cannot be interrupted by normal combat hits
    }
}
