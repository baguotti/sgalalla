import Phaser from 'phaser';
import { MenuInput } from '../input/MenuInput';

export class CreditsScene extends Phaser.Scene {
    private inputUnlocked: boolean = false;
    private menuInput!: MenuInput;

    constructor() {
        super({ key: 'CreditsScene' });
    }

    create() {
        const { width, height } = this.scale;

        // Black background
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

        // Credits Placeholder Text
        this.add.text(width / 2, height / 2, 'CREDITS', {
            fontSize: '64px',
            fontFamily: '"Pixeloid Sans"',
            color: '#FFFFFF'
        }).setOrigin(0.5);

        // Input delay to prevent accidental skips from the fight press
        this.time.delayedCall(1000, () => {
            this.inputUnlocked = true;
        });

        this.menuInput = new MenuInput(this);

        // Auto-advance after 10 seconds if no input
        this.time.delayedCall(10000, () => this.advance());
    }

    update() {
        // Any menu button skips, once the delay is over
        if (this.menuInput.poll().some(press => press.action === 'confirm' || press.action === 'back' || press.action === 'start')) this.advance();
    }

    private advance() {
        if (!this.inputUnlocked) return;
        this.inputUnlocked = false;

        // Transition back to Main Menu
        this.scene.start('MainMenuScene');
    }
}
