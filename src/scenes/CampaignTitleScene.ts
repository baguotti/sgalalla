import Phaser from 'phaser';

export class CampaignTitleScene extends Phaser.Scene {
    private inputUnlocked: boolean = false;
    private initData: any;

    constructor() {
        super({ key: 'CampaignTitleScene' });
    }

    init(data: Record<string, any>) {
        this.initData = data;
        this.inputUnlocked = false;
    }

    create() {
        const { width, height } = this.scale;

        // Black background
        this.add.rectangle(0, 0, width, height, 0x000000).setOrigin(0);

        // Title Text
        this.add.text(width / 2, height / 2, 'ROAD TO LAMICIZIA', {
            fontSize: '64px',
            fontFamily: '"Pixeloid Sans"',
            color: '#FFFFFF'
        }).setOrigin(0.5);

        // Input delay to prevent accidental skips from the menu press
        this.time.delayedCall(500, () => {
            this.inputUnlocked = true;
        });

        // Setup input to skip
        this.input.keyboard?.on('keydown', () => this.advance());
        if (this.input.gamepad) {
            this.input.gamepad.on('down', () => this.advance());
        }

        // Auto-advance after 5 seconds if no input
        this.time.delayedCall(5000, () => this.advance());
    }

    private advance() {
        if (!this.inputUnlocked) return;
        this.inputUnlocked = false; // Prevent multiple triggers

        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.start('LobbyScene', { ...this.initData, mode: 'campaign' });
        });
    }
}
