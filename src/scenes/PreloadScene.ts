import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager';

export class PreloadScene extends Phaser.Scene {
    constructor() {
        super({ key: 'PreloadScene' });
    }

    preload(): void {
        this.load.image('title_card', 'assets/ui/main_title.jpg');
        this.load.video('title_card_video', 'assets/ui/Main_menu/Main_Menu_Animation_001.mp4'); // Load video

        this.load.atlas('fok', 'assets/fok/fok.png', 'assets/fok/fok.json');
        this.load.atlas('sgu', 'assets/sgu/sgu.png', 'assets/sgu/sgu.json');
        this.load.atlas('sga', 'assets/sga/sga.png', 'assets/sga/sga.json');
        this.load.atlas('pe', 'assets/pe/pe.png', 'assets/pe/pe.json');
        this.load.atlas('nock', 'assets/nock/nock.png', 'assets/nock/nock.json');
        this.load.atlas('greg', 'assets/greg/greg.png', 'assets/greg/greg.json');
        // Load Global Music
        this.load.audio('global_music_loop', 'assets/audio/music/manici_intro_002_loop.mp3');
        this.load.audio('ui_player_found', 'assets/audio/ui/ui_player_found.wav');
    }

    create(): void {
        // Music will replace user interaction to satisfy browser policies
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
        const proceed = async () => {
            // Resume Audio Context (Browser Policy)
            if (this.sound instanceof Phaser.Sound.WebAudioSoundManager) {
                if (this.sound.context.state === 'suspended') {
                    await this.sound.context.resume();
                }
            }

            // Start Global Music (if not already playing)
            const audioManager = AudioManager.getInstance();
            audioManager.init(this);

            if (!this.sound.get('global_music_loop')) {
                this.sound.play('global_music_loop', { loop: true, volume: audioManager.getMusicVolume() });
            }

            this.sound.play('ui_player_found', { volume: 0.5 });
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
