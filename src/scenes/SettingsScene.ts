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
            { label: 'Resolution: 1920 x 1080 (Locked)', value: 'res_static' },
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
        // The menuItems array aligns with settings array indices.
        // Let's use logic based on index.

        // Actually, let's fix the value retrieval.
        // The text objects don't currently store the value.
        // But map indices are stable.
        const settings = [
            { label: 'Camera Zoom: CLOSE (Default)', value: 'zoom' },
            { label: 'Resolution: 1920 x 1080 (Locked)', value: 'res_static' },
            { label: 'BACK', value: 'back' }
        ];
        const selectedValue = settings[this.selectedIndex].value;

        console.log('SettingsScene: selectOption', selectedValue);

        if (selectedValue === 'back') {
            this.goBack();
        } else if (selectedValue === 'zoom') {
            // Placeholder for zoom toggle (implemented in PauseMenu, here it's just visual for now)
            // If we want it to actually change global settings, we need a Global Config.
            console.log('Zoom toggle requested');
        } else if (selectedValue === 'res_static') {
            // Do nothing
        }
    }

    private goBack(): void {
        this.input.keyboard?.removeAllKeys();
        this.scene.stop();
        this.scene.resume('MainMenuScene');
    }
}
