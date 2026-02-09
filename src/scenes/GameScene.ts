import Phaser from 'phaser';
import { Player, PlayerState } from '../entities/Player';
import { PlayerHUD } from '../ui/PlayerHUD';
import { DebugOverlay } from '../components/DebugOverlay';
import { PauseMenu } from '../components/PauseMenu';
import { Bomb } from '../entities/Bomb';

export class GameScene extends Phaser.Scene {
    // private player1!: Player;
    // private player2!: Player;

    private debugOverlay!: DebugOverlay;
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private softPlatforms: Phaser.GameObjects.Rectangle[] = [];
    public bombs: Bomb[] = [];
    private background!: Phaser.GameObjects.Graphics;
    private backgroundImage!: Phaser.GameObjects.Image; // Add class property
    private walls: Phaser.GameObjects.Rectangle[] = [];
    private wallTexts: Phaser.GameObjects.Text[] = [];

    // Debug visibility
    private debugVisible: boolean = false;
    private debugToggleKey!: Phaser.Input.Keyboard.Key;
    private trainingToggleKey!: Phaser.Input.Keyboard.Key;
    // Debug bomb spawn key
    private spawnKey!: Phaser.Input.Keyboard.Key;

    // Kill tracking
    // private player1HUD!: PlayerHUD;
    // private player2HUD!: PlayerHUD;


    // Wall configuration
    private readonly WALL_THICKNESS = 45;
    private readonly WALL_LEFT_X = -400; // Refinement 12: Pushed out from -200
    private readonly WALL_RIGHT_X = 2320; // Refinement 12: Pushed out from 2120
    // Playable area bounds (inner edges of walls)
    private readonly PLAY_BOUND_LEFT = this.WALL_LEFT_X + this.WALL_THICKNESS / 2;
    private readonly PLAY_BOUND_RIGHT = this.WALL_RIGHT_X - this.WALL_THICKNESS / 2;

    // Blast zone boundaries
    private readonly BLAST_ZONE_LEFT = -3000; // Extended from -2000
    private readonly BLAST_ZONE_RIGHT = 5000; // Extended from 4000
    private readonly BLAST_ZONE_TOP = -2500;
    private readonly BLAST_ZONE_BOTTOM = 3500;

    private uiCamera!: Phaser.Cameras.Scene2D.Camera;

    // Camera Settings
    private currentZoomLevel: 'CLOSE' | 'NORMAL' | 'WIDE' = 'CLOSE';
    private readonly ZOOM_SETTINGS = {
        CLOSE: { padX: 250, padY: 100, minZoom: 0.5, maxZoom: 1.5 }, // Increased padding and range
        NORMAL: { padX: 450, padY: 300, minZoom: 0.5, maxZoom: 1.1 },
        WIDE: { padX: 600, padY: 450, minZoom: 0.3, maxZoom: 0.8 }
    };

    // Pause menu
    private isPaused: boolean = false;
    private pauseMenu!: PauseMenu;
    private pauseKey!: Phaser.Input.Keyboard.Key;

    // Game Over State
    private isGameOver: boolean = false;
    private previousAButtonPressed: boolean = false;
    private previousSelectPressed: boolean = false; // Moved here for logical grouping
    private previousStartPressed: boolean = false; // Moved here for logical grouping

    constructor() {
        super({ key: 'GameScene' });
    }

    preload(): void {
        this.loadCharacterAssets();
    }

    private loadCharacterAssets(): void {
        this.load.atlas('fok_v3', 'assets/fok_v3/fok_v3.png', 'assets/fok_v3/fok_v3.json');

        // Load Maps
        this.load.image('background_lake', 'assets/pixel-lake08-sunny-water.jpg');
    }

