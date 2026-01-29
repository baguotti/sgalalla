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

export class PauseMenu {
    private scene: Phaser.Scene;
    private overlay!: Phaser.GameObjects.Graphics;
    private titleText!: Phaser.GameObjects.Text;
    private menuItems: Phaser.GameObjects.Text[] = [];
    private selectedIndex: number = 0;
    private visible: boolean = false;

    private menuOptions = [
        { label: 'Resume', value: MenuOption.RESUME },
        { label: 'Controls', value: MenuOption.CONTROLS },
        { label: 'Settings', value: MenuOption.SETTINGS },
        { label: 'Training', value: MenuOption.TRAINING },
        { label: 'Restart Match', value: MenuOption.RESTART },
        { label: 'Exit to Menu', value: MenuOption.EXIT }
    ];

    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;
    private escKey!: Phaser.Input.Keyboard.Key;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.createMenu();
        this.setupInput();
    }

    private createMenu(): void {
        const centerX = 400;

        // Create semi-transparent overlay
        this.overlay = this.scene.add.graphics();
        this.overlay.fillStyle(0x000000, 0.85);
        this.overlay.fillRect(0, 0, 800, 600);
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

        // Menu items
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
            this.menuItems.push(itemText);
        });

        // Hint text
        const hintText = this.scene.add.text(centerX, 550, '[ESC / START to Resume]', {
            fontSize: '18px',
            color: '#888888',
            fontFamily: 'Arial'
        });
        hintText.setOrigin(0.5);
        hintText.setScrollFactor(0);
        hintText.setDepth(1001);
        hintText.setVisible(false);
        this.menuItems.push(hintText);
    }

    private setupInput(): void {
        this.upKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.downKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.enterKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.escKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    }

    show(): void {
        this.visible = true;
        this.selectedIndex = 0;
        this.overlay.setVisible(true);
        this.titleText.setVisible(true);
        this.menuItems.forEach(item => item.setVisible(true));
        this.updateSelection();
    }

    hide(): void {
        this.visible = false;
        this.overlay.setVisible(false);
        this.titleText.setVisible(false);
        this.menuItems.forEach(item => item.setVisible(false));
    }

    isVisible(): boolean {
        return this.visible;
    }

    update(_delta: number): void {
        if (!this.visible) return;

        // Navigate up
        if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
            this.selectedIndex--;
            if (this.selectedIndex < 0) {
                this.selectedIndex = this.menuOptions.length - 1;
            }
            this.updateSelection();
        }

        // Navigate down
        if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
            this.selectedIndex++;
            if (this.selectedIndex >= this.menuOptions.length) {
                this.selectedIndex = 0;
            }
            this.updateSelection();
        }

        // Select option
        if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            this.selectOption();
        }

        // Quick resume with ESC
        if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
            this.executeOption(MenuOption.RESUME);
        }
    }

    private updateSelection(): void {
        this.menuItems.forEach((item, index) => {
            // Skip the hint text (last item)
            if (index >= this.menuOptions.length) return;

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
        this.executeOption(option);
    }

    private executeOption(option: MenuOption): void {
        switch (option) {
            case MenuOption.RESUME:
                this.scene.events.emit('pauseMenuResume');
                break;
            case MenuOption.CONTROLS:
                // Placeholder - show message
                console.log('Controls menu - Not yet implemented');
                break;
            case MenuOption.SETTINGS:
                // Placeholder - show message
                console.log('Settings menu - Not yet implemented');
                break;
            case MenuOption.TRAINING:
                // Placeholder - show message
                console.log('Training options - Not yet implemented');
                break;
            case MenuOption.RESTART:
                this.scene.events.emit('pauseMenuRestart');
                break;
            case MenuOption.EXIT:
                // Placeholder - show message
                console.log('Exit to menu - Not yet implemented');
                break;
        }
    }

    getElements(): Phaser.GameObjects.GameObject[] {
        return [this.overlay, this.titleText, ...this.menuItems];
    }
}
