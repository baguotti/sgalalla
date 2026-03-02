import Phaser from 'phaser';
import { GamepadInput } from './GamepadInput';
import { KeyboardMapping } from './KeyboardMapping';
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
    gamepadIndex: number | null;
    enableGamepad?: boolean;
    keyboardMapping?: 'all'; // Kept for API compat, always 'all' now (no more split)
}

export class InputManager {
    private scene: Phaser.Scene;
    private gamepadInput: GamepadInput;
    private touchController?: TouchController;
    private config: PlayerInputConfig;

    // Raw key objects – set up dynamically from KeyboardMapping
    private keyMap: Map<string, Phaser.Input.Keyboard.Key> = new Map();

    // Track key states for single-press detection
    private prevStates: Map<string, boolean> = new Map();

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

        // Also register arrow keys for movement (always available alongside WASD remappable keys)
        const cursors = keyboard.createCursorKeys();
        this.keyMap.set('ArrowUp', cursors.up);
        this.keyMap.set('ArrowDown', cursors.down);
        this.keyMap.set('ArrowLeft', cursors.left);
        this.keyMap.set('ArrowRight', cursors.right);

        // Register all keys from the mapping
        this.rebuildKeyMap();
    }

    /** Rebuild Phaser key objects from current KeyboardMapping. Call after remap. */
    public rebuildKeyMap(): void {
        const keyboard = this.scene.input.keyboard;
        if (!keyboard) return;

        const mapping = KeyboardMapping.getInstance().getMapping();

        // Register each mapped key
        for (const [_action, code] of Object.entries(mapping)) {
            if (!this.keyMap.has(code)) {
                const phaserCode = this.codeToPhaserKey(code);
                if (phaserCode !== undefined) {
                    this.keyMap.set(code, keyboard.addKey(phaserCode, false));
                }
            }
        }
    }

    /** Convert a KeyboardEvent.code string to a Phaser KeyCodes number. */
    private codeToPhaserKey(code: string): number | undefined {
        // Letters: KeyA → A
        if (code.startsWith('Key')) {
            const letter = code.slice(3).toUpperCase();
            return (Phaser.Input.Keyboard.KeyCodes as any)[letter];
        }
        // Digits: Digit1 → ONE, etc.
        if (code.startsWith('Digit')) {
            const digitNames = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE'];
            const d = parseInt(code.slice(5));
            return (Phaser.Input.Keyboard.KeyCodes as any)[digitNames[d]];
        }
        // Common keys
        const MAP: Record<string, string> = {
            Space: 'SPACE',
            ShiftLeft: 'SHIFT',
            ShiftRight: 'SHIFT',
            ControlLeft: 'CTRL',
            ControlRight: 'CTRL',
            AltLeft: 'ALT',
            AltRight: 'ALT',
            Enter: 'ENTER',
            Backspace: 'BACKSPACE',
            Tab: 'TAB',
            CapsLock: 'CAPS_LOCK',
            ArrowUp: 'UP',
            ArrowDown: 'DOWN',
            ArrowLeft: 'LEFT',
            ArrowRight: 'RIGHT',
            Comma: 'COMMA',
            Period: 'PERIOD',
            Slash: 'FORWARD_SLASH',
            Semicolon: 'SEMICOLON',
            Quote: 'QUOTES',
            BracketLeft: 'OPEN_BRACKET',
            BracketRight: 'CLOSED_BRACKET',
            Backslash: 'BACK_SLASH',
            Minus: 'MINUS',
            Equal: 'PLUS',
        };
        const name = MAP[code];
        if (name) return (Phaser.Input.Keyboard.KeyCodes as any)[name];
        return undefined;
    }

    private isKeyDown(code: string): boolean {
        const key = this.keyMap.get(code);
        return key ? key.isDown : false;
    }

    private isJustPressed(code: string): boolean {
        const down = this.isKeyDown(code);
        const was = this.prevStates.get(code) || false;
        return down && !was;
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
        // FOCUS CHECK
        if (typeof document !== 'undefined' && !document.hasFocus() && !this.scene.sys.game.device.input.touch) {
            return this.getEmptyInput();
        }

        const keyboardEnabled = this.config.useKeyboard;
        const gamepadEnabled = this.config.enableGamepad;

        let baseState = this.getEmptyInput();

        const gamepadState = gamepadEnabled ? this.gamepadInput.poll() : null;
        const keyboardState = keyboardEnabled ? this.pollKeyboard() : this.getEmptyInput();
        const touchState = this.touchController ? this.touchController.getState() : null;

        const usingGamepad = gamepadState && gamepadState.connected && this.hasGamepadInput(gamepadState);

        if (usingGamepad) {
            baseState = this.gamepadToInputState(gamepadState);
        } else {
            baseState = keyboardState;
        }

        // Merge touch state if active
        if (touchState) {
            if (touchState.moveX !== 0) baseState.moveX = touchState.moveX as number;
            if (touchState.moveY !== 0) baseState.moveY = touchState.moveY as number;

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
            state.heavyAttackHeld ||
            state.dodge ||
            state.dodgeHeld ||
            state.taunt
        );
    }

    private pollKeyboard(): InputState {
        if (!this.keyMap.size) return this.getEmptyInput();

        const km = KeyboardMapping.getInstance();

        // Movement: mapped keys + always allow arrow keys
        const left = this.isKeyDown(km.getKeyForAction('moveLeft')) || this.isKeyDown('ArrowLeft');
        const right = this.isKeyDown(km.getKeyForAction('moveRight')) || this.isKeyDown('ArrowRight');
        const up = this.isKeyDown(km.getKeyForAction('moveUp')) || this.isKeyDown('ArrowUp');
        const down = this.isKeyDown(km.getKeyForAction('moveDown')) || this.isKeyDown('ArrowDown');

        // Action keys
        const jumpCode = km.getKeyForAction('jump');
        const lightCode = km.getKeyForAction('lightAttack');
        const heavyCode = km.getKeyForAction('heavyAttack');
        const dodgeCode = km.getKeyForAction('dodge');
        const tauntCode = km.getKeyForAction('taunt');
        const recoveryCode = km.getKeyForAction('recovery');

        const jumpDown = this.isKeyDown(jumpCode);
        const lightDown = this.isKeyDown(lightCode);
        const heavyDown = this.isKeyDown(heavyCode);
        const dodgeDown = this.isKeyDown(dodgeCode);
        const tauntDown = this.isKeyDown(tauntCode);
        const recoveryDown = this.isKeyDown(recoveryCode);

        // Single press detection
        const jumpPressed = this.isJustPressed(jumpCode);
        const lightPressed = this.isJustPressed(lightCode);
        const heavyPressed = this.isJustPressed(heavyCode);
        const dodgePressed = this.isJustPressed(dodgeCode);
        const tauntPressed = this.isJustPressed(tauntCode);

        // Update previous states for all action keys
        this.prevStates.set(jumpCode, jumpDown);
        this.prevStates.set(lightCode, lightDown);
        this.prevStates.set(heavyCode, heavyDown);
        this.prevStates.set(dodgeCode, dodgeDown);
        this.prevStates.set(tauntCode, tauntDown);

        return {
            moveLeft: left,
            moveRight: right,
            moveUp: up,
            moveDown: down,
            moveX: left ? -1 : right ? 1 : 0,
            moveY: up ? -1 : down ? 1 : 0,
            jump: jumpPressed,
            jumpHeld: jumpDown,
            lightAttack: lightPressed,
            lightAttackHeld: lightDown,
            heavyAttack: heavyPressed,
            heavyAttackHeld: heavyDown,
            dodge: dodgePressed,
            dodgeHeld: dodgeDown,
            recovery: recoveryDown,
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
            lightAttackHeld: state.lightAttackHeld,
            heavyAttack: state.heavyAttack,
            heavyAttackHeld: state.heavyAttackHeld,
            dodge: state.dodge,
            dodgeHeld: state.dodgeHeld,
            taunt: state.taunt,
            recovery: state.heavyAttack && state.aimUp,
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
