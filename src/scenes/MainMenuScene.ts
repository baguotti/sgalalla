import Phaser from 'phaser';

const MenuOption = {
    LOCAL_MULTIPLAYER: 0,
    SETTINGS: 1,
    ONLINE: 2,
    EXIT: 3
} as const;
type MenuOption = typeof MenuOption[keyof typeof MenuOption];

export class MainMenuScene extends Phaser.Scene {
    private menuItems: Phaser.GameObjects.Text[] = [];
    private selectedIndex: number = 0;

    private menuOptions = [
        { label: 'LOCAL MULTIPLAYER', value: MenuOption.LOCAL_MULTIPLAYER },
        { label: 'SETTINGS', value: MenuOption.SETTINGS },
        { label: 'ONLINE (Coming Soon)', value: MenuOption.ONLINE },
        { label: 'EXIT', value: MenuOption.EXIT }
    ];

    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: 'MainMenuScene' });
    }

    create(): void {
        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

        // Title
        this.add.text(width / 2, 150, 'SGALALLA', {
            fontSize: '84px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Subtitle/Version
        this.add.text(width / 2, 220, 'Pre-Alpha Build', {
            fontSize: '20px',
            color: '#8ab4f8'
        }).setOrigin(0.5);

        // Menu Items
        const startY = 500;
        const spacing = 80; // Increased spacing for 1080p

        this.menuOptions.forEach((option, index) => {
            const text = this.add.text(width / 2, startY + (index * spacing), option.label, {
                fontSize: '32px',
                color: '#ffffff',
                fontFamily: 'Arial',
                fontStyle: 'bold'
            }).setOrigin(0.5).setInteractive({ useHandCursor: true });

            text.on('pointerover', () => {
                this.selectedIndex = index;
                this.updateSelection();
            });

            text.on('pointerdown', () => {
                this.selectedIndex = index;
                this.updateSelection();
                this.selectOption();
            });

            this.menuItems.push(text);
        });

        // Input
        this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

        this.updateSelection();

        // Hint
        this.add.text(width / 2, height - 50, '[UP/DOWN] Navigate  [ENTER] Select  [GAMEPAD] Supported', {
            fontSize: '16px',
            color: '#666666'
        }).setOrigin(0.5);
    }

    update(): void {
        this.handleInput();
    }

    // Gamepad state tracking
    private previousGamepadState = {
        up: false,
        down: false,
        left: false,
        right: false,
        a: false,
        b: false,
        start: false
    };

    private handleInput(): void {
        const gp = this.getGamepadInput();

        // Keyboard or Gamepad Up
        if (Phaser.Input.Keyboard.JustDown(this.upKey) || gp.upPressed) {
            this.moveSelection(-1);
        }
        // Keyboard or Gamepad Down
        else if (Phaser.Input.Keyboard.JustDown(this.downKey) || gp.downPressed) {
            this.moveSelection(1);
        }
        // Keyboard Enter or Gamepad A
        else if (Phaser.Input.Keyboard.JustDown(this.enterKey) || gp.aPressed) {
            this.selectOption();
        }
    }

    private getGamepadInput() {
        const gamepads = navigator.getGamepads();
        let currentState = {
            up: false,
            down: false,
            left: false,
            right: false,
            a: false,
            b: false,
            start: false
        };

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                // D-pad
                const dpadUp = gamepad.buttons[12]?.pressed || false;
                const dpadDown = gamepad.buttons[13]?.pressed || false;

                // Left stick
                const stickY = gamepad.axes[1] || 0;
                const DEADZONE = 0.5;

                currentState.up = dpadUp || stickY < -DEADZONE;
                currentState.down = dpadDown || stickY > DEADZONE;
                currentState.a = gamepad.buttons[0]?.pressed || false; // A button
                currentState.b = gamepad.buttons[1]?.pressed || false; // B button
                currentState.start = gamepad.buttons[9]?.pressed || false; // START button
                break;
            }
        }

        // Detect rising edges (just pressed)
        const result = {
            upPressed: currentState.up && !this.previousGamepadState.up,
            downPressed: currentState.down && !this.previousGamepadState.down,
            aPressed: currentState.a && !this.previousGamepadState.a,
            bPressed: currentState.b && !this.previousGamepadState.b,
            startPressed: currentState.start && !this.previousGamepadState.start
        };

        this.previousGamepadState = currentState;
        return result;
    }

    private moveSelection(dir: number): void {
        this.selectedIndex = (this.selectedIndex + dir + this.menuOptions.length) % this.menuOptions.length;
        this.updateSelection();
    }

    private updateSelection(): void {
        this.menuItems.forEach((item, index) => {
            if (index === this.selectedIndex) {
                item.setColor('#ffdd00');
                item.setScale(1.1);
            } else {
                item.setColor('#ffffff');
                item.setScale(1.0);
            }
        });
    }

    private selectOption(): void {
        const option = this.menuOptions[this.selectedIndex].value;

        switch (option) {
            case MenuOption.LOCAL_MULTIPLAYER:
                this.scene.start('LocalMultiplayerSetupScene');
                break;
            case MenuOption.SETTINGS:
                this.scene.start('SettingsScene');
                break;
            case MenuOption.ONLINE:
                console.log('Online clicked');
                break;
            case MenuOption.EXIT:
                console.log('Exit clicked');
                break;
        }
    }
}
