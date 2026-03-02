import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager';
import { VideoManager } from '../managers/VideoManager';
import { getConfirmButtonIndex, getBackButtonIndex, getMenuNavX, getMenuNavY } from '../input/JoyConMapper';
import { GamepadMapping, BUTTON_NAMES, ACTION_LABELS } from '../input/GamepadMapping';
import type { GameAction } from '../input/GamepadMapping';

type ScreenMode = 'MAIN' | 'AUDIO' | 'VIDEO' | 'CONTROLLER';

export class SettingsScene extends Phaser.Scene {
    // Main menu
    private options = ['SONORO', 'VIDEO', 'CONTROLLER', 'BACK'];
    private selectedIndex = 0;
    private menuTexts: Phaser.GameObjects.Text[] = [];
    private menuValueTexts: Phaser.GameObjects.Text[] = [];
    private mainContainer!: Phaser.GameObjects.Container;

    // Audio menu
    private audioOptions = ['MUSIC', 'SFX', 'BACK'];
    private audioSelectedIndex = 0;
    private audioTexts: Phaser.GameObjects.Text[] = [];
    private audioValueTexts: Phaser.GameObjects.Text[] = [];
    private audioContainer!: Phaser.GameObjects.Container;

    // Video menu
    private videoOptions = ['EFFETTO CRT', 'BACK'];
    private videoSelectedIndex = 0;
    private videoTexts: Phaser.GameObjects.Text[] = [];
    private videoValueTexts: Phaser.GameObjects.Text[] = [];
    private videoContainer!: Phaser.GameObjects.Container;

    // Controller remap screen
    private controllerActions: GameAction[] = ['jump', 'lightAttack', 'heavyAttack', 'heavyAttack2', 'dodge', 'taunt'];
    private controllerOptions: string[] = []; // Filled dynamically
    private controllerSelectedIndex = 0;
    private controllerTexts: Phaser.GameObjects.Text[] = [];
    private controllerValueTexts: Phaser.GameObjects.Text[] = [];
    private controllerContainer!: Phaser.GameObjects.Container;

    private audioManager: AudioManager;
    private screenMode: ScreenMode = 'MAIN';

    // Rebinding state
    private isListening: boolean = false;
    private listeningAction: GameAction | null = null;
    private listeningText: Phaser.GameObjects.Text | null = null;
    private listeningFlashTimer: number = 0;

    // Keys
    private keyUp!: Phaser.Input.Keyboard.Key;
    private keyDown!: Phaser.Input.Keyboard.Key;
    private keyLeft!: Phaser.Input.Keyboard.Key;
    private keyRight!: Phaser.Input.Keyboard.Key;
    private keyEnter!: Phaser.Input.Keyboard.Key;
    private keyEsc!: Phaser.Input.Keyboard.Key;
    private keySpace!: Phaser.Input.Keyboard.Key;

    private canInput: boolean = false;
    private returnScene: string = 'MainMenuScene';

    constructor() {
        super({ key: 'SettingsScene' });
        this.audioManager = AudioManager.getInstance();
    }

    init(data: any): void {
        this.returnScene = data?.returnScene || 'MainMenuScene';
    }

