import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload(): void {
        this.load.image('logo', 'assets/ui/logo.jpg');
        this.load.image('title_card', 'assets/ui/title_card.jpg');

        // Character Assets
        this.load.atlas('fok_v3', 'assets/fok_v3/fok_v3.png', 'assets/fok_v3/fok_v3.json');
        this.load.atlas('sga', 'assets/sga/sga.png', 'assets/sga/sga.json');
    }

    create(): void {
        const { width, height } = this.scale;

        // Black Background (Fallback)
        this.cameras.main.setBackgroundColor('#000000');

        // Background Image (Title Card)
        if (this.textures.exists('title_card')) {
            const bg = this.add.image(width / 2, height / 2, 'title_card');
            const scaleX = width / bg.width;
            const scaleY = height / bg.height;
            const scale = Math.max(scaleX, scaleY);
            bg.setScale(scale);
            // Darken slightly for logo/text contrast
            this.add.rectangle(0, 0, width, height, 0x000000, 0.3).setOrigin(0);
        }

        // Display Logo
        const logo = this.add.image(width / 2, height / 2, 'logo');
        logo.setOrigin(0.5);

        // Scale logo to fit within screen with some padding, maintaining aspect ratio
        const scaleX = (width * 0.8) / logo.width;
        const scaleY = (height * 0.8) / logo.height;
        const scale = Math.min(scaleX, scaleY);
        logo.setScale(scale);

        // Loading Text
        const loadingText = this.add.text(width / 2, height - 100, 'Loading...', {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: 'Arial'
        }).setOrigin(0.5);

        // Wait for Silkscreen font to load
        // @ts-ignore - document.fonts is not in all TS definitions
        document.fonts.load('1rem "Silkscreen"').then(() => {
            console.log('Font loaded');
            loadingText.setText('PRESS START');
            loadingText.setFontFamily('"Silkscreen"');
            loadingText.setFontSize(48);

            // Blink effect
            this.tweens.add({
                targets: loadingText,
                alpha: 0,
                duration: 500,
                yoyo: true,
                repeat: -1
            });

            this.setupInput();
        }).catch((err: any) => {
            console.error('Font loading failed:', err);
            // Fallback
            loadingText.setText('PRESS START');
            this.setupInput();
        });
    }

    private setupInput(): void {
        const proceed = () => {
            this.scene.start('MainMenuScene');
        };

        // Keyboard
        this.input.keyboard?.on('keydown-ENTER', proceed);
        this.input.keyboard?.on('keydown-SPACE', proceed);

        // Gamepad
        this.input.gamepad?.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
            if (button.index === 0 || button.index === 9) { // A or Start
                proceed();
            }
        });

        // Mouse/Touch
        this.input.on('pointerdown', proceed);
    }
}
