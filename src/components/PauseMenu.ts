import Phaser from 'phaser';

const MenuOption = {
    RESUME: 0,
    CONTROLS: 1,
    SETTINGS: 2,
    TRAINING: 3,
    RESTART: 4,
    EXIT: 5
} as const;
type MenuOption = typeof MenuOption[keyof typeof MenuOption];

const SettingsOption = {
    RESOLUTION: 0,
    FULLSCREEN: 1,
    BACK: 2
} as const;
type SettingsOption = typeof SettingsOption[keyof typeof SettingsOption];

const Resolutions = [
    { w: 960, h: 540, label: '960 x 540' },
    { w: 1280, h: 720, label: '1280 x 720' },
    { w: 1920, h: 1080, label: '1920 x 1080' }
];

export class PauseMenu {
    private scene: Phaser.Scene;
    private overlay!: Phaser.GameObjects.Graphics;
    private titleText!: Phaser.GameObjects.Text;

    // Menu States
    private menuState: 'MAIN' | 'SETTINGS' = 'MAIN';

    // UI Groups
    private mainMenuItems: Phaser.GameObjects.Text[] = [];
    private settingsMenuItems: Phaser.GameObjects.Text[] = [];

    // Selection Trackers
    private mainSelectedIndex: number = 0;
    private settingsSelectedIndex: number = 0;

    // Settings State
    private currentResolutionIndex: number = 1; // Default to middle (720p)
    private isFullscreen: boolean = false;

    private visible: boolean = false;

    private menuOptions = [
        { label: 'Resume', value: MenuOption.RESUME },
        { label: 'Controls', value: MenuOption.CONTROLS },
        { label: 'Settings', value: MenuOption.SETTINGS },
        { label: 'Training', value: MenuOption.TRAINING },
        { label: 'Restart Match', value: MenuOption.RESTART },
        { label: 'Exit to Menu', value: MenuOption.EXIT }
    ];

    // Settings options managed dynamically due to text updates

    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private leftKey!: Phaser.Input.Keyboard.Key;
    private rightKey!: Phaser.Input.Keyboard.Key;
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

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.createMenu();
        this.setupInput();

        // Determine initial resolution index
        const currentW = scene.scale.width;
        // Find closest match or default
        const idx = Resolutions.findIndex(r => r.w === currentW);
        if (idx !== -1) {
            this.currentResolutionIndex = idx;
        } else {
            // If not found, default to 720p (index 1) which is standard
            this.currentResolutionIndex = 1;
        }

