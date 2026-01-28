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
    usingGamepad: boolean;
}

export class InputManager {
    private scene: Phaser.Scene;
    private gamepadInput: GamepadInput;

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

    // Track key states for single-press detection
    private jKeyWasPressed: boolean = false;
    private kKeyWasPressed: boolean = false;
    private lKeyWasPressed: boolean = false;
    private spaceWasPressed: boolean = false;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.gamepadInput = new GamepadInput();
        this.setupKeyboard();
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
    }

    /**
     * Poll all inputs and return unified state
     * Call this once per frame
     */
    poll(): InputState {
        const gamepadState = this.gamepadInput.poll();
        const keyboardState = this.pollKeyboard();

        // If gamepad is connected and has input, prefer gamepad
        const usingGamepad = gamepadState.connected && this.hasGamepadInput(gamepadState);

        if (usingGamepad) {
            return this.gamepadToInputState(gamepadState);
        } else {
            return keyboardState;
        }
    }

    private hasGamepadInput(state: GamepadState): boolean {
        return (
            Math.abs(state.moveX) > 0.1 ||
            Math.abs(state.moveY) > 0.1 ||
            state.jump ||
            state.jumpHeld ||
            state.lightAttack ||
            state.heavyAttack ||
            state.dodge
        );
    }

    private pollKeyboard(): InputState {
        const left = this.cursors.left.isDown || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up = this.cursors.up.isDown || this.wasd.up.isDown;
        const down = this.cursors.down.isDown || this.wasd.down.isDown;

        const spaceDown = this.spaceKey.isDown;
        const jDown = this.jKey.isDown;
        const kDown = this.kKey.isDown;
        const lDown = this.lKey.isDown;

        // Single press detection
        const jumpPressed = spaceDown && !this.spaceWasPressed;
        const lightPressed = jDown && !this.jKeyWasPressed;
        const heavyPressed = kDown && !this.kKeyWasPressed;
        const dodgePressed = lDown && !this.lKeyWasPressed;

        // Update previous states
        this.spaceWasPressed = spaceDown;
        this.jKeyWasPressed = jDown;
        this.kKeyWasPressed = kDown;
        this.lKeyWasPressed = lDown;

        return {
            moveLeft: left,
            moveRight: right,
            moveUp: up,
            moveDown: down,
            moveX: left ? -1 : right ? 1 : 0,
            moveY: up ? -1 : down ? 1 : 0,
            jump: jumpPressed,
            jumpHeld: spaceDown,
            lightAttack: lightPressed,
            heavyAttack: heavyPressed,
            heavyAttackHeld: kDown, // Track held state for charging
            dodge: dodgePressed,
            dodgeHeld: lDown, // Track L key held for running
            recovery: this.shiftKey.isDown,
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
            heavyAttack: state.heavyAttack,
            heavyAttackHeld: state.heavyAttackHeld, // Track B/Y held for charging
            dodge: state.dodge,
            dodgeHeld: state.dodgeHeld, // Track LT/RT held for running
            recovery: state.heavyAttack && state.aimUp && !this.isGroundedCheck(), // Up + Heavy in air = recovery
            aimUp: state.aimUp,
            aimDown: state.aimDown,
            aimLeft: state.aimLeft,
            aimRight: state.aimRight,
            usingGamepad: true,
        };
    }

    // This is a placeholder - the actual grounded check happens in Player
    private isGroundedCheck(): boolean {
        return false;
    }

    isGamepadConnected(): boolean {
        return this.gamepadInput.isConnected();
    }

    getGamepadId(): string | null {
        return this.gamepadInput.getGamepadId();
    }
}
