import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager';

export class MainMenuScene extends Phaser.Scene {
    private startKey!: Phaser.Input.Keyboard.Key;
    private upKey!: Phaser.Input.Keyboard.Key;
    private downKey!: Phaser.Input.Keyboard.Key;
    private enterKey!: Phaser.Input.Keyboard.Key;

    private canInput: boolean = false;
    private selectedIndex: number = 0;
    private prevGamepadA: Map<number, boolean> = new Map(); // Edge detection for A/Start
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

        // CRITICAL: Clear menu items from previous runs
        this.menuTexts = [];
        // ... (rest of create)

        // Visuals
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

        // Video Background
        if (this.cache.video.has('title_card_video')) {
            const video = this.add.video(width / 2, height / 2, 'title_card_video');
            // User requested scale 1.5 (likely to zoom in and crop, or fill specific aspect ratio)
            video.setMute(true); // Ensure autoplay works if the video has an audio track
            video.setScale(1.5).play(true); // true = loop
        }

        // Version Text
        this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 20, 'v1.0.15', {
            fontSize: '24px', fontFamily: '"Pixeloid Sans"', color: '#888888'
        }).setOrigin(1, 1);        // Menu Items
        const startY = height - 280; // Moved lower
        this.menuOptions.forEach((opt, index) => {
            const text = this.add.text(width / 2, startY + (index * 70), opt.label, {
                fontSize: '48px', fontFamily: '"Pixeloid Sans"', color: '#888888'
            }).setOrigin(0.5);



            this.menuTexts.push(text);
        });

        this.updateSelection();



        // Input Safety (Prevent ghost clicks)
        this.canInput = false;
        this.prevGamepadA.clear();
        this.lastGamepadInputTime = Date.now(); // Reset debounce
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
        // Always poll gamepads to track edge states (even during lockout)
        this.pollGamepadEdgeStates();

        if (!this.canInput) return;

        if (Phaser.Input.Keyboard.JustDown(this.upKey)) {
            this.changeSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.downKey)) {
            this.changeSelection(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.startKey) || Phaser.Input.Keyboard.JustDown(this.enterKey)) {
            // Sound removed per user request
            this.selectOption('KEYBOARD');
        }

        this.handleGamepad();
    }

    /** Track gamepad A/Start states every frame so held buttons from previous scenes get swallowed */
    private pollGamepadEdgeStates(): void {
        const gamepads = navigator.getGamepads();
        for (let i = 0; i < gamepads.length; i++) {
            const pad = gamepads[i];
            if (!pad) continue;

            const isSwitch = pad.id.toLowerCase().includes('nintendo') ||
                pad.id.toLowerCase().includes('switch') ||
                pad.id.toLowerCase().includes('joy-con') ||
                pad.id.toLowerCase().includes('pro controller');
            const logicalAIndex = isSwitch ? 1 : 0;

            const aPressed = pad.buttons[logicalAIndex]?.pressed || pad.buttons[9]?.pressed;
            if (!this.canInput) {
                // During lockout, just record the state so held buttons are consumed
                this.prevGamepadA.set(pad.index, !!aPressed);
            }
        }
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

            const isSwitch = pad.id.toLowerCase().includes('nintendo') ||
                pad.id.toLowerCase().includes('switch') ||
                pad.id.toLowerCase().includes('joy-con') ||
                pad.id.toLowerCase().includes('pro controller');

            const logicalAIndex = isSwitch ? 1 : 0;

            // A Button (0/1) or Start (9) to select — EDGE DETECTION
            const aPressed = pad.buttons[logicalAIndex]?.pressed || pad.buttons[9]?.pressed;
            const wasPressed = this.prevGamepadA.get(pad.index) ?? false;
            this.prevGamepadA.set(pad.index, !!aPressed);

            if (aPressed && !wasPressed) {
                // Sound removed per user request
                this.selectOption('GAMEPAD', pad.index);
                this.lastGamepadInputTime = now;
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
                text.setFontSize(48);
                text.setShadow(0, 0, 'transparent', 0, false, false); // remove glow
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
