import type { IState } from '../IState';
import type { Player } from '../../entities/Player';
import type { InputState } from '../../input/InputManager';

/**
 * HitStunState — Player is damaged and frozen.
 * All inputs are disabled. Timer-based exit.
 * Transitions to: Idle (grounded), Fall (airborne) — when hitStunTimer expires
 */
export class HitStunState implements IState {
    readonly name = 'HitStun';

    enter(player: Player): void {
        // The actual hitstun application (flag set, timer start, visual flash)
        // is handled by Fighter.applyHitStun() / Player.applyHitStun()
        // This state just represents "being in hitstun".

        // Clear combat state on hitstun entry
        player.isAttacking = false;
        player.isDodging = false;
        if (player.combat) {
            player.combat.isGroundPounding = false;
            player.combat.currentAttack = null;
            player.combat.deactivateHitbox();
            player.combat.clearChargeState();
        }
        player.resetVisuals();
        player.flashDamageColor(player.damagePercent);
    }

    update(player: Player, _delta: number, _input: InputState): void {
        // HitStun timer is decremented in Fighter.updatePhysics()
        // When it expires, isHitStunned becomes false → we exit
        if (!player.isHitStunned) {
            if (player.isGrounded) {
                player.fsm.changeState('Idle', player);
            } else {
                player.fsm.changeState('Fall', player);
            }
        }
    }

    exit(_player: Player): void {
        // Nothing to clean up — Fighter already cleared isHitStunned
    }

    getAnimationKey(_player: Player): string {
        return 'hurt';
    }

    canBeInterrupted(): boolean {
        return false; // Cannot be interrupted by another hitstun while already stunned
    }
}
