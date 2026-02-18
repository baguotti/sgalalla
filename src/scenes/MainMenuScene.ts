import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager';

export class MainMenuScene extends Phaser.Scene {
    private startKey!: Phaser.Input.Keyboard.Key;
    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;

    private canInput: boolean = false;
    private selectedIndex: number = 0;
    private menuOptions = [
        { label: 'TRAINING', mode: 'training' },
        { label: 'BOTTE IN LOCALE', mode: 'versus' },
        { label: 'BOTTE IN REMOTO', mode: 'online' },
        { label: 'IMPOSTAZIONI', mode: 'settings' }
    ];
    private menuTexts: Phaser.GameObjects.Text[] = [];

    constructor() {
        super({ key: 'MainMenuScene' });
    }

    private debugText!: Phaser.GameObjects.Text;

    preload(): void {
        // ui_title_loop removed in favor of global music
        this.load.audio('ui_menu_hover', 'assets/audio/ui/ui_menu_hover.wav');
        this.load.audio('ui_confirm', 'assets/audio/ui/ui_confirm.wav');
        this.load.audio('ui_back', 'assets/audio/ui/ui_back.wav');
    }

    create(): void {
        const { width, height } = this.scale;

        // Ensure Global Music is playing and at correct volume
        const music = this.sound.get('global_music_loop');
        if (music) {
            if (!music.isPlaying) {
                music.play({ loop: true, volume: 0.8 });
            } else {
                // Tween volume back to user setting if it was lowered
                this.tweens.add({
                    targets: music,
                    volume: AudioManager.getInstance().getMusicVolume(),
                    duration: 1000
                });
            }
        }

        // CRITICAL: Clear menu items from previous runs
        this.menuTexts = [];
        // ... (rest of create)

        // Visuals
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

        // Video Background
        if (this.cache.video.has('title_card_video')) {
            const video = this.add.video(width / 2, height / 2, 'title_card_video');
            // User requested scale 1.5 (likely to zoom in and crop, or fill specific aspect ratio)
            video.setScale(1.5).play(true); // true = loop
        }

        // Title Text
        this.add.text(width / 2, 200, 'SUPER SMASH FIOI', {
            fontSize: '80px', fontFamily: '"Pixeloid Sans"', color: '#ffffff'
        }).setOrigin(0.5);



        // Version Text (Below Title)
        this.add.text(width / 2, 260, 'v0.13.4', {
            fontSize: '24px', fontFamily: '"Pixeloid Sans"', color: '#888888'
        }).setOrigin(0.5);


        // Version (Removed - combined with subtitle)

        // Menu Items
        const startY = 650; // Moved down from 420
        this.menuOptions.forEach((opt, index) => {
            const text = this.add.text(width / 2, startY + (index * 90), opt.label, {
                fontSize: '48px', fontFamily: '"Pixeloid Sans"', color: '#888888'
            }).setOrigin(0.5);



            this.menuTexts.push(text);
        });

        this.updateSelection();

        // DEBUG: Gamepad Status
        this.debugText = this.add.text(10, 10, 'Gamepad: ???', { fontSize: '16px', color: '#00ff00', fontFamily: '"Pixeloid Sans"' });


        this.input.gamepad?.on('connected', (pad: Phaser.Input.Gamepad.Gamepad) => {
            this.debugText.setText(`Gamepad Connected: ${pad.id}`);
        });

        // Input Safety (Prevent ghost clicks)
        this.time.delayedCall(500, () => {
            this.canInput = true;
            this.startKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
            this.upKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
            this.downKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
            this.enterKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        });

        // Cleanup
        this.events.once('shutdown', () => {
            this.input.gamepad?.off('connected');

            // PHASER BUG FIX: GamepadPlugin.stopListeners crashes on sparse arrays (e.g. pad index 1 w/o 0)
            if (this.input.gamepad && Array.isArray(this.input.gamepad.gamepads)) {
                // Filter out null/undefined slots so stopListeners loop doesn't crash
                // @ts-ignore - gamepads is technically readonly in types but mutable in JS
                this.input.gamepad.gamepads = this.input.gamepad.gamepads.filter(p => !!p);
            }
        });
    }

    update(): void {
        const gamepads = navigator.getGamepads();
        let debugStr = 'Gamepads:\n';
        for (let i = 0; i < gamepads.length; i++) {
            const gp = gamepads[i];
            if (gp) {
                debugStr += `[${i}] ${gp.id.substring(0, 20)}...\n`;
            }
        }
        this.debugText.setText(debugStr);

        if (!this.canInput) return;

        if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
            this.changeSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
            this.changeSelection(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.startKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            this.selectOption('KEYBOARD');
        }

        this.handleGamepad();
    }

    private lastGamepadInputTime: number = 0;

    private handleGamepad(): void {
        const gamepads = navigator.getGamepads();
        const now = Date.now();

        // Throttle input to prevent super fast scrolling (200ms delay)
        if (now - this.lastGamepadInputTime < 150) {
            return;
        }

        for (let i = 0; i < gamepads.length; i++) {
            const pad = gamepads[i];
            if (!pad) continue;

            const axisY = pad.axes[1]; // float value

            let moved = false;

            if (axisY < -0.5) {
                this.changeSelection(-1);
                moved = true;
            } else if (axisY > 0.5) {
                this.changeSelection(1);
                moved = true;
            }

            // D-Pad support
            if (!moved) {
                if (pad.buttons[12].pressed) { // D-Pad Up
                    this.changeSelection(-1);
                    moved = true;
                } else if (pad.buttons[13].pressed) { // D-Pad Down
                    this.changeSelection(1);
                    moved = true;
                }
            }

            if (moved) {
                this.lastGamepadInputTime = now;
            }

            // A Button (0) or Start (9) to select
            // Manual debounce for buttons usually not needed as much for selection, but good to have
            if (pad.buttons[0].pressed || pad.buttons[9].pressed) {
                if (now - this.lastGamepadInputTime > 300) { // Longer debounce for select
                    this.selectOption('GAMEPAD', pad.index);
                    this.lastGamepadInputTime = now;
                }
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
            } else {
                text.setColor('#888888');
                text.setAlpha(0.5);
                text.setFontSize(48);
            }
        });
    }

    private selectOption(inputType: 'KEYBOARD' | 'GAMEPAD' = 'KEYBOARD', gamepadIndex: number | null = null): void {
        AudioManager.getInstance().playSFX('ui_confirm', { volume: 0.5 });
        const mode = this.menuOptions[this.selectedIndex].mode;

        // Handle Online Quick Join
        if (mode === 'online') {
            this.scene.start('OnlineGameScene');
            return;
        }

        if (mode === 'settings') {
            this.scene.start('SettingsScene');
            return;
        }

        // Local Game (training or versus) - Pass input type and gamepad index
        this.scene.start('LobbyScene', { mode: mode, inputType: inputType, gamepadIndex: gamepadIndex });
    }
}
