import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { TrainingDummy } from '../entities/TrainingDummy';
import { DebugOverlay } from '../components/DebugOverlay';
import { PauseMenu } from '../components/PauseMenu';

export class GameScene extends Phaser.Scene {
    private player!: Player;
    private trainingDummy: TrainingDummy | null = null;
    private opponent: Player | null = null;
    private debugOverlay!: DebugOverlay;
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private softPlatforms: Phaser.GameObjects.Rectangle[] = [];
    private background!: Phaser.GameObjects.Graphics;
    private walls: Phaser.GameObjects.Rectangle[] = [];
    private wallTexts: Phaser.GameObjects.Text[] = [];

    private toggleKey!: Phaser.Input.Keyboard.Key;

    // Debug visibility
    private debugVisible: boolean = true;
    private debugToggleKey!: Phaser.Input.Keyboard.Key;
    private controlsHintText!: Phaser.GameObjects.Text;

    // Kill tracking
    private playerKills: number = 0;
    private opponentKills: number = 0;
    private killCountText!: Phaser.GameObjects.Text;

    // Wall configuration
    private readonly WALL_THICKNESS = 30;
    private readonly WALL_LEFT_X = 100;
    private readonly WALL_RIGHT_X = 1180;
    // Playable area bounds (inner edges of walls)
    private readonly PLAY_BOUND_LEFT = this.WALL_LEFT_X + this.WALL_THICKNESS / 2;
    private readonly PLAY_BOUND_RIGHT = this.WALL_RIGHT_X - this.WALL_THICKNESS / 2;

    // Blast zone boundaries
    private readonly BLAST_ZONE_LEFT = -200;
    private readonly BLAST_ZONE_RIGHT = 1480;
    private readonly BLAST_ZONE_TOP = -200;
    private readonly BLAST_ZONE_BOTTOM = 900;

    private uiCamera!: Phaser.Cameras.Scene2D.Camera;

    // Camera Settings
    private currentZoomLevel: 'CLOSE' | 'NORMAL' | 'WIDE' = 'CLOSE';
    private readonly ZOOM_SETTINGS = {
        CLOSE: { padX: 100, padY: 100, minZoom: 0.8, maxZoom: 1.5 },
        NORMAL: { padX: 250, padY: 200, minZoom: 0.6, maxZoom: 1.1 },
        WIDE: { padX: 400, padY: 300, minZoom: 0.4, maxZoom: 0.8 }
    };

    // Pause menu
    private isPaused: boolean = false;
    private pauseMenu!: PauseMenu;
    private pauseKey!: Phaser.Input.Keyboard.Key;

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

        // Setup cameras
        this.setupCameras();

        // Create debug overlay
        this.debugOverlay = new DebugOverlay(this);
        // Make debug overlay ignore main camera (only render on UI camera)
        this.debugOverlay.setCameraIgnore(this.cameras.main);

        // Add controls hint
        this.createControlsHint();

        // Add kill counter display
        this.createKillCounter();

        // Toggle key
        this.toggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
        this.debugToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
        this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // Create pause menu
        this.pauseMenu = new PauseMenu(this);
        this.cameras.main.ignore(this.pauseMenu.getElements());

