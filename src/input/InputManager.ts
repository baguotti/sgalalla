import Phaser from 'phaser';
import { GamepadInput } from './GamepadInput';
import type { GamepadState } from './GamepadInput';
import type { TouchController } from '../components/TouchController';

/**
 * Unified Input State
 * Combines keyboard and gamepad input into a single interface
 */
export interface InputState {
    // Movement
    moveLeft: boolean;
    moveRight: boolean;
    moveUp: boolean;
    moveDown: boolean;
    moveX: number; // -1 to 1 for analog input
    moveY: number; // -1 to 1 for analog input

    // Actions (single press detection)
    jump: boolean;
    jumpHeld: boolean;
    lightAttack: boolean;
    lightAttackHeld: boolean; // For charge throws
    heavyAttack: boolean;
    heavyAttackHeld: boolean; // For charge attacks
    dodge: boolean;
    dodgeHeld: boolean; // For running (dodge key held)
    recovery: boolean;
    taunt: boolean; // Taunt / Win Animation

    // Directional input for attacks
    aimUp: boolean;
    aimDown: boolean;
    aimLeft: boolean;
    aimRight: boolean;

    // Input source
    usingGamepad: boolean;
}

export interface PlayerInputConfig {
    playerId: number;
    useKeyboard: boolean;
    gamepadIndex: number | null; // null = no gamepad, or auto-detect if P1? For specific P2, usually 1.
    enableGamepad?: boolean; // Explicitly enable/disable gamepad support
    keyboardMapping?: 'wasd' | 'arrows' | 'all'; // For split keyboard local multiplayer
}

export class InputManager {
    private scene: Phaser.Scene;
    private gamepadInput: GamepadInput;
    private touchController?: TouchController;
    private config: PlayerInputConfig;

    // Keyboard keys
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private wasd!: {
        up: Phaser.Input.Keyboard.Key;
        left: Phaser.Input.Keyboard.Key;
        down: Phaser.Input.Keyboard.Key;
        right: Phaser.Input.Keyboard.Key;
    };
    private spaceKey!: Phaser.Input.Keyboard.Key;
    private shiftKey!: Phaser.Input.Keyboard.Key;
    private jKey!: Phaser.Input.Keyboard.Key;
    private kKey!: Phaser.Input.Keyboard.Key;
    private lKey!: Phaser.Input.Keyboard.Key;
    private pKey!: Phaser.Input.Keyboard.Key;

    // Arrow keys actions (P2)
    private cKey!: Phaser.Input.Keyboard.Key; // Light attack
    private vKey!: Phaser.Input.Keyboard.Key; // Heavy attack
    private bKey!: Phaser.Input.Keyboard.Key; // Dodge
    private gKey!: Phaser.Input.Keyboard.Key; // Jump
    private mKey!: Phaser.Input.Keyboard.Key; // Taunt

    // Track key states for single-press detection
    private jKeyWasPressed: boolean = false;
    private kKeyWasPressed: boolean = false;
    private lKeyWasPressed: boolean = false;
    private spaceWasPressed: boolean = false;

    private pKeyWasPressed: boolean = false;
    private mKeyWasPressed: boolean = false;

    private gKeyWasPressed: boolean = false;
    private cKeyWasPressed: boolean = false;
    private vKeyWasPressed: boolean = false;
    private bKeyWasPressed: boolean = false;

    constructor(scene: Phaser.Scene, config: PlayerInputConfig = { playerId: 0, useKeyboard: true, gamepadIndex: null, enableGamepad: true, keyboardMapping: 'all' }, touchController?: TouchController) {
        this.scene = scene;
        this.config = { ...config, enableGamepad: config.enableGamepad !== undefined ? config.enableGamepad : true };
        this.gamepadInput = new GamepadInput(config.gamepadIndex);
        this.touchController = touchController;

        if (this.config.useKeyboard) {
            this.setupKeyboard();
        }
    }

