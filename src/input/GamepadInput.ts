/**
 * Gamepad Input System
 * Handles Xbox controller input with Brawlhalla-style button mapping
 *
 * Brawlhalla Xbox Default Controls:
 * - A: Jump
 * - X: Light Attack
 * - B/Y: Heavy Attack
 * - LT/RT: Dodge
 * - Left Stick / D-pad: Movement
 */

export interface GamepadState {
    // Movement (-1 to 1)
    moveX: number;
    moveY: number;

    // Buttons (true = pressed this frame, not held)
    jump: boolean;
    jumpHeld: boolean;
    lightAttack: boolean;
    lightAttackHeld: boolean; // For charge throws
    heavyAttack: boolean;
    heavyAttackHeld: boolean; // For charge attacks
    dodge: boolean;
    dodgeHeld: boolean; // For running (trigger held)
    throw: boolean;
    pause: boolean; // START button for pause menu

    // Direction for attacks
    aimUp: boolean;
    aimDown: boolean;
    aimLeft: boolean;
    aimRight: boolean;

    // Connection state
    connected: boolean;
}

// Xbox controller button indices (standard mapping)
const XBOX_BUTTONS = {
    A: 0,      // Jump
    B: 1,      // Heavy Attack
    X: 2,      // Light Attack
    Y: 3,      // Throw/Pickup
    LB: 4,     // Left Bumper
    RB: 5,     // Right Bumper
    LT: 6,     // Left Trigger (Dodge)
    RT: 7,     // Right Trigger (Dodge)
    BACK: 8,
    START: 9,
    L3: 10,    // Left Stick Click
    R3: 11,    // Right Stick Click
    DPAD_UP: 12,
    DPAD_DOWN: 13,
    DPAD_LEFT: 14,
    DPAD_RIGHT: 15,
} as const;

// Dead zone for analog sticks
const STICK_DEADZONE = 0.2;
const TRIGGER_THRESHOLD = 0.5;

export class GamepadInput {
    private previousState: GamepadState;
    private gamepadIndex: number | null = null;

    private gamepadConnectedListener: (e: GamepadEvent) => void;
    private gamepadDisconnectedListener: (e: GamepadEvent) => void;

    constructor(targetIndex: number | null = null) {
        this.previousState = this.createEmptyState();

        // If a specific index is requested, set it immediately
        if (targetIndex !== null) {
            this.gamepadIndex = targetIndex;
        }

        // Define listeners
        this.gamepadConnectedListener = (e: GamepadEvent) => {
            // If we are looking for a specific index, ignore others
            if (targetIndex !== null) {
                if (e.gamepad.index === targetIndex) {
                    this.gamepadIndex = targetIndex;
                }
                return;
            }

            // Legacy behavior: grab first available
            if (this.gamepadIndex === null) {
                this.gamepadIndex = e.gamepad.index;
            }
        };

        this.gamepadDisconnectedListener = (e: GamepadEvent) => {
            if (this.gamepadIndex === e.gamepad.index) {
                if (targetIndex === null) {
                    this.gamepadIndex = null;
                }
            }
        };

        // Add listeners
        window.addEventListener('gamepadconnected', this.gamepadConnectedListener);
        window.addEventListener('gamepaddisconnected', this.gamepadDisconnectedListener);

        // Check for already-connected gamepads
        const gamepads = navigator.getGamepads();
        if (targetIndex !== null) {
            if (gamepads[targetIndex]) {
                this.gamepadIndex = targetIndex;
            }
        } else {
            for (let i = 0; i < gamepads.length; i++) {
                if (gamepads[i]) {
                    this.gamepadIndex = i;
                    break;
                }
            }
        }
    }

    public destroy(): void {
        window.removeEventListener('gamepadconnected', this.gamepadConnectedListener);
        window.removeEventListener('gamepaddisconnected', this.gamepadDisconnectedListener);
    }

    public createEmptyState(): GamepadState {
        return {
            moveX: 0,
            moveY: 0,
            jump: false,
            jumpHeld: false,
            lightAttack: false,
            lightAttackHeld: false,
            heavyAttack: false,
            heavyAttackHeld: false,
            dodge: false,
            dodgeHeld: false,
            throw: false,
            pause: false,
            aimUp: false,
            aimDown: false,
            aimLeft: false,
            aimRight: false,
            connected: false,
        };
    }

