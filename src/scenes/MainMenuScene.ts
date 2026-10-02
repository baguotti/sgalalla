import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager';
import { MenuInput } from '../input/MenuInput';
import { labSceneData } from '../lab/StudioLab';
import { enterFullscreenOnPhone, isPhone } from '../input/Touch';

export class MainMenuScene extends Phaser.Scene {
    private menuInput!: MenuInput;
    private canInput: boolean = false;
    private selectedIndex: number = 0;
    private menuOptions = [
        { label: 'CAMPAGNA', mode: 'campaign' },
        { label: 'ALLENAMENTO', mode: 'training' },
        { label: 'BOTTE IN LOCALE', mode: 'versus' },
        { label: 'BOTTE IN REMOTO', mode: 'online' },
        // CORSA (RacingScene) is hidden until it's ready: { label: 'CORSA', mode: 'racing' },
        { label: 'DERAPATE', mode: 'donut' },
        { label: 'STUDIO LAB', mode: 'lab' },
        { label: 'IMPOSTAZIONI', mode: 'settings' }
    ];
    private menuTexts: Phaser.GameObjects.Text[] = [];
    private itemSize = 40;

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

        // Menu items; the last sits 40 px above the bottom. On a phone, bigger and further apart for thumbs
        const phone = isPhone(this);
        this.itemSize = phone ? 58 : 40;
        const spacing = phone ? 70 : 55;
        const startY = height - 40 - (this.menuOptions.length - 1) * spacing;
        this.menuOptions.forEach((opt, index) => {
            const text = this.add.text(width / 2, startY + (index * spacing), opt.label, {
                fontSize: `${this.itemSize}px`, fontFamily: '"Pixeloid Sans"', color: '#888888'
            }).setOrigin(0.5);
            this.menuTexts.push(text);
            // Touch and mouse: a row the width of the menu, easy to hit with a thumb; tapping picks it
            text.setInteractive({
                hitArea: new Phaser.Geom.Rectangle(text.width / 2 - 360, -6, 720, text.height + 12),
                hitAreaCallback: Phaser.Geom.Rectangle.Contains,
                useHandCursor: true,
            });
            text.on('pointerover', () => {
                if (this.selectedIndex === index) return;
                this.selectedIndex = index;
                AudioManager.getInstance().playSFX('ui_menu_hover', { volume: 0.5 });
                this.updateSelection();
            });
            text.on('pointerup', () => {
                if (!this.canInput) return;
                this.selectedIndex = index;
                this.updateSelection();
                enterFullscreenOnPhone(this);
                this.selectOption(this.sys.game.device.input.touch ? 'TOUCH' : 'KEYBOARD');
            });
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
                text.setFontSize(this.itemSize);
                text.setShadow(0, 0, 'transparent', 0, false, false); // remove glow
            }
        });
    }

    private selectOption(input: 'KEYBOARD' | 'GAMEPAD' | 'TOUCH' = 'KEYBOARD', gamepadIndex: number | null = null): void {
        AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });
        const mode = this.menuOptions[this.selectedIndex].mode;
        // Only DERAPATE has touch controls; the other modes take a keyboard or gamepad as before
        const inputType = input === 'TOUCH' ? 'KEYBOARD' : input;

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

        if (mode === 'donut') {
            this.scene.start('DonutScene');
            return;
        }

        if (mode === 'racing') {
            this.scene.start('RacingScene');
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
