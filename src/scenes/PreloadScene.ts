import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload(): void {
        // this.load.image('logo', 'assets/ui/logo.jpg'); // Removed as file is deleted
        this.load.image('title_card', 'assets/ui/main_title.jpg');

        this.load.atlas('fok', 'assets/fok_v4/fok_v4.png', 'assets/fok_v4/fok_v4.json');
        this.load.atlas('sga', 'assets/sga/sga.png', 'assets/sga/sga.json');
        this.load.atlas('sgu', 'assets/sgu/sgu.png', 'assets/sgu/sgu.json');
        this.load.image('fok_icon', 'assets/fok_icon.png');
        this.load.image('sga_icon', 'assets/sga_icon.png');
        this.load.image('sgu_icon', 'assets/sgu_icon.png');
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
        }

        // Loading Text (uses system font initially - will switch once Pixeloid is confirmed)
        const loadingText = this.add.text(width / 2, height - 100, 'Loading...', {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: 'sans-serif'
        }).setOrigin(0.5);

        // ===== FONT LOADING =====
        // Self-hosted font with font-display: block ensures browser blocks until loaded.
        // Explicitly preload both weights, then wait for document.fonts.ready
        // before transitioning to scenes that create canvas text.
        Promise.all([
            // @ts-ignore
            document.fonts.load('400 1rem "Pixeloid Sans"'),
            // @ts-ignore
            document.fonts.load('700 1rem "Pixeloid Sans"'),
        ]).catch((err: any) => {
            console.warn('[PreloadScene] Font loading error (proceeding anyway):', err);
        });

        // Wait for ALL fonts to be ready before accepting input
        // @ts-ignore
        document.fonts.ready.then(() => {
            console.log('[PreloadScene] All document fonts ready');
            loadingText.setFontFamily('"Pixeloid Sans"');
            loadingText.setText('PRESS START');
            loadingText.setFontSize(48);

            // Blink effect
            this.tweens.add({
                targets: loadingText,
                alpha: 0,
                duration: 500,
                yoyo: true,
                repeat: -1
            });

            // Only now accept input (font is ready for all downstream scenes)
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
