import Phaser from 'phaser';

export class MainMenuScene extends Phaser.Scene {
    private startKey!: Phaser.Input.Keyboard.Key;
    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;

    private canInput: boolean = false;
    private selectedIndex: number = 0;
    private menuOptions = [
        { label: 'TRAINING', mode: 'training' },
        { label: 'BOTTE IN LOCALE', mode: 'versus' },
        { label: '1v1', mode: 'online' }
    ];
    private menuTexts: Phaser.GameObjects.Text[] = [];

    constructor() {
        super({ key: 'MainMenuScene' });
    }

    private debugText!: Phaser.GameObjects.Text;

    create(): void {
        const { width, height } = this.scale;

        // CRITICAL: Clear menu items from previous runs
        this.menuTexts = [];

        // Visuals
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

        // Title Text
        this.add.text(width / 2, 200, 'SUPER SMASH FIOI', {
            fontSize: '80px', fontFamily: '"Pixeloid Sans"', color: '#ffffff'
        }).setOrigin(0.5);



        this.add.text(width / 2, 270, 'Pre-Alpha Build v0.11.2', {
            fontSize: '24px', fontFamily: '"Pixeloid Sans"', color: '#888888'
        }).setOrigin(0.5);


        // Version (Removed - combined with subtitle)

        // Menu Items
        const startY = 420;
        this.menuOptions.forEach((opt, index) => {
            const text = this.add.text(width / 2, startY + (index * 90), opt.label, {
                fontSize: '48px', fontFamily: '"Pixeloid Sans"', color: '#888888'
            }).setOrigin(0.5);



            this.menuTexts.push(text);
        });

        this.updateSelection();

        // DEBUG: Gamepad Status
        this.debugText = this.add.text(10, 10, 'Gamepad: ???', { fontSize: '16px', color: '#00ff00', fontFamily: '"Pixeloid Sans"' });


        this.input.gamepad?.on('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
            console.log('Gamepad connected:', pad.id);
            this.debugText.setText(`Gamepad Connected: ${pad.id}`);
        });

        // Input Safety (Prevent ghost clicks)
        this.time.delayedCall(500, () => {
            this.canInput = true;
            this.startKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
            this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
            this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        });
    }

    update(): void {
        if (this.input.gamepad) {
            this.debugText.setText(`pads: ${this.input.gamepad.total}`);
        }

        if (!this.canInput) return;

        if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
            this.changeSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
            this.changeSelection(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.startKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            this.selectOption('KEYBOARD');
        }

        this.handleGamepad();
    }

    private previousAxis: { [index: number]: number } = {};
    private previousButtons: { [key: string]: boolean } = {};

    private handleGamepad(): void {
        if (!this.input.gamepad?.total) return;

        const pad = this.input.gamepad.getPad(0);
        if (!pad) return;

        const axisY = pad.axes[1].getValue();

        // Debounce stick
        if (this.previousAxis[pad.index] === undefined) this.previousAxis[pad.index] = 0;
        const prevAxis = this.previousAxis[pad.index];

        if (axisY < -0.5 && prevAxis >= -0.5) {
            this.changeSelection(-1);
        } else if (axisY > 0.5 && prevAxis <= 0.5) {
            this.changeSelection(1);
        }

        // D-Pad support
        if (pad.buttons[12].pressed && !this.previousButtons['dpadUp']) {
            this.changeSelection(-1);
            this.previousButtons['dpadUp'] = true;
        } else if (!pad.buttons[12].pressed) {
            this.previousButtons['dpadUp'] = false;
        }

        if (pad.buttons[13].pressed && !this.previousButtons['dpadDown']) {
            this.changeSelection(1);
            this.previousButtons['dpadDown'] = true;
        } else if (!pad.buttons[13].pressed) {
            this.previousButtons['dpadDown'] = false;
        }

        this.previousAxis[pad.index] = axisY;

        // A Button (0) or Start (9) to select
        if ((pad.buttons[0].pressed || pad.buttons[9].pressed) && !this.previousButtons['btnA']) {
            this.selectOption('GAMEPAD', pad.index);
            this.previousButtons['btnA'] = true;
        } else if (!pad.buttons[0].pressed && !pad.buttons[9].pressed) {
            this.previousButtons['btnA'] = false;
        }
    }

    private changeSelection(dir: number): void {
        this.selectedIndex = (this.selectedIndex + dir + this.menuOptions.length) % this.menuOptions.length;
        this.updateSelection();
    }

    private updateSelection(): void {
        this.menuTexts.forEach((text, index) => {
            if (index === this.selectedIndex) {
                text.setColor('#ffffff');
                text.setAlpha(1);
            } else {
                text.setColor('#888888');
                text.setAlpha(0.5);
                text.setFontSize(48);
            }
        });
    }

    private selectOption(inputType: 'KEYBOARD' | 'GAMEPAD' = 'KEYBOARD', gamepadIndex: number | null = null): void {
        const mode = this.menuOptions[this.selectedIndex].mode;

        // Handle Online Quick Join
        if (mode === 'online') {
            this.scene.start('OnlineGameScene');
            return;
        }

        // Local Game (training or versus) - Pass input type and gamepad index
        this.scene.start('LobbyScene', { mode: mode, inputType: inputType, gamepadIndex: gamepadIndex });
    }
}