    create(): void {
        const { width, height } = this.scale;

        // Reset state
        this.menuTexts = [];
        this.menuValueTexts = [];
        this.audioTexts = [];
        this.audioValueTexts = [];
        this.videoTexts = [];
        this.videoValueTexts = [];
        this.controllerTexts = [];
        this.controllerValueTexts = [];
        this.screenMode = 'MAIN';
        this.isListening = false;
        this.listeningAction = null;

        // Background
        const bgAlpha = this.returnScene !== 'MainMenuScene' ? 0.9 : 1.0;
        this.add.rectangle(0, 0, width, height, 0x000000, bgAlpha).setOrigin(0);

        // Title
        this.add.text(width / 2, 100, 'IMPOSTAZIONI', {
            fontSize: '64px',
            fontFamily: '"Pixeloid Sans"',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Containers
        this.mainContainer = this.add.container(0, 0);
        this.createMenuUI();

        this.audioContainer = this.add.container(0, 0);
        this.audioContainer.setVisible(false);
        this.createAudioUI();

        this.videoContainer = this.add.container(0, 0);
        this.videoContainer.setVisible(false);
        this.createVideoUI();

        this.controllerContainer = this.add.container(0, 0);
        this.controllerContainer.setVisible(false);
        this.createControllerUI();

        // Input
        this.keyUp = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.keyDown = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.keyLeft = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        this.keyRight = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
        this.keyEnter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // Delay input activation
        this.time.delayedCall(500, () => {
            this.canInput = true;
        });

        this.updateSelection();

        // Cleanup
        this.events.once('shutdown', () => {
            if (this.input.gamepad && Array.isArray(this.input.gamepad.gamepads)) {
                // @ts-ignore
                this.input.gamepad.gamepads = this.input.gamepad.gamepads.filter(p => !!p);
            }
        });
    }

    // ─── Main Menu UI ───

    private createMenuUI(): void {
        const { width, height } = this.scale;
        const startY = height / 2 - 80;
        const gap = 70;

        this.options.forEach((opt, index) => {
            const y = startY + index * gap;

            const text = this.add.text(width / 2 - 100, y, opt, {
                fontSize: '40px',
                fontFamily: '"Pixeloid Sans"',
                color: '#888888'
            }).setOrigin(1, 0.5);
            this.menuTexts.push(text);
            this.mainContainer.add(text);

            if (opt === 'SONORO' || opt === 'VIDEO' || opt === 'CONTROLLER') {
                const valText = this.add.text(width / 2 + 50, y, '→', {
                    fontSize: '40px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#666666'
                }).setOrigin(0, 0.5);
                this.menuValueTexts.push(valText);
                this.mainContainer.add(valText);
            } else {
                this.menuValueTexts.push(null as any);
                text.setX(width / 2);
                text.setOrigin(0.5);
            }
        });
    }

    // ─── Audio Menu UI ───

    private createAudioUI(): void {
        const { width, height } = this.scale;
        const startY = height / 2 - 50;
        const gap = 80;

        const subtitle = this.add.text(width / 2, 180, 'SONORO', {
            fontSize: '36px',
            fontFamily: '"Pixeloid Sans"',
            color: '#FF9F1C'
        }).setOrigin(0.5);
        this.audioContainer.add(subtitle);

        this.audioOptions.forEach((opt, index) => {
            const y = startY + index * gap;

            const text = this.add.text(width / 2 - 100, y, opt, {
                fontSize: '40px',
                fontFamily: '"Pixeloid Sans"',
                color: '#888888'
            }).setOrigin(1, 0.5);
            this.audioTexts.push(text);
            this.audioContainer.add(text);

            if (opt === 'MUSIC' || opt === 'SFX') {
                const valText = this.add.text(width / 2 + 50, y, '', {
                    fontSize: '40px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#ffffff'
                }).setOrigin(0, 0.5);
                this.audioValueTexts.push(valText);
                this.audioContainer.add(valText);
                this.updateAudioValueText(index);
            } else {
                this.audioValueTexts.push(null as any);
                text.setX(width / 2);
                text.setOrigin(0.5);
            }
        });
    }

    private updateAudioValueText(index: number): void {
        const opt = this.audioOptions[index];
        const valText = this.audioValueTexts[index];
        if (!valText) return;

        let val = 0;
        if (opt === 'MUSIC') val = this.audioManager.getMusicVolume();
        if (opt === 'SFX') val = this.audioManager.getSFXVolume();

        const displayVal = Math.round(val * 10);
        valText.setText(`< ${displayVal} >`);
    }

    // ─── Video Menu UI ───

    private createVideoUI(): void {
        const { width, height } = this.scale;
        const startY = height / 2 - 50;
        const gap = 80;

        const subtitle = this.add.text(width / 2, 180, 'VIDEO', {
            fontSize: '36px',
            fontFamily: '"Pixeloid Sans"',
            color: '#FF9F1C'
        }).setOrigin(0.5);
        this.videoContainer.add(subtitle);

        const videoMgr = VideoManager.getInstance();

        this.videoOptions.forEach((opt, index) => {
            const y = startY + index * gap;

            const text = this.add.text(width / 2 - 100, y, opt, {
                fontSize: '40px',
                fontFamily: '"Pixeloid Sans"',
                color: '#888888'
            }).setOrigin(1, 0.5);
            this.videoTexts.push(text);
            this.videoContainer.add(text);

            if (opt === 'EFFETTO CRT') {
                const label = this.getCrtLabel(videoMgr.getCrtIntensity());
                const color = videoMgr.isCrtEnabled() ? '#2EC4B6' : '#666666';
                const valText = this.add.text(width / 2 + 50, y, label, {
                    fontSize: '40px',
                    fontFamily: '"Pixeloid Sans"',
                    color
                }).setOrigin(0, 0.5);
                this.videoValueTexts.push(valText);
                this.videoContainer.add(valText);
            } else {
                this.videoValueTexts.push(null as any);
                text.setX(width / 2);
                text.setOrigin(0.5);
            }
        });
    }

    private getCrtLabel(intensity: number): string {
        if (intensity === 0) return 'OFF';
        if (intensity === 1) return 'BASSO';
        if (intensity === 2) return 'MEDIO';
        return 'ALTO';
    }

    private refreshVideoValues(): void {
        const videoMgr = VideoManager.getInstance();
        const crtIndex = this.videoOptions.indexOf('EFFETTO CRT');
        if (crtIndex >= 0) {
            const valText = this.videoValueTexts[crtIndex];
            if (valText) {
                const intensity = videoMgr.getCrtIntensity();
                valText.setText(this.getCrtLabel(intensity));
                valText.setColor(intensity > 0 ? '#2EC4B6' : '#666666');
            }
        }
    }

    // ─── Controller Remap UI ───

    private createControllerUI(): void {
        const { width, height } = this.scale;

        this.controllerOptions = this.controllerActions.map(a => ACTION_LABELS[a]);
        this.controllerOptions.push('INVERT Y AXIS');
        this.controllerOptions.push('RESET DEFAULTS');
        this.controllerOptions.push('BACK');

        const subtitle = this.add.text(width / 2, 180, 'CONTROLLER MAPPING', {
            fontSize: '36px',
            fontFamily: '"Pixeloid Sans"',
            color: '#FF9F1C'
        }).setOrigin(0.5);
        this.controllerContainer.add(subtitle);

        const hint = this.add.text(width / 2, 220, 'PREMI START PER REMAPPARE', {
            fontSize: '18px',
            fontFamily: '"Pixeloid Sans"',
            color: '#666666'
        }).setOrigin(0.5);
        this.controllerContainer.add(hint);

        const startY = height / 2 - 120;
        const gap = 55;
        const mapping = GamepadMapping.getInstance();

        this.controllerOptions.forEach((label, index) => {
            const y = startY + index * gap;

            const text = this.add.text(width / 2 - 150, y, label, {
                fontSize: '32px',
                fontFamily: '"Pixeloid Sans"',
                color: '#888888'
            }).setOrigin(1, 0.5);
            this.controllerTexts.push(text);
            this.controllerContainer.add(text);

            if (index < this.controllerActions.length) {
                const action = this.controllerActions[index];
                const btnIdx = mapping.getButtonForAction(action);
                const btnName = BUTTON_NAMES[btnIdx] || `BTN ${btnIdx}`;

                const valText = this.add.text(width / 2 + 20, y, btnName, {
                    fontSize: '32px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#4361EE'
                }).setOrigin(0, 0.5);
                this.controllerValueTexts.push(valText);
                this.controllerContainer.add(valText);
            } else if (label === 'INVERT Y AXIS') {
                const invertVal = mapping.getInvertY() ? 'ON' : 'OFF';
                const valText = this.add.text(width / 2 + 20, y, invertVal, {
                    fontSize: '32px',
                    fontFamily: '"Pixeloid Sans"',
                    color: mapping.getInvertY() ? '#2EC4B6' : '#666666'
                }).setOrigin(0, 0.5);
                this.controllerValueTexts.push(valText);
                this.controllerContainer.add(valText);
            } else {
                this.controllerValueTexts.push(null as any);
                text.setX(width / 2);
                text.setOrigin(0.5);
            }
        });
    }

    private refreshControllerValues(): void {
        const mapping = GamepadMapping.getInstance();
        this.controllerActions.forEach((action, index) => {
            const valText = this.controllerValueTexts[index];
            if (valText) {
                const btnIdx = mapping.getButtonForAction(action);
                valText.setText(BUTTON_NAMES[btnIdx] || `BTN ${btnIdx}`);
                valText.setColor('#4361EE');
            }
        });

        const invertIndex = this.controllerOptions.indexOf('INVERT Y AXIS');
        if (invertIndex >= 0) {
            const valText = this.controllerValueTexts[invertIndex];
            if (valText) {
                const isInverted = mapping.getInvertY();
                valText.setText(isInverted ? 'ON' : 'OFF');
                valText.setColor(isInverted ? '#2EC4B6' : '#666666');
            }
        }
    }

    // ─── Update Loop ───

    update(_time: number, delta: number): void {
        if (!this.canInput) return;

        if (this.isListening && this.listeningText) {
            this.listeningFlashTimer += delta;
            const show = Math.floor(this.listeningFlashTimer / 400) % 2 === 0;
            this.listeningText.setAlpha(show ? 1 : 0.3);
            this.pollGamepadForRebind();
            return;
        }

        if (this.screenMode === 'MAIN') {
            this.updateMainMenu();
        } else if (this.screenMode === 'AUDIO') {
            this.updateAudioMenu();
        } else if (this.screenMode === 'VIDEO') {
            this.updateVideoMenu();
        } else if (this.screenMode === 'CONTROLLER') {
            this.updateControllerMenu();
        }

        this.handleGamepad();
    }

    private updateMainMenu(): void {
        if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
            this.changeSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
            this.changeSelection(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyEnter) || Phaser.Input.Keyboard.JustDown(this.keySpace)) {
            this.confirmSelection();
        } else if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
            this.goBack();
        }
    }