    /**
     * Poll the gamepad and return the current state
     * Call this once per frame
     */
    poll(): GamepadState {
        const state = this.createEmptyState();

        if (this.gamepadIndex === null) {
            this.previousState = state;
            return state;
        }

        const gamepads = navigator.getGamepads();
        const gamepad = gamepads[this.gamepadIndex];

        if (!gamepad) {
            this.previousState = state;
            return state;
        }

        state.connected = true;

        // Left Stick (axes 0 and 1)
        const leftStickX = this.applyDeadzone(gamepad.axes[0] || 0);
        const leftStickY = this.applyDeadzone(gamepad.axes[1] || 0);

        // D-pad (buttons 12-15)
        const dpadUp = gamepad.buttons[XBOX_BUTTONS.DPAD_UP]?.pressed || false;
        const dpadDown = gamepad.buttons[XBOX_BUTTONS.DPAD_DOWN]?.pressed || false;
        const dpadLeft = gamepad.buttons[XBOX_BUTTONS.DPAD_LEFT]?.pressed || false;
        const dpadRight = gamepad.buttons[XBOX_BUTTONS.DPAD_RIGHT]?.pressed || false;

        // Combine stick and D-pad for movement
        state.moveX = leftStickX || (dpadLeft ? -1 : dpadRight ? 1 : 0);
        state.moveY = leftStickY || (dpadUp ? -1 : dpadDown ? 1 : 0);

        // Direction for aiming (used for directional attacks)
        state.aimUp = state.moveY < -0.5;
        state.aimDown = state.moveY > 0.5;
        state.aimLeft = state.moveX < -0.5;
        state.aimRight = state.moveX > 0.5;

        // Buttons - detect press (not held) for actions
        const aPressed = gamepad.buttons[XBOX_BUTTONS.A]?.pressed || false;
        const xPressed = gamepad.buttons[XBOX_BUTTONS.X]?.pressed || false;
        const bPressed = gamepad.buttons[XBOX_BUTTONS.B]?.pressed || false;
        const yPressed = gamepad.buttons[XBOX_BUTTONS.Y]?.pressed || false;

        // Triggers (value 0-1)
        const ltValue = gamepad.buttons[XBOX_BUTTONS.LT]?.value || 0;
        const rtValue = gamepad.buttons[XBOX_BUTTONS.RT]?.value || 0;
        const triggerPressed = ltValue > TRIGGER_THRESHOLD || rtValue > TRIGGER_THRESHOLD;

        // Jump - detect new press AND held state
        state.jump = aPressed && !this.previousState.jumpHeld;
        state.jumpHeld = aPressed;

        // Light Attack (X) - detect new press AND held state
        state.lightAttack = xPressed && !this.wasButtonPressed(XBOX_BUTTONS.X);
        state.lightAttackHeld = xPressed; // Added held state support

        // Heavy Attack (B or Y) - detect new press only
        // User wants Y and B to be exactly the same: Heavy Attack
        const heavyNewPress = (bPressed && !this.wasButtonPressed(XBOX_BUTTONS.B)) ||
            (yPressed && !this.wasButtonPressed(XBOX_BUTTONS.Y));
        state.heavyAttack = heavyNewPress;
        state.heavyAttackHeld = bPressed || yPressed;

        // Dodge (LT or RT) - detect new press only
        state.dodge = triggerPressed && !this.wasTriggerPressed();
        state.dodgeHeld = triggerPressed; // Track held state for running

        // Throw (Right Bumper/RB) - detect new press only
        const rbPressed = gamepad.buttons[XBOX_BUTTONS.RB]?.pressed || false;
        state.throw = rbPressed && !this.wasButtonPressed(XBOX_BUTTONS.RB);

        // Pause (START button) - detect new press only
        const startPressed = gamepad.buttons[XBOX_BUTTONS.START]?.pressed || false;
        state.pause = startPressed && !this.wasButtonPressed(XBOX_BUTTONS.START);

        this.previousState = { ...state };
        this.cacheButtonStates(gamepad);

        return state;
    }

    private applyDeadzone(value: number): number {
        if (Math.abs(value) < STICK_DEADZONE) {
            return 0;
        }
        // Remap the value outside deadzone to 0-1 range
        const sign = Math.sign(value);
        const magnitude = Math.abs(value);
        return sign * ((magnitude - STICK_DEADZONE) / (1 - STICK_DEADZONE));
    }

    // Cache for detecting button releases
    private buttonCache: boolean[] = [];
    private triggerCache: boolean = false;

    private cacheButtonStates(gamepad: Gamepad): void {
        this.buttonCache = gamepad.buttons.map(b => b.pressed);
        const ltValue = gamepad.buttons[XBOX_BUTTONS.LT]?.value || 0;
        const rtValue = gamepad.buttons[XBOX_BUTTONS.RT]?.value || 0;
        this.triggerCache = ltValue > TRIGGER_THRESHOLD || rtValue > TRIGGER_THRESHOLD;
    }

    private wasButtonPressed(buttonIndex: number): boolean {
        return this.buttonCache[buttonIndex] || false;
    }

    private wasTriggerPressed(): boolean {
        return this.triggerCache;
    }

    isConnected(): boolean {
        return this.gamepadIndex !== null;
    }

    getGamepadId(): string | null {
        if (this.gamepadIndex === null) return null;
        const gamepads = navigator.getGamepads();
        return gamepads[this.gamepadIndex]?.id || null;
    }
}
