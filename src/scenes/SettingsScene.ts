import Phaser from 'phaser';
import { AudioManager } from '../managers/AudioManager';

export class SettingsScene extends Phaser.Scene {
    private options = ['MUSIC', 'SFX', 'BACK'];
    private selectedIndex = 0;
    private menuTexts: Phaser.GameObjects.Text[] = [];
    private valueTexts: Phaser.GameObjects.Text[] = [];
    private audioManager: AudioManager;

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
        if (data && data.returnScene) {
            this.returnScene = data.returnScene;
        } else {
            this.returnScene = 'MainMenuScene';
        }
    }

    create(): void {
        const { width, height } = this.scale;

        // Clear arrays to prevent holding references to destroyed objects
        this.menuTexts = [];
        this.valueTexts = [];

        // Background (Black overlay)
        const bgAlpha = this.returnScene !== 'MainMenuScene' ? 0.9 : 1.0;
        this.add.rectangle(0, 0, width, height, 0x000000, bgAlpha).setOrigin(0);

        // Title
        this.add.text(width / 2, 100, 'IMPOSTAZIONI', {
            fontSize: '64px',
            fontFamily: '"Pixeloid Sans"',
            color: '#ffffff'
        }).setOrigin(0.5);

        // Menu Items
        this.createMenuUI();

        // Input
        this.keyUp = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
        this.keyDown = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);
        this.keyLeft = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        this.keyRight = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
        this.keyEnter = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // DELAY INPUT ACTIVATION to prevent accidental double-presses from previous menu
        this.time.delayedCall(500, () => {
            this.canInput = true;
        });

        this.updateSelection();

        // Cleanup
        this.events.once('shutdown', () => {
            // PHASER BUG FIX: GamepadPlugin.stopListeners crashes on sparse arrays (e.g. pad index 1 w/o 0)
            if (this.input.gamepad && Array.isArray(this.input.gamepad.gamepads)) {
                // Filter out null/undefined slots so stopListeners loop doesn't crash
                // @ts-ignore - gamepads is technically readonly in types but mutable in JS
                this.input.gamepad.gamepads = this.input.gamepad.gamepads.filter(p => !!p);
            }
        });
    }

    private createMenuUI(): void {
        const { width, height } = this.scale;
        const startY = height / 2 - 50;
        const gap = 80;

        this.options.forEach((opt, index) => {
            const y = startY + index * gap;

            // Label
            const text = this.add.text(width / 2 - 100, y, opt, {
                fontSize: '40px',
                fontFamily: '"Pixeloid Sans"',
                color: '#888888'
            }).setOrigin(1, 0.5);
            this.menuTexts.push(text);

            // Value (for toggleable items)
            if (opt !== 'BACK') {
                const valText = this.add.text(width / 2 + 50, y, '', {
                    fontSize: '40px',
                    fontFamily: '"Pixeloid Sans"',
                    color: '#ffffff'
                }).setOrigin(0, 0.5);
                this.valueTexts.push(valText);
                this.updateValueText(index);
            } else {
                this.valueTexts.push(null as any); // Placeholder
                // Center BACK button? Or keep aligned?
                // Let's center BACK if it has no value
                text.setX(width / 2);
                text.setOrigin(0.5);
            }
        });
    }

    private updateValueText(index: number): void {
        const opt = this.options[index];
        const valText = this.valueTexts[index];
        if (!valText) return;

        let val = 0;
        if (opt === 'MUSIC') val = this.audioManager.getMusicVolume();
        if (opt === 'SFX') val = this.audioManager.getSFXVolume();

        // Display as 0-10
        const displayVal = Math.round(val * 10);
        valText.setText(`< ${displayVal} >`);
    }

    update(): void {
        if (!this.canInput) return;

        if (Phaser.Input.Keyboard.JustDown(this.keyUp)) {
            this.changeSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyDown)) {
            this.changeSelection(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyLeft)) {
            this.modifyValue(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyRight)) {
            this.modifyValue(1);
        } else if (Phaser.Input.Keyboard.JustDown(this.keyEnter) || Phaser.Input.Keyboard.JustDown(this.keySpace)) {
            this.confirmSelection();
        } else if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) {
            this.goBack();
        }

        this.handleGamepad();
    }

    // Simple gamepad support
    // Simple gamepad support
    private previousAxis: Map<number, { x: number, y: number }> = new Map();
    private previousButtons: Map<number, { a: boolean; b: boolean; dpadUp?: boolean; dpadDown?: boolean; dpadLeft?: boolean; dpadRight?: boolean }> = new Map();

    private handleGamepad(): void {
        const pads = this.input.gamepad?.gamepads;
        if (!pads) return;

        for (let i = 0; i < pads.length; i++) {
            const pad = pads[i];
            if (!pad) continue;

            const axisX = pad.axes[0].getValue();
            const axisY = pad.axes[1].getValue();

            // Init tracking
            if (!this.previousAxis.has(pad.index)) this.previousAxis.set(pad.index, { x: 0, y: 0 });
            if (!this.previousButtons.has(pad.index)) this.previousButtons.set(pad.index, { a: false, b: false });

            const prevAxis = this.previousAxis.get(pad.index)!;
            const prevBtns = this.previousButtons.get(pad.index)!;

            // NAV: Y Axis
            if (axisY < -0.5 && prevAxis.y >= -0.5) this.changeSelection(-1);
            else if (axisY > 0.5 && prevAxis.y <= 0.5) this.changeSelection(1);

            // NAV: X Axis
            if (axisX < -0.5 && prevAxis.x >= -0.5) this.modifyValue(-1);
            else if (axisX > 0.5 && prevAxis.x <= 0.5) this.modifyValue(1);

            // D-Pad support (Up/Down/Left/Right)
            // Up/Down
            if (pad.buttons[12]?.pressed && !prevBtns['dpadUp']) { this.changeSelection(-1); prevBtns['dpadUp'] = true; }
            else if (!pad.buttons[12]?.pressed) prevBtns['dpadUp'] = false;

            if (pad.buttons[13]?.pressed && !prevBtns['dpadDown']) { this.changeSelection(1); prevBtns['dpadDown'] = true; }
            else if (!pad.buttons[13]?.pressed) prevBtns['dpadDown'] = false;

            // Left/Right
            if (pad.buttons[14]?.pressed && !prevBtns['dpadLeft']) { this.modifyValue(-1); prevBtns['dpadLeft'] = true; }
            else if (!pad.buttons[14]?.pressed) prevBtns['dpadLeft'] = false;

            if (pad.buttons[15]?.pressed && !prevBtns['dpadRight']) { this.modifyValue(1); prevBtns['dpadRight'] = true; }
            else if (!pad.buttons[15]?.pressed) prevBtns['dpadRight'] = false;


            // A or Start (Confirm)
            const isA = pad.buttons[0]?.pressed || pad.buttons[9]?.pressed;
            if (isA && !prevBtns.a) {
                this.confirmSelection();
                prevBtns.a = true;
            } else if (!isA) {
                prevBtns.a = false;
            }

            // B (Back)
            const isB = pad.buttons[1]?.pressed;
            if (isB && !prevBtns.b) {
                this.goBack();
                prevBtns.b = true;
            } else if (!isB) {
                prevBtns.b = false;
            }

            // Update state
            this.previousAxis.set(pad.index, { x: axisX, y: axisY });
        }
    }

    private changeSelection(dir: number): void {
        this.audioManager.playSFX('ui_menu_hover', { volume: 0.5 });
        this.selectedIndex = (this.selectedIndex + dir + this.options.length) % this.options.length;
        this.updateSelection();
    }

    private modifyValue(dir: number): void {
        const opt = this.options[this.selectedIndex];
        if (opt === 'BACK') return;

        const step = 0.1;
        if (opt === 'MUSIC') {
            const current = this.audioManager.getMusicVolume();
            this.audioManager.setMusicVolume(current + (dir * step));
        } else if (opt === 'SFX') {
            const current = this.audioManager.getSFXVolume();
            this.audioManager.setSFXVolume(current + (dir * step));
            // Play sound to test volume
            this.audioManager.playSFX('ui_menu_hover');
        }
        this.updateValueText(this.selectedIndex);
    }

    private confirmSelection(): void {
        if (this.options[this.selectedIndex] === 'BACK') {
            this.goBack();
        } else {
            // Maybe toggle something if not a slider? For now just sound.
            this.audioManager.playSFX('ui_confirm', { volume: 0.5 });
        }
    }

    private goBack(): void {
        this.audioManager.playSFX('ui_back', { volume: 0.5 });
        if (this.returnScene === 'MainMenuScene') {
            this.scene.start('MainMenuScene');
        } else {
            this.scene.stop();
        }
    }

    private updateSelection(): void {
        this.menuTexts.forEach((text, index) => {
            const isSelected = index === this.selectedIndex;
            text.setColor(isSelected ? '#ffffff' : '#888888');
            text.setAlpha(isSelected ? 1 : 0.5);

            if (this.valueTexts[index]) {
                this.valueTexts[index].setColor(isSelected ? '#ffffff' : '#888888');
                this.valueTexts[index].setAlpha(isSelected ? 1 : 0.5);
            }
        });
    }
}