    private updateAudioMenu(): void {
        if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
            this.changeAudioSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
            this.changeAudioSelection(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyLeft)) {
            this.modifyAudioValue(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyRight)) {
            this.modifyAudioValue(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyEnter) || Phaser.Input.Keyboard.JustDown(this.keySpace)) {
            this.confirmAudioSelection();
        } else if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
            this.goBack();
        }
    }

    private updateVideoMenu(): void {
        if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
            this.changeVideoSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
            this.changeVideoSelection(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyEnter) || Phaser.Input.Keyboard.JustDown(this.keySpace)) {
            this.confirmVideoSelection();
        } else if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
            this.goBack();
        }
    }

    private updateControllerMenu(): void {
        if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
            this.changeControllerSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
            this.changeControllerSelection(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyEnter) || Phaser.Input.Keyboard.JustDown(this.keySpace)) {
            this.confirmControllerSelection();
        } else if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
            this.goBack();
        }
    }

    // ─── Gamepad Navigation ───

    private previousAxis: Map<number, { x: number, y: number }> = new Map();
    private previousButtons: Map<number, { a: boolean; b: boolean; start: boolean }> = new Map();

    private handleGamepad(): void {
        const pads = this.input.gamepad?.gamepads;
        if (!pads) return;

        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i];
            if (!pad) continue;

            const rawGp = navigator.getGamepads()[pad.index];
            if (!rawGp) continue;

            const navX = getMenuNavX(rawGp);
            const navY = getMenuNavY(rawGp);

            if (!this.previousAxis.has(pad.index)) this.previousAxis.set(pad.index, { x: 0, y: 0 });
            if (!this.previousButtons.has(pad.index)) this.previousButtons.set(pad.index, { a: false, b: false, start: false });

            const prevAxis = this.previousAxis.get(pad.index)!;
            const prevBtns = this.previousButtons.get(pad.index)!;

            // NAV Y
            if (navY < 0 && prevAxis.y >= 0) {
                if (this.screenMode === 'MAIN') this.changeSelection(-1);
                else if (this.screenMode === 'AUDIO') this.changeAudioSelection(-1);
                else if (this.screenMode === 'VIDEO') this.changeVideoSelection(-1);
                else if (this.screenMode === 'CONTROLLER') this.changeControllerSelection(-1);
            } else if (navY > 0 && prevAxis.y <= 0) {
                if (this.screenMode === 'MAIN') this.changeSelection(1);
                else if (this.screenMode === 'AUDIO') this.changeAudioSelection(1);
                else if (this.screenMode === 'VIDEO') this.changeVideoSelection(1);
                else if (this.screenMode === 'CONTROLLER') this.changeControllerSelection(1);
            }

            // NAV X (volume sliders in AUDIO screen)
            if (this.screenMode === 'AUDIO') {
                if (navX < 0 && prevAxis.x >= 0) this.modifyAudioValue(-1);
                else if (navX > 0 && prevAxis.x <= 0) this.modifyAudioValue(1);
            }

            // A (Confirm)
            const confirmIdx = getConfirmButtonIndex(rawGp);
            const isA = rawGp.buttons[confirmIdx]?.pressed;
            if (isA && !prevBtns.a) {
                if (this.screenMode === 'MAIN') this.confirmSelection();
                else if (this.screenMode === 'AUDIO') this.confirmAudioSelection();
                else if (this.screenMode === 'VIDEO') this.confirmVideoSelection();
                else if (this.screenMode === 'CONTROLLER') this.confirmControllerSelection('A');
                prevBtns.a = true;
            } else if (!isA) {
                prevBtns.a = false;
            }

            // START (Alternate Confirm, required for remapping)
            const isStart = rawGp.buttons[9]?.pressed;
            if (isStart && !prevBtns.start) {
                if (this.screenMode === 'MAIN') this.confirmSelection();
                else if (this.screenMode === 'AUDIO') this.confirmAudioSelection();
                else if (this.screenMode === 'VIDEO') this.confirmVideoSelection();
                else if (this.screenMode === 'CONTROLLER') this.confirmControllerSelection('START');
                prevBtns.start = true;
            } else if (!isStart) {
                prevBtns.start = false;
            }

            // B (Back) - active in MAIN, AUDIO, VIDEO but disabled in CONTROLLER so it can be remapped
            const backIdx = getBackButtonIndex(rawGp);
            const isB = rawGp.buttons[backIdx]?.pressed;
            if (isB && !prevBtns.b) {
                if (this.screenMode !== 'CONTROLLER') {
                    this.goBack();
                }
                prevBtns.b = true;
            } else if (!isB) {
                prevBtns.b = false;
            }

            this.previousAxis.set(pad.index, { x: navX, y: navY });
        }
    }

    // ─── Rebind Logic ───

    private pollGamepadForRebind(): void {
        const pads = this.input.gamepad?.gamepads;
        if (!pads) return;

        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i];
            if (!pad) continue;

            const rawGp = navigator.getGamepads()[pad.index];
            if (!rawGp) continue;

            for (let b = 0; b < rawGp.buttons.length; b++) {
                if (b === 8 || b === 9) continue; // Skip BACK/START
                if (b === 10) continue; // Skip L3

                const pressed = rawGp.buttons[b]?.pressed || false;
                const value = rawGp.buttons[b]?.value || 0;
                if (pressed || value > 0.5) {
                    this.applyRebind(b);
                    return;
                }
            }
        }
    }

    private startListening(action: GameAction, index: number): void {
        this.isListening = true;
        this.listeningAction = action;
        this.listeningFlashTimer = 0;

        const valText = this.controllerValueTexts[index];
        if (valText) {
            valText.setText('PRESS…');
            valText.setColor('#FF006E');
            this.listeningText = valText;
        }
    }

    private applyRebind(buttonIndex: number): void {
        if (!this.listeningAction) return;

        const mapping = GamepadMapping.getInstance();
        mapping.setButtonForAction(this.listeningAction, buttonIndex);
        this.audioManager.playSFX('ui_confirm', { volume: 0.5 });

        this.isListening = false;
        this.listeningAction = null;
        this.listeningText = null;

        this.refreshControllerValues();
        this.updateControllerHighlight();
    }

    // ─── Selection Logic ───

    private changeSelection(dir: number): void {
        this.audioManager.playSFX('ui_menu_hover', { volume: 0.5 });
        this.selectedIndex = (this.selectedIndex + dir + this.options.length) % this.options.length;
        this.updateSelection();
    }

    private changeAudioSelection(dir: number): void {
        this.audioManager.playSFX('ui_menu_hover', { volume: 0.5 });
        this.audioSelectedIndex = (this.audioSelectedIndex + dir + this.audioOptions.length) % this.audioOptions.length;
        this.updateAudioHighlight();
    }

    private changeVideoSelection(dir: number): void {
        this.audioManager.playSFX('ui_menu_hover', { volume: 0.5 });
        this.videoSelectedIndex = (this.videoSelectedIndex + dir + this.videoOptions.length) % this.videoOptions.length;
        this.updateVideoHighlight();
    }

    private changeControllerSelection(dir: number): void {
        this.audioManager.playSFX('ui_menu_hover', { volume: 0.5 });
        this.controllerSelectedIndex = (this.controllerSelectedIndex + dir + this.controllerOptions.length) % this.controllerOptions.length;
        this.updateControllerHighlight();
    }

    private modifyAudioValue(dir: number): void {
        const opt = this.audioOptions[this.audioSelectedIndex];
        if (opt !== 'MUSIC' && opt !== 'SFX') return;

        const step = 0.1;
        if (opt === 'MUSIC') {
            const current = this.audioManager.getMusicVolume();
            this.audioManager.setMusicVolume(current + (dir * step));
        } else if (opt === 'SFX') {
            const current = this.audioManager.getSFXVolume();
            this.audioManager.setSFXVolume(current + (dir * step));
            this.audioManager.playSFX('ui_menu_hover');
        }
        this.updateAudioValueText(this.audioSelectedIndex);
    }

    private confirmSelection(): void {
        const opt = this.options[this.selectedIndex];
        if (opt === 'BACK') {
            this.goBack();
        } else if (opt === 'SONORO') {
            this.enterAudioScreen();
        } else if (opt === 'VIDEO') {
            this.enterVideoScreen();
        } else if (opt === 'CONTROLLER') {
            this.enterControllerScreen();
        }
    }

    private confirmAudioSelection(): void {
        const opt = this.audioOptions[this.audioSelectedIndex];
        if (opt === 'BACK') {
            this.goBack();
        } else {
            this.audioManager.playSFX('ui_confirm', { volume: 0.5 });
        }
    }

    private confirmVideoSelection(): void {
        const opt = this.videoOptions[this.videoSelectedIndex];
        if (opt === 'BACK') {
            this.goBack();
        } else if (opt === 'EFFETTO CRT') {
            VideoManager.getInstance().cycleCrt();
            this.refreshVideoValues();
            this.updateVideoHighlight();
            this.audioManager.playSFX('ui_confirm', { volume: 0.5 });
        }
    }

    private confirmControllerSelection(trigger: 'A' | 'START' | 'KEYBOARD' = 'KEYBOARD'): void {
        const idx = this.controllerSelectedIndex;

        if (idx < this.controllerActions.length) {
            if (trigger === 'START' || trigger === 'KEYBOARD') {
                this.startListening(this.controllerActions[idx], idx);
            }
        } else if (this.controllerOptions[idx] === 'INVERT Y AXIS') {
            const mapping = GamepadMapping.getInstance();
            mapping.setInvertY(!mapping.getInvertY());
            this.refreshControllerValues();
            this.audioManager.playSFX('ui_confirm', { volume: 0.5 });
        } else if (this.controllerOptions[idx] === 'RESET DEFAULTS') {
            GamepadMapping.getInstance().resetDefaults();
            this.refreshControllerValues();
            this.audioManager.playSFX('ui_confirm', { volume: 0.5 });
        } else if (this.controllerOptions[idx] === 'BACK') {
            this.goBack();
        }
    }

    // ─── Screen Transitions ───

    private enterAudioScreen(): void {
        this.audioManager.playSFX('ui_confirm', { volume: 0.5 });
        this.screenMode = 'AUDIO';
        this.audioSelectedIndex = 0;
        this.mainContainer.setVisible(false);
        this.audioContainer.setVisible(true);
        this.updateAudioHighlight();
    }

    private enterVideoScreen(): void {
        this.audioManager.playSFX('ui_confirm', { volume: 0.5 });
        this.screenMode = 'VIDEO';
        this.videoSelectedIndex = 0;
        this.mainContainer.setVisible(false);
        this.videoContainer.setVisible(true);
        this.refreshVideoValues();
        this.updateVideoHighlight();
    }

    private enterControllerScreen(): void {
        this.audioManager.playSFX('ui_confirm', { volume: 0.5 });
        this.screenMode = 'CONTROLLER';
        this.controllerSelectedIndex = 0;
        this.mainContainer.setVisible(false);
        this.controllerContainer.setVisible(true);
        this.refreshControllerValues();
        this.updateControllerHighlight();
    }

    private goBack(): void {
        this.audioManager.playSFX('ui_back', { volume: 0.5 });

        if (this.screenMode === 'AUDIO' || this.screenMode === 'VIDEO' || this.screenMode === 'CONTROLLER') {
            const prevContainer = this.screenMode === 'AUDIO' ? this.audioContainer
                : this.screenMode === 'VIDEO' ? this.videoContainer
                    : this.controllerContainer;
            this.screenMode = 'MAIN';
            prevContainer.setVisible(false);
            this.mainContainer.setVisible(true);
            this.updateSelection();
        } else {
            if (this.returnScene === 'MainMenuScene') {
                this.scene.start('MainMenuScene');
            } else {
                this.scene.stop();
            }
        }
    }

    // ─── Highlight Updates ───

    private updateSelection(): void {
        this.menuTexts.forEach((text, index) => {
            const isSelected = index === this.selectedIndex;
            text.setColor(isSelected ? '#ffffff' : '#888888');
            text.setAlpha(isSelected ? 1 : 0.5);

            if (this.menuValueTexts[index]) {
                const valText = this.menuValueTexts[index];
                valText.setColor(isSelected ? '#ffffff' : '#888888');
                valText.setAlpha(isSelected ? 1 : 0.5);
            }
        });
    }

    private updateAudioHighlight(): void {
        this.audioTexts.forEach((text, index) => {
            const isSelected = index === this.audioSelectedIndex;
            text.setColor(isSelected ? '#ffffff' : '#888888');
            text.setAlpha(isSelected ? 1 : 0.5);

            if (this.audioValueTexts[index]) {
                this.audioValueTexts[index].setColor(isSelected ? '#ffffff' : '#888888');
                this.audioValueTexts[index].setAlpha(isSelected ? 1 : 0.5);
            }
        });
    }

    private updateVideoHighlight(): void {
        this.videoTexts.forEach((text, index) => {
            const isSelected = index === this.videoSelectedIndex;
            text.setColor(isSelected ? '#ffffff' : '#888888');
            text.setAlpha(isSelected ? 1 : 0.5);

            if (this.videoValueTexts[index]) {
                const valText = this.videoValueTexts[index];
                const enabled = VideoManager.getInstance().isCrtEnabled();
                valText.setColor(isSelected ? (enabled ? '#2EC4B6' : '#888888') : '#666666');
                valText.setAlpha(isSelected ? 1 : 0.5);
            }
        });
    }

    private updateControllerHighlight(): void {
        this.controllerTexts.forEach((text, index) => {
            const isSelected = index === this.controllerSelectedIndex;
            text.setColor(isSelected ? '#ffffff' : '#888888');
            text.setAlpha(isSelected ? 1 : 0.5);

            const valText = this.controllerValueTexts[index];
            if (valText && !this.isListening) {
                if (this.controllerOptions[index] !== 'INVERT Y AXIS') {
                    valText.setColor(isSelected ? '#4361EE' : '#333333');
                } else {
                    const isInverted = GamepadMapping.getInstance().getInvertY();
                    valText.setColor(isSelected ? (isInverted ? '#2EC4B6' : '#888888') : '#666666');
                }
                valText.setAlpha(isSelected ? 1 : 0.5);
            }
        });
    }
}
