import Phaser from 'phaser';

const MenuOption = {
    RESUME: 0,
    CONTROLS: 1,
    TRAINING: 3,
    SPAWN_DUMMY: 6,
    RESTART: 4,
    LOBBY: 7,
    EXIT: 5
} as const;
type MenuOption = typeof MenuOption[keyof typeof MenuOption];

export class PauseMenu {
    private scene: Phaser.Scene;
    private overlay!: Phaser.GameObjects.Graphics;
    private titleText!: Phaser.GameObjects.Text;

    // UI Groups
    private mainMenuItems: Phaser.GameObjects.Text[] = [];

    // Selection Trackers
    private mainSelectedIndex: number = 0;

    private visible: boolean = false;

    private menuOptions = [
        { label: 'Resume', value: MenuOption.RESUME },
        { label: 'Controls', value: MenuOption.CONTROLS },
        // Training Options removed
        { label: 'Spawn Training Partner', value: MenuOption.SPAWN_DUMMY },
        { label: 'Restart Match', value: MenuOption.RESTART },
        { label: 'Return to Lobby', value: MenuOption.LOBBY },
        { label: 'Exit to Menu', value: MenuOption.EXIT }
    ];

    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;
    private escKey!: Phaser.Input.Keyboard.Key;

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

    private hintText!: Phaser.GameObjects.Text;
    private controlsContainer!: Phaser.GameObjects.Container;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.createMenu();
        this.createControlsPage();
        this.setupInput();
    }

    private createMenu(): void {
        const centerX = 400; // Placeholder, updated in layout

        // Create semi-transparent overlay
        this.overlay = this.scene.add.graphics();
        this.overlay.fillStyle(0x000000, 0.90); // Slightly darker for legibility
        this.overlay.fillRect(0, 0, 3000, 3000);
        this.overlay.setScrollFactor(0);
        this.overlay.setDepth(1000);
        this.overlay.setVisible(false);

        // Title
        this.titleText = this.scene.add.text(centerX, 120, 'PAUSED', {
            fontSize: '64px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: '"Silkscreen"'
        });
        this.titleText.setOrigin(0.5);
        this.titleText.setScrollFactor(0);
        this.titleText.setDepth(1001);
        this.titleText.setVisible(false);

        // -- Main Menu Items --
        const startY = 220;
        const spacing = 50;

        this.menuOptions.forEach((option, index) => {
            const itemText = this.scene.add.text(centerX, startY + (index * spacing), option.label, {
                fontSize: '32px',
                color: '#ffffff',
                fontFamily: '"Silkscreen"'
            });
            itemText.setOrigin(0.5);
            itemText.setScrollFactor(0);
            itemText.setDepth(1001);
            itemText.setVisible(false);
            itemText.setInteractive({ useHandCursor: true });

            itemText.on('pointerover', () => {
                this.mainSelectedIndex = index;
                this.updateSelection();
            });

            itemText.on('pointerdown', () => {
                this.mainSelectedIndex = index;
                this.updateSelection();
                this.selectOption();
            });

            this.mainMenuItems.push(itemText);
        });

        // Hint text
        this.hintText = this.scene.add.text(centerX, 550, '[ESC / START to Resume]', {
            fontSize: '18px',
            color: '#888888',
            fontFamily: '"Silkscreen"'
        });
        this.hintText.setOrigin(0.5);
        this.hintText.setScrollFactor(0);
        this.hintText.setDepth(1001);
        this.hintText.setVisible(false);
    }

    private createControlsPage(): void {
        this.controlsContainer = this.scene.add.container(0, 0);
        this.controlsContainer.setScrollFactor(0);
        this.controlsContainer.setDepth(1001);
        this.controlsContainer.setVisible(false);

        const centerX = this.scene.scale.width / 2;
        const centerY = this.scene.scale.height / 2;

        // -- Layout Configuration --
        const col1X = -300; // Relative to center
        const col2X = 100;
        const headerY = -150;
        const contentY = -100;

        // == COL 1: INPUTS ==
        const inputsHeader = this.scene.add.text(col1X, headerY, 'INPUTS', {
            fontSize: '28px',
            color: '#8ab4f8', // Pastel Blue
            fontStyle: 'bold',
            fontFamily: '"Silkscreen"'
        });

        const inputsText = [
            'ACTION       | KEYBOARD | GAMEPAD',
            '-------------+----------+--------',
            'Move         | WASD/Arr | Stick/Pad',
            'Jump         | Space/Z  | A (Cross)',
            'Light Attack | J / X    | X (Square)',
            'Heavy Attack | K / C    | B (Circle)',
            'Dodge        | L / Shift| Triggers',
            'Move/Aim     | WASD     | Stick',
            '',
            'Debug        | Q        | Select',
            'Toggle AI    | O        | -',
            'Spawn Dummy  | T        | -'
        ].join('\n');

        const inputsContent = this.scene.add.text(col1X, contentY, inputsText, {
            fontSize: '18px',
            color: '#cccccc',
            fontFamily: '"Silkscreen"',
            lineSpacing: 8
        });

        // == COL 2: MOVESET GUIDE ==
        const movesetHeader = this.scene.add.text(col2X, headerY, 'MOVESET GUIDE', {
            fontSize: '28px',
            color: '#f28b82', // Pastel Red
            fontStyle: 'bold',
            fontFamily: '"Silkscreen"'
        });

        const movesetText = [
            'LIGHT ATTACKS (Quick)',
            '• NLight: Standing Light (Neutral)',
            '• SLight: Moving Forward + Light',
            '• DLight: Hold Down + Light',
            '• Air Light: Jump + Light',
            '',
            'HEAVY ATTACKS (Signatures)',
            '• NSig: Neutral Heavy (Anti-Air)',
            '• SSig: Side Heavy (Kill Move)',
            '• DSig: Down Heavy (Area Control)',
            '',
            'SPECIAL AIR',
            '• Recovery: Air + Up + Heavy',
            '• Ground Pound: Air + Down + Heavy'
        ].join('\n');

        const movesetContent = this.scene.add.text(col2X, contentY, movesetText, {
            fontSize: '18px',
            color: '#eeeeee',
            fontFamily: '"Silkscreen"', // Readable font for text
            lineSpacing: 6
        });

        // Add to container
        this.controlsContainer.add([inputsHeader, inputsContent, movesetHeader, movesetContent]);

        // Use a relative positioning trick for container when screen resizes? 
        // For now, assume fixed center relative.
        this.controlsContainer.setPosition(centerX, centerY);
    }

    private updateLayout(): void {
        const centerX = this.scene.scale.width / 2;
        const centerY = this.scene.scale.height / 2;

        this.titleText.setPosition(centerX, centerY - 250);
        this.hintText.setPosition(centerX, this.scene.scale.height - 50);

        // Position controls container center
        this.controlsContainer.setPosition(centerX, centerY);

        const startY = centerY - 100;
        const spacing = 50;

        this.mainMenuItems.forEach((item, index) => {
            item.setPosition(centerX, startY + (index * spacing));
        });
    }

    private setupInput(): void {
        this.upKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.downKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.enterKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.escKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    // State
    private menuState: 'MAIN' | 'CONTROLS' = 'MAIN';

    show(): void {
        this.visible = true;
        this.menuState = 'MAIN'; // Reset to main menu
        this.mainSelectedIndex = 0;

        // Sync gamepad state to prevent immediate re-trigger
        this.syncGamepadState();

        this.updateLayout();

        this.overlay.setVisible(true);
        this.showMainMenu();
    }

    hide(): void {
        this.visible = false;
        this.overlay.setVisible(false);
        this.hideMainMenu();
        this.hideControlsMenu();
    }

    isVisible(): boolean {
        return this.visible;
    }

    update(_delta: number): void {
        if (!this.visible) return;
        this.handleInput();
    }

    private showMainMenu(): void {
        this.titleText.setText('PAUSED');
        this.titleText.setVisible(true);
        this.hintText.setText('[ESC / START to Resume]');
        this.hintText.setVisible(true);
        this.controlsContainer.setVisible(false);
        this.mainMenuItems.forEach(item => item.setVisible(true));
        this.updateSelection();
    }

    private hideMainMenu(): void {
        this.titleText.setVisible(false);
        this.hintText.setVisible(false);
        this.mainMenuItems.forEach(item => item.setVisible(false));
    }

    private showControlsMenu(): void {
        this.titleText.setText('CONTROLS');
        this.titleText.setVisible(true);

        // Center controls container
        this.controlsContainer.setPosition(this.scene.scale.width / 2, this.scene.scale.height / 2);
        this.controlsContainer.setVisible(true);

        this.hintText.setText('[ESC / B to Back]');
        this.hintText.setVisible(true);

        this.mainMenuItems.forEach(item => item.setVisible(false));
    }

    private hideControlsMenu(): void {
        this.controlsContainer.setVisible(false);
    }

    private handleInput(): void {
        const gp = this.getGamepadInput();

        if (this.menuState === 'MAIN') {
            if (Phaser.Input.Keyboard.JustDown(this.upKey) || gp.upPressed) {
                this.mainSelectedIndex = (this.mainSelectedIndex - 1 + this.menuOptions.length) % this.menuOptions.length;
                this.updateSelection();
            } else if (Phaser.Input.Keyboard.JustDown(this.downKey) || gp.downPressed) {
                this.mainSelectedIndex = (this.mainSelectedIndex + 1) % this.menuOptions.length;
                this.updateSelection();
            }

            if (Phaser.Input.Keyboard.JustDown(this.enterKey) || gp.aPressed) {
                this.selectOption();
            }

            if (Phaser.Input.Keyboard.JustDown(this.escKey) || gp.bPressed || gp.startPressed) {
                this.executeOption(MenuOption.RESUME);
            }
        } else if (this.menuState === 'CONTROLS') {
            // Back to Main Menu
            if (Phaser.Input.Keyboard.JustDown(this.escKey) || gp.bPressed || gp.aPressed || gp.startPressed) {
                this.menuState = 'MAIN';
                this.hideControlsMenu();
                this.showMainMenu();
            }
        }
    }

    private updateSelection(): void {
        this.mainMenuItems.forEach((item, index) => {
            if (index === this.mainSelectedIndex) {
                item.setColor('#ffdd00');
                item.setScale(1.1);
            } else {
                item.setColor('#ffffff');
                item.setScale(1.0);
            }
        });
    }

    private selectOption(): void {
        const option = this.menuOptions[this.mainSelectedIndex].value;
        this.executeOption(option);
    }

    private executeOption(option: MenuOption): void {
        switch (option) {
            case MenuOption.RESUME:
                this.scene.events.emit('pauseMenuResume');
                break;
            case MenuOption.CONTROLS:
                this.menuState = 'CONTROLS';
                this.showControlsMenu();
                break;
            case MenuOption.SPAWN_DUMMY:
                this.scene.events.emit('spawnDummy');
                break;
            case MenuOption.RESTART:
                this.scene.events.emit('pauseMenuRestart');
                break;
            case MenuOption.LOBBY:
                this.scene.events.emit('pauseMenuLobby');
                break;
            case MenuOption.EXIT:
                this.scene.events.emit('pauseMenuExit');
                break;
        }
    }

    private getGamepadInput() {
        const gamepads = navigator.getGamepads();
        let currentState = {
            up: false, down: false, left: false, right: false,
            a: false, b: false, start: false
        };

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                const dpadUp = gamepad.buttons[12]?.pressed || false;
                const dpadDown = gamepad.buttons[13]?.pressed || false;
                const deadzone = 0.5;
                const stickY = gamepad.axes[1] || 0;

                currentState.up = dpadUp || stickY < -deadzone;
                currentState.down = dpadDown || stickY > deadzone;
                currentState.a = gamepad.buttons[0]?.pressed || false;
                currentState.b = gamepad.buttons[1]?.pressed || false;
                currentState.start = gamepad.buttons[9]?.pressed || false;
                break;
            }
        }

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

    private syncGamepadState(): void {
        const gamepads = navigator.getGamepads();
        let currentState = {
            up: false, down: false, left: false, right: false,
            a: false, b: false, start: false
        };

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                const dpadUp = gamepad.buttons[12]?.pressed || false;
                const dpadDown = gamepad.buttons[13]?.pressed || false;
                const deadzone = 0.5;
                const stickY = gamepad.axes[1] || 0;

                currentState.up = dpadUp || stickY < -deadzone;
                currentState.down = dpadDown || stickY > deadzone;
                currentState.a = gamepad.buttons[0]?.pressed || false;
                currentState.b = gamepad.buttons[1]?.pressed || false;
                currentState.start = gamepad.buttons[9]?.pressed || false;
                break;
            }
        }
        this.previousGamepadState = currentState;
    }

    getElements(): Phaser.GameObjects.GameObject[] {
        return [this.overlay, this.titleText, this.hintText, this.controlsContainer, ...this.mainMenuItems];
    }
}