        this.isFullscreen = this.scene.scale.isFullscreen;
    }

    private createMenu(): void {
        const centerX = 400; // This should be dynamic really, but kept for simplicity relative to base design

        // Create semi-transparent overlay
        this.overlay = this.scene.add.graphics();
        this.overlay.fillStyle(0x000000, 0.85);
        this.overlay.fillRect(0, 0, 3000, 3000); // Oversized to cover resize
        this.overlay.setScrollFactor(0);
        this.overlay.setDepth(1000);
        this.overlay.setVisible(false);

        // Title
        this.titleText = this.scene.add.text(centerX, 120, 'PAUSED', {
            fontSize: '64px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: 'Arial'
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
                fontFamily: 'Arial'
            });
            itemText.setOrigin(0.5);
            itemText.setScrollFactor(0);
            itemText.setDepth(1001);
            itemText.setVisible(false);
            this.mainMenuItems.push(itemText);
        });

        // -- Settings Menu Items --
        const settingsStartY = startY;

        // 1. Resolution
        const resText = this.scene.add.text(centerX, settingsStartY, `Resolution: ${Resolutions[this.currentResolutionIndex].label}`, {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: 'Arial'
        });
        resText.setOrigin(0.5);
        resText.setScrollFactor(0);
        resText.setDepth(1001);
        resText.setVisible(false);
        this.settingsMenuItems.push(resText);

        // 2. Fullscreen
        const fsText = this.scene.add.text(centerX, settingsStartY + spacing, `Fullscreen: ${this.isFullscreen ? 'ON' : 'OFF'}`, {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: 'Arial'
        });
        fsText.setOrigin(0.5);
        fsText.setScrollFactor(0);
        fsText.setDepth(1001);
        fsText.setVisible(false);
        this.settingsMenuItems.push(fsText);

        // 3. Back
        const backText = this.scene.add.text(centerX, settingsStartY + spacing * 2, 'Back', {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: 'Arial'
        });
        backText.setOrigin(0.5);
        backText.setScrollFactor(0);
        backText.setDepth(1001);
        backText.setVisible(false);
        this.settingsMenuItems.push(backText);


        // Hint text
        this.hintText = this.scene.add.text(centerX, 550, '[ESC / START to Resume]', {
            fontSize: '18px',
            color: '#888888',
            fontFamily: 'Arial'
        });
        this.hintText.setOrigin(0.5);
        this.hintText.setScrollFactor(0);
        this.hintText.setDepth(1001);
        this.hintText.setVisible(false);
    }

    private updateLayout(): void {
        const centerX = this.scene.scale.width / 2;
        const centerY = this.scene.scale.height / 2;

        this.titleText.setPosition(centerX, centerY - 200);
        this.hintText.setPosition(centerX, this.scene.scale.height - 50);

        const startY = centerY - 100;
        const spacing = 50;

        this.mainMenuItems.forEach((item, index) => {
            item.setPosition(centerX, startY + (index * spacing));
        });

        this.settingsMenuItems.forEach((item, index) => {
            if (index === SettingsOption.BACK) {
                // Add extra spacing for Back button
                item.setPosition(centerX, startY + (SettingsOption.FULLSCREEN * spacing) + (spacing * 2));
            } else {
                item.setPosition(centerX, startY + (index * spacing));
            }
        });
    }

    private setupInput(): void {
        this.upKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.downKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.leftKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        this.rightKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
        this.enterKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.escKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    show(): void {
        this.visible = true;
        this.menuState = 'MAIN';
        this.mainSelectedIndex = 0;

        // Update fullscreen state in case it changed externally (F11 etc)
        this.isFullscreen = this.scene.scale.isFullscreen;
        this.settingsMenuItems[SettingsOption.FULLSCREEN].setText(`Fullscreen: ${this.isFullscreen ? 'ON' : 'OFF'}`);

        this.updateLayout();

        this.overlay.setVisible(true);
        this.titleText.setVisible(true);
        this.hintText.setVisible(true);

        this.showMainMenu();
        this.updateSelection();
    }

    hide(): void {
        this.visible = false;
        this.overlay.setVisible(false);
        this.titleText.setVisible(false);
        this.hintText.setVisible(false);
        this.mainMenuItems.forEach(item => item.setVisible(false));
        this.settingsMenuItems.forEach(item => item.setVisible(false));
    }

    private showMainMenu(): void {
        this.titleText.setText('PAUSED');
        this.mainMenuItems.forEach(item => item.setVisible(true));
        this.settingsMenuItems.forEach(item => item.setVisible(false));
        this.updateHint('[ESC / B / START] Resume  [ENTER / A] Select');
    }

    private showSettingsMenu(): void {
        this.titleText.setText('SETTINGS');
        this.mainMenuItems.forEach(item => item.setVisible(false));
        this.settingsMenuItems.forEach(item => item.setVisible(true));
        this.updateHint('[LEFT/RIGHT / D-Pad] Change  [ENTER / A] Select  [ESC / B] Back');
    }

    private updateHint(text: string): void {
        this.hintText.setText(text);
    }

    isVisible(): boolean {
        return this.visible;
    }

    update(_delta: number): void {
        if (!this.visible) return;

        if (this.menuState === 'MAIN') {
            this.handleMainMenuInput();
        } else {
            this.handleSettingsInput();
        }
    }

    private handleMainMenuInput(): void {
        const gp = this.getGamepadInput();

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
    }

    private handleSettingsInput(): void {
        const gp = this.getGamepadInput();

        // Navigation (Up/Down)
        if (Phaser.Input.Keyboard.JustDown(this.upKey) || gp.upPressed) {
            this.settingsSelectedIndex = (this.settingsSelectedIndex - 1 + this.settingsMenuItems.length) % this.settingsMenuItems.length;
            this.updateSelection();
        } else if (Phaser.Input.Keyboard.JustDown(this.downKey) || gp.downPressed) {
            this.settingsSelectedIndex = (this.settingsSelectedIndex + 1) % this.settingsMenuItems.length;
            this.updateSelection();
        }

        // Modification (Left/Right)
        if (this.settingsSelectedIndex === SettingsOption.RESOLUTION) {
            if (Phaser.Input.Keyboard.JustDown(this.leftKey) || gp.leftPressed) {
                this.cycleResolution(-1);
            } else if (Phaser.Input.Keyboard.JustDown(this.rightKey) || gp.rightPressed) {
                this.cycleResolution(1);
            }
        } else if (this.settingsSelectedIndex === SettingsOption.FULLSCREEN) {
            if (Phaser.Input.Keyboard.JustDown(this.leftKey) || Phaser.Input.Keyboard.JustDown(this.rightKey) || gp.leftPressed || gp.rightPressed) {
                this.toggleFullscreen();
            }
        }

        // Select / Back
        if (Phaser.Input.Keyboard.JustDown(this.enterKey) || gp.aPressed) {
            if (this.settingsSelectedIndex === SettingsOption.BACK) {
                this.menuState = 'MAIN';
                this.showMainMenu();
            } else if (this.settingsSelectedIndex === SettingsOption.RESOLUTION) {
                this.cycleResolution(1);
            } else if (this.settingsSelectedIndex === SettingsOption.FULLSCREEN) {
                this.toggleFullscreen();
            }
        }

        if (Phaser.Input.Keyboard.JustDown(this.escKey) || gp.bPressed || gp.startPressed) {
            this.menuState = 'MAIN';
            this.showMainMenu();
        }
    }

    private cycleResolution(dir: number): void {
        this.currentResolutionIndex = (this.currentResolutionIndex + dir + Resolutions.length) % Resolutions.length;

        const res = Resolutions[this.currentResolutionIndex];
        // Resize game
        this.scene.scale.resize(res.w, res.h);

        // Update Text
        this.settingsMenuItems[SettingsOption.RESOLUTION].setText(`Resolution: ${res.label}`);

        // Re-center layout
        this.updateLayout();
    }

    private toggleFullscreen(): void {
        if (this.scene.scale.isFullscreen) {
            this.scene.scale.stopFullscreen();
            this.isFullscreen = false;
        } else {
            this.scene.scale.startFullscreen();
            this.isFullscreen = true;
        }
        this.settingsMenuItems[SettingsOption.FULLSCREEN].setText(`Fullscreen: ${this.isFullscreen ? 'ON' : 'OFF'}`);
    }



    private updateSelection(): void {
        const items = this.menuState === 'MAIN' ? this.mainMenuItems : this.settingsMenuItems;
        const selected = this.menuState === 'MAIN' ? this.mainSelectedIndex : this.settingsSelectedIndex;

        items.forEach((item, index) => {
            if (index === selected) {
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
                console.log('Controls menu - Not yet implemented');
                break;
            case MenuOption.SETTINGS:
                this.menuState = 'SETTINGS';
                this.settingsSelectedIndex = 0;
                this.showSettingsMenu();
                this.updateSelection();
                break;
            case MenuOption.TRAINING:
                console.log('Training options - Not yet implemented');
                break;
            case MenuOption.RESTART:
                this.scene.events.emit('pauseMenuRestart');
                break;
            case MenuOption.EXIT:
                console.log('Exit to menu - Not yet implemented');
                break;
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
                const dpadLeft = gamepad.buttons[14]?.pressed || false;
                const dpadRight = gamepad.buttons[15]?.pressed || false;

                // Left stick
                const stickX = gamepad.axes[0] || 0;
                const stickY = gamepad.axes[1] || 0;
                const DEADZONE = 0.5;

                currentState.up = dpadUp || stickY < -DEADZONE;
                currentState.down = dpadDown || stickY > DEADZONE;
                currentState.left = dpadLeft || stickX < -DEADZONE;
                currentState.right = dpadRight || stickX > DEADZONE;
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
            leftPressed: currentState.left && !this.previousGamepadState.left,
            rightPressed: currentState.right && !this.previousGamepadState.right,
            aPressed: currentState.a && !this.previousGamepadState.a,
            bPressed: currentState.b && !this.previousGamepadState.b,
            startPressed: currentState.start && !this.previousGamepadState.start
        };

        this.previousGamepadState = currentState;
        return result;
    }

    getElements(): Phaser.GameObjects.GameObject[] {
        return [this.overlay, this.titleText, this.hintText, ...this.mainMenuItems, ...this.settingsMenuItems];
    }
}
