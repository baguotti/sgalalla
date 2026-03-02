import Phaser from 'phaser';
import type { InputState } from '../input/InputManager';

export class TouchController {
    private scene: Phaser.Scene;
    private container: Phaser.GameObjects.Container;
    private uiCamera: Phaser.Cameras.Scene2D.Camera | null = null;

    // State
    private active: boolean = false;
    private state: Partial<InputState> = {
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
        taunt: false,
        recovery: false,
        aimUp: false,
        aimDown: false,
        aimLeft: false,
        aimRight: false
    };

    // Tracking for single press detection
    private jumpWasPressed: boolean = false;
    private lightWasPressed: boolean = false;
    private heavyWasPressed: boolean = false;
    private dodgeWasPressed: boolean = false;
    private tauntWasPressed: boolean = false;

    // UI Elements
    private joystickBase!: Phaser.GameObjects.Arc;
    private joystickKnob!: Phaser.GameObjects.Arc;

    // Joystick state
    private joystickPointer: Phaser.Input.Pointer | null = null;
    private joystickBaseX: number = 150;
    private joystickBaseY: number = 0; // Set in init
    private joystickRadius: number = 80;
    private deadzone: number = 0.2;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.container = this.scene.add.container(0, 0);
        this.container.setDepth(1000); // On top of everything
        this.container.setScrollFactor(0);

        // Disable initially until touch is detected or explicitly enabled
        this.setVisible(false);