        // Pause menu event listeners
        this.events.on('pauseMenuResume', () => this.togglePause());
        this.events.on('pauseMenuRestart', () => this.restartMatch());
    }

    private setupCameras(): void {
        // Main camera is manually controlled via updateCamera() using centerOn()

        // Create a separate UI camera that ignores zoom
        this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.uiCamera.setScroll(0, 0);
        // UI camera ignores main camera zoom
        this.uiCamera.setZoom(1);

        // PREVENT GHOSTING: UI Camera should ignore game world objects
        this.configureCameraExclusions();
    }

    private configureCameraExclusions(): void {
        if (!this.uiCamera) return;

        // Ignore static world elements
        if (this.background) this.uiCamera.ignore(this.background);
        if (this.platforms.length > 0) this.uiCamera.ignore(this.platforms);
        if (this.softPlatforms.length > 0) this.uiCamera.ignore(this.softPlatforms);
        if (this.walls.length > 0) this.uiCamera.ignore(this.walls);
        if (this.wallTexts.length > 0) this.uiCamera.ignore(this.wallTexts);

        // Ignore entities (and their damage text)
        if (this.player) this.player.addToCameraIgnore(this.uiCamera);
        if (this.trainingDummy) this.trainingDummy.addToCameraIgnore(this.uiCamera);
        if (this.opponent) this.opponent.addToCameraIgnore(this.uiCamera);
    }

    /**
     * Expose method to add dynamic objects to camera ignore list
     * (Called by Hitboxes and other dynamic entities)
     */
    public addToCameraIgnore(object: Phaser.GameObjects.GameObject): void {
        if (this.uiCamera) {
            this.uiCamera.ignore(object);
        }
    }

    private createStage(): void {
        // Background gradient to show play area
        this.background = this.add.graphics();
        this.background.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a2e, 0x1a1a2e, 1);
        this.background.fillRect(0, 0, this.scale.width, this.scale.height);
        this.background.setDepth(-10);

        // Main platform (centered, wide - Brawlhalla style)
        // At 1280x720: center is x=640, place main platform lower at y=550
        const mainPlatform = this.add.rectangle(640, 550, 900, 30, 0x16213e);
        mainPlatform.setStrokeStyle(3, 0x3a506b);
        this.platforms.push(mainPlatform);

        // Soft platform 1 (left, above main)
        const softPlatform1 = this.add.rectangle(380, 400, 240, 16, 0x0f3460);
        softPlatform1.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform1.setAlpha(0.85);
        this.softPlatforms.push(softPlatform1);

        // Soft platform 2 (right, above main)
        const softPlatform2 = this.add.rectangle(900, 400, 240, 16, 0x0f3460);
        softPlatform2.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform2.setAlpha(0.85);
        this.softPlatforms.push(softPlatform2);

        // VISIBLE SIDE WALLS for wall mechanics testing
        this.walls = [];
        // Left wall
        const leftWall = this.add.rectangle(this.WALL_LEFT_X, 360, this.WALL_THICKNESS, 720, 0x2a3a4e);
        leftWall.setStrokeStyle(4, 0x4a6a8e);
        leftWall.setAlpha(0.6);
        leftWall.setDepth(-5);
        this.walls.push(leftWall);

        // Right wall
        const rightWall = this.add.rectangle(this.WALL_RIGHT_X, 360, this.WALL_THICKNESS, 720, 0x2a3a4e);
        rightWall.setStrokeStyle(4, 0x4a6a8e);
        rightWall.setAlpha(0.6);
        rightWall.setDepth(-5);
        this.walls.push(rightWall);

        // Add wall indicators (text labels)
        const leftWallText = this.add.text(this.WALL_LEFT_X - 8, 250, 'WALL', {
            fontSize: '12px',
            color: '#8ab4f8',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        });
        leftWallText.setRotation(-Math.PI / 2);
        leftWallText.setAlpha(0.5);
        leftWallText.setDepth(-4);
        this.wallTexts.push(leftWallText);

        const rightWallText = this.add.text(this.WALL_RIGHT_X + 8, 350, 'WALL', {
            fontSize: '12px',
            color: '#8ab4f8',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        });
        rightWallText.setRotation(Math.PI / 2);
        rightWallText.setAlpha(0.5);
        rightWallText.setDepth(-4);
        this.wallTexts.push(rightWallText);
    }

    private createControlsHint(): void {
        const controlsText = [
            'Keyboard Controls:',
            'Arrow Keys / WASD - Move',
            '↑ Arrow / Space - Jump',
            'C / J - Light Attack',
            'X / K - Heavy Attack',
            'Z / L - Dodge',
            'V / Shift - Recovery',
            '',
            'F3 - Toggle Debug | O - Toggle AI | T - Toggle Dummy/Opponent',
        ].join('\n');

        this.controlsHintText = this.add.text(10, 500, controlsText, {
            fontSize: '10px',
            color: '#888888',
            fontFamily: 'Arial',
            lineSpacing: 1,
        });
        this.controlsHintText.setScrollFactor(0);
        this.controlsHintText.setDepth(500);
        // Make controls hint ignore main camera zoom
        this.cameras.main.ignore(this.controlsHintText);
    }

    private createKillCounter(): void {
        this.killCountText = this.add.text(400, 20, 'Eliminations: 0', {
            fontSize: '20px',
            color: '#ffffff',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4,
        });
        this.killCountText.setOrigin(0.5);
        this.killCountText.setScrollFactor(0);
        this.killCountText.setDepth(1000);
        // Make kill counter ignore main camera zoom
        this.cameras.main.ignore(this.killCountText);
    }

    update(_time: number, delta: number): void {
        // Handle Pause Toggle (ESC key or START button on gamepad)
        const pauseKeyPressed = Phaser.Input.Keyboard.JustDown(this.pauseKey);
        const gamepadPausePressed = this.checkGamepadPause();

        if (pauseKeyPressed || gamepadPausePressed) {
            this.togglePause();
        }

        // If paused, only update pause menu
        if (this.isPaused) {
            this.pauseMenu.update(delta);
            return;
        }

        // Handle Debug Toggle (F3)
        if (Phaser.Input.Keyboard.JustDown(this.debugToggleKey)) {
            this.debugVisible = !this.debugVisible;
            // No visual indicator needed - the debug info itself shows/hides
        }

        // Handle Toggle
        if (Phaser.Input.Keyboard.JustDown(this.toggleKey)) {
            if (this.trainingDummy) {
                // Switch to Opponent
                const x = this.trainingDummy.x;
                const y = this.trainingDummy.y;
                this.trainingDummy.destroy();
                this.trainingDummy = null;

                this.opponent = new Player(this, x, y, true);
                // Important: Exclude new opponent from UI camera
                if (this.uiCamera) this.opponent.addToCameraIgnore(this.uiCamera);
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
                // Important: Exclude new dummy from UI camera
                if (this.uiCamera) this.trainingDummy.addToCameraIgnore(this.uiCamera);
            }
        }

        // Update player
        this.player.update(delta);

        // Update Camera
        this.updateCamera();

        // Update Entity (Dummy or Opponent)
        if (this.trainingDummy) {
            this.trainingDummy.update(delta);

            // Check collisions FIRST to establish grounded state
            // Check collisions with main platforms
            for (const platform of this.platforms) {
                this.trainingDummy.checkPlatformCollision(platform, false);
            }
            // Check collisions with soft platforms
            for (const platform of this.softPlatforms) {
                this.trainingDummy.checkPlatformCollision(platform, true);
            }

            // Wall collision for training dummy (using bounds)
            this.trainingDummy.checkWallCollision(this.PLAY_BOUND_LEFT, this.PLAY_BOUND_RIGHT);

            // Then check hits
            this.player.checkHitAgainst(this.trainingDummy as any);
        } else if (this.opponent) {
            // Update opponent
            this.opponent.update(delta);
            this.opponent.physics.checkWallCollision(this.PLAY_BOUND_LEFT, this.PLAY_BOUND_RIGHT);

            // Opponent Platform Collision
            for (const platform of this.platforms) this.opponent.checkPlatformCollision(platform, false);
            for (const platform of this.softPlatforms) this.opponent.checkPlatformCollision(platform, true);

            // Hits
            this.player.checkHitAgainst(this.opponent);
            this.opponent.checkHitAgainst(this.player);

            // Hits
            this.player.checkHitAgainst(this.opponent);
            this.opponent.checkHitAgainst(this.player);

            // Respawn opponent if out of bounds
            if (this.opponent.y > this.BLAST_ZONE_BOTTOM) {
                this.respawnPlayer(this.opponent, false);
            }
        }

        // Check Player Wall Collision
        this.player.physics.checkWallCollision(this.PLAY_BOUND_LEFT, this.PLAY_BOUND_RIGHT);

        // Player Platform Collision
        for (const platform of this.platforms) {
            this.player.checkPlatformCollision(platform, false);
        }
        for (const platform of this.softPlatforms) {
            this.player.checkPlatformCollision(platform, true);
        }

        // Check edge grab for player
        // const platformData = [
        //    ...this.platforms.map(p => ({ rect: p, isSoft: false })),
        //    ...this.softPlatforms.map(p => ({ rect: p, isSoft: true }))
        // ];
        // this.player.physics.checkLedgeGrab(platformData); // Call if needed

        // Check Blast Zones
        this.checkBlastZones();

        // Update debug overlay
        const velocity = this.player.getVelocity();
        const currentAttack = this.player.getCurrentAttack();
        const attackInfo = currentAttack
            ? `${currentAttack.data.type} ${currentAttack.data.direction} (${currentAttack.phase})`
            : 'None';

        if (this.debugVisible) {
            this.debugOverlay.update(
                velocity.x,
                velocity.y,
                this.player.getState(),
                this.player.getRecoveryAvailable(),
                attackInfo,
                this.player.isGamepadConnected()
            );
            this.debugOverlay.setVisible(true);
            this.controlsHintText.setVisible(true);
        } else {
            this.debugOverlay.setVisible(false);
            this.controlsHintText.setVisible(false);
        }
    }

    private checkBlastZones(): void {
        // Check player
        const playerBounds = this.player.getBounds();
        if (playerBounds.left < this.BLAST_ZONE_LEFT ||
            playerBounds.right > this.BLAST_ZONE_RIGHT ||
            playerBounds.top < this.BLAST_ZONE_TOP ||
            playerBounds.bottom > this.BLAST_ZONE_BOTTOM) {

            // Player was eliminated - opponent gets a kill
            if (this.opponent) {
                this.opponentKills++;
                this.updateKillCounter();
            }
            this.respawnPlayer(this.player, true);
        }

        // Check opponent
        if (this.opponent) {
            const opponentBounds = this.opponent.getBounds();
            if (opponentBounds.left < this.BLAST_ZONE_LEFT ||
                opponentBounds.right > this.BLAST_ZONE_RIGHT ||
                opponentBounds.top < this.BLAST_ZONE_TOP ||
                opponentBounds.bottom > this.BLAST_ZONE_BOTTOM) {

                // Opponent was eliminated - player gets a kill
                this.playerKills++;
                this.updateKillCounter();
                this.respawnPlayer(this.opponent, false);
            }
        }

        // Check training dummy (no kill tracking, just respawn)
        if (this.trainingDummy) {
            const dummyBounds = this.trainingDummy.getBounds();
            if (dummyBounds.left < this.BLAST_ZONE_LEFT ||
                dummyBounds.right > this.BLAST_ZONE_RIGHT ||
                dummyBounds.top < this.BLAST_ZONE_TOP ||
                dummyBounds.bottom > this.BLAST_ZONE_BOTTOM) {

                this.respawnPlayer(this.trainingDummy as any, false);
            }
        }
    }

    private respawnPlayer(entity: Player | TrainingDummy, isPlayer: boolean): void {
        // Respawn position
        const spawnX = isPlayer ? 300 : 500;
        const spawnY = 200;

        entity.x = spawnX;
        entity.y = spawnY;
        entity.damagePercent = 0;

        // Visual respawn effect (flash)
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 0.8);
        flash.fillCircle(spawnX, spawnY, 50);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2,
            duration: 300,
            onComplete: () => flash.destroy()
        });
    }

    private updateKillCounter(): void {
        this.killCountText.setText(`Eliminations: ${this.playerKills}`);
    }

    public setZoomLevel(level: 'CLOSE' | 'NORMAL' | 'WIDE'): void {
        this.currentZoomLevel = level;
    }

    private updateCamera(): void {
        const targets: Phaser.GameObjects.Components.Transform[] = [];
        if (this.player) targets.push(this.player);
        if (this.trainingDummy) targets.push(this.trainingDummy);
        if (this.opponent) targets.push(this.opponent);

        if (targets.length === 0) return;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        targets.forEach(t => {
            minX = Math.min(minX, t.x);
            maxX = Math.max(maxX, t.x);
            minY = Math.min(minY, t.y);
            maxY = Math.max(maxY, t.y);
        });

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        // Viewport padding based on zoom level
        const settings = this.ZOOM_SETTINGS[this.currentZoomLevel];
        const padX = settings.padX;
        const padY = settings.padY;

        const width = (maxX - minX) + padX * 2;
        const height = (maxY - minY) + padY * 2;

        const zoomX = this.scale.width / width;
        const zoomY = this.scale.height / height;

        // Clamp zoom
        const targetZoom = Phaser.Math.Clamp(Math.min(zoomX, zoomY), settings.minZoom, settings.maxZoom);

        // Lerp Camera
        const cam = this.cameras.main;
        cam.zoom = Phaser.Math.Linear(cam.zoom, targetZoom, 0.05);
        cam.centerOn(
            Phaser.Math.Linear(cam.midPoint.x, centerX, 0.1),
            Phaser.Math.Linear(cam.midPoint.y, centerY, 0.1)
        );
    }

    private previousStartPressed: boolean = false;

    private checkGamepadPause(): boolean {
        // Check if gamepad START button was just pressed
        const gamepads = navigator.getGamepads();
        let currentStartPressed = false;

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                currentStartPressed = gamepad.buttons[9]?.pressed || false; // Button 9 is START
                break; // Only check first connected gamepad
            }
        }

        // Detect rising edge (was not pressed, now is pressed)
        const justPressed = currentStartPressed && !this.previousStartPressed;
        this.previousStartPressed = currentStartPressed;

        return justPressed;
    }

    private togglePause(): void {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.pauseMenu.show();
        } else {
            this.pauseMenu.hide();
        }
    }

    private restartMatch(): void {
        // Reset player positions and damage
        this.player.x = 300;
        this.player.y = 200;
        this.player.damagePercent = 0;

        if (this.opponent) {
            this.opponent.x = 500;
            this.opponent.y = 200;
            this.opponent.damagePercent = 0;
        }

        // Reset kill counts
        this.playerKills = 0;
        this.opponentKills = 0;
        this.updateKillCounter();

        // Close pause menu
        this.isPaused = false;
        this.pauseMenu.hide();
    }
}
