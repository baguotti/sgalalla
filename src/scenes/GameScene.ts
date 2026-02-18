import Phaser from 'phaser';
import { Player, PlayerState } from '../entities/Player';
import { MatchHUD, SMASH_COLORS } from '../ui/PlayerHUD';
import { DebugOverlay } from '../components/DebugOverlay';
import { PauseMenu } from '../components/PauseMenu';
import { Bomb } from '../entities/Bomb';
import { Chest } from '../entities/Chest';
import { MapConfig, ZOOM_SETTINGS } from '../config/MapConfig';
import type { ZoomLevel } from '../config/MapConfig';
import { createStage as createSharedStage } from '../stages/StageFactory';
import { EffectManager } from '../effects/EffectManager';
import { AnimationHelpers } from '../managers/AnimationHelpers';

import type { GameSceneInterface } from './GameSceneInterface';


export class GameScene extends Phaser.Scene implements GameSceneInterface {
    // private player1!: Player;
    // private player2!: Player;

    private debugOverlay!: DebugOverlay;
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private softPlatforms: Phaser.GameObjects.Rectangle[] = [];
    private sidePlatforms: Phaser.GameObjects.Rectangle[] = []; // Track side platforms
    public bombs!: Phaser.GameObjects.Group;
    public chests: Chest[] = [];
    public seals: any[] = []; // Seal projectiles
    private background!: Phaser.GameObjects.Graphics;
    private backgroundImage!: Phaser.GameObjects.Image; // Add class property
    public walls: Phaser.Geom.Rectangle[] = []; // Unified walls (geom)
    private stageTextures: Phaser.GameObjects.Image[] = []; // Restore this
    private ceilings: Phaser.GameObjects.Rectangle[] = []; // Bottom blocking

    // Debug visibility
    public debugVisible: boolean = false;
    private debugGraphics!: Phaser.GameObjects.Graphics;
    private debugLabels: Phaser.GameObjects.Text[] = [];
    private debugToggleKey!: Phaser.Input.Keyboard.Key;
    private trainingToggleKey!: Phaser.Input.Keyboard.Key;
    // Debug bomb spawn key
    private spawnKey!: Phaser.Input.Keyboard.Key;

    // Kill tracking
    // private player1HUD!: PlayerHUD;
    // private player2HUD!: PlayerHUD;


    // Wall configuration

    public uiCamera!: Phaser.Cameras.Scene2D.Camera;

    // Camera Settings
    private currentZoomLevel: ZoomLevel = 'CLOSE';

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
        AnimationHelpers.loadCharacterAssets(this);
        AnimationHelpers.loadCommonAssets(this);

