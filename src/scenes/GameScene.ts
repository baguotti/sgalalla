import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { NetPlayer } from '../entities/NetPlayer';
import { PlayerHUD } from '../ui/PlayerHUD';
import { DebugOverlay } from '../components/DebugOverlay';
import { PauseMenu } from '../components/PauseMenu';
import { Bomb } from '../entities/Bomb';
import { NetworkManager } from '../network/NetworkManager';
import { PhysicsConfig } from '../../shared/physics/PhysicsConfig';

export class GameScene extends Phaser.Scene {
    // private player1!: Player;
    // private player2!: Player;

    private networkManager!: NetworkManager;
    private netPlayers: Map<string, NetPlayer> = new Map();

    private debugOverlay!: DebugOverlay;
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private softPlatforms: Phaser.GameObjects.Rectangle[] = [];
    public bombs: Bomb[] = [];
    private background!: Phaser.GameObjects.Graphics;
    private walls: Phaser.GameObjects.Rectangle[] = [];
    private wallTexts: Phaser.GameObjects.Text[] = [];

    // Debug visibility
    private debugVisible: boolean = false;
    private debugToggleKey!: Phaser.Input.Keyboard.Key;
    private trainingToggleKey!: Phaser.Input.Keyboard.Key;
    // Debug bomb spawn key
    private spawnKey!: Phaser.Input.Keyboard.Key;
    private controlsHintText!: Phaser.GameObjects.Text;

    // Kill tracking
    // private player1HUD!: PlayerHUD;
    // private player2HUD!: PlayerHUD;


    public static readonly WORLD_WIDTH = 1920;
    public static readonly WORLD_HEIGHT = 1080;

    // Wall configuration - NOW USING PHYSICS CONFIG

    // Blast zone boundaries
    private readonly BLAST_ZONE_LEFT = -300;
    private readonly BLAST_ZONE_RIGHT = 2220; // 1920 + 300
    private readonly BLAST_ZONE_TOP = -300;
    private readonly BLAST_ZONE_BOTTOM = 1350; // 1080 + 270

    private uiCamera!: Phaser.Cameras.Scene2D.Camera;

