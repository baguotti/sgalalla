/**
 * Gamepad Input System
 * Handles Xbox controller input with Brawlhalla-style button mapping
 * Also supports individual Nintendo Switch Joy-Cons held sideways via JoyConMapper.
 *
 * Brawlhalla Xbox Default Controls:
 * - A: Jump
 * - X: Light Attack
 * - B/Y: Heavy Attack
 * - LT/RT: Dodge
 * - Left Stick / D-pad: Movement
 */

import { isSingleJoyCon, getMovementAxes, getNormalizedButtons } from './JoyConMapper';

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
    taunt: boolean; // R3 button for taunt

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
            taunt: false,
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

        // ─── Single Joy-Con path (completely custom mapping) ───
        if (isSingleJoyCon(gamepad.id)) {
            return this.pollSingleJoyCon(gamepad, state);
        }

        // ─── Standard / Pro Controller path ───
        return this.pollStandardGamepad(gamepad, state);
    }

    /**
     * Custom polling for individual Joy-Cons held sideways.
     * Uses JoyConMapper for axis rotation and button remapping.
     */
    private pollSingleJoyCon(gamepad: Gamepad, state: GamepadState): GamepadState {
        const axes = getMovementAxes(gamepad);
        const btns = getNormalizedButtons(gamepad);

        // Movement (apply deadzone to the rotated axes)
        const stickX = this.applyDeadzone(axes.moveX);
        const stickY = this.applyDeadzone(axes.moveY);

        state.moveX = stickX;
        state.moveY = stickY;

        // Aiming
        state.aimUp = state.moveY < -0.5;
        state.aimDown = state.moveY > 0.5;
        state.aimLeft = state.moveX < -0.5;
        state.aimRight = state.moveX > 0.5;

        // Jump (top face button)
        state.jump = btns.jump && !this.previousState.jumpHeld;
        state.jumpHeld = btns.jump;

        // Light Attack (left face button)
        state.lightAttack = btns.lightAttack && !this.previousState.lightAttackHeld;
        state.lightAttackHeld = btns.lightAttack;

        // Heavy Attack (SR rail button)
        state.heavyAttack = btns.heavyAttack && !this.previousState.heavyAttackHeld;
        state.heavyAttackHeld = btns.heavyAttack;

        // Dodge (SL rail button)
        state.dodge = btns.dodge && !this.previousState.dodgeHeld;
        state.dodgeHeld = btns.dodge;

        // Pause
        state.pause = btns.pause && !this.previousState.pause;

        // Taunt (stick click)
        state.taunt = btns.taunt && !this.previousState.taunt;

        // Throw — map to light attack for Joy-Con (same button, context-dependent in game)
        state.throw = state.lightAttack;

        this.previousState = { ...state };
        this.cacheButtonStates(gamepad);

        return state;
    }

    /**
     * Standard polling for Xbox / Pro Controller / paired Joy-Cons.
     * Preserves the original A/B X/Y swap for Nintendo Switch Pro Controllers.
     */
    private pollStandardGamepad(gamepad: Gamepad, state: GamepadState): GamepadState {
        const isSwitchCtrl = gamepad.id.toLowerCase().includes('nintendo') ||
            gamepad.id.toLowerCase().includes('switch') ||
            gamepad.id.toLowerCase().includes('pro controller') ||
            gamepad.id.toLowerCase().includes('joy-con');

        // Check if it's an official controller (Xbox, PS, Switch)
        // If not, it's likely a generic USB dongle which often has inverted Y axes
        const isOfficialCtrl = isSwitchCtrl ||
            gamepad.id.toLowerCase().includes('xbox') ||
            gamepad.id.toLowerCase().includes('xinput') ||
            gamepad.id.toLowerCase().includes('playstation') ||
            gamepad.id.toLowerCase().includes('dualshock') ||
            gamepad.id.toLowerCase().includes('dualsense');

        const isGenericUSB = !isOfficialCtrl;

        // Left Stick (axes 0 and 1)
        const leftStickX = this.applyDeadzone(gamepad.axes[0] || 0);
        let leftStickY = this.applyDeadzone(gamepad.axes[1] || 0);

        if (isGenericUSB) {
            leftStickY = -leftStickY; // Invert Y axis for generic USB dongles
        }

        // D-pad (buttons 12-15)
        let dpadUp = gamepad.buttons[XBOX_BUTTONS.DPAD_UP]?.pressed || false;
        let dpadDown = gamepad.buttons[XBOX_BUTTONS.DPAD_DOWN]?.pressed || false;
        const dpadLeft = gamepad.buttons[XBOX_BUTTONS.DPAD_LEFT]?.pressed || false;
        const dpadRight = gamepad.buttons[XBOX_BUTTONS.DPAD_RIGHT]?.pressed || false;

        // Generic USB controllers may also have inverted D-pad Up/Down
        if (isGenericUSB) {
            const temp = dpadUp;
            dpadUp = dpadDown;
            dpadDown = temp;
        }

        // Combine stick and D-pad for movement
        state.moveX = leftStickX || (dpadLeft ? -1 : dpadRight ? 1 : 0);
        state.moveY = leftStickY || (dpadUp ? -1 : dpadDown ? 1 : 0);

        // Direction for aiming (used for directional attacks)
        state.aimUp = state.moveY < -0.5;
        state.aimDown = state.moveY > 0.5;
        state.aimLeft = state.moveX < -0.5;
        state.aimRight = state.moveX > 0.5;

        // Buttons - detect press (not held) for actions
        let aPressed = gamepad.buttons[XBOX_BUTTONS.A]?.pressed || false;
        let xPressed = gamepad.buttons[XBOX_BUTTONS.X]?.pressed || false;
        let bPressed = gamepad.buttons[XBOX_BUTTONS.B]?.pressed || false;
        let yPressed = gamepad.buttons[XBOX_BUTTONS.Y]?.pressed || false;

        // Remap for Nintendo Switch (Swap A/B and X/Y)
        if (isSwitchCtrl) {
            const tempA = aPressed;
            aPressed = bPressed;
            bPressed = tempA;

            const tempX = xPressed;
            xPressed = yPressed;
            yPressed = tempX;
        }

        // Triggers (value 0-1)
        const ltValue = gamepad.buttons[XBOX_BUTTONS.LT]?.value || 0;
        const rtValue = gamepad.buttons[XBOX_BUTTONS.RT]?.value || 0;
        const triggerPressed = ltValue > TRIGGER_THRESHOLD || rtValue > TRIGGER_THRESHOLD;

        // Jump - detect new press AND held state
        state.jump = aPressed && !this.previousState.jumpHeld;
        state.jumpHeld = aPressed;

        // Light Attack (X) - detect new press AND held state
        state.lightAttack = xPressed && !this.wasButtonPressed(XBOX_BUTTONS.X);
        state.lightAttackHeld = xPressed;

        // Heavy Attack (B or Y) - detect new press only
        const heavyNewPress = (bPressed && !this.wasButtonPressed(XBOX_BUTTONS.B)) ||
            (yPressed && !this.wasButtonPressed(XBOX_BUTTONS.Y));
        state.heavyAttack = heavyNewPress;
        state.heavyAttackHeld = bPressed || yPressed;

        // Dodge (LT or RT) - detect new press only
        state.dodge = triggerPressed && !this.wasTriggerPressed();
        state.dodgeHeld = triggerPressed;

        // Throw (Right Bumper/RB) - detect new press only
        const rbPressed = gamepad.buttons[XBOX_BUTTONS.RB]?.pressed || false;
        state.throw = rbPressed && !this.wasButtonPressed(XBOX_BUTTONS.RB);

        // Pause (START button) - detect new press only
        const startPressed = gamepad.buttons[XBOX_BUTTONS.START]?.pressed || false;
        state.pause = startPressed && !this.wasButtonPressed(XBOX_BUTTONS.START);

        // Taunt (Right Stick Click / R3) - detect new press only
        const r3Pressed = gamepad.buttons[XBOX_BUTTONS.R3]?.pressed || false;
        state.taunt = r3Pressed && !this.wasButtonPressed(XBOX_BUTTONS.R3);

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
