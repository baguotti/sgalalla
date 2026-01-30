import Phaser from 'phaser';

export class SettingsScene extends Phaser.Scene {
    private menuItems: Phaser.GameObjects.Text[] = [];
    private selectedIndex: number = 0;
    private backKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;
    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: 'SettingsScene' });
    }

    create(): void {
        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

        // Title
        this.add.text(width / 2, 150, 'SETTINGS', {
            fontSize: '64px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);

        // Settings Data (Visual only for now, matching defaults)
        const settings = [
            { label: 'Camera Zoom: CLOSE (Default)', value: 'zoom' },
            { label: 'Resolution: 1920 x 1080 (Default)', value: 'res' },
            { label: 'BACK', value: 'back' }
        ];

        // Render Items
        const startY = 400;
        const spacing = 80;

        settings.forEach((option, index) => {
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
        this.backKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        this.updateSelection();
    }

    update(): void {
        this.handleInput();
    }

    private handleInput(): void {
        if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
            this.moveSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
            this.moveSelection(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            this.selectOption();
        } else if (Phaser.Input.Keyboard.JustDown(this.backKey)) {
            this.goBack();
        }
    }

    private moveSelection(dir: number): void {
        this.selectedIndex = (this.selectedIndex + dir + this.menuItems.length) % this.menuItems.length;
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
        const selected = this.menuItems[this.selectedIndex].text;

        if (selected === 'BACK') {
            this.goBack();
        } else {
            // Placeholder for changing settings
            console.log('Setting selected:', selected);
        }
    }

    private goBack(): void {
        // If we came from Pause, we might need logic to return to GameScene (paused)?
        // For now, simpler to just go to MainMenu if accessed from there.
        // But if accessed from PauseMenu, we likely want to stop settings and resume/show pause.
        // Let's assume for now we just switch back to MainMenu. 
        // Wait, if we are in-game, we don't want to go to MainMenu.
        // We can pass data to the scene or check which scene is sleeping?
        // Actually, PauseMenu is an overlay in GameScene. 
        // If we switch to SettingsScene *from* GameScene, GameScene will be paused/sleeping.

        // Let's check if GameScene is running (paused)
        const gameScene = this.scene.get('GameScene');
        if (gameScene.scene.isSleeping() || gameScene.scene.isPaused()) {
            this.scene.stop('SettingsScene');
            this.scene.resume('GameScene'); // Resume game (which should still have PauseMenu open effectively? Or we need to re-open it?)
            // Actually, usually Settings is an overlay too, but simpler as a separate scene.
            // If we resume GameScene, we need to make sure PauseMenu is still showing.
            // GameScene handles pause state.
        } else {
            this.scene.start('MainMenuScene');
        }
    }
}