    // Camera Settings (currently disabled, re-enable when camera follow is needed)
    // private currentZoomLevel: 'CLOSE' | 'NORMAL' | 'WIDE' = 'CLOSE';
    // private readonly ZOOM_SETTINGS = {
    //     CLOSE: { padX: 100, padY: 100, minZoom: 0.8, maxZoom: 1.5 },
    //     NORMAL: { padX: 375, padY: 300, minZoom: 0.6, maxZoom: 1.1 },
    //     WIDE: { padX: 600, padY: 450, minZoom: 0.4, maxZoom: 0.8 }
    // };

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
                { key: 'attack_down', folder: 'Down_Sig', count: 1, prefix: '0_Fok_DownSig_', type: 'manual', filename: '0_Fok_DownSig_001.png' },
                { key: 'attack_side', folder: 'Side_Sig', count: 1, prefix: '0_Fok_SideSig_', type: 'manual', filename: '0_Fok_SideSig_001.png' }
            ];

        fokAssets.forEach(asset => {
            // Check for manual single-file assets
            if (asset.type === 'manual' && asset.filename) {
                const path = `assets/fok/${asset.folder}/${asset.filename}`;
                this.load.image(`fok_${asset.key}_0`, path);
            } else {
                // Numbered sequence loading
                for (let i = 0; i < asset.count; i++) {
                    const num = i.toString().padStart(3, '0');
                    const filename = `${asset.prefix}${num}.png`;
                    const key = `fok_${asset.key}_${i}`;
                    const path = `assets/fok/${asset.folder}/${filename}`;
                    this.load.image(key, path);
                }
            }
        });
    }

    private onlineMode: boolean = false;
    private initData: any = {};
    private debugTextUpdate: number = 0;

    private players: Player[] = [];
    private playerHUDs: PlayerHUD[] = [];
    private playerData: any[] = [];

    init(data: any): void {
        this.initData = data;
        this.onlineMode = data.online === true;

        if (data.playerData) {
            this.playerData = data.playerData;
        } else if (this.onlineMode) {
            // ONLINE MODE: Empty playerData - network callbacks are responsible for spawning players
            // This enables pure 1v1 Human vs Human testing without any local AI
            this.playerData = [];
            console.log('[ONLINE] PlayerData empty - NetworkManager will handle player spawning');
        } else {
            // OFFLINE Fallback defaults (only used when not online and no explicit playerData)
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
            console.log("GameScene.create started");
            const { width, height } = this.scale;

            // --- Network Connection ---
            // --- Network Connection ---
            const FORCE_OFFLINE = true; // DEBUG: Force Offline to test Physics Isolation

            if (FORCE_OFFLINE) {
                console.log("!!! FORCING OFFLINE MODE !!!");
                this.onlineMode = false;
                this.players.forEach(p => p.destroy()); // Destroy existing if restart
                this.players = [];

                // FORCE POPULATE if init cleared it
                if (this.playerData.length === 0) {
                    console.log("!!! POPULATING DEFAULT OFFLINE PLAYERS !!!");
                    this.playerData = [
                        { playerId: 0, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null }, character: 'fok' }
                        // { playerId: 1, joined: true, ready: true, input: { type: 'KEYBOARD', gamepadIndex: null }, character: 'fok', isAI: true, isTrainingDummy: true }
                    ];
                }

                // Spawn Local Players from Init Data
                this.playerData.forEach(pData => {
                    const spawnPoints = [{ x: 450, y: 300 }, { x: 1470, y: 300 }];
                    const spawn = spawnPoints[pData.playerId] || { x: 960, y: 300 };

                    const player = new Player(this, spawn.x, spawn.y, {
                        playerId: pData.playerId,
                        character: pData.character,
                        useKeyboard: !pData.isAI && pData.playerId === 0, // Simplified
                        gamepadIndex: (pData as any).input?.gamepadIndex ?? null,
                        isAI: !!(pData as any).isAI,
                        isTrainingDummy: !!(pData as any).isTrainingDummy
                    });
                    this.players.push(player);
                });

            } else {
                this.networkManager = NetworkManager.getInstance();
                this.networkManager.connect()
                    .then(room => {
                        // Success! Show Room ID
                        const selfSessionId = room.sessionId;
                        console.log("My Session ID:", selfSessionId);

                        this.add.text(10, 10, `Room: ${room.roomId}\nID: ${selfSessionId.substr(0, 4)}`, {
                            fontSize: '20px',
                            color: '#00ff00',
                            backgroundColor: '#000000'
                        }).setScrollFactor(0).setDepth(2000); // Increased depth

                        // CRITICAL: Clear any ghosts from previous sessions/reconnects
                        console.log("[Network] Cleaning up stage for new session...");
                        this.players.forEach(p => p.destroy());
                        this.players = [];
                        this.netPlayers.forEach(p => p.destroy());
                        this.netPlayers.clear();
                        console.log(`Connected to room! SessionID: ${room.sessionId}`);

                        // Initialize Debug Timer
                        this.debugTextUpdate = 0;

                        // Setup Callbacks
                        console.log(`[Network] PlayerData from Lobby: ${JSON.stringify(this.playerData)}`);

                        const handlePlayerJoin = (id: string, playerSchema: any) => {
                            try {
                                const selfIdFromRoom = room.sessionId;
                                const isMe = (id === selfIdFromRoom);

                                // IDENTIFY LOCAL SLOT: Authoritatively from Server State if possible
                                let mySlotIndex = -1;
                                const mySchema = room.state.players.get(selfIdFromRoom);
                                if (mySchema) {
                                    mySlotIndex = mySchema.slotIndex;
                                } else {
                                    // Fallback (Race condition: My schema not yet in state?)
                                    console.warn(`[WARN] My Schema not found in state yet! Using Lobby fallback.`);
                                    const mySlotEntry = this.playerData.find(pd => pd.id === selfIdFromRoom || !pd.isRemote);
                                    if (mySlotEntry) mySlotIndex = mySlotEntry.playerId;
                                }


                                const isMySlot = (playerSchema.slotIndex === mySlotIndex);

                                console.log(`[JOIN] id=${id}, slot=${playerSchema.slotIndex}, isMe=${isMe}, isMySlot=${isMySlot}`);

                                if (isMySlot && !isMe) {
                                    console.warn(`[DENIED] Slot ${playerSchema.slotIndex} reserved for me. JoinID=${id} != MyID=${selfIdFromRoom}`);
                                    return;
                                }

                                if (isMe) {
                                    if (this.players.some(p => p.playerId === playerSchema.slotIndex)) return;

                                    console.log(`[SPAWN SELF] ${id} @ ${playerSchema.slotIndex}`);
                                    const spawnPoints = [{ x: 450, y: 300 }, { x: 1470, y: 300 }, { x: 960, y: 200 }, { x: 960, y: 400 }];
                                    const spawn = spawnPoints[playerSchema.slotIndex] || { x: 960, y: 300 };

                                    // ... spawn logic

                                    // Retrieve input config robustly from initData
                                    const inputType = this.initData?.inputType || 'KEYBOARD';
                                    const gamepadIdx = this.initData?.gamepadIndex;
                                    const useKeyboard = inputType === 'KEYBOARD' || inputType === 'MIXED';

                                    console.log(`[SPAWN SELF] ${id} at slot ${playerSchema.slotIndex}. Controls: ${inputType}, Gamepad: ${gamepadIdx}`);

                                    const player = new Player(this, spawn.x, spawn.y, {
                                        playerId: playerSchema.slotIndex,
                                        character: playerSchema.character || 'fok',
                                        useKeyboard: useKeyboard,
                                        gamepadIndex: gamepadIdx,
                                        isAI: false
                                    });
                                    this.players.push(player);
                                    playerSchema.onChange(() => player.reconcile(playerSchema));
                                    return;
                                }

                                if (this.netPlayers.has(id)) {
                                    console.log(`[REPLACE] NetPlayer ${id} existed. Destroying old.`);
                                    this.netPlayers.get(id)?.destroy();
                                    this.netPlayers.delete(id);
                                }

                                console.log(`[SPAWN REMOTE] ${id} @ ${playerSchema.slotIndex}`);
                                console.log(`[Network] Spawning REMOTE: ${id} at slot ${playerSchema.slotIndex}`);
                                const spawnPoints = [{ x: 450, y: 300 }, { x: 1470, y: 300 }, { x: 960, y: 200 }, { x: 960, y: 400 }];
                                const spawn = spawnPoints[playerSchema.slotIndex] || { x: 960, y: 300 };

                                const netPlayer = new NetPlayer(this, spawn.x, spawn.y, id, playerSchema.character || 'fok');
                                this.netPlayers.set(id, netPlayer);
                                if (this.uiCamera) this.uiCamera.ignore(netPlayer);

                                playerSchema.onChange(() => netPlayer.sync(playerSchema));
                                netPlayer.sync(playerSchema);


                                // Visual update (removed)
                            } catch (e: any) {
                                console.error(`[ERROR] Join Failed: ${e.message}`, e);
                            }
                        };

                        // Process Existing Players First
                        room.state.players.forEach((player: any, id: string) => handlePlayerJoin(id, player));

                        // Then Listen for New Ones
                        const unregisterJoin = this.networkManager.onPlayerJoined((id, playerSchema: any) => handlePlayerJoin(id, playerSchema));

                        const unregisterLeave = this.networkManager.onPlayerLeft((id) => {
                            console.log("Player Left:", id);
                            const netPlayer = this.netPlayers.get(id);
                            if (netPlayer) {
                                netPlayer.destroy();
                                this.netPlayers.delete(id);
                            }
                        });

                        // Track for cleanup
                        (this as any).networkCleanups = [unregisterJoin, unregisterLeave];

                        // Death / Respawn Visuals
                        room.onMessage("player_death", (data) => {
                            console.log("Death Visual Event:", data.id);
                            const isSelf = data.id === room.sessionId;

                            // Flash effect at spawn
                            const flash = this.add.graphics();
                            flash.fillStyle(0xffffff, 0.8);
                            flash.fillCircle(data.x, data.y, 75);
                            this.addToCameraIgnore(flash);
                            this.tweens.add({
                                targets: flash,
                                alpha: 0,
                                scale: 2,
                                duration: 300,
                                onComplete: () => flash.destroy()
                            });

                            if (isSelf) {
                                const localPlayer = this.players.find(p => p.playerId === room.state.players.get(data.id)?.slotIndex);
                                if (localPlayer) localPlayer.respawn();
                            }
                        });

                    })
                    .catch(e => {
                        console.error("Network connection failed:", e);
                        this.add.text(width / 2, height / 2, `CONNECTION FAILED:\n${e}`, {
                            fontSize: '32px',
                            color: '#ff0000',
                            backgroundColor: '#000000',
                            align: 'center'
                        }).setOrigin(0.5).setScrollFactor(0).setDepth(2000);
                    });
            } // End FORCE_OFFLINE check

            // --- Physics Setup ---
            this.matter.world.setBounds(0, 0, width, height);
            this.matter.world.setGravity(0, 1);

            // --- Error Handler (Visual) ---
            // (Error text is created dynamically in catch block if needed)

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
                { key: 'slide', count: 1, loop: true },
                { key: 'dodge', count: 1, loop: false },
                { key: 'charging', count: 8, loop: true },
                { key: 'attack_light', count: 1, loop: false },
                { key: 'attack_up', count: 1, loop: false },
                { key: 'attack_down', count: 1, loop: false, type: 'manual', filename: '0_Fok_DownSig_001.png', folder: 'Down_Sig', prefix: '0_Fok_DownSig_' },
                { key: 'attack_side', count: 1, loop: false, type: 'manual', filename: '0_Fok_SideSig_001.png', folder: 'Side_Sig', prefix: '0_Fok_SideSig_' }
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
                key: 'fok_attack_light_0',
                frames: [{ key: `fok_attack_light_0` }],
                frameRate: 10,
                repeat: 0
            });
            // Map dodge explicitly
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
            // Heavy attack mapping
            this.anims.create({
                key: 'fok_attack_heavy',
                frames: [{ key: `fok_attack_heavy_0` }],
                frameRate: 1,
                repeat: 0
            });

            // Down Sig (Heavy Down)
            this.anims.create({
                key: 'fok_attack_down',
                frames: [{ key: `fok_attack_down_0` }],
                frameRate: 10,
                repeat: 0
            });


            // Set background color
            this.cameras.main.setBackgroundColor('#1a1a2e');

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

            // If OFFLINE, use playerData loop
            if (!this.onlineMode) {
                this.playerData.forEach(pData => {
                    if (!pData.joined) return;
                    const spawn = spawnPoints[pData.playerId] || { x: 960, y: 300 };

                    const player = new Player(this, spawn.x, spawn.y, {
                        playerId: pData.playerId,
                        gamepadIndex: pData.input.gamepadIndex,
                        useKeyboard: pData.input.type === 'KEYBOARD',
                        character: pData.character
                    });
                    this.players.push(player);
                });
                console.log("Offline players created.");
            } else {
                console.log("Online Mode active. Local and Remote players will be spawned via Server Schema callbacks.");
            }


            // Setup cameras
            this.setupCameras();

            // Create debug overlay
            this.debugOverlay = new DebugOverlay(this);
            this.debugOverlay.setCameraIgnore(this.cameras.main);

            // Add controls hint
            this.createControlsHint();

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
                        // Pass current player data back to lobby to preserve connections
                        this.scene.start('LobbyScene', {
                            mode: 'versus', // Defaulting to versus for now
                            slots: this.playerData
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

        const width = GameScene.WORLD_WIDTH;

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
        const { width, height } = this.scale;

        // Create a separate UI camera that ignores zoom
        this.uiCamera = this.cameras.add(0, 0, width, height);
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
        this.background.fillRect(0, 0, GameScene.WORLD_WIDTH, GameScene.WORLD_HEIGHT);
        this.background.setDepth(-10);

        // --- STAGE GEOMETRY ---
        const { MAIN_PLATFORM, SOFT_PLAT_1, SOFT_PLAT_2 } = PhysicsConfig.STAGE_GEOMETRY;

        // Main platform
        const mainPlatform = this.add.rectangle(MAIN_PLATFORM.x, MAIN_PLATFORM.y, MAIN_PLATFORM.width, MAIN_PLATFORM.height, 0x2c3e50);
        mainPlatform.setStrokeStyle(3, 0x3a506b);
        mainPlatform.setData('id', MAIN_PLATFORM.id);
        this.platforms.push(mainPlatform);
        this.matter.add.gameObject(mainPlatform, { isStatic: true });

        // Soft Platforms
        const softDefs = [SOFT_PLAT_1, SOFT_PLAT_2];
        softDefs.forEach(def => {
            if (def && def.width > 0) {
                const sp = this.add.rectangle(def.x, def.y, def.width, def.height, 0x1e3a5f);
                sp.setStrokeStyle(3, 0x4da8da);
                sp.setAlpha(1);
                sp.setData('id', def.id);
                this.softPlatforms.push(sp);
                this.matter.add.gameObject(sp, { isStatic: true, label: def.id });
                console.log(`[STAGE] Created Soft Platform: ${def.id} at ${def.x}, ${def.y}`);
            }
        });

        // VISIBLE SIDE WALLS
        const wallThickness = 45;
        this.walls = [];

        // Left wall (Centered at 150, boundary at 172.5)
        const leftWallX = 150;
        const leftWall = this.add.rectangle(leftWallX, 540, wallThickness, 1080, 0x2a3a4e);
        leftWall.setStrokeStyle(4, 0x4a6a8e);
        leftWall.setAlpha(0.6);
        leftWall.setDepth(-5);
        this.walls.push(leftWall);
        this.matter.add.gameObject(leftWall, { isStatic: true });

        // Right wall (Centered at 1770, boundary at 1747.5)
        const rightWallX = 1770;
        const rightWall = this.add.rectangle(rightWallX, 540, wallThickness, 1080, 0x2a3a4e);
        rightWall.setStrokeStyle(4, 0x4a6a8e);
        rightWall.setAlpha(0.6);
        rightWall.setDepth(-5);
        this.walls.push(rightWall);
        this.matter.add.gameObject(rightWall, { isStatic: true });

        // Add wall indicators (text labels)
        const leftWallText = this.add.text(leftWallX - 12, 375, 'WALL', {
            fontSize: '18px',
            color: '#8ab4f8',
            fontFamily: 'Arial',
            fontStyle: 'bold'
        });
        leftWallText.setRotation(-Math.PI / 2);
        leftWallText.setAlpha(0.5);
        leftWallText.setDepth(-4);
        this.wallTexts.push(leftWallText);

        const rightWallText = this.add.text(rightWallX + 12, 525, 'WALL', {
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
                case 1: x = GameScene.WORLD_WIDTH - 120; y = 80; isLeft = false; break;
                case 2: x = 120; y = GameScene.WORLD_HEIGHT - 80; isLeft = true; break;
                case 3: x = GameScene.WORLD_WIDTH - 120; y = GameScene.WORLD_HEIGHT - 80; isLeft = false; break;
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
    private physicsAccumulator = 0;
    private readonly FIXED_STEP = 1000 / 60; // 16.66ms

    update(_time: number, delta: number): void {
        this.debugUpdateCounter++;
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

        // Camera Follow
        // this.updateCamera(); // Disabled for debugging as requested

        // Update NetPlayers visuals (Smoothing)
        this.netPlayers.forEach(np => np.update(delta));

        // --- FIXED TIMESTEP PHYSICS ---
        this.physicsAccumulator += delta;

        // Safety cap to prevent spiral of death
        if (this.physicsAccumulator > 250) this.physicsAccumulator = 250;

        while (this.physicsAccumulator >= this.FIXED_STEP) {
            this.physicsAccumulator -= this.FIXED_STEP;
            this.fixedUpdate(this.FIXED_STEP);
        }

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
            if (this.players[index]) {
                hud.update(this.players[index].damage, this.players[index].lives);
            }
        });

        // Debug Status Update
        if (this.debugTextUpdate && this.time.now > this.debugTextUpdate) {
            this.debugTextUpdate = this.time.now + 500;
            // Find statusText (hacky lookup or store ref? I stored reference in create but need to access it here. I'll search children or just add a global prop)
            // Better: Access it via a class property if I had one. I don't.
            // Let's just log to console occasionally? No, on screen is needed.
            // I'll emit an event to update it if I can't reach it.
            // Actually, the closure 'statusText' in create is not accessible here.
            // I will add a method 'updateDebugStatus' and call it.
            this.updateDebugStatus();
        }
    }

    private debugStatusText: Phaser.GameObjects.Text | null = null;
    private updateDebugStatus(): void {
        if (!this.debugStatusText) return;
        const npCount = this.netPlayers.size;
        const pCount = this.players.length;
        const camTargets = ([...this.players, ...Array.from(this.netPlayers.values())] as any[]).length;
        this.debugStatusText.setText(`NetPs: ${npCount} | LocalPs: ${pCount} | CamT: ${camTargets}`);
    }

    // New Fixed Update Method
    fixedUpdate(delta: number): void {
        // Update players (Physics)
        this.players.forEach(p => p.fixedUpdate(delta));

        // Platform Collisions (Use stable shared geometry for ID matching)
        const { MAIN_PLATFORM, SOFT_PLAT_1, SOFT_PLAT_2 } = PhysicsConfig.STAGE_GEOMETRY;

        this.players.forEach(p => {
            p.checkPlatformCollision(MAIN_PLATFORM, false);
            p.checkPlatformCollision(SOFT_PLAT_1, true);
            p.checkPlatformCollision(SOFT_PLAT_2, true);
        });

        // Environment Collisions (Handled internally by players)

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
    }






    private checkBlastZones(): void {
        // In Online Mode, the server handles Blast Zones to prevent reconciliation fighting.
        if (this.onlineMode) return;

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
        player.playerState.x = spawnX; // Sync shared state
        player.playerState.y = spawnY;
        player.respawn();

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

    // Disabled: Camera zoom is currently not in use
    // public setZoomLevel(level: 'CLOSE' | 'NORMAL' | 'WIDE'): void {
    //     this.currentZoomLevel = level;
    // }

    /*
    private _updateCamera(): void {
        const targets: Phaser.GameObjects.Components.Transform[] = [...this.players, ...Array.from(this.netPlayers.values())];


        if (targets.length === 0) return;

        // 1. Calculate bounding box of all targets
        let minX = Infinity;
        let maxX = -Infinity;
        let minY = Infinity;
        let maxY = -Infinity;

        targets.forEach(target => {
            minX = Math.min(minX, target.x);
            maxX = Math.max(maxX, target.x);
            minY = Math.min(minY, target.y);
            maxY = Math.max(maxY, target.y);
        });

        // Add padding
        const currentZoomSetting = this.ZOOM_SETTINGS[this.currentZoomLevel];
        const padX = currentZoomSetting.padX;
        const padY = currentZoomSetting.padY;

        minX -= padX;
        maxX += padX;
        minY -= padY;
        maxY += padY;

        const rectWidth = maxX - minX;
        const rectHeight = maxY - minY;

        // 2. Center camera
        const centerX = minX + rectWidth / 2;
        const centerY = minY + rectHeight / 2;

        // 3. Zoom level
        const zoomX = this.scale.width / rectWidth;
        const zoomY = this.scale.height / rectHeight;
        let targetZoom = Math.min(zoomX, zoomY);

        // Clamp zoom
        targetZoom = Phaser.Math.Clamp(targetZoom, currentZoomSetting.minZoom, currentZoomSetting.maxZoom);

        // 4. Smoothly apply
        const lerpFactor = 0.05;
        this.cameras.main.centerOn(
            Phaser.Math.Linear(this.cameras.main.midPoint.x, centerX, lerpFactor),
            Phaser.Math.Linear(this.cameras.main.midPoint.y, centerY, lerpFactor)
        );
        this.cameras.main.setZoom(Phaser.Math.Linear(this.cameras.main.zoom, targetZoom, lerpFactor));
    }
    */

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

        const hud = new PlayerHUD(this, x, y, isLeft, `CPU ${playerId + 1}`, color);
        hud.addToCameraIgnore(this.cameras.main);

        // Ensure we don't duplicate HUD if re-spawning (though player array check prevents this)
        // Just push new logic
        this.playerHUDs.push(hud);


    }

    // Clean up when scene is shut down (e.g. switching to menu)
    shutdown(): void {
        console.log("GameScene.shutdown started");

        // Reset room listeners flag on the instance
        (this as any).roomListenersRegistered = false;
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

        // --- NETWORK CLEANUP ---
        if ((this as any).networkCleanups) {
            console.log("[Network] Cleaning up scene listeners...");
            (this as any).networkCleanups.forEach((cleanup: () => void) => cleanup());
            (this as any).networkCleanups = [];
        }
    }
}