        // New Stage Background
        this.load.image('adria_bg', 'assets/adria_background.webp');
    }

    private createAnimations(): void {
        AnimationHelpers.createAnimations(this);
    }

    public addBomb(_bomb: Bomb): void {
        // No-op: Group handles list management
    }

    public removeBomb(_bomb: Bomb): void {
        // No-op: Group handles list management
    }

    public getBombs(): Bomb[] {
        return this.bombs.getChildren() as Bomb[];
    }

    public getPlayers(): Player[] {
        return this.players;
    }

    private players: Player[] = [];
    // private playerHUDs: PlayerHUD[] = []; // Deprecated
    private matchHUD!: MatchHUD;
    private playerData: any[] = [];

    public effectManager!: EffectManager;

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
        try {
            // Initialize Effect Manager
            this.effectManager = new EffectManager(this);

            // CRITICAL: Reset state arrays on scene restart
            // CRITICAL: Reset state arrays on scene restart
            this.players.forEach(p => p.destroy());
            this.players = [];
            // this.playerHUDs = [];
            if (this.matchHUD) {
                this.matchHUD.destroy();
            }
            this.platforms = [];
            this.softPlatforms = [];
            this.sidePlatforms = [];
            this.walls = [];
            this.stageTextures = [];

            // Re-create bomb group
            // (Old group is destroyed by scene shutdown, just overwrite reference)
            this.bombs = this.add.group({
                classType: Bomb,
                runChildUpdate: true,
                maxSize: 20 // Reasonable limit for performance
            });

            this.chests.forEach(c => c.destroy());
            this.chests = [];
            this.isGameOver = false;
            this.isPaused = false;

            // --- Physics Setup ---
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

            // Setup cameras (Must be before createStage so UI camera exists for ignore logic)
            this.setupCameras();

            // Create stage platforms
            this.createStage();

            // BACKGROUND LOGIC
            this.cameras.main.setBackgroundColor('#99d7f0'); // New Sky Blue

            // Background graphics are created in createStage(), ensure they are visible
            if (this.background) {
                this.background.setVisible(true);
            }

            // Create Players
            this.players = [];

            // Default Spawn Points (Supported up to 6)
            let spawnPoints = [
                { x: 400, y: 300 },   // P1 (Left Soft)
                { x: 1520, y: 300 },  // P2 (Right Soft)
                { x: 800, y: 200 },   // P3 (Main Center-Left)
                { x: 1120, y: 200 },  // P4 (Main Center-Right)
                { x: 600, y: 400 },   // P5 (Low Left)
                { x: 1320, y: 400 }   // P6 (Low Right)
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

                const player = new Player(this, spawn.x, spawn.y, {
                    playerId: pData.playerId,
                    isAI: pData.isAI,
                    isTrainingDummy: pData.isTrainingDummy, // Pass training dummy flag
                    gamepadIndex: pData.input.gamepadIndex,
                    useKeyboard: pData.input.type === 'KEYBOARD',
                    character: pData.character
                });

                // Set Color (all players use their assigned color)
                const color = this.PLAYER_COLORS[pData.playerId] || 0xffffff;
                player.visualColor = color;
                player.resetVisuals();

                this.players.push(player);

                // Add small triangle indicator above human players (colored, centered on hitbox)
                if (!pData.isAI) {
                    const tri = this.add.graphics();
                    tri.fillStyle(color, 0.5);
                    tri.fillTriangle(-6, -6, 6, -6, 0, 6); // Downward-pointing
                    tri.setPosition(0, -120); // Above nameTag (y=-100)
                    player.add(tri);
                    this.tweens.add({
                        targets: tri,
                        y: tri.y - 5,
                        duration: 600,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }

                // Add to HUD
                this.addPlayerToHUD(player);
            });


            // Re-run camera exclusions now that players exist
            // (setupCameras was moved up before createStage, but players are created after)
            this.configureCameraExclusions();

            // Create debug overlay
            this.debugOverlay = new DebugOverlay(this);
            this.debugOverlay.setCameraIgnore(this.cameras.main);

            // Debug Graphics for Platform Visualization
            this.debugGraphics = this.add.graphics();
            this.debugGraphics.setDepth(9999);
            this.uiCamera.ignore(this.debugGraphics); // Only visible in main camera (world space)

            // Add controls hint
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
                this.time.delayedCall(10, () => {
                    try {
                        // Infer mode from playerData (if dummy exists, it's training)
                        const isTraining = this.playerData.some((p: any) => p.isTrainingDummy);
                        const p1Data = this.playerData.find((p: any) => p.playerId === 0);
                        this.scene.start('LobbyScene', {
                            mode: isTraining ? 'training' : 'versus',
                            inputType: p1Data?.input?.type || 'KEYBOARD',
                            gamepadIndex: p1Data?.input?.gamepadIndex ?? null,
                        });
                    } catch (e) {
                        console.error("Failed to start LobbyScene:", e);
                    }
                });
            });
            this.events.on('pauseMenuExit', () => {
                this.scene.start('MainMenuScene');
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
            // Chest spawn timer: every 30 seconds, 35% chance
            this.time.addEvent({
                delay: 30000,
                callback: () => {
                    if (Phaser.Math.FloatBetween(0, 1) < 0.35) {
                        this.spawnChest();
                    }
                },
                loop: true
            });

            // Manual Chest Spawn (Y key)
            this.input.keyboard?.on('keydown-Y', () => {
                this.spawnChest();
            });


        } catch (e: any) {
            console.error("CRITICAL ERROR in GameScene.create:", e);
            const errT = this.add.text(this.scale.width / 2, this.scale.height / 2, "CRASH: " + e?.message || String(e), { fontSize: '32px', color: '#ff0000', backgroundColor: '#000' });
            errT.setOrigin(0.5).setDepth(9999);
        }
    }

    private spawnBomb(): void {
        if (this.isPaused) return;

        const { width } = this.scale;

        // Random X position within central area (500-1420) so it's likely visible
        const padding = 500;
        const x = Phaser.Math.Between(padding, width - padding);
        const y = 0; // Top of screen (inside bounds)

        const bomb = this.bombs.get(x, y) as Bomb;
        if (bomb) {
            bomb.enable(x, y);
            if (this.uiCamera) {
                this.uiCamera.ignore(bomb);
            }
        }
    }

    private spawnChest(): void {
        if (this.isPaused) return;

        const { width } = this.scale;
        const padding = 500;
        const x = Phaser.Math.Between(padding, width - padding);
        const y = 0;

        const chest = new Chest(this, x, y);
        if (this.uiCamera) {
            this.uiCamera.ignore(chest);
        }
    }

    private checkChestInteractions(): void {
        if (!this.chests || this.chests.length === 0) return;

        const interactRange = 120; // Proximity range to open chest

        for (const player of this.players) {
            if (!player.isAttacking) continue;

            for (const chest of [...this.chests]) { // Copy array since open() may modify it
                if (chest.isOpened) continue;

                const dist = Phaser.Math.Distance.Between(player.x, player.y, chest.x, chest.y);
                if (dist < interactRange) {
                    chest.open();
                }
            }
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
        if (this.stageTextures.length > 0) this.uiCamera.ignore(this.stageTextures);

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
        const stage = createSharedStage(this);

        // Populate ALL tracking arrays so configureCameraExclusions always works
        this.backgroundImage = stage.background;
        this.platforms = [stage.mainPlatform];
        this.softPlatforms = stage.softPlatforms;
        this.sidePlatforms = stage.sidePlatforms; // Store side platforms
        this.ceilings = stage.ceilings || []; // Store ceilings
        this.stageTextures = [...stage.platformTextures]; // Track ALL textures (side visuals are in platformTextures now)
        this.walls = stage.wallCollisionRects;

        // Explicitly ignore every stage object in UI camera (with guards for empty arrays)
        if (this.uiCamera) {
            this.uiCamera.ignore(stage.background);
            this.uiCamera.ignore(stage.mainPlatform);
            if (stage.softPlatforms.length > 0) this.uiCamera.ignore(stage.softPlatforms);
            if (stage.platformTextures.length > 0) this.uiCamera.ignore(stage.platformTextures);
            if (stage.sidePlatforms.length > 0) this.uiCamera.ignore(stage.sidePlatforms);
        }

        // Re-run full exclusion pass (catches anything missed above)
        this.configureCameraExclusions();
    }

    // Player Config
    // Player colors - using SMASH_COLORS from PlayerHUD for consistency
    private readonly PLAYER_COLORS = SMASH_COLORS;

    private createHUDs(): void {
        // Initialize HUD
        this.matchHUD = new MatchHUD(this);
        this.matchHUD.addToCameraIgnore(this.cameras.main);

        // Add existing players if any
        this.players.forEach(p => this.addPlayerToHUD(p));
    }

    private addPlayerToHUD(player: Player): void {
        if (this.matchHUD) {
            // Local game logic
            // If strictly 1 human vs CPU, P1 is You. 
            // If local multiplayer (P1 vs P2 human), both are "You"? No, that's confusing.
            // Let's say Player 1 is ALWAYS "You" in single/local? 
            // Or just P1 / P2 tags.
            // User complained: "In training mode I'm currently battling a CPU, display the correct name (it's not P2 (YOU))"

            // Logic:
            // If AI -> Name = "CPU" or Character Name. isLocal = false.
            // If Human -> Name = "P1" etc. isLocal = true (for P1 only maybe?)

            const isYOU = (player.playerId === 0); // Only P1 is "YOU"

            let name = `P${player.playerId + 1}`;
            if (player.isAI) {
                name = "CPU"; // or player.character
            }

            this.matchHUD.addPlayer(player.playerId, name, isYOU, player.character || 'fok');
        }
    }

    private debugUpdateCounter = 0;

    /**
     * Chromatic Aberration Implementation:
     * Uses built-in Camera Shake + Flash red/blue as a cheap "vibe" alternative 
     * if simple CA shader isn't available, but here we will try to use the ColorMatrix 
     * or simple camera shake which natively does some of this feeling.
     * 
     * ACTUALLY: Let's use a "Glitch" shake.
     */


    update(_time: number, delta: number): void {
        // --- HITSTOP REMOVED --- 
        // Logic flows normally now.

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
        }

        // Handle Pause Toggle (ESC key or START button on gamepad)
        const pauseKeyPressed = Phaser.Input.Keyboard.JustDown(this.pauseKey);
        const gamepadPausePressed = this.checkGamepadPause();

        // Check if any chest overlay is open
        const isChestOverlayOpen = this.chests.some(chest => chest.isOverlayOpen);

        if ((pauseKeyPressed || gamepadPausePressed) && !isChestOverlayOpen) {
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
            this.debugOverlay.setVisible(this.debugVisible);
            this.toggleDebugVisuals(this.debugVisible);
            this.players.forEach(p => p.setDebug(this.debugVisible));
            this.seals.forEach(s => s.setDebug(this.debugVisible));
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
            this.spawnBomb();
        }

        // 1. Update Physics (Move)
        this.players.forEach(p => p.updatePhysics(delta));

        // 2. Resolve Collisions (Snap to Ground)
        for (const platform of this.platforms) {
            this.players.forEach(p => p.checkPlatformCollision(platform, false));
        }
        // Side Platforms (Solid)
        for (const platform of this.sidePlatforms) {
            this.players.forEach(p => p.checkPlatformCollision(platform, false));
        }
        // Soft Platforms (One-Way)
        for (const platform of this.softPlatforms) {
            this.players.forEach(p => p.checkPlatformCollision(platform, true));
        }

        // Ceiling Collision (Bottom Block)
        this.players.forEach(p => p.checkCeilingCollision(this.ceilings));

        // 3. Update Logic (Anim)
        this.players.forEach(p => p.updateLogic(delta));

        // 4. Wall Collisions (end of frame — sets isTouchingWall for next frame)
        this.players.forEach(p => p.checkWallCollision(this.walls));


        // Combat Hit Checks
        for (let i = 0; i < this.players.length; i++) {
            for (let j = 0; j < this.players.length; j++) {
                if (i !== j) {
                    this.players[i].checkHitAgainst(this.players[j]);
                }
            }
        }

        // Chest Interaction (attack near chest to open)
        this.checkChestInteractions();


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
        if (this.matchHUD) {
            // Create a map for MatchHUD
            const playerMap = new Map<number, Player>();
            this.players.forEach(p => playerMap.set(p.playerId, p));
            this.matchHUD.updatePlayers(playerMap);
        }

    }

    private checkBlastZones(): void {
        const checkPlayer = (player: Player, playerId: number) => {
            // Skip checks if player is already dead/eliminated
            if (!player.active) return; // Phaser active flag

            const bounds = player.getBounds();
            if (bounds.left < MapConfig.BLAST_ZONE_LEFT ||
                bounds.right > MapConfig.BLAST_ZONE_RIGHT ||
                bounds.top < MapConfig.BLAST_ZONE_TOP ||
                bounds.bottom > MapConfig.BLAST_ZONE_BOTTOM) {

                // Score update (lives)
                player.lives = Math.max(0, player.lives - 1);

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

        // Debug Text
        // this.debugText = this.add.text(10, 10, `Debug: ${this.VERSION}`, { font: '16px "Pixeloid Sans"', color: '#00ff00' });
        // this.debugText.setScrollFactor(0);
        // this.debugText.setDepth(1000);
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
            return p.x > MapConfig.BLAST_ZONE_LEFT + 50 &&
                p.x < MapConfig.BLAST_ZONE_RIGHT - 50 &&
                p.y < MapConfig.BLAST_ZONE_BOTTOM - 50 &&
                p.y > MapConfig.BLAST_ZONE_TOP + 50;
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
        const settings = ZOOM_SETTINGS[this.currentZoomLevel];
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

        // Add to MatchHUD
        this.addPlayerToHUD(player);
    }

    // Clean up when scene is shut down (e.g. switching to menu)
    // Clean up when scene is shut down (e.g. switching to menu)
    shutdown(): void {
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
            fontFamily: '"Pixeloid Sans"',
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
            fontFamily: '"Pixeloid Sans"',
            color: '#cccccc'
        });
        subText.setOrigin(0.5);
        subText.setDepth(1001);
        this.cameras.main.ignore(subText);
    }
    private toggleDebugVisuals(visible: boolean): void {
        // Safety check for debugGraphics existence
        if (!this.debugGraphics) {
            // Re-create if missing (e.g. scene restart)
            this.debugGraphics = this.add.graphics();
            this.debugGraphics.setDepth(9999);
            if (this.uiCamera) this.uiCamera.ignore(this.debugGraphics);
        }

        this.debugGraphics.clear();
        this.debugLabels.forEach(t => t.destroy());
        this.debugLabels = [];

        if (!visible) return;

        // Draw Solids (Green) - Main Platform
        this.debugGraphics.lineStyle(2, 0x00ff00, 1);
        this.debugGraphics.fillStyle(0x00ff00, 0.2);

        this.platforms.forEach((p, index) => {
            if (!p) return;
            this.debugGraphics.strokeRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
            this.debugGraphics.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
            this.addDebugLabel(p.x, p.y - p.height / 2 - 15, `MAIN #${index} (${p.width}x${p.height})`, '#00ff00');
        });

        // Draw Solids (Green) - Side Platforms (Images)
        this.sidePlatforms.forEach((p, index) => {
            if (!p) return;
            // Images use different origin/size logic sometimes, but usually centered.
            // Use displayWidth/Height for safety.
            const w = p.displayWidth;
            const h = p.displayHeight;
            this.debugGraphics.strokeRect(p.x - w * p.originX, p.y - h * p.originY, w, h);
            this.debugGraphics.fillRect(p.x - w * p.originX, p.y - h * p.originY, w, h);
            this.addDebugLabel(p.x, p.y - h * p.originY - 15, `SIDE #${index + 1} (${Math.round(w)}x${Math.round(h)})`, '#00ff00');
        });

        // Draw Soft (Yellow) - Top Platforms
        this.debugGraphics.lineStyle(2, 0xffff00, 1);
        this.debugGraphics.fillStyle(0xffff00, 0.2);

        this.softPlatforms.forEach((p, index) => {
            if (!p) return;
            const w = p.displayWidth;
            const h = p.displayHeight;
            this.debugGraphics.strokeRect(p.x - w * p.originX, p.y - h * p.originY, w, h);
            this.debugGraphics.fillRect(p.x - w * p.originX, p.y - h * p.originY, w, h);
            this.addDebugLabel(p.x, p.y - h * p.originY - 15, `TOP #${index + 1} (${Math.round(w)}x${Math.round(h)})`, '#ffff00');
        });

        // Draw Walls (Red)
        this.debugGraphics.lineStyle(2, 0xff0000, 1);
        this.debugGraphics.fillStyle(0xff0000, 0.2);

        this.walls.forEach((r: Phaser.Geom.Rectangle, index: number) => {
            if (!r) return;
            this.debugGraphics.strokeRect(r.x, r.y, r.width, r.height);
            this.debugGraphics.fillRect(r.x, r.y, r.width, r.height);
            this.addDebugLabel(r.x + r.width / 2, r.y - 15, `WALL #${index + 1} (${r.width}x${r.height})`, '#ff0000');
        });
    }

    private addDebugLabel(x: number, y: number, text: string, color: string): void {
        const t = this.add.text(x, y, text, {
            fontSize: '12px',
            color: color,
            backgroundColor: '#000000aa',
            padding: { x: 2, y: 1 }
        });
        t.setOrigin(0.5);
        t.setDepth(10000);
        if (this.uiCamera) {
            this.uiCamera.ignore(t); // Only show in world camera
        }
        this.debugLabels.push(t);
    }
}