    private createAnimations(): void {
        const charConfigs = {
            'fok_v3': {
                idle: { prefix: 'Fok_v3_Idle_', count: 12, loop: true },
                run: { prefix: 'Fok_v3_Run_', count: 9, loop: true },
                charging: { prefix: 'Fok_v3_Charge_', count: 2, loop: true },

                // Dash (New)
                dash: { prefix: 'Fok_v3_Dash_', count: 1, suffix: '000', loop: false },

                // Spot Dodge
                spot_dodge: { prefix: 'Fok_v3_Dodge_', count: 1, suffix: '000', loop: false },

                // --- LIGHT ATTACKS ---

                // Neutral Light
                attack_light_neutral: { prefix: 'Fok_v3_Side_Light_', count: 1, suffix: '000', loop: false },

                // Up Light -> Mapped to Side Light (Req 1 swap)
                attack_light_up: { prefix: 'Fok_v3_Side_Light_', count: 1, suffix: '000', loop: false },

                // Down Light
                attack_light_down: { prefix: 'Fok_v3_Down_Light_', count: 1, suffix: '000', loop: false },

                // Side Light -> Mapped to Neutral Light (Req 1 swap)
                attack_light_side: { prefix: 'Fok_v3_Neutral_Light_', count: 1, suffix: '000', loop: false },
                attack_light_side_air: { prefix: 'Fok_v3_Side_Air_', count: 1, suffix: '000', loop: false },


                // --- HEAVY ATTACKS (SIGS) ---

                // Neutral Sig -> Mapped to Up Sig (Req 2)
                attack_heavy_neutral: { prefix: 'Fok_v3_Up_Sig_', count: 1, suffix: '000', loop: false },

                // Up Sig
                attack_heavy_up: { prefix: 'Fok_v3_Up_Sig_', count: 1, suffix: '000', loop: false },

                // Side Sig (Req 3)
                attack_heavy_side: { prefix: 'Fok_v3_Side_Sig_', count: 1, suffix: '000', loop: false },

                // Down Sig 
                attack_heavy_down: { prefix: 'Fok_v3_Down_Sig_', count: 1, suffix: '000', loop: false },


                // Utilities
                wall_slide: { prefix: 'Fok_v3_Wall_Slide_', count: 1, suffix: '000', loop: false },
                recovery: { prefix: 'Fok_v3_Recovery_', count: 1, suffix: '000', loop: false },
                ground_pound: { prefix: 'Fok_v3_Ground_Pound_', count: 1, suffix: '000', loop: false },

                hurt: { prefix: 'Fok_v3_Hurt_', count: 1, suffix: '000', loop: false },
                fall: { prefix: 'Fok_v3_Fall_', count: 1, suffix: '000', loop: false },
                jump: { prefix: 'Fok_v3_Jump_', count: 1, suffix: '000', loop: false },
                slide: { prefix: 'Fok_v3_Dodge_', count: 1, suffix: '000', loop: false }
            }
        };

        const characters = ['fok_v3'];

        characters.forEach(char => {
            const config = charConfigs[char as keyof typeof charConfigs];
            if (!config) return;

            Object.entries(config).forEach(([animName, animData]: [string, any]) => {
                const animKey = `${char}_${animName}`;
                if (this.anims.exists(animKey)) return;

                let frames;
                if (animData.count === 1 && animData.suffix) {
                    frames = this.anims.generateFrameNames(char, {
                        prefix: animData.prefix,
                        start: parseInt(animData.suffix),
                        end: parseInt(animData.suffix),
                        zeroPad: 3
                    });
                } else {
                    // Sequence 0 to count-1
                    // Note: fok_v3 uses 3 digit zero pad for all? json shows "000", "001" etc.
                    frames = this.anims.generateFrameNames(char, {
                        prefix: animData.prefix,
                        start: 0,
                        end: animData.count - 1,
                        zeroPad: 3
                    });
                }

                this.anims.create({
                    key: animKey,
                    frames: frames,
                    frameRate: animName === 'run' ? 24 : 10, // Increased run speed to reduce sliding look
                    repeat: animData.loop ? -1 : 0
                });
            });

            // Special cases / Extra mappings to ensure all keys exist
            const ensureAnim = (key: string, frameName: string, frameIndex: number = 0) => {
                if (!this.anims.exists(key)) {
                    this.anims.create({
                        key: key,
                        frames: this.anims.generateFrameNames(char, { prefix: frameName, start: frameIndex, end: frameIndex, zeroPad: 3 }),
                        frameRate: 10,
                        repeat: 0
                    });
                }
            };

            if (char === 'fok_v3') {
                ensureAnim(`${char}_attack_light_0`, 'Fok_v3_Neutral_Light_', 0);
                ensureAnim(`${char}_attack_light_1`, 'Fok_v3_Neutral_Light_', 1);
                ensureAnim(`${char}_dodge`, 'Fok_v3_Dodge_', 0);
                ensureAnim(`${char}_jump_start`, 'Fok_v3_Jump_', 0);
            } else {
                // Original mappings
                if (!this.anims.exists(`${char}_attack_light_0`)) {
                    this.anims.create({
                        key: `${char}_attack_light_0`,
                        frames: this.anims.generateFrameNames(char, { prefix: '0_Fok_AttackLight_', start: 0, end: 0, zeroPad: 3 }),
                        frameRate: 10,
                        repeat: 0
                    });
                }
                if (!this.anims.exists(`${char}_attack_light_1`)) {
                    this.anims.create({
                        key: `${char}_attack_light_1`,
                        frames: this.anims.generateFrameNames(char, { prefix: '0_Fok_AttackLight_', start: 0, end: 0, zeroPad: 3 }),
                        frameRate: 10,
                        repeat: 0
                    });
                }
                if (!this.anims.exists(`${char}_dodge`)) {
                    this.anims.create({
                        key: `${char}_dodge`,
                        frames: this.anims.generateFrameNames(char, { prefix: '0_Fok_Sliding_', start: 0, end: 0, zeroPad: 3 }),
                        frameRate: 10,
                        repeat: 0
                    });
                }
                if (!this.anims.exists(`${char}_jump_start`)) {
                    this.anims.create({
                        key: `${char}_jump_start`,
                        frames: this.anims.generateFrameNames(char, { prefix: '0_Fok_Jump_', start: 0, end: 0, zeroPad: 3 }),
                        frameRate: 10,
                        repeat: 0
                    });
                }

                // COMPATIBILITY ALIASING for 'fok'/'fok_alt'
                // Alias new specific keys to existing legacy ones
                const createAlias = (newSuffix: string, existingSuffix: string) => {
                    const newKey = `${char}_${newSuffix}`;
                    const existingKey = `${char}_${existingSuffix}`;
                    if (!this.anims.exists(newKey) && this.anims.exists(existingKey)) {
                        const existingAnim = this.anims.get(existingKey);
                        const frames = existingAnim.frames.map(f => ({ key: f.textureKey, frame: f.textureFrame }));
                        this.anims.create({
                            key: newKey,
                            frames: frames,
                            frameRate: 10,
                            repeat: 0
                        });
                    }
                };

                createAlias('attack_light_neutral', 'attack_light');
                createAlias('attack_light_up', 'attack_up');
                createAlias('attack_light_down', 'attack_down');
                createAlias('attack_light_side', 'attack_side');
                createAlias('attack_light_side_air', 'attack_side');

                createAlias('attack_heavy_neutral', 'attack_heavy');
                createAlias('attack_heavy_up', 'attack_up');
                createAlias('attack_heavy_side', 'attack_side');
                createAlias('attack_heavy_down', 'attack_down');

                createAlias('spot_dodge', 'slide');
                createAlias('dash', 'slide'); // Use slide for dash too (legacy fallback)
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
                { playerId: 0, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null }, character: 'fok_v3' },
                { playerId: 1, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null }, character: 'fok', isAI: true, isTrainingDummy: true }
            ];
        }

