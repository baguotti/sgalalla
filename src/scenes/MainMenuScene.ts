import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager';
import { MenuInput } from '../input/MenuInput';
import { labSceneData } from '../lab/StudioLab';

export class MainMenuScene extends Phaser.Scene {
    private menuInput!: MenuInput;
    private canInput: boolean = false;
    private selectedIndex: number = 0;
    private menuOptions = [
        { label: 'CAMPAGNA', mode: 'campaign' },
        { label: 'ALLENAMENTO', mode: 'training' },
        { label: 'BOTTE IN LOCALE', mode: 'versus' },
        { label: 'BOTTE IN REMOTO', mode: 'online' },
        { label: 'STUDIO LAB', mode: 'lab' },
        { label: 'IMPOSTAZIONI', mode: 'settings' }
    ];
    private menuTexts: Phaser.GameObjects.Text[] = [];

    constructor() {
        super({ key: 'MainMenuScene' });
    }



    preload(): void {
        const cb = `?v=${Date.now() + 1}`;
        this.load.audio('ui_menu_hover', 'assets/audio/ui/ui_menu_hover.wav' + cb);
        this.load.audio('ui_confirm', 'assets/audio/sfx/ui/ui_confirm.wav' + cb);
        this.load.audio('ui_back', 'assets/audio/ui/ui_back.wav' + cb);
        this.load.audio('sfx_ui_press_start', 'assets/audio/sfx/ui/ui_press_start.wav' + cb);
    }

    create(): void {
        this.cameras.main.setBackgroundColor('#2d2d2d');

        const { width, height } = this.scale;

        // Ensure Global Music is playing and at correct volume
        const music = this.sound.get('global_music_loop');
        if (music) {
            if (!music.isPlaying) {
                music.play({ loop: true, volume: 0.3 });
            } else {
                // Tween volume back to user setting if it was lowered
                this.tweens.add({
                    targets: music,
                    volume: AudioManager.getInstance().getMusicVolume(),
                    duration: 1000
                });
            }
        }

        // The scene object survives restarts: drop the previous run's menu items
        this.menuTexts = [];

        // Visuals
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

        // Video Background
        if (this.cache.video.has('title_card_video')) {
            const video = this.add.video(width / 2, height / 2, 'title_card_video');
            // Slightly zoomed so the video fills the screen
            video.setMute(true); // Ensure autoplay works if the video has an audio track
            video.setScale(1.505).play(true); // true = loop
        }

        // The version from package.json; the experimental "3.0.1-e" shows as v3.0.1e
        this.add.text(this.scale.width - 20, this.scale.height - 20, `v${__APP_VERSION__.replace('-', '')}`, {
            fontSize: '18px', fontFamily: '"Pixeloid Sans"', color: '#888888'
        }).setOrigin(1, 1);

        // Menu items; the last sits 40 px above the bottom
        const startY = height - 40 - (this.menuOptions.length - 1) * 55;
        this.menuOptions.forEach((opt, index) => {
            const text = this.add.text(width / 2, startY + (index * 55), opt.label, {
                fontSize: '40px', fontFamily: '"Pixeloid Sans"', color: '#888888'
            }).setOrigin(0.5);
            this.menuTexts.push(text);
        });

        this.updateSelection();

        // Ignore input for half a second, so a press from the previous screen doesn't carry over
        this.menuInput = new MenuInput(this);
        this.canInput = false;
        this.time.delayedCall(500, () => this.canInput = true);
    }

    update(): void {
        // Polled during the lockout too, so what's pressed then is used up
        const presses = this.menuInput.poll();
        if (!this.canInput) return;

        for (const { action, pad } of presses) {
            if (action === 'up') this.changeSelection(-1);
            else if (action === 'down') this.changeSelection(1);
            else if (action === 'confirm' || action === 'start') {
                this.selectOption(pad === null ? 'KEYBOARD' : 'GAMEPAD', pad);
                return;
            }
        }
    }

    private changeSelection(dir: number): void {
        AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 });
        this.selectedIndex = (this.selectedIndex + dir + this.menuOptions.length) % this.menuOptions.length;
        this.updateSelection();
    }

    private updateSelection(): void {
        this.menuTexts.forEach((text, index) => {
            if (index === this.selectedIndex) {
                text.setColor('#ffffff');
                text.setAlpha(1);
                text.setShadow(0, 0, '#ffffff', 8, false, true); // subtle glow
            } else {
                text.setColor('#888888');
                text.setAlpha(0.5);
                text.setFontSize(40);
                text.setShadow(0, 0, 'transparent', 0, false, false); // remove glow
            }
        });
    }

    private selectOption(inputType: 'KEYBOARD' | 'GAMEPAD' = 'KEYBOARD', gamepadIndex: number | null = null): void {
        AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });
        const mode = this.menuOptions[this.selectedIndex].mode;

        if (mode === 'online') {
            this.scene.start('OnlineLobbyScene');
            return;
        }

        if (mode === 'campaign') {
            this.scene.start('SaveFileScene', { mode: 'campaign', inputType: inputType, gamepadIndex: gamepadIndex });
            return;
        }

        if (mode === 'settings') {
            this.scene.start('SettingsScene');
            return;
        }

        if (mode === 'lab') {
            this.scene.start('GameScene', labSceneData());
            return;
        }

        // Local Game (training or versus) - Pass input type and gamepad index
        this.scene.start('LobbyScene', { mode: mode, inputType: inputType, gamepadIndex: gamepadIndex });
    }
}
