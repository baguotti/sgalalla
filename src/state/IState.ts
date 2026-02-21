import type { Player } from '../entities/Player';
import type { InputState } from '../input/InputManager';

/**
 * IState — Interface for all player states in the FSM.
 *
 * Each state owns its enter/exit lifecycle, per-frame update logic,
 * and the animation key it produces. States request transitions
 * by calling `player.fsm.changeState()`.
 */
export interface IState {
    /** Unique identifier for this state (e.g. 'Idle', 'Run', 'HitStun') */
    readonly name: string;

    /** Called once when entering this state */
    enter(player: Player): void;

    /** Called every frame while this state is active */
    update(player: Player, delta: number, input: InputState): void;

    /** Called once when leaving this state */
    exit(player: Player): void;

    /** Returns the animation key this state should play */
    getAnimationKey(player: Player): string;

    /** Can this state be interrupted by hitstun? (almost always true) */
    canBeInterrupted(): boolean;
}