        // Register shutdown handler
        this.events.once('shutdown', this.shutdown, this);
    }


    create(): void {
        try {
            console.log("GameScene.create started");
            // const { width, height } = this.scale; // Unused after bounds removal

            // --- Physics Setup ---
            // --- Physics Setup ---
            // this.matter.world.setBounds(0, 0, width, height); // Removed to fix off-stage bounce
            this.matter.world.setGravity(0, 1);

            // --- Error Handler (Visual) ---
            // (Error text is created dynamically in catch block if needed)
            // this.matter.world.setBounds(0, 0, width, height); // Removed duplicate

            // --- Fok Animations ---
            this.createAnimations();


            // BACKGROUND LOGIC
            // Move background creation here to ensure it's managed, but depth should handle order.
            // If SetDepth(-20) isn't working, it might be due to display list order if depth sorting isn't enabled or is buggy.
            // Safest: create background FIRST.
            // But since we are patching, let's try to force it to back of display list AND use depth.

            // Note: I added background loading in createAnimations() earlier, which is called above.
            // Let's remove it from there and put it here cleanly.
            // Actually, let's just use what was added in createAnimations (which I effectively patched into 'create' in previous step? No, wait.)

            // In the previous patch, I added the background code inside 'createAnimations'??
            // Let's check where line 271 is. 
            // Ah, I see "this.createAnimations();" at line 271.
            // And then "Set background color (fallback)" at line 274.
            // It seems I added the background code AFTER createAnimations, inside 'create'.

            // If z-index -20 is obscuring, maybe the camera transform is ignored for background?
            // Or maybe the players have lower Z?
            // Player Z is 0.

            // Let's try setScrollFactor(0) to make it static and ensure depth is comfortably low.
            // And also `sendToBack()`.

            // Create stage platforms
            this.createStage();

            // BACKGROUND LOGIC
            // Refinement: Removed image, using static dark blue gradient
            this.cameras.main.setBackgroundColor('#000000'); // Fallback black

            // Background graphics are created in createStage(), ensure they are visible
            if (this.background) {
                this.background.setVisible(true);
            }

            // Create Players
            this.players = [];

            // Default Spawn Points
            let spawnPoints = [
                { x: 450, y: 300 },
                { x: 1470, y: 300 },
                { x: 960, y: 200 },
                { x: 960, y: 400 }
            ];

            // DUMMY MODE OVERRIDE: Spawn closer together at center
            const hasDummy = this.playerData.some(p => p.isTrainingDummy);
            if (hasDummy) {
                spawnPoints = [
                    { x: 880, y: 300 },  // P1: Left of center
                    { x: 1040, y: 300 }, // P2 (Dummy): Right of center
                    { x: 960, y: 200 },
                    { x: 960, y: 400 }
                ];
            }

            this.playerData.forEach(pData => {
                if (!pData.joined) return;

                const spawn = spawnPoints[pData.playerId] || { x: 960, y: 300 };

                console.log(`Creating player ${pData.playerId}...`);
                const player = new Player(this, spawn.x, spawn.y, {
                    playerId: pData.playerId,
                    isAI: pData.isAI,
                    isTrainingDummy: pData.isTrainingDummy, // Pass training dummy flag
                    gamepadIndex: pData.input.gamepadIndex,
                    useKeyboard: pData.input.type === 'KEYBOARD',
                    character: pData.character
                });
                console.log(`Player ${pData.playerId} created.`);

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
                console.log(`Player ${pData.playerId} pushed to array.`);
            });


            // Setup cameras
            this.setupCameras();

            // Create debug overlay
            this.debugOverlay = new DebugOverlay(this);
            this.debugOverlay.setCameraIgnore(this.cameras.main);

            // Add controls hint
            // Refinement: Removed as requested ("remove control legend from debug mode")
            // this.createControlsHint();

            // Create HUDs
            this.createHUDs();

            // Toggle key
            this.debugToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
            this.trainingToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
            this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
            // Debug Spawn Key
            this.spawnKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);

            // Create pause menu
            this.pauseMenu = new PauseMenu(this);
            this.cameras.main.ignore(this.pauseMenu.getElements());

            // Pause menu event listeners
            this.events.on('pauseMenuResume', () => this.togglePause());
            this.events.on('pauseMenuRestart', () => this.restartMatch());
            this.events.on('pauseMenuLobby', () => {
                console.log("PauseMenu: Returning to Lobby...");
                this.time.delayedCall(10, () => {
                    try {
                        console.log("Switching to LobbyScene");
                        // Infer mode from playerData (if dummy exists, it's training)
                        const isTraining = this.playerData.some((p: any) => p.isTrainingDummy);
                        this.scene.start('LobbyScene', {
                            mode: isTraining ? 'training' : 'versus',
                            // Don't pass old slots - let LobbyScene.create reset fresh
                        });
                    } catch (e) {
                        console.error("Failed to start LobbyScene:", e);
                    }
                });
            });
            this.events.on('pauseMenuExit', () => {
                window.location.reload();
            });
            this.events.on('spawnDummy', () => {
                this.togglePause(); // Unpause
                if (this.players.length < 4) {
                    this.spawnTrainingDummy();
                }
            });

            // Handle Resume from other scenes
            this.events.on('resume', () => {
                if (this.isPaused) {
                    this.pauseMenu.show();
                    this.input.keyboard?.resetKeys();
                }
            });
            console.log("GameScene.create completed successfully");

        } catch (e: any) {
            console.error("CRITICAL ERROR in GameScene.create:", e);
            const errT = this.add.text(this.scale.width / 2, this.scale.height / 2, "CRASH: " + e?.message || String(e), { fontSize: '32px', color: '#ff0000', backgroundColor: '#000' });
            errT.setOrigin(0.5).setDepth(9999);
        }
    }

    private spawnBomb(): void {
        console.log("spawnBomb called. isPaused:", this.isPaused);
        if (this.isPaused) return;

        const { width } = this.scale;

        // Random X position within central area (500-1420) so it's likely visible
        const padding = 500;
        const x = Phaser.Math.Between(padding, width - padding);
        const y = 0; // Top of screen (inside bounds)

        const bomb = new Bomb(this, x, y);
        if (this.uiCamera) {
            this.uiCamera.ignore(bomb);
        }
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
        if (this.backgroundImage) this.uiCamera.ignore(this.backgroundImage); // Ignore bg image
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
        // Background gradient to show play area
        this.background = this.add.graphics();
        // Refinement: Dark Blue Gradient (Deep Navy -> Dark Blue/Grey)
        // Top: 0x0f2027, Bottom: 0x203a43
        this.background.fillGradientStyle(0x0f2027, 0x0f2027, 0x203a43, 0x203a43, 1);
        this.background.fillRect(0, 0, this.scale.width, this.scale.height);
        this.background.setScrollFactor(0); // Ensure static relative to camera
        this.background.setDepth(-100); // Ensure behind everything

        // Main platform (centered, wider - Refinement 12)
        // Center: 960. Width 2400 (Was 1800). Y = 900
        const mainPlatform = this.add.rectangle(960, 900, 2400, 60, 0x2c3e50);
        mainPlatform.setStrokeStyle(3, 0x3a506b);
        this.platforms.push(mainPlatform);
        // Add Matter body for Bomb collision
        this.matter.add.gameObject(mainPlatform, { isStatic: true });

        // Soft platform 1 (left, floating HIGHER)
        // Refinement 12: Pushed left to 260 (Was 460)
        const softPlatform1 = this.add.rectangle(260, 500, 500, 30, 0x0f3460);
        softPlatform1.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform1.setAlpha(0.85);
        this.softPlatforms.push(softPlatform1);
        this.matter.add.gameObject(softPlatform1, { isStatic: true });

        // Soft platform 2 (right, floating HIGHER)
        // Refinement 12: Pushed right to 1660 (Was 1460)
        const softPlatform2 = this.add.rectangle(1660, 500, 500, 30, 0x0f3460);
        softPlatform2.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform2.setAlpha(0.85);
        this.softPlatforms.push(softPlatform2);
        this.matter.add.gameObject(softPlatform2, { isStatic: true });

        // Camera Zoom
        this.cameras.main.setZoom(1);
        this.cameras.main.centerOn(960, 540);

        // VISIBLE SIDE WALLS
        const wallColor = 0x2a3a4e;
        const wallStroke = 0x4a6a8e;

        // Left wall visual
        const leftWallVisual = this.add.rectangle(this.WALL_LEFT_X, 540, this.WALL_THICKNESS, 1080, wallColor);
        leftWallVisual.setStrokeStyle(4, wallStroke);
        leftWallVisual.setAlpha(0.6);
        leftWallVisual.setDepth(-5);

        // Right wall visual
        const rightWallVisual = this.add.rectangle(this.WALL_RIGHT_X, 540, this.WALL_THICKNESS, 1080, wallColor);
        rightWallVisual.setStrokeStyle(4, wallStroke);
        rightWallVisual.setAlpha(0.6);
        rightWallVisual.setDepth(-5);

        // Add wall indicators (text labels)
        const leftWallText = this.add.text(this.WALL_LEFT_X - 12, 375, 'WALL', {
            fontSize: '18px',
            color: '#8ab4f8',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        });
        leftWallText.setRotation(-Math.PI / 2);
        leftWallText.setAlpha(0.5);
        leftWallText.setDepth(-4);
        this.wallTexts.push(leftWallText);

        const rightWallText = this.add.text(this.WALL_RIGHT_X + 12, 525, 'WALL', {
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

            let displayName = '';
            if (pData.isAI) {
                displayName = `CPU ${pData.playerId + 1}`;
            } else {
                displayName = (pData.character || 'fok').toUpperCase();
            }

            const hud = new PlayerHUD(this, x, y, isLeft, displayName, color);
            hud.addToCameraIgnore(this.cameras.main);
            this.playerHUDs.push(hud);
        });
    }

    private debugUpdateCounter = 0;

    update(_time: number, delta: number): void {
        this.debugUpdateCounter++;

        // Stop updates if game over
        if (this.isGameOver) {
            // Allow restarting via SPACE, ESC, or Gamepad A Button (0)
            const spacePressed = Phaser.Input.Keyboard.JustDown(this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE));
            const escPressed = Phaser.Input.Keyboard.JustDown(this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC));
            const aButtonPressed = this.checkGamepadA();

            if (spacePressed || escPressed || aButtonPressed) {
                window.location.reload();
            }
            return;
        }

        if (this.debugUpdateCounter % 60 === 0) {
            console.log(`GameScene.update running. Frame: ${this.debugUpdateCounter}`);
        }

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

        // Handle Bomb Spawn (R)
        if (Phaser.Input.Keyboard.JustDown(this.spawnKey)) {
            console.log("R key pressed! Calling spawnBomb()...");
            this.spawnBomb();
        }

        // 1. Update Physics (Move)
        this.players.forEach(p => p.updatePhysics(delta));

        // 2. Resolve Collisions (Snap to Ground)
        for (const platform of this.platforms) {
            this.players.forEach(p => p.checkPlatformCollision(platform, false));
        }
        for (const platform of this.softPlatforms) {
            this.players.forEach(p => p.checkPlatformCollision(platform, true));
        }

        // 3. Update Logic (Anim)
        this.players.forEach(p => p.updateLogic(delta));


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
            } else {
                this.debugOverlay.setVisible(false);
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
            // Skip checks if player is already dead/eliminated
            if (!player.active) return; // Phaser active flag

            const bounds = player.getBounds();
            if (bounds.left < this.BLAST_ZONE_LEFT ||
                bounds.right > this.BLAST_ZONE_RIGHT ||
                bounds.top < this.BLAST_ZONE_TOP ||
                bounds.bottom > this.BLAST_ZONE_BOTTOM) {

                // Score update (lives)
                player.lives = Math.max(0, player.lives - 1);
                console.log(`Player ${playerId} died. Lives remaining: ${player.lives}`);

                // Deactivate player immediately so camera ignores them
                player.setActive(false);
                player.setVisible(false);

                if (player.lives > 0) {
                    // 2 Second Respawn Delay
                    this.time.delayedCall(2000, () => {
                        this.respawnPlayer(player, playerId);
                    });
                } else {
                    // Elimination
                    this.killPlayer(player);
                    this.checkGameOver();
                }
            }
        };

        this.players.forEach(p => checkPlayer(p, p.playerId));
    }

    private respawnPlayer(player: Player, playerId: number): void {
        // Reactivate player
        player.setActive(true);
        player.setVisible(true);

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
        player.setInvulnerable(1000); // 1 full second of invulnerability

        // Visual respawn effect (flash)
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 0.8);
        flash.fillCircle(spawnX, spawnY, 75); // 50->75
        this.addToCameraIgnore(flash);
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
        // Filter out players who are effectively dead or inactive
        const targets = this.players.filter(p => {
            if (!p.active) return false; // Ignore inactive (dead/waiting respawn) players

            // Check bounds (using slightly tighter bounds than actual kill box)
            return p.x > this.BLAST_ZONE_LEFT + 500 &&
                p.x < this.BLAST_ZONE_RIGHT - 500 &&
                p.y < this.BLAST_ZONE_BOTTOM - 500 &&
                p.y > this.BLAST_ZONE_TOP + 500;
        });

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
        cam.zoom = Phaser.Math.Linear(cam.zoom, targetZoom, 0.1); // Increased from 0.05
        cam.centerOn(
            Phaser.Math.Linear(cam.midPoint.x, centerX, 0.2), // Increased from 0.1
            Phaser.Math.Linear(cam.midPoint.y, centerY, 0.2)
        );
    }

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

    private checkGamepadA(): boolean {
        // Check if gamepad A button (0) was just pressed
        const gamepads = navigator.getGamepads();
        let currentAPressed = false;

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                currentAPressed = gamepad.buttons[0]?.pressed || false;
                break; // Only check first connected gamepad
            }
        }

        const justPressed = currentAPressed && !this.previousAButtonPressed;
        this.previousAButtonPressed = currentAPressed;
        return justPressed;
    }

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
            character: 'fok_v3' as const,
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
            character: 'fok_v3',
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

        const hud = new PlayerHUD(this, x, y, isLeft, `CPU ${playerId + 1}`, color);
        hud.addToCameraIgnore(this.cameras.main);

        // Ensure we don't duplicate HUD if re-spawning (though player array check prevents this)
        // Just push new logic
        this.playerHUDs.push(hud);


    }

    // Clean up when scene is shut down (e.g. switching to menu)
    // Clean up when scene is shut down (e.g. switching to menu)
    shutdown(): void {
        console.log("GameScene.shutdown started");
        try {
            // Stop all physics and input
            if (this.matter && this.matter.world) {
                this.matter.world.shutdown();
            }
        } catch (e) {
            console.warn("Error shutting down physics:", e);
        }

        try {
            this.input.keyboard?.removeAllKeys();
            this.input.keyboard?.resetKeys();
        } catch (e) {
            console.warn("Error clearing input keys:", e);
        }

        // Kill event listeners
        this.events.off('pauseMenuResume');
        this.events.off('pauseMenuRestart');
        this.events.off('pauseMenuLobby');
        this.events.off('pauseMenuExit');
        this.events.off('spawnDummy');

        // Destroy players
        this.players.forEach(p => p.destroy());

        if (this.debugOverlay) {
            this.debugOverlay.destroy();
        }
    }
    private killPlayer(player: Player): void {
        console.log(`Player ${player.playerId} ELIMINATED!`);
        player.setActive(false);
        player.setVisible(false);
        player.setPosition(-9999, -9999); // Move away
        // Disable body
        if (player.body) {
            this.matter.world.remove(player.body);
        }

        // Show "ELIMINATED" text briefly? (Optional)
    }

    private checkGameOver(): void {
        // Count active players with lives > 0
        const survivors = this.players.filter(p => p.lives > 0);

        if (survivors.length <= 1) {
            // Game Over!
            const winner = survivors.length > 0 ? survivors[0] : null; // If 0 (everyone died same frame), draw or no winner
            this.handleGameOver(winner ? winner.playerId : -1);
        }
    }

    private handleGameOver(winnerId: number): void {
        if (this.isGameOver) return;
        this.isGameOver = true;
        console.log("GAME OVER!");

        const { width, height } = this.scale;

        // Darken background
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        overlay.setDepth(1000);
        this.addToCameraIgnore(overlay); // UI Camera ignores it? NO, UI camera renders UI. Wait.
        // If we want UI to render this, we must ensure it is visible to UI camera properly.
        // Actually, main camera ignores UI. UI camera renders UI.
        // If I just add to scene, Main Camera renders it by default.
        // But wait, GameScene uses `uiCamera`.
        // Objects for UI should be ignored by Main Camera.
        this.cameras.main.ignore(overlay);

        let winnerText = "GAME!";
        if (winnerId >= 0) {
            winnerText += `\\nPLAYER ${winnerId + 1} WINS!`;
        } else {
            winnerText += "\\nDRAW GAME!";
        }

        const text = this.add.text(width / 2, height / 2, winnerText, {
            fontSize: '64px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 8
        });
        text.setOrigin(0.5);
        text.setDepth(1001);
        this.cameras.main.ignore(text); // Only UI camera sees it

        const subText = this.add.text(width / 2, height / 2 + 100, "Press SPACE or (A) to Restart", {
            fontSize: '32px',
            fontFamily: 'Arial',
            color: '#cccccc'
        });
        subText.setOrigin(0.5);
        subText.setDepth(1001);
        this.cameras.main.ignore(subText);
    }
}