    private setupKeyboard(): void {
        const keyboard = this.scene.input.keyboard;
        if (!keyboard) return;

        this.cursors = keyboard.createCursorKeys();
        this.wasd = {
            up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
        };
        this.spaceKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.shiftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
        this.jKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
        this.kKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.K);
        this.lKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
        this.pKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P); // Taunt P1

        // Arrow actions (P2)
        this.cKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
        this.vKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V);
        this.bKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.B);
        this.gKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G); // Jump P2
        this.mKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M); // Taunt P2
    }

    /**
     * Poll all inputs and return unified state
     * Call this once per frame
     * 
     * STRICT ROUTING:
     * - If useKeyboard=true && enableGamepad=false: keyboard-only
     * - If useKeyboard=false && enableGamepad=true: gamepad-only
     * - If both enabled: merge (online mode - first connected device wins)
     */
    poll(): InputState {
        // FOCUS CHECK: Only process inputs if the window has focus
        // This prevents inactive tabs from controlling the character in local testing (multiple tabs)
        // Note: Touch devices might not reliably report document.hasFocus(), but we'll leave it for desktop
        if (typeof document !== 'undefined' && !document.hasFocus() && !this.scene.sys.game.device.input.touch) {
            return this.getEmptyInput();
        }

        const keyboardEnabled = this.config.useKeyboard;
        const gamepadEnabled = this.config.enableGamepad;

        let baseState = this.getEmptyInput();

        // MERGED MODE (both enabled - online mode or active checking)
        // Poll all available inputs
        const gamepadState = gamepadEnabled ? this.gamepadInput.poll() : null;
        const keyboardState = keyboardEnabled ? this.pollKeyboard() : this.getEmptyInput();
        const touchState = this.touchController ? this.touchController.getState() : null;

        const usingGamepad = gamepadState && gamepadState.connected && this.hasGamepadInput(gamepadState);

        if (usingGamepad) {
            baseState = this.gamepadToInputState(gamepadState);
        } else {
            baseState = keyboardState;
        }

        // Merge touch state if active. Touch state overrides other inputs if it exists and has active input.
        if (touchState) {
            // Because TouchController returns Partial<InputState>, we need to merge it carefully
            // only for properties that are true or non-zero.
            // A simple OR merge works for booleans and taking the touch value for axes if non-zero.

            // Axes
            if (touchState.moveX !== 0) baseState.moveX = touchState.moveX as number;
            if (touchState.moveY !== 0) baseState.moveY = touchState.moveY as number;

            // Booleans
            baseState.moveLeft = baseState.moveLeft || (touchState.moveLeft as boolean);
            baseState.moveRight = baseState.moveRight || (touchState.moveRight as boolean);
            baseState.moveUp = baseState.moveUp || (touchState.moveUp as boolean);
            baseState.moveDown = baseState.moveDown || (touchState.moveDown as boolean);

            baseState.jump = baseState.jump || (touchState.jump as boolean);
            baseState.jumpHeld = baseState.jumpHeld || (touchState.jumpHeld as boolean);

            baseState.lightAttack = baseState.lightAttack || (touchState.lightAttack as boolean);
            baseState.lightAttackHeld = baseState.lightAttackHeld || (touchState.lightAttackHeld as boolean);

            baseState.heavyAttack = baseState.heavyAttack || (touchState.heavyAttack as boolean);
            baseState.heavyAttackHeld = baseState.heavyAttackHeld || (touchState.heavyAttackHeld as boolean);

            baseState.dodge = baseState.dodge || (touchState.dodge as boolean);
            baseState.dodgeHeld = baseState.dodgeHeld || (touchState.dodgeHeld as boolean);

            baseState.recovery = baseState.recovery || (touchState.recovery as boolean);
            baseState.taunt = baseState.taunt || (touchState.taunt as boolean);

            baseState.aimUp = baseState.aimUp || (touchState.aimUp as boolean);
            baseState.aimDown = baseState.aimDown || (touchState.aimDown as boolean);
            baseState.aimLeft = baseState.aimLeft || (touchState.aimLeft as boolean);
            baseState.aimRight = baseState.aimRight || (touchState.aimRight as boolean);

            // Assuming if we use touch, it's not a gamepad purely (or maybe we say it is to show controller prompts?)
            // We'll leave usingGamepad as whatever it was, or false.
        }

        return baseState;
    }

    public getEmptyInput(): InputState {
        return {
            moveLeft: false,
            moveRight: false,
            moveUp: false,
            moveDown: false,
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
            recovery: false,
            taunt: false,
            aimUp: false,
            aimDown: false,
            aimLeft: false,
            aimRight: false,
            usingGamepad: false,
        };
    }

    private hasGamepadInput(state: GamepadState): boolean {
        return (
            Math.abs(state.moveX) > 0.1 ||
            Math.abs(state.moveY) > 0.1 ||
            state.jump ||
            state.jumpHeld ||
            state.lightAttack ||
            state.heavyAttack ||
            state.heavyAttackHeld || // Important: Check held state to prevent fallback to keyboard while charging
            state.dodge ||
            state.dodgeHeld ||
            state.taunt
        );
    }

    private pollKeyboard(): InputState {
        // Safety check if setupKeyboard wasn't called or failed
        if (!this.cursors) return this.getEmptyInput();

        const mapping = this.config.keyboardMapping || 'all';
        const useAll = mapping === 'all';
        const useWasd = mapping === 'wasd' || useAll;
        const useArrows = mapping === 'arrows' || useAll;

        const left = (useArrows && this.cursors.left.isDown) || (useWasd && this.wasd.left.isDown);
        const right = (useArrows && this.cursors.right.isDown) || (useWasd && this.wasd.right.isDown);
        const up = (useArrows && this.cursors.up.isDown) || (useWasd && this.wasd.up.isDown);
        const down = (useArrows && this.cursors.down.isDown) || (useWasd && this.wasd.down.isDown);

        // WASD map (J/K/L/Space/P)
        const spaceDown = useWasd && this.spaceKey.isDown;
        const jDown = useWasd && this.jKey.isDown;
        const kDown = useWasd && this.kKey.isDown;
        const lDown = useWasd && this.lKey.isDown;
        const pDown = useWasd && this.pKey.isDown;
        const shiftDown = useWasd && this.shiftKey.isDown;

        // Arrows map (C / V / B / G / M)
        const gDown = useArrows && this.gKey.isDown;
        const cDown = useArrows && this.cKey.isDown;
        const vDown = useArrows && this.vKey.isDown;
        const bDown = useArrows && this.bKey.isDown;
        const mDown = useArrows && this.mKey.isDown;

        // Single press detection - support both control schemes
        const jumpPressed = (spaceDown && !this.spaceWasPressed) || (gDown && !this.gKeyWasPressed);
        const lightPressed = (jDown && !this.jKeyWasPressed) || (cDown && !this.cKeyWasPressed);
        const heavyPressed = (kDown && !this.kKeyWasPressed) || (vDown && !this.vKeyWasPressed);
        const dodgePressed = (lDown && !this.lKeyWasPressed) || (bDown && !this.bKeyWasPressed);
        const tauntPressed = (pDown && !this.pKeyWasPressed) || (mDown && !this.mKeyWasPressed);

        // Update previous states
        this.spaceWasPressed = spaceDown;
        this.jKeyWasPressed = jDown;
        this.kKeyWasPressed = kDown;
        this.lKeyWasPressed = lDown;
        this.pKeyWasPressed = pDown;

        this.gKeyWasPressed = gDown;
        this.cKeyWasPressed = cDown;
        this.vKeyWasPressed = vDown;
        this.bKeyWasPressed = bDown;
        this.mKeyWasPressed = mDown;

        return {
            moveLeft: left,
            moveRight: right,
            moveUp: up,
            moveDown: down,
            moveX: left ? -1 : right ? 1 : 0,
            moveY: up ? -1 : down ? 1 : 0,
            jump: jumpPressed,
            jumpHeld: spaceDown || gDown,
            lightAttack: lightPressed,
            lightAttackHeld: jDown || cDown, // Track light attack held
            heavyAttack: heavyPressed,
            heavyAttackHeld: kDown || vDown, // Track held state for charging
            dodge: dodgePressed,
            dodgeHeld: lDown || bDown, // Track dodge held for running
            recovery: shiftDown, // Focus on shift for recovery on P1
            taunt: tauntPressed,
            aimUp: up,
            aimDown: down,
            aimLeft: left,
            aimRight: right,
            usingGamepad: false,
        };
    }

    private gamepadToInputState(state: GamepadState): InputState {
        return {
            moveLeft: state.moveX < -0.3,
            moveRight: state.moveX > 0.3,
            moveUp: state.moveY < -0.3,
            moveDown: state.moveY > 0.3,
            moveX: state.moveX,
            moveY: state.moveY,
            jump: state.jump,
            jumpHeld: state.jumpHeld,
            lightAttack: state.lightAttack,
            lightAttackHeld: state.lightAttackHeld, // Sync light attack held
            heavyAttack: state.heavyAttack,
            heavyAttackHeld: state.heavyAttackHeld, // Track B held for charging
            dodge: state.dodge,
            dodgeHeld: state.dodgeHeld, // Track LT/RT held for running
            taunt: state.taunt,
            recovery: state.heavyAttack && state.aimUp, // Map Up+Heavy to recovery signal. Logic handled by Player.
            aimUp: state.aimUp,
            aimDown: state.aimDown,
            aimLeft: state.aimLeft,
            aimRight: state.aimRight,
            usingGamepad: true,
        };
    }

    isGamepadConnected(): boolean {
        return this.gamepadInput.isConnected();
    }

    getGamepadId(): string | null {
        return this.gamepadInput.getGamepadId();
    }

    destroy(): void {
        this.gamepadInput.destroy();
    }
}
