import Phaser from 'phaser';
import { Player, PlayerState } from '../entities/Player';
import { PlayerHUD } from '../ui/PlayerHUD';
import { DebugOverlay } from '../components/DebugOverlay';
import { PauseMenu } from '../components/PauseMenu';

export class GameScene extends Phaser.Scene {
    // private player1!: Player;
    // private player2!: Player;

    private debugOverlay!: DebugOverlay;
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private softPlatforms: Phaser.GameObjects.Rectangle[] = [];
    private background!: Phaser.GameObjects.Graphics;
    private walls: Phaser.GameObjects.Rectangle[] = [];
    private wallTexts: Phaser.GameObjects.Text[] = [];

    // Debug visibility
    private debugVisible: boolean = false;
    private debugToggleKey!: Phaser.Input.Keyboard.Key;
    private trainingToggleKey!: Phaser.Input.Keyboard.Key;
    private controlsHintText!: Phaser.GameObjects.Text;

    // Kill tracking
    // private player1HUD!: PlayerHUD;
    // private player2HUD!: PlayerHUD;


    // Wall configuration
    private readonly WALL_THICKNESS = 45; // 30 * 1.5
    private readonly WALL_LEFT_X = 150; // 100 * 1.5
    private readonly WALL_RIGHT_X = 1770; // 1180 * 1.5
    // Playable area bounds (inner edges of walls)
    private readonly PLAY_BOUND_LEFT = this.WALL_LEFT_X + this.WALL_THICKNESS / 2;
    private readonly PLAY_BOUND_RIGHT = this.WALL_RIGHT_X - this.WALL_THICKNESS / 2;

    // Blast zone boundaries
    private readonly BLAST_ZONE_LEFT = -300; // -200 * 1.5
    private readonly BLAST_ZONE_RIGHT = 2220; // 1480 * 1.5 (1920 + 300)
    private readonly BLAST_ZONE_TOP = -300; // -200 * 1.5
    private readonly BLAST_ZONE_BOTTOM = 1350; // 900 * 1.5

    private uiCamera!: Phaser.Cameras.Scene2D.Camera;

    // Camera Settings
    private currentZoomLevel: 'CLOSE' | 'NORMAL' | 'WIDE' = 'CLOSE';
    private readonly ZOOM_SETTINGS = {
        CLOSE: { padX: 100, padY: 100, minZoom: 0.8, maxZoom: 1.5 }, // Tightened padding for closer view
        NORMAL: { padX: 375, padY: 300, minZoom: 0.6, maxZoom: 1.1 },
        WIDE: { padX: 600, padY: 450, minZoom: 0.4, maxZoom: 0.8 }
    };

    // Pause menu
    private isPaused: boolean = false;
    private pauseMenu!: PauseMenu;
    private pauseKey!: Phaser.Input.Keyboard.Key;

    constructor() {
        super({ key: 'GameScene' });
    }

    preload(): void {
        this.loadCharacterAssets();
    }

