import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { TrainingDummy } from '../entities/TrainingDummy';
import { DebugOverlay } from '../components/DebugOverlay';

export class GameScene extends Phaser.Scene {
    private player!: Player;
    private trainingDummy!: TrainingDummy;
    private debugOverlay!: DebugOverlay;
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private softPlatforms: Phaser.GameObjects.Rectangle[] = [];

    constructor() {
        super({ key: 'GameScene' });
    }

    create(): void {
        // Set background color
        this.cameras.main.setBackgroundColor('#1a1a2e');

        // Create stage platforms
        this.createStage();

        // Create player
        this.player = new Player(this, 300, 200);

        // Create training dummy
        this.trainingDummy = new TrainingDummy(this, 500, 200);

        // Create debug overlay
        this.debugOverlay = new DebugOverlay(this);

        // Add controls hint
        this.createControlsHint();
    }

    private createStage(): void {
        // Main platform (large, centered)
        const mainPlatform = this.add.rectangle(400, 500, 800, 40, 0x16213e);
        this.platforms.push(mainPlatform);

        // Soft platform 1 (left)
        const softPlatform1 = this.add.rectangle(250, 350, 400, 20, 0x0f3460);
        this.softPlatforms.push(softPlatform1);

        // Soft platform 2 (right)
        const softPlatform2 = this.add.rectangle(550, 250, 400, 20, 0x0f3460);
        this.softPlatforms.push(softPlatform2);

        // Add visual distinction for soft platforms (dashed effect)
        softPlatform1.setAlpha(0.7);
        softPlatform2.setAlpha(0.7);
    }

    private createControlsHint(): void {
        const controlsText = [
            'Keyboard:',
            'WASD/Arrows - Move',
            'Space - Jump | J - Light | K - Heavy',
            'L - Dodge | Shift - Recovery',
            '',
            'Xbox Controller:',
            'Left Stick/D-pad - Move',
            'A - Jump | X - Light | B/Y - Heavy',
            'LT/RT - Dodge',
        ].join('\n');

        this.add.text(10, 500, controlsText, {
            fontSize: '10px',
            color: '#888888',
            fontFamily: 'Arial',
            lineSpacing: 1,
        });
    }

    update(_time: number, delta: number): void {
        // Update player
        this.player.update(delta);

        // Update training dummy
        this.trainingDummy.update(delta);

        // Check player attack hitting dummy
        this.player.checkHitAgainst(this.trainingDummy as any);

        // Check collisions with main platforms
        for (const platform of this.platforms) {
            this.player.checkPlatformCollision(platform, false);
            this.trainingDummy.checkPlatformCollision(platform, false);
        }

        // Check collisions with soft platforms
        for (const platform of this.softPlatforms) {
            this.player.checkPlatformCollision(platform, true);
            this.trainingDummy.checkPlatformCollision(platform, true);
        }

        // Keep player in bounds (horizontal)
        const playerBounds = this.player.getBounds();
        if (playerBounds.left < 0) {
            this.player.x = playerBounds.width / 2;
        } else if (playerBounds.right > 800) {
            this.player.x = 800 - playerBounds.width / 2;
        }

        // Respawn if player falls off screen
        if (this.player.y > 700) {
            this.player.x = 300;
            this.player.y = 200;
            this.player.damagePercent = 0;
        }

        // Update debug overlay
        const velocity = this.player.getVelocity();
        const currentAttack = this.player.getCurrentAttack();
        const attackInfo = currentAttack
            ? `${currentAttack.data.type} ${currentAttack.data.direction} (${currentAttack.phase})`
            : 'None';

        this.debugOverlay.update(
            velocity.x,
            velocity.y,
            this.player.getState(),
            this.player.getRecoveryAvailable(),
            attackInfo,
            this.player.isGamepadConnected()
        );
    }
}