        // Listen for ANY touch to enable the controller
        if (this.scene.sys.game.device.input.touch) {
            this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
                if (!this.active && pointer.wasTouch) {
                    this.enable();
                }
            });
            // Ensure enough active pointers for multi-touch (joystick + buttons)
            this.scene.input.addPointer(2); // Adds more pointers if needed (default is usually 2)
        }
    }

    private enable(): void {
        if (this.active) return;
        this.active = true;
        this.createUI();
        this.setVisible(true);
    }

    private createUI(): void {
        const { width, height } = this.scene.scale;

        // --- Joystick (Bottom Left) ---
        this.joystickBaseY = height - 150;
        this.joystickBase = this.scene.add.circle(this.joystickBaseX, this.joystickBaseY, this.joystickRadius, 0x000000, 0.3);
        this.joystickBase.setStrokeStyle(4, 0xffffff, 0.5);
        this.joystickBase.setInteractive();

        this.joystickKnob = this.scene.add.circle(this.joystickBaseX, this.joystickBaseY, 40, 0xffffff, 0.8);

        // Setup Joystick Interaction
        this.joystickBase.on('pointerdown', this.onJoystickDown, this);
        this.scene.input.on('pointermove', this.onJoystickMove, this);
        this.scene.input.on('pointerup', this.onJoystickUp, this);
        // Sometimes pointers leave the screen
        this.scene.input.on('pointerout', this.onJoystickUp, this);

        this.container.add([this.joystickBase, this.joystickKnob]);

        // --- Action Buttons (Bottom Right) ---
        const btnRadius = 45;
        const btnSpacing = 110;
        const baseX = width - 250;
        const baseY = height - 150;

        // A diamond layout for buttons
        // Jump (Bottom)
        this.createButton(baseX, baseY + btnSpacing * 0.5, btnRadius, 'A', 'jumpHeld', 0x4361EE);
        // Light Attack (Left)
        this.createButton(baseX - btnSpacing, baseY, btnRadius, 'X', 'lightAttackHeld', 0xE63946);
        // Heavy Attack (Right)
        this.createButton(baseX + btnSpacing, baseY, btnRadius, 'B', 'heavyAttackHeld', 0x06D6A0);
        // Dodge (Top)
        this.createButton(baseX, baseY - btnSpacing * 0.8, btnRadius, 'Y', 'dodgeHeld', 0xFF9F1C);

        // Taunt (Smaller, top right)
        this.createButton(width - 80, height - 300, 30, 'T', 'taunt', 0x888888);

        // Map UI to ignore camera if set
        if (this.uiCamera) {
            this.uiCamera.ignore(this.scene.children.list.filter(c => c !== this.container && !this.container.exists(c)));
        }
    }

    private createButton(x: number, y: number, radius: number, text: string, stateKey: keyof typeof this.state, color: number): void {
        const btn = this.scene.add.circle(x, y, radius, color, 0.6);
        btn.setStrokeStyle(3, 0xffffff, 0.8);
        btn.setInteractive();

        const label = this.scene.add.text(x, y, text, {
            fontSize: `${radius}px`,
            fontFamily: '"Pixeloid Sans"',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        btn.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.wasTouch) return;
            this.state[stateKey] = true as never;
            btn.setAlpha(0.9);
            btn.setScale(0.9);
        });

        const release = () => {
            // Need to check if this pointer was the one pressing it, but for simplicity, 
            // if we get a pointer up on the button, we release it.
            this.state[stateKey] = false as never;
            btn.setAlpha(0.6);
            btn.setScale(1);
        };

        btn.on('pointerup', release);
        btn.on('pointerout', release);

        this.container.add([btn, label]);
    }

    private onJoystickDown(pointer: Phaser.Input.Pointer): void {
        if (!pointer.wasTouch) return;
        this.joystickPointer = pointer;
        this.updateJoystickPosition(pointer);
    }

    private onJoystickMove(pointer: Phaser.Input.Pointer): void {
        if (this.joystickPointer === pointer) {
            this.updateJoystickPosition(pointer);
        }
    }

    private onJoystickUp(pointer: Phaser.Input.Pointer): void {
        if (this.joystickPointer === pointer) {
            this.joystickPointer = null;
            this.joystickKnob.setPosition(this.joystickBaseX, this.joystickBaseY);
            this.state.moveX = 0;
            this.state.moveY = 0;
            this.state.moveLeft = false;
            this.state.moveRight = false;
            this.state.moveUp = false;
            this.state.moveDown = false;
            this.state.aimLeft = false;
            this.state.aimRight = false;
            this.state.aimUp = false;
            this.state.aimDown = false;
        }
    }

    private updateJoystickPosition(pointer: Phaser.Input.Pointer): void {
        const dx = pointer.x - this.joystickBaseX;
        const dy = pointer.y - this.joystickBaseY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Cap knob to radius
        const maxDist = this.joystickRadius;
        const angle = Math.atan2(dy, dx);

        if (distance > maxDist) {
            this.joystickKnob.x = this.joystickBaseX + Math.cos(angle) * maxDist;
            this.joystickKnob.y = this.joystickBaseY + Math.sin(angle) * maxDist;
        } else {
            this.joystickKnob.x = pointer.x;
            this.joystickKnob.y = pointer.y;
        }

        // Normalize state (-1 to 1)
        let nx = distance > 0 ? dx / maxDist : 0;
        let ny = distance > 0 ? dy / maxDist : 0;

        // Apply deadzone
        if (Math.abs(nx) < this.deadzone) nx = 0;
        if (Math.abs(ny) < this.deadzone) ny = 0;

        // Clamp to -1/1
        nx = Math.max(-1, Math.min(1, nx));
        ny = Math.max(-1, Math.min(1, ny));

        this.state.moveX = nx;
        this.state.moveY = ny;

        // Digital equivalents
        this.state.moveLeft = nx < -0.3;
        this.state.moveRight = nx > 0.3;
        this.state.moveUp = ny < -0.3;
        this.state.moveDown = ny > 0.3;

        this.state.aimLeft = this.state.moveLeft;
        this.state.aimRight = this.state.moveRight;
        this.state.aimUp = this.state.moveUp;
        this.state.aimDown = this.state.moveDown;
    }

    public setCameraIgnore(mainCamera: Phaser.Cameras.Scene2D.Camera, uiCamera: Phaser.Cameras.Scene2D.Camera): void {
        mainCamera.ignore(this.container);
        this.uiCamera = uiCamera; // Store for later if we create UI dynamically
    }

    public setVisible(visible: boolean): void {
        this.container.setVisible(visible);
    }

    public getState(): Partial<InputState> | null {
        if (!this.active) return null;

        // Process single frame presses
        const jumpPressed = (this.state.jumpHeld as boolean) && !this.jumpWasPressed;
        const lightPressed = (this.state.lightAttackHeld as boolean) && !this.lightWasPressed;
        const heavyPressed = (this.state.heavyAttackHeld as boolean) && !this.heavyWasPressed;
        const dodgePressed = (this.state.dodgeHeld as boolean) && !this.dodgeWasPressed;
        // Taunt is a direct button click, we can use the held state to trigger a press
        const tauntPressed = (this.state.taunt as boolean) && !this.tauntWasPressed;

        this.jumpWasPressed = this.state.jumpHeld as boolean;
        this.lightWasPressed = this.state.lightAttackHeld as boolean;
        this.heavyWasPressed = this.state.heavyAttackHeld as boolean;
        this.dodgeWasPressed = this.state.dodgeHeld as boolean;
        this.tauntWasPressed = this.state.taunt as boolean;

        // Update single frame presses
        this.state.jump = jumpPressed;
        this.state.lightAttack = lightPressed;
        this.state.heavyAttack = heavyPressed;
        this.state.dodge = dodgePressed;
        this.state.taunt = tauntPressed;

        // Special case for recovery: Up + Heavy
        this.state.recovery = (this.state.heavyAttackHeld as boolean) && (this.state.aimUp as boolean);

        return this.state;
    }

    public destroy(): void {
        this.container.destroy();
    }
}
