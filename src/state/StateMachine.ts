import type { IState } from './IState';
import type { Player } from '../entities/Player';
import type { InputState } from '../input/InputManager';

/**
 * StateMachine — Manages player state transitions.
 *
 * The FSM is passive: it holds the current state and delegates
 * lifecycle calls. States themselves decide when to transition
 * by calling `player.fsm.changeState()`.
 *
 * Design choices:
 *   - `changeState()` always calls exit() → enter() (no self-transition guard)
 *   - Previous state name is tracked for transition-aware logic
 *   - States are registered by name and looked up from a Map
 */
export class StateMachine {
    private currentState: IState | null = null;
    private states: Map<string, IState> = new Map();
    private _previousStateName: string = '';

    /** Register a state. Call once per state during player init. */
    public register(state: IState): void {
        this.states.set(state.name, state);
    }

    /**
     * Transition to a new state.
     * Calls exit() on the old state and enter() on the new one.
     * Throws if the target state is not registered.
     */
    public changeState(name: string, player: Player): void {
        const next = this.states.get(name);
        if (!next) {
            console.warn(`[FSM] State "${name}" not registered. Available: ${Array.from(this.states.keys()).join(', ')}`);
            return;
        }

        if (this.currentState) {
            this._previousStateName = this.currentState.name;
            this.currentState.exit(player);
        }

        this.currentState = next;
        this.currentState.enter(player);
    }

    /** Delegate per-frame update to the current state. */
    public update(player: Player, delta: number, input: InputState): void {
        if (this.currentState) {
            this.currentState.update(player, delta, input);
        }
    }

    /** Get the current state's name (e.g. 'Idle', 'HitStun'). */
    public getCurrentStateName(): string {
        return this.currentState?.name ?? '';
    }

    /** Get the current state object (for animation key queries, etc). */
    public getCurrentState(): IState | null {
        return this.currentState;
    }

    /** Get the name of the state we transitioned FROM. */
    public getPreviousStateName(): string {
        return this._previousStateName;
    }

    /** Check if a state is registered. */
    public hasState(name: string): boolean {
        return this.states.has(name);
    }
}
