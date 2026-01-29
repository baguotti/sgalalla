import Phaser from 'phaser';

export class LocalMultiplayerSetupScene extends Phaser.Scene {
    private p1InputText!: Phaser.GameObjects.Text;
    private p2InputText!: Phaser.GameObjects.Text;

    // Default Configuration
    private p1UseKeyboard: boolean = false; // Default P1 to Gamepad
    private p2UseKeyboard: boolean = true;  // Default P2 to Keyboard

    constructor() {
        super({ key: 'LocalMultiplayerSetupScene' });
    }

    // Navigation
    private menuItems: Phaser.GameObjects.Text[] = [];
    private selectedIndex: number = 0; // 0=P1, 1=P2, 2=Start

    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;

    // Gamepad state tracking
    private previousGamepadState = {
        up: false,
        down: false,
        a: false
    };

    create(): void {
        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

        // Title
        this.add.text(width / 2, 100, 'SGALALLA', {
            fontSize: '64px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, 180, 'Local Multiplayer Setup', {
            fontSize: '24px',
            color: '#8ab4f8',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // --- Player 1 Setup ---
        this.add.text(width / 2 - 200, 300, 'PLAYER 1', {
            fontSize: '32px',
            color: '#b19cd9', // Purple
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.p1InputText = this.add.text(width / 2 - 200, 360, this.getInputLabel(this.p1UseKeyboard, 0), {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.p1InputText.on('pointerdown', () => {
            this.selectedIndex = 0;
            this.updateSelection();
            this.toggleP1Input();
        });

        // --- Player 2 Setup ---
        this.add.text(width / 2 + 200, 300, 'PLAYER 2', {
            fontSize: '32px',
            color: '#77dd77', // Green
            fontStyle: 'bold'
        }).setOrigin(0.5);

        this.p2InputText = this.add.text(width / 2 + 200, 360, this.getInputLabel(this.p2UseKeyboard, 1), {
            fontSize: '24px',
            color: '#ffffff',
            backgroundColor: '#333333',
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        this.p2InputText.on('pointerdown', () => {
            this.selectedIndex = 1;
            this.updateSelection();
            this.toggleP2Input();
        });

        // --- Start Button ---
        const startBtn = this.add.text(width / 2, 550, 'START MATCH', {
            fontSize: '48px',
            color: '#ffffff',
            backgroundColor: '#2ecc71',
            padding: { x: 20, y: 10 },
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        startBtn.on('pointerdown', () => {
            this.selectedIndex = 2;
            this.updateSelection();
            this.startGame();
        });

        startBtn.on('pointerover', () => {
            this.selectedIndex = 2;
            this.updateSelection();
        });

        // Add to navigation group
        this.menuItems = [this.p1InputText, this.p2InputText, startBtn];

        // Input
        this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        this.updateSelection();

        // Hint text
        this.add.text(width / 2, 650, '[UP/DOWN] Navigate  [ENTER/A] Toggle/Start', {
            fontSize: '16px',
            color: '#888888'
        }).setOrigin(0.5);
    }

    update(): void {
        this.handleInput();
    }

    private handleInput(): void {
        const gp = this.getGamepadInput();

        // Navigation
        if (Phaser.Input.Keyboard.JustDown(this.upKey) || gp.upPressed) {
            this.moveSelection(-1);
        }
        else if (Phaser.Input.Keyboard.JustDown(this.downKey) || gp.downPressed) {
            this.moveSelection(1);
        }

        // Action
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) || gp.aPressed) {
            this.activateSelection();
        }
    }

    private moveSelection(dir: number): void {
        this.selectedIndex = (this.selectedIndex + dir + this.menuItems.length) % this.menuItems.length;
        this.updateSelection();
    }

    private updateSelection(): void {
        this.menuItems.forEach((item, index) => {
            const isStartBtn = index === 2;

            if (index === this.selectedIndex) {
                // Hightlight
                item.setColor('#ffff00');
                if (isStartBtn) {
                    item.setBackgroundColor('#2ecc71'); // Start btn keeps bg
                    item.setScale(1.1);
                } else {
                    item.setBackgroundColor('#555555');
                }
            } else {
                // Normal
                item.setColor('#ffffff');
                if (isStartBtn) {
                    item.setBackgroundColor('#2ecc71');
                    item.setScale(1.0);
                } else {
                    item.setBackgroundColor('#333333');
                }
            }
        });
    }

    private activateSelection(): void {
        switch (this.selectedIndex) {
            case 0: // P1 Toggle
                this.toggleP1Input();
                break;
            case 1: // P2 Toggle
                this.toggleP2Input();
                break;
            case 2: // Start
                this.startGame();
                break;
        }
    }

    private toggleP1Input(): void {
        this.p1UseKeyboard = !this.p1UseKeyboard;
        this.updateInputText();
    }

    private toggleP2Input(): void {
        this.p2UseKeyboard = !this.p2UseKeyboard;
        this.updateInputText();
    }

    private getInputLabel(useKeyboard: boolean, gamepadIndex: number): string {
        return useKeyboard ? 'KEYBOARD' : `GAMEPAD ${gamepadIndex}`;
    }

    private updateInputText(): void {
        this.p1InputText.setText(this.getInputLabel(this.p1UseKeyboard, 0));
        this.p2InputText.setText(this.getInputLabel(this.p2UseKeyboard, 1));
    }

    private startGame(): void {
        this.scene.start('GameScene', {
            p1: {
                useKeyboard: this.p1UseKeyboard,
                gamepadIndex: this.p1UseKeyboard ? null : 0
            },
            p2: {
                useKeyboard: this.p2UseKeyboard,
                gamepadIndex: this.p2UseKeyboard ? null : 1
            }
        });
    }

    private getGamepadInput() {
        // Simplified polling for ANY controller
        const gamepads = navigator.getGamepads();
        let currentState = {
            up: false,
            down: false,
            a: false
        };

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                const dpadUp = gamepad.buttons[12]?.pressed || false;
                const dpadDown = gamepad.buttons[13]?.pressed || false;
                const stickY = gamepad.axes[1] || 0;

                currentState.up = dpadUp || stickY < -0.5;
                currentState.down = dpadDown || stickY > 0.5;
                currentState.a = gamepad.buttons[0]?.pressed || false;
                break;
            }
        }

        const result = {
            upPressed: currentState.up && !this.previousGamepadState.up,
            downPressed: currentState.down && !this.previousGamepadState.down,
            aPressed: currentState.a && !this.previousGamepadState.a
        };

        this.previousGamepadState = currentState;
        return result;
    }
}