    private loadCharacterAssets(): void {
        // --- Fok ---
        const fokAssets: Array<{
            key: string;
            folder: string;
            count: number;
            prefix: string; // File prefix e.g. "0_Fok_Idle_"
            type?: string;
            filename?: string;
        }> = [
                { key: 'idle', folder: 'Idle', count: 19, prefix: '0_Fok_Idle_' },
                { key: 'run', folder: 'Running', count: 12, prefix: '0_Fok_Running_' },
                { key: 'charging', folder: 'Charging', count: 8, prefix: '0_Fok_Charging_' },
                { key: 'attack_light', folder: 'AttackLight', count: 1, prefix: '0_Fok_AttackLight_', type: 'manual', filename: '0_Fok_AttackLight_001.png' },
                { key: 'attack_heavy', folder: 'AttackHeavy', count: 1, prefix: '0_Fok_AttackHeavy_' }, // Verified 000
                { key: 'attack_up', folder: 'Attack_Up', count: 1, prefix: '0_Fok_AttackUp_', type: 'manual', filename: '0_Fok_AttackUp_001.png' },
                { key: 'fall', folder: 'Falling Down', count: 1, prefix: '0_Fok_Falling Down_', type: 'manual', filename: '0_Fok_Falling_001.png' },
                { key: 'ground_pound', folder: 'Ground Pound', count: 1, prefix: '0_Fok_Gpound_', type: 'manual', filename: '0_Fok_Gpound_001.png' },
                { key: 'hurt', folder: 'Hurt', count: 1, prefix: '0_Fok_Hurt_', type: 'manual', filename: '0_Fok_Hurt_001.png' },
                { key: 'jump_start', folder: 'Jump Start', count: 6, prefix: '0_Fok_Jump Start_' }, // Assuming verified
                { key: 'jump', folder: 'Jump Loop', count: 1, prefix: '0_Fok_Jump_', type: 'manual', filename: '0_Fok_Jump_000.png' },
                { key: 'slide', folder: 'Sliding', count: 1, prefix: '0_Fok_Sliding_', type: 'manual', filename: '0_Fok_Sliding_000.png' },
                { key: 'attack', folder: 'Throwing', count: 12, prefix: '0_Fok_Throwing_' }, // Assuming verification
                { key: 'attack', folder: 'Throwing', count: 12, prefix: '0_Fok_Throwing_' }, // Assuming verification
            ];

        fokAssets.forEach(asset => {
            for (let i = 0; i < asset.count; i++) {
                let filename = '';
                if (asset.type === 'manual' && asset.filename) {
                    filename = asset.filename;
                } else {
                    const num = i.toString().padStart(3, '0');
                    filename = `${asset.prefix}${num}.png`;
                }
                const key = `fok_${asset.key}_${i}`;
                const path = `assets/fok/${asset.folder}/${filename}`;
                this.load.image(key, path);
            }
        });
    }

    private players: Player[] = [];
    private playerHUDs: PlayerHUD[] = [];
    private playerData: any[] = [];

