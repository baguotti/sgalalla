import Phaser from 'phaser';
import { Client, Room } from 'colyseus.js';

export class OnlineTestScene extends Phaser.Scene {
    private client!: Client;
    private room!: Room;
    private statusText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'OnlineTestScene' });
    }

    create() {
        this.add.text(100, 50, 'Online Connection Test', { fontSize: '32px', color: '#ffffff' });
        this.statusText = this.add.text(100, 100, 'Connecting...', { fontSize: '24px', color: '#ffff00' });

        this.add.text(100, 500, 'Press ESC to return', { fontSize: '16px', color: '#aaaaaa' });
        this.input.keyboard!.on('keydown-ESC', () => {
            if (this.room) {
                this.room.leave();
            }
            this.scene.start('MainMenuScene');
        });

        this.connect();
    }

    async connect() {
        try {
            // Localhost connection
            this.client = new Client('ws://localhost:2567');

            this.statusText.setText('Joining room...');

            this.room = await this.client.joinOrCreate('game_room');

            console.log("Joined successfully!", this.room);
            this.statusText.setText(`Connected! Session ID: ${this.room.sessionId}`);
            this.statusText.setColor('#00ff00');

            this.room.onMessage("move", (message) => {
                console.log("Received move:", message);
            });

            this.room.onLeave((code) => {
                console.log("Left room", code);
                this.statusText.setText('Disconnected.');
                this.statusText.setColor('#ff0000');
            });

        } catch (e: any) {
            console.error("Join error:", e);
            this.statusText.setText(`Error: ${e.message}`);
            this.statusText.setColor('#ff0000');
        }
    }
}
