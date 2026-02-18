import Phaser from 'phaser';
import { GamepadInput } from './GamepadInput';
import type { GamepadState } from './GamepadInput';

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

    // Directional input for attacks
    aimUp: boolean;
    aimDown: boolean;
    aimLeft: boolean;
    aimRight: boolean;

    // Input source
    // Input source
    usingGamepad: boolean;
}

export interface PlayerInputConfig {
    playerId: number;
    useKeyboard: boolean;
    gamepadIndex: number | null; // null = no gamepad, or auto-detect if P1? For specific P2, usually 1.
    enableGamepad?: boolean; // Explicitly enable/disable gamepad support
}

export class InputManager {
    private scene: Phaser.Scene;
    private gamepadInput: GamepadInput;
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

    // Brawlhalla default keys
    private cKey!: Phaser.Input.Keyboard.Key; // Light attack
    private xKey!: Phaser.Input.Keyboard.Key; // Heavy attack
    private zKey!: Phaser.Input.Keyboard.Key; // Dodge
    private vKey!: Phaser.Input.Keyboard.Key; // Recovery

    // Track key states for single-press detection
    private jKeyWasPressed: boolean = false;
    private kKeyWasPressed: boolean = false;
    private lKeyWasPressed: boolean = false;
    private spaceWasPressed: boolean = false;
    private upArrowWasPressed: boolean = false; // For arrow-based jump
    private cKeyWasPressed: boolean = false;
    private xKeyWasPressed: boolean = false;
    private zKeyWasPressed: boolean = false;

    constructor(scene: Phaser.Scene, config: PlayerInputConfig = { playerId: 0, useKeyboard: true, gamepadIndex: null, enableGamepad: true }) {
        this.scene = scene;
        this.config = { ...config, enableGamepad: config.enableGamepad !== undefined ? config.enableGamepad : true };
        this.gamepadInput = new GamepadInput(config.gamepadIndex);

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

        // Brawlhalla defaults
        this.cKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C);
        this.xKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
        this.zKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
        this.vKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V);
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
        if (typeof document !== 'undefined' && !document.hasFocus()) {
            return this.getEmptyInput();
        }

        const keyboardEnabled = this.config.useKeyboard;
        const gamepadEnabled = this.config.enableGamepad;

        // STRICT ROUTING: Keyboard-only mode
        if (keyboardEnabled && !gamepadEnabled) {
            return this.pollKeyboard();
        }

        // STRICT ROUTING: Gamepad-only mode
        if (!keyboardEnabled && gamepadEnabled) {
            const gamepadState = this.gamepadInput.poll();
            if (gamepadState.connected) {
                return this.gamepadToInputState(gamepadState);
            }
            return this.getEmptyInput();
        }

        // MERGED MODE (both enabled - online mode)
        // Poll both and prefer gamepad if it has input
        const gamepadState = this.gamepadInput.poll();
        const keyboardState = this.pollKeyboard();

        const usingGamepad = gamepadState.connected && this.hasGamepadInput(gamepadState);

        if (usingGamepad) {
            return this.gamepadToInputState(gamepadState);
        } else {
            return keyboardState;
        }
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
            state.dodgeHeld
        );
    }

    private pollKeyboard(): InputState {
        // Safety check if setupKeyboard wasn't called or failed
        if (!this.cursors) return this.getEmptyInput();

        const left = this.cursors.left.isDown || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up = this.cursors.up.isDown || this.wasd.up.isDown;
        const down = this.cursors.down.isDown || this.wasd.down.isDown;

        const spaceDown = this.spaceKey.isDown;
        const upArrowDown = this.cursors.up.isDown;
        const jDown = this.jKey.isDown;
        const kDown = this.kKey.isDown;
        const lDown = this.lKey.isDown;
        const cDown = this.cKey.isDown;
        const xDown = this.xKey.isDown;
        const zDown = this.zKey.isDown;
        const vDown = this.vKey.isDown;
        const shiftDown = this.shiftKey.isDown;

        // Single press detection - support both control schemes
        const jumpPressed = (spaceDown && !this.spaceWasPressed) || (upArrowDown && !this.upArrowWasPressed);
        const lightPressed = (jDown && !this.jKeyWasPressed) || (cDown && !this.cKeyWasPressed);
        const heavyPressed = (kDown && !this.kKeyWasPressed) || (xDown && !this.xKeyWasPressed);
        const dodgePressed = (lDown && !this.lKeyWasPressed) || (zDown && !this.zKeyWasPressed);

        // Update previous states
        this.spaceWasPressed = spaceDown;
        this.upArrowWasPressed = upArrowDown;
        this.jKeyWasPressed = jDown;
        this.kKeyWasPressed = kDown;
        this.lKeyWasPressed = lDown;
        this.cKeyWasPressed = cDown;
        this.xKeyWasPressed = xDown;
        this.zKeyWasPressed = zDown;

        return {
            moveLeft: left,
            moveRight: right,
            moveUp: up,
            moveDown: down,
            moveX: left ? -1 : right ? 1 : 0,
            moveY: up ? -1 : down ? 1 : 0,
            jump: jumpPressed,
            jumpHeld: spaceDown || upArrowDown,
            lightAttack: lightPressed,
            lightAttackHeld: jDown || cDown, // Track light attack held
            heavyAttack: heavyPressed,
            heavyAttackHeld: kDown || xDown, // Track held state for charging
            dodge: dodgePressed,
            dodgeHeld: lDown || zDown, // Track dodge held for running
            recovery: shiftDown || vDown, // Support both Shift and V for recovery
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