    init(data: any): void {
        if (data.playerData) {
            this.playerData = data.playerData;
        } else {
            // Fallback defaults
            this.playerData = [
                { playerId: 0, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null }, character: 'fok' },
                { playerId: 1, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null }, character: 'fok', isAI: true, isTrainingDummy: true }
            ];
        }

        // Register shutdown handler
        this.events.once('shutdown', this.shutdown, this);
    }


    create(): void {
        // --- Fok Animations ---
        const fokAnims = [
            { key: 'idle', count: 19, loop: true },
            { key: 'run', count: 12, loop: true },
            { key: 'jump_start', count: 6, loop: false },
            { key: 'jump', count: 1, loop: true },
            { key: 'fall', count: 1, loop: true },
            { key: 'hurt', count: 1, loop: false },
            { key: 'ground_pound', count: 1, loop: true },
            { key: 'attack', count: 12, loop: false },
            { key: 'attack', count: 12, loop: false },
            { key: 'slide', count: 1, loop: true },
            { key: 'dodge', count: 1, loop: false }, // Using same frame logic as slide, mapped later or just created here if frames valid
            { key: 'charging', count: 8, loop: true },
            { key: 'attack_light', count: 1, loop: false },
            { key: 'attack_up', count: 1, loop: false }
        ];

        fokAnims.forEach(anim => {
            const frames = [];
            for (let i = 0; i < anim.count; i++) {
                frames.push({ key: `fok_${anim.key}_${i}` });
            }

            this.anims.create({
                key: `fok_${anim.key}`,
                frames: frames,
                frameRate: anim.key === 'run' ? 20 : 15,
                repeat: anim.loop ? -1 : 0
            });
        });

        // Fok Light Attack (Single Frame 001)
        this.anims.create({
            key: 'fok_attack_light_0', // Keeping variants for Player.ts compatibility, but mapping to same frame
            frames: [{ key: `fok_attack_light_0` }],
            frameRate: 10,
            repeat: 0
        });
        // Map dodge explicitly to slide frame if asset not loaded as 'dodge'
        this.anims.create({
            key: 'fok_dodge',
            frames: [{ key: `fok_slide_0` }],
            frameRate: 10,
            repeat: 0
        });

        this.anims.create({
            key: 'fok_attack_light_1',
            frames: [{ key: `fok_attack_light_0` }],
            frameRate: 10,
            repeat: 0
        });
        // Also map 'heavy' to something so it doesn't crash
        this.anims.create({
            key: 'fok_attack_heavy',
            frames: [{ key: `fok_attack_heavy_0` }],
            frameRate: 1,
            repeat: 0
        });

        // Create Fok Animations
        // Set background color
        this.cameras.main.setBackgroundColor('#1a1a2e');

        // Create stage platforms
        // Create stage platforms
        this.createStage();

        // Create Players
        this.players = [];
        const spawnPoints = [
            { x: 450, y: 300 },
            { x: 1470, y: 300 },
            { x: 960, y: 200 },
            { x: 960, y: 400 }
        ];

        this.playerData.forEach(pData => {
            if (!pData.joined) return;

            const spawn = spawnPoints[pData.playerId] || { x: 960, y: 300 };

            const player = new Player(this, spawn.x, spawn.y, {
                playerId: pData.playerId,
                gamepadIndex: pData.input.gamepadIndex,
                useKeyboard: pData.input.type === 'KEYBOARD',
                character: pData.character
            });

            // Set Color
            const color = this.PLAYER_COLORS[pData.playerId] || 0xffffff;

            // Only tint AI skins
            if (pData.isAI) {
                player.visualColor = color;
            } else {
                player.visualColor = 0xffffff;
            }
            player.resetVisuals();

            this.players.push(player);
        });


        // Setup cameras
        this.setupCameras();

        // Create debug overlay
        this.debugOverlay = new DebugOverlay(this);
        // Make debug overlay ignore main camera (only render on UI camera)
        this.debugOverlay.setCameraIgnore(this.cameras.main);

        // Add controls hint
        this.createControlsHint();

        // Create HUDs
        this.createHUDs();


        // Toggle key
        this.debugToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q); // Changed from F3 to Q
        this.trainingToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
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
        this.events.on('spawnDummy', () => {
            this.togglePause(); // Unpause
            if (this.players.length < 4) {
                this.spawnTrainingDummy();
            }
        });

        // Handle Resume from other scenes (e.g. Settings)
        this.events.on('resume', () => {
            // If we were paused (likely, since we went to settings), show the menu again
            if (this.isPaused) {
                this.pauseMenu.show();
                // Ensure keys are reset to avoid sticking
                this.input.keyboard?.resetKeys();
            }
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

        // Ignore entities
        this.players.forEach(p => p.addToCameraIgnore(this.uiCamera));
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
        // At 1920x1080: center is x=960, place main platform lower at y=825 (550*1.5)
        const mainPlatform = this.add.rectangle(960, 825, 1350, 45, 0x16213e); // 640->960, 550->825, 900->1350, 30->45
        mainPlatform.setStrokeStyle(3, 0x3a506b);
        this.platforms.push(mainPlatform);

        // Soft platform 1 (left, above main)
        const softPlatform1 = this.add.rectangle(570, 600, 360, 24, 0x0f3460); // 380->570, 400->600, 240->360, 16->24
        softPlatform1.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform1.setAlpha(0.85);
        this.softPlatforms.push(softPlatform1);

        // Soft platform 2 (right, above main)
        const softPlatform2 = this.add.rectangle(1350, 600, 360, 24, 0x0f3460); // 900->1350, 400->600
        softPlatform2.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform2.setAlpha(0.85);
        this.softPlatforms.push(softPlatform2);

        // VISIBLE SIDE WALLS for wall mechanics testing
        this.walls = [];
        // Left wall
        const leftWall = this.add.rectangle(this.WALL_LEFT_X, 540, this.WALL_THICKNESS, 1080, 0x2a3a4e); // 360->540, 720->1080
        leftWall.setStrokeStyle(4, 0x4a6a8e);
        leftWall.setAlpha(0.6);
        leftWall.setDepth(-5);
        this.walls.push(leftWall);

        // Right wall
        const rightWall = this.add.rectangle(this.WALL_RIGHT_X, 540, this.WALL_THICKNESS, 1080, 0x2a3a4e);
        rightWall.setStrokeStyle(4, 0x4a6a8e);
        rightWall.setAlpha(0.6);
        rightWall.setDepth(-5);
        this.walls.push(rightWall);

        // Add wall indicators (text labels)
        const leftWallText = this.add.text(this.WALL_LEFT_X - 12, 375, 'WALL', { // -8->-12, 250->375
            fontSize: '18px', // 12->18
            color: '#8ab4f8',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        });
        leftWallText.setRotation(-Math.PI / 2);
        leftWallText.setAlpha(0.5);
        leftWallText.setDepth(-4);
        this.wallTexts.push(leftWallText);

        const rightWallText = this.add.text(this.WALL_RIGHT_X + 12, 525, 'WALL', { // +8->+12, 350->525
            fontSize: '18px',
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
            'Keyboard / Joypad Controls:',
            'Move: Arrows/WASD | Stick/D-pad',
            'Jump: Space/↑    | A (Cross)',
            'Light: C / J     | X (Square)',
            'Heavy: X / K     | B / Y (Circle/Tri)',
            'Dodge: Z / L     | Triggers (LT/RT)',
            'Recov: V / Shift | Up + Heavy',
            '',
            'Debug: Q / Select | AI: O | Dummy: T',
        ].join('\n');

        this.controlsHintText = this.add.text(15, 750, controlsText, { // 10->15, 500->750
            fontSize: '16px', // 10->16?
            color: '#888888',
            fontFamily: 'monospace', // Monospace for alignment
            lineSpacing: 1,
        });
        this.controlsHintText.setScrollFactor(0);
        this.controlsHintText.setDepth(500);
        // Make controls hint ignore main camera zoom
        this.cameras.main.ignore(this.controlsHintText);
    }

    // Player Config
    private readonly PLAYER_COLORS = [
        0x8ab4f8, // P1: Pastel Blue
        0xf28b82, // P2: Pastel Red
        0xccff90, // P3: Pastel Green
        0xfdd663  // P4: Pastel Yellow
    ];

    private createHUDs(): void {
        this.playerHUDs = [];
        this.playerData.forEach(pData => {
            if (!pData.joined) return;

            // Layout: P1 TL, P2 TR, P3 BL, P4 BR
            // Increased margins from edge
            let x = 120;
            let y = 80;
            let isLeft = true;

            switch (pData.playerId) {
                case 0: x = 120; y = 80; isLeft = true; break;
                case 1: x = this.scale.width - 120; y = 80; isLeft = false; break;
                case 2: x = 120; y = this.scale.height - 80; isLeft = true; break;
                case 3: x = this.scale.width - 120; y = this.scale.height - 80; isLeft = false; break;
            }

            const color = this.PLAYER_COLORS[pData.playerId] || 0xffffff;
            const hud = new PlayerHUD(this, x, y, isLeft, `Player ${pData.playerId + 1}`, color);
            hud.addToCameraIgnore(this.cameras.main);
            this.playerHUDs.push(hud);
        });
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

        // Check for Debug Toggle (Q key or SELECT button on gamepad)
        const qKeyPressed = Phaser.Input.Keyboard.JustDown(this.debugToggleKey);
        const gamepadSelectPressed = this.checkGamepadSelect();

        if (qKeyPressed || gamepadSelectPressed) {
            this.debugVisible = !this.debugVisible;
            // Update Debug Overlay
            this.debugOverlay.setVisible(this.debugVisible);
            // Update Players
            this.players.forEach(p => p.setDebug(this.debugVisible));
        }

        // Handle Training Toggle (T)
        if (Phaser.Input.Keyboard.JustDown(this.trainingToggleKey)) {
            // Find all AI players
            const aiPlayers = this.players.filter(p => p.isAI);

            if (aiPlayers.length > 0) {
                // Determine target state based on the first AI (sync them all)
                // If first one is dummy, ALL become active. If first is active, ALL become dummy.
                const targetIsDummy = !aiPlayers[0].isTrainingDummy;

                aiPlayers.forEach(p => {
                    p.isTrainingDummy = targetIsDummy;

                    // Show floating text feedback for each
                    p.isTrainingDummy = targetIsDummy;
                    // No floaty text needed, debug overlay shows state
                });
            } else {
                // If no AI exists (e.g. 1v1 human match, or just P1), spawn a dummy
                this.spawnTrainingDummy();
            }
        }

        // Update players
        this.players.forEach(p => p.update(delta));


        // Platform Collisions
        for (const platform of this.platforms) {
            this.players.forEach(p => p.checkPlatformCollision(platform, false));
        }
        for (const platform of this.softPlatforms) {
            this.players.forEach(p => p.checkPlatformCollision(platform, true));
        }


        // Environment Collisions (Walls)
        this.players.forEach(p => p.checkWallCollision(this.PLAY_BOUND_LEFT, this.PLAY_BOUND_RIGHT));


        // Combat Hit Checks
        for (let i = 0; i < this.players.length; i++) {
            for (let j = 0; j < this.players.length; j++) {
                if (i !== j) {
                    this.players[i].checkHitAgainst(this.players[j]);
                }
            }
        }


        // Check Blast Zones
        this.checkBlastZones();

        // Camera Follow
        this.updateCamera();

        // Update debug overlay (Showing P1 stats for now)
        if (this.players.length > 0) {
            const displayPlayer = this.players[0]; // Always show first player
            const velocity = displayPlayer.getVelocity();
            const currentAttack = displayPlayer.getCurrentAttack();
            const attackInfo = currentAttack
                ? `${currentAttack.data.type} ${currentAttack.data.direction} (${currentAttack.phase})`
                : 'None';

            if (this.debugVisible) {
                this.debugOverlay.update(
                    velocity.x,
                    velocity.y,
                    displayPlayer.getState(),
                    displayPlayer.getRecoveryAvailable(),
                    attackInfo,
                    displayPlayer.isGamepadConnected()
                );
                this.debugOverlay.setVisible(true);
                this.controlsHintText.setVisible(true);
            } else {
                this.debugOverlay.setVisible(false);
                this.controlsHintText.setVisible(false);
            }
        }


        // Update HUDs
        this.playerHUDs.forEach((hud, index) => {
            // Matching logic is brittle if players and HUDs align by index of *joined* players. 
            // Logic in createHUDs iterates playerData, same as createPlayers (if sequential).
            // Simpler: playerHUDs[i] corresponds to players[i] if created in same order.
            if (this.players[index]) {
                hud.update(this.players[index].damage, this.players[index].lives);
            }
        });

    }

    private checkBlastZones(): void {
        const checkPlayer = (player: Player, playerId: number) => {
            const bounds = player.getBounds();
            if (bounds.left < this.BLAST_ZONE_LEFT ||
                bounds.right > this.BLAST_ZONE_RIGHT ||
                bounds.top < this.BLAST_ZONE_TOP ||
                bounds.bottom > this.BLAST_ZONE_BOTTOM) {

                // Player eliminated
                this.respawnPlayer(player, playerId);

                // Score update (lives)
                player.lives = Math.max(0, player.lives - 1);
            }
        };

        this.players.forEach(p => checkPlayer(p, p.playerId));

    }

    private respawnPlayer(player: Player, playerId: number): void {
        // Respawn position
        const spawnPoints = [
            { x: 450, y: 300 },
            { x: 1470, y: 300 },
            { x: 960, y: 200 },
            { x: 960, y: 400 }
        ];
        const spawn = spawnPoints[playerId] || { x: 960, y: 300 };
        const spawnX = spawn.x;

        const spawnY = 300;

        // Reset physics and state
        player.setPosition(spawnX, spawnY);
        player.physics.reset();
        player.setState(PlayerState.AIRBORNE);
        player.setDamage(0);
        player.resetVisuals();

        // Visual respawn effect (flash)
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 0.8);
        flash.fillCircle(spawnX, spawnY, 75); // 50->75
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2,
            duration: 300,
            onComplete: () => flash.destroy()
        });
    }

    public setZoomLevel(level: 'CLOSE' | 'NORMAL' | 'WIDE'): void {
        this.currentZoomLevel = level;
    }

    private updateCamera(): void {
        const targets: Phaser.GameObjects.Components.Transform[] = [...this.players];


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

    private previousSelectPressed: boolean = false;

    private checkGamepadSelect(): boolean {
        // Check if gamepad SELECT/BACK button was just pressed
        const gamepads = navigator.getGamepads();
        let currentSelectPressed = false;

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                // Button 8 is usually SELECT/BACK/VIEW on standard gamepads (Xbox/PlayStation)
                currentSelectPressed = gamepad.buttons[8]?.pressed || false;
                break; // Only check first connected gamepad
            }
        }

        // Detect rising edge (was not pressed, now is pressed)
        const justPressed = currentSelectPressed && !this.previousSelectPressed;
        this.previousSelectPressed = currentSelectPressed;

        return justPressed;
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
        this.players.forEach(p => this.respawnPlayer(p, p.playerId));


        // Reset kill counts
        this.players.forEach(p => p.lives = 3);


        // Close pause menu
        this.isPaused = false;
        this.pauseMenu.hide();
    }

    private spawnTrainingDummy(): void {
        const maxPlayers = 4;

        // Find first available player ID
        let availableId = -1;
        for (let i = 0; i < maxPlayers; i++) {
            if (!this.players.find(p => p.playerId === i)) {
                availableId = i;
                break;
            }
        }

        if (availableId === -1) {
            console.log('Max players reached, cannot spawn dummy.');
            return;
        }

        const playerId = availableId;

        // Data
        const dummyData = {
            playerId: playerId,
            joined: true,
            ready: true,
            input: { type: 'KEYBOARD', gamepadIndex: null },
            character: 'fok' as const,
            isAI: true,
            isTrainingDummy: true
        };

        // Check if already exists in data (shouldn't if check passed)
        if (!this.playerData.find(pd => pd.playerId === playerId)) {
            this.playerData.push(dummyData);
        }

        // Spawn logic
        // Center Spawn (with slight offset to avoid complete overlap if multiple spawn at once)
        const spawnX = 960 + (playerId * 10);
        const spawnY = 300;

        const player = new Player(this, spawnX, spawnY, {
            playerId: playerId,
            gamepadIndex: null,
            useKeyboard: false,
            character: 'fok',
            isAI: true
        });

        player.isTrainingDummy = true;

        // Set Color
        // Set Color
        const color = this.PLAYER_COLORS[playerId] || 0xffffff;
        player.visualColor = color;
        player.resetVisuals(); // Apply color

        this.players.push(player);
        player.addToCameraIgnore(this.uiCamera);

        // Create HUD
        // Layout logic
        let x = 120;
        let y = 80;
        let isLeft = true;

        switch (playerId) {
            case 0: x = 120; y = 80; isLeft = true; break;
            case 1: x = this.scale.width - 120; y = 80; isLeft = false; break;
            case 2: x = 120; y = this.scale.height - 80; isLeft = true; break;
            case 3: x = this.scale.width - 120; y = this.scale.height - 80; isLeft = false; break;
        }

        const hud = new PlayerHUD(this, x, y, isLeft, `CPU ${playerId + 1} (Dummy)`, color);
        hud.addToCameraIgnore(this.cameras.main);

        // Ensure we don't duplicate HUD if re-spawning (though player array check prevents this)
        // Just push new logic
        this.playerHUDs.push(hud);


    }

    // Clean up when scene is shut down (e.g. switching to menu)
    // Clean up when scene is shut down (e.g. switching to menu)
    shutdown(): void {
        // Stop all physics and input
        if (this.matter && this.matter.world) {
            this.matter.world.shutdown();
        }
        this.input.keyboard?.removeAllKeys();
        this.input.keyboard?.resetKeys();

        // Kill event listeners
        this.events.off('pauseMenuResume');
        this.events.off('pauseMenuRestart');
        this.events.off('pauseMenuExit');
        this.events.off('spawnDummy');

        // Destroy players
        this.players.forEach(p => p.destroy());

        if (this.debugOverlay) {
            this.debugOverlay.destroy();
        }
    }
}
