import Phaser from 'phaser';
import { Player, PlayerState } from '../entities/Player';
import { DebugOverlay } from '../components/DebugOverlay';
import { PauseMenu } from '../components/PauseMenu';

export class GameScene extends Phaser.Scene {
    private player1!: Player;
    private player2!: Player;
    private debugOverlay!: DebugOverlay;
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private softPlatforms: Phaser.GameObjects.Rectangle[] = [];
    private background!: Phaser.GameObjects.Graphics;
    private walls: Phaser.GameObjects.Rectangle[] = [];
    private wallTexts: Phaser.GameObjects.Text[] = [];

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

        // Preload Spine Assets (Raptor Placeholder)
        (this.load as any).spineJson('raptor-data', 'assets/spine/raptor/raptor-pro.json');
        (this.load as any).spineAtlas('raptor-atlas', 'assets/spine/raptor/raptor-pma.atlas');
    }

    private p1Config: any;
    private p2Config: any;

    init(data: any): void {
        this.p1Config = data.p1;
        this.p2Config = data.p2;

        // Fallback defaults if no data passed (e.g. direct load or reload)
        if (!this.p1Config) {
            this.p1Config = { playerId: 0, gamepadIndex: 0, useKeyboard: false };
        }
        if (!this.p2Config) {
            this.p2Config = { playerId: 1, gamepadIndex: null, useKeyboard: true };
        }

        // Register shutdown handler
        this.events.once('shutdown', this.shutdown, this);
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
        // Create stage platforms
        this.createStage();

        // Create Player 1 (Left Spawn)
        this.player1 = new Player(this, 300, 200, {
            playerId: 0,
            gamepadIndex: this.p1Config.gamepadIndex,
            useKeyboard: this.p1Config.useKeyboard
        });

        // Create Player 2 (Right Spawn)
        this.player2 = new Player(this, 980, 200, {
            playerId: 1,
            gamepadIndex: this.p2Config.gamepadIndex,
            useKeyboard: this.p2Config.useKeyboard
        });
        // Ensure P2 faces left initially
        // (Player class handles facing based on velocity, but visual start?)
        this.player2.setState(PlayerState.AIRBORNE); // Just to ensure update runs


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
        this.debugToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.F3);
        this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);

        // Create pause menu
        this.pauseMenu = new PauseMenu(this);
        this.cameras.main.ignore(this.pauseMenu.getElements());

        // Pause menu event listeners
        this.events.on('pauseMenuResume', () => this.togglePause());
        this.events.on('pauseMenuRestart', () => this.restartMatch());
        this.events.on('pauseMenuExit', () => {
            // Force a reload to ensure clean state and avoid memory leaks
            window.location.reload();
        });
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
        // Ignore entities (and their damage text)
        if (this.player1) this.player1.addToCameraIgnore(this.uiCamera);
        if (this.player2) this.player2.addToCameraIgnore(this.uiCamera);
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
        }

        // Update players
        if (this.player1) this.player1.update(delta);
        if (this.player2) this.player2.update(delta);

        // Platform Collisions
        for (const platform of this.platforms) {
            if (this.player1) this.player1.checkPlatformCollision(platform, false);
            if (this.player2) this.player2.checkPlatformCollision(platform, false);
        }
        for (const platform of this.softPlatforms) {
            if (this.player1) this.player1.checkPlatformCollision(platform, true);
            if (this.player2) this.player2.checkPlatformCollision(platform, true);
        }

        // Environment Collisions (Walls)
        if (this.player1) this.player1.checkWallCollision(this.PLAY_BOUND_LEFT, this.PLAY_BOUND_RIGHT);
        if (this.player2) this.player2.checkWallCollision(this.PLAY_BOUND_LEFT, this.PLAY_BOUND_RIGHT);

        // Combat Hit Checks
        if (this.player1 && this.player2) {
            this.player1.checkHitAgainst(this.player2);
            this.player2.checkHitAgainst(this.player1);
        }

        // Check Blast Zones
        this.checkBlastZones();

        // Camera Follow
        this.updateCamera();

        // Update debug overlay (Showing P1 stats for now)
        if (this.player1) {
            const velocity = this.player1.getVelocity();
            const currentAttack = this.player1.getCurrentAttack();
            const attackInfo = currentAttack
                ? `${currentAttack.data.type} ${currentAttack.data.direction} (${currentAttack.phase})`
                : 'None';

            if (this.debugVisible) {
                this.debugOverlay.update(
                    velocity.x,
                    velocity.y,
                    this.player1.getState(),
                    this.player1.getRecoveryAvailable(),
                    attackInfo,
                    this.player1.isGamepadConnected()
                );
                this.debugOverlay.setVisible(true);
                this.controlsHintText.setVisible(true);
            } else {
                this.debugOverlay.setVisible(false);
                this.controlsHintText.setVisible(false);
            }
        }
    }

    private checkBlastZones(): void {
        const checkPlayer = (player: Player, isP1: boolean) => {
            const bounds = player.getBounds();
            if (bounds.left < this.BLAST_ZONE_LEFT ||
                bounds.right > this.BLAST_ZONE_RIGHT ||
                bounds.top < this.BLAST_ZONE_TOP ||
                bounds.bottom > this.BLAST_ZONE_BOTTOM) {

                // Player eliminated
                this.respawnPlayer(player, isP1);

                // Score update
                if (isP1) {
                    this.opponentKills++;
                } else {
                    this.playerKills++;
                }
                this.updateKillCounter();
            }
        };

        if (this.player1) checkPlayer(this.player1, true);
        if (this.player2) checkPlayer(this.player2, false);
    }

    private respawnPlayer(player: Player, isP1: boolean): void {
        // Respawn position
        // P1 defaults to left (300), P2 defaults to right (980)
        const spawnX = isP1 ? 300 : 980;
        const spawnY = 200;

        // Reset physics and state
        player.setPosition(spawnX, spawnY);
        player.physics.reset();
        player.setState(PlayerState.AIRBORNE);
        player.setDamage(0);
        player.resetVisuals();

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
        if (this.player1) targets.push(this.player1);
        if (this.player2) targets.push(this.player2);

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
        if (this.player1) {
            this.respawnPlayer(this.player1, true);
        }
        if (this.player2) {
            this.respawnPlayer(this.player2, false);
        }

        // Reset kill counts
        this.playerKills = 0;
        this.opponentKills = 0;
        this.updateKillCounter();

        // Close pause menu
        this.isPaused = false;
        this.pauseMenu.hide();
    }

    // Clean up when scene is shut down (e.g. switching to menu)
    shutdown(): void {
        this.events.off('pauseMenuResume');
        this.events.off('pauseMenuRestart');
        this.events.off('pauseMenuExit');
        this.input.keyboard?.removeAllKeys();
    }
}
