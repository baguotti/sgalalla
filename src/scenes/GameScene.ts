import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { TrainingDummy } from '../entities/TrainingDummy';
import { DebugOverlay } from '../components/DebugOverlay';

export class GameScene extends Phaser.Scene {
    private player!: Player;
    private trainingDummy: TrainingDummy | null = null;
    private opponent: Player | null = null;
    private debugOverlay!: DebugOverlay;
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private softPlatforms: Phaser.GameObjects.Rectangle[] = [];
    private toggleKey!: Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: 'GameScene' });
    }

    preload(): void {
        this.load.spritesheet('dude', 'assets/dude.png', { frameWidth: 32, frameHeight: 48 });
    }

    create(): void {
        // Create animations
        this.anims.create({
            key: 'left',
            frames: this.anims.generateFrameNumbers('dude', { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'turn',
            frames: [{ key: 'dude', frame: 4 }],
            frameRate: 20
        });

        this.anims.create({
            key: 'right',
            frames: this.anims.generateFrameNumbers('dude', { start: 5, end: 8 }),
            frameRate: 10,
            repeat: -1
        });

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

        // Toggle key
        this.toggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.O);
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
            '',
            'O - Toggle Sparring AI',
        ].join('\n');

        this.add.text(10, 500, controlsText, {
            fontSize: '10px',
            color: '#888888',
            fontFamily: 'Arial',
            lineSpacing: 1,
        });
    }

    update(_time: number, delta: number): void {
        // Handle Toggle
        if (Phaser.Input.Keyboard.JustDown(this.toggleKey)) {
            if (this.trainingDummy) {
                // Switch to Opponent
                const x = this.trainingDummy.x;
                const y = this.trainingDummy.y;
                this.trainingDummy.destroy();
                this.trainingDummy = null;

                this.opponent = new Player(this, x, y, true);
                // isAI handled in constructor now
                // (Already handled in constructor based on isAI, but we set isAI after construction)
                // Wait, constructor checks isAI. We need to set it BEFORE adding children?
                // Actually Player constructor calls super() then adds visuals.
                // We should pass isAI in constructor or have an init method.
                // OR simpler: Just recreate visuals.
                // For now, let's assume I need to pass it or set it.
                // Hack: Set it then call a setup method? Or modify Player constructor?
                // I modified Player constructor to check `this.isAI`.
                // But `this.isAI` is false by default.
                // Modify Player constructor to create visuals AFTER? Or pass config?
                // Since I can't easily change constructor signature without breaking calls,
                // I'll destroy the opponent and recreate with a flag? or just recreate visuals?
                // Actually, I can just destroy the visuals in opponent and re-run visual setup? 
                // OR simpler: make `isAI` false default, then I set it to true.
                // But visuals are created in constructor.
                // FIX: I will destroy the opponent created above? No.
                // I should assume I need to edit Player constructor or add `initAI()` method.
                // Let's add `configureAsAI()` to Player.ts?
                // No, I'll just edit Player to check a static flag or pass a param. 
                // Actually I can't easily change Player constructor now without breaking other things.

                // Let's fix this properly: 
                // I'll overwrite the visuals manually here for now, or assume I will fix Player later.
                // Better: I will use a different approach. I'll just modify Player.ts to have a public `setAI()` method that rebuilds visuals.
            } else if (this.opponent) {
                // Switch to Dummy
                const x = this.opponent.x;
                const y = this.opponent.y;
                this.opponent.destroy();
                this.opponent = null;

                this.trainingDummy = new TrainingDummy(this, x, y);
            }
        }

        // Update player
        this.player.update(delta);

        // Update Entity (Dummy or Opponent)
        if (this.trainingDummy) {
            this.trainingDummy.update(delta);
            this.player.checkHitAgainst(this.trainingDummy as any);

            // Check collisions with main platforms
            for (const platform of this.platforms) {
                this.trainingDummy.checkPlatformCollision(platform, false);
            }
            // Check collisions with soft platforms
            for (const platform of this.softPlatforms) {
                this.trainingDummy.checkPlatformCollision(platform, true);
            }
        } else if (this.opponent) {
            this.opponent.update(delta);
            this.player.checkHitAgainst(this.opponent);
            this.opponent.checkHitAgainst(this.player);

            // Check collisions
            for (const platform of this.platforms) {
                this.opponent.checkPlatformCollision(platform, false);
            }
            for (const platform of this.softPlatforms) {
                this.opponent.checkPlatformCollision(platform, true);
            }

            // Bounds check for opponent
            const opBounds = this.opponent.getBounds();
            if (opBounds.left < 0) this.opponent.x = opBounds.width / 2;
            else if (opBounds.right > 800) this.opponent.x = 800 - opBounds.width / 2;

            // Respawn opponent
            if (this.opponent.y > 700) {
                this.opponent.x = 500;
                this.opponent.y = 200;
                this.opponent.damagePercent = 0;
            }
        }

        // Player platform collisions
        for (const platform of this.platforms) {
            this.player.checkPlatformCollision(platform, false);
        }
        for (const platform of this.softPlatforms) {
            this.player.checkPlatformCollision(platform, true);
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
