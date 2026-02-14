/**
 * OnlineGameScene.ts
 * Game scene for online multiplayer matches
 * 
 * Differences from GameScene:
 * - Connects to server via NetworkManager
 * - Sends local input to server each frame
 * - Receives authoritative state updates from server
 * - Interpolates remote player positions
 */

import Phaser from 'phaser';
import { Player, PlayerState } from '../entities/Player';
import { Bomb } from '../entities/Bomb';
import { Chest } from '../entities/Chest';
import NetworkManager from '../network/NetworkManager';
import type { NetGameState, NetPlayerState, NetAttackEvent, NetHitEvent } from '../network/NetworkManager';

// Define a snapshot type that includes reconstructed server timestamp for fixed-timeline interpolation
type NetPlayerSnapshot = NetPlayerState & { frame: number; serverTime: number };
import { InputManager } from '../input/InputManager';
import type { GameSnapshot, PlayerSnapshot } from '../network/StateSnapshot';
import { MatchHUD, SMASH_COLORS } from '../ui/PlayerHUD';
import { DebugOverlay } from '../components/DebugOverlay';

export class OnlineGameScene extends Phaser.Scene {
    // Networking
    private networkManager: NetworkManager;
    private snapshotBuffer: Map<number, NetPlayerSnapshot[]> = new Map();
    private interpolationTime: number = 0; // Stable playback timeline (milliseconds)
    private isBufferInitialized: boolean = false;
    // Adaptive buffer: 60ms for local (optimal), 80ms for production (user requested balance)
    private readonly RENDER_DELAY_MS = (window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1') ? 60 : 80;
    private localPlayerId: number = -1;
    private isConnected: boolean = false;

    // Players
    private players: Map<number, Player> = new Map();
    private localPlayer: Player | null = null;

    // Input
    private inputManager!: InputManager;

    // Stage
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private softPlatforms: Phaser.GameObjects.Rectangle[] = [];

    // Bombs (synced from server)
    public bombs: Map<number, Bomb> = new Map();
    public chests: Chest[] = [];

    // UI
    private connectionStatusText!: Phaser.GameObjects.Text;
    private connectionStatusBg!: Phaser.GameObjects.Rectangle;
    private matchHUD!: MatchHUD;

    // Rollback netcode
    private localFrame: number = 0;

    // Network throttling
    private stateThrottleCounter: number = 0;
    private readonly STATE_SEND_INTERVAL: number = 1; // sendState every frame (60Hz)
    private inputThrottleCounter: number = 0;
    private readonly INPUT_SEND_INTERVAL: number = 1; // sendInput every frame (~60Hz)

    // Selection UI Visuals
    private myCharacterSprite!: Phaser.GameObjects.Sprite;
    private opponentCharacterSprite!: Phaser.GameObjects.Sprite;

    // Remote player target state for smooth interpolation
    private remoteTargets: Map<number, NetPlayerState> = new Map();
    private playerCharacters: Map<number, string> = new Map(); // Store character selections

    // Wall configuration (matching GameScene)
    private readonly WALL_THICKNESS = 45;
    private readonly WALL_LEFT_X = 0; // Refinement 14: Pushed out to 0 (Was 200)
    private readonly WALL_RIGHT_X = 1920; // Refinement 14: Pushed out to 1920 (Was 1720)

    // Blast zone boundaries (matching GameScene)
    private readonly BLAST_ZONE_LEFT = -1020; // Matching training mode
    private readonly BLAST_ZONE_RIGHT = 2940; // Matching training mode
    private readonly BLAST_ZONE_TOP = -600; // Matching training mode
    private readonly BLAST_ZONE_BOTTOM = 1800;

    // Camera Settings (matching GameScene)
    // Camera Settings (matching GameScene)
    private currentZoomLevel: 'CLOSE' | 'NORMAL' | 'WIDE' = 'CLOSE';
    private readonly ZOOM_SETTINGS = {
        CLOSE: { padX: 250, padY: 100, minZoom: 0.5, maxZoom: 1.5 }, // Increased padding and range
        NORMAL: { padX: 450, padY: 300, minZoom: 0.5, maxZoom: 1.1 },
        WIDE: { padX: 600, padY: 450, minZoom: 0.3, maxZoom: 0.8 }
    };

    // UI Camera
    public uiCamera!: Phaser.Cameras.Scene2D.Camera;

    // Debug Overlay
    private debugOverlay!: DebugOverlay;
    private debugVisible: boolean = false;
    private debugToggleKey!: Phaser.Input.Keyboard.Key;
    private previousSelectPressed: boolean = false;

    // Game Over State
    private isGameOver: boolean = false;
    private gameOverContainer!: Phaser.GameObjects.Container;

    // Player indicator colors (from PlayerHUD for consistency)
    private readonly PLAYER_COLORS = SMASH_COLORS;
    private rematchButton!: Phaser.GameObjects.Text;
    private leaveButton!: Phaser.GameObjects.Text;
    private hasVotedRematch: boolean = false;
    private selectedButtonIndex: number = 0; // 0 = Rematch, 1 = Leave
    private menuButtons: Phaser.GameObjects.Text[] = [];

    // Character Selection State
    private phase: 'WAITING' | 'SELECTING' | 'PLAYING' = 'WAITING';
    private selectionCountdown: number = 10;
    private selectedCharacter: string = 'fok_v3';
    private opponentCharacter: string = 'fok_v3';
    // Character Selection
    private availableCharacters: string[] = ['fok_v3', 'sga', 'sgu']; // Refinement: fok_v3 is default
    private selectedCharIndex: number = 0;
    private isConfirmed: boolean = false;
    private isOpponentConfirmed: boolean = false;

    // Selection UI Elements
    private selectionContainer!: Phaser.GameObjects.Container;
    private countdownText!: Phaser.GameObjects.Text;
    private myCharacterText!: Phaser.GameObjects.Text;
    private opponentCharacterText!: Phaser.GameObjects.Text;
    private myConfirmText!: Phaser.GameObjects.Text;
    private opponentConfirmText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'OnlineGameScene' });
        this.networkManager = NetworkManager.getInstance();
    }

    preload(): void {
        this.load.image('platform', 'assets/platform.png');
        // New Stage Background
        this.load.image('adria_bg', 'assets/adria_background.webp');
        this.load.image('background', 'assets/background.png'); // Keep for fallback?

        this.load.atlas('fok_v3', 'assets/fok_v3/fok_v3.png', 'assets/fok_v3/fok_v3.json');
        this.load.image('fok_icon', 'assets/fok_icon.png'); // Refinement V2

        // Preload scrin images for chest opening
        const scrinFiles = [
            'scrin_001.jpg', 'scrin_002.jpg', 'scrin_003.jpg', 'scrin_004.jpg', 'scrin_005.jpg',
            'scrin_006.jpg', 'scrin_007.jpg', 'scrin_008.jpg', 'scrin_009.jpg', 'scrin_0010.jpg',
            'scrin_0011.jpg', 'scrin_0012.jpg', 'scrin_0013.jpg', 'scrin_0014.jpg', 'scrin_0015.jpg',
            'scrin_0016.jpg', 'scrin_0017.jpg', 'scrin_0018.jpg', 'scrin_0019.jpg', 'scrin_0020.jpg',
            'scrin_0021.jpg', 'scrin_0022.jpg', 'scrin_0023.jpg', 'scrin_0024.jpg', 'scrin_0025.jpg',
            'scrin_0026.jpg', 'scrin_0027.jpg', 'scrin_0028.jpg', 'scrin_0029.jpg', 'scrin_0030.jpg',
            'scrin_0031.jpg'
        ];

        scrinFiles.forEach(file => {
            const key = file.replace('.jpg', '').replace('.png', '');
            this.load.image(key, `assets/scrins/${file}`);
        });
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

                // Up Light Air (separate aerial animation)
                attack_light_up_air: { prefix: 'Fok_v3_Side_Air_', count: 1, suffix: '000', loop: false },

                // Running Light Attack
                attack_light_run: { prefix: 'Fok_v3_Side_Run_', count: 1, suffix: '000', loop: false },
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
            },
            'sga': {
                // Sga specific mappings based on sga.json
                // Note mixed capitalization in source assets

                // Idle & Run (Run mapped to Idle)
                idle: { prefix: 'Sga_Idle_', count: 12, loop: true },
                run: { prefix: 'Sga_Idle_', count: 12, loop: true },

                // Movement / States
                charging: { prefix: 'sga_Charge_', count: 2, loop: true }, // lowercase sga
                dash: { prefix: 'sga_Dash_', count: 1, suffix: '000', loop: false },
                spot_dodge: { prefix: 'sga_Dodge_', count: 1, suffix: '000', loop: false },

                // Jump / Fall / Hurt
                jump: { prefix: 'sga_Jump_', count: 1, suffix: '000', loop: false },
                fall: { prefix: 'sga_Fall_', count: 1, suffix: '000', loop: false },
                hurt: { prefix: 'sga_Hurt_', count: 1, suffix: '000', loop: false },

                // Utils
                wall_slide: { prefix: 'sga_Wall_Slide_', count: 1, suffix: '000', loop: false },
                recovery: { prefix: 'sga_Recovery_', count: 1, suffix: '000', loop: false },
                ground_pound: { prefix: 'sga_Ground_Pound_', count: 1, suffix: '000', loop: false },
                slide: { prefix: 'sga_Dodge_', count: 1, suffix: '000', loop: false }, // Reused Dodge

                // --- LIGHT ATTACKS ---
                // Neutral Light -> Mapped to Side Light (Match Fok logic, but using sga_Side_Light)
                attack_light_neutral: { prefix: 'sga_Side_Light_', count: 1, suffix: '000', loop: false },

                // Side Light -> Mapped to Side Light (Source has sga_Side_Light)
                attack_light_side: { prefix: 'sga_Side_Light_', count: 1, suffix: '000', loop: false },

                // Up Light -> Mapped to Side Light (Match Fok)
                attack_light_up: { prefix: 'sga_Side_Light_', count: 1, suffix: '000', loop: false },

                // Aerials
                attack_light_up_air: { prefix: 'sga_Side_Air_', count: 1, suffix: '000', loop: false }, // sga_Side_Air
                attack_light_side_air: { prefix: 'sga_Side_Air_', count: 1, suffix: '000', loop: false },

                // Down Light
                attack_light_down: { prefix: 'sga_Down_Light_', count: 1, suffix: '000', loop: false },

                // Run Attack
                attack_light_run: { prefix: 'sga_Side_Run_', count: 1, suffix: '000', loop: false },


                // --- HEAVY ATTACKS (SIGS) ---
                // Neutral Sig -> Mapped to Up Sig (Match Fok)
                attack_heavy_neutral: { prefix: 'sga_Up_Sig_', count: 1, suffix: '000', loop: false },

                // Up Sig
                attack_heavy_up: { prefix: 'sga_Up_Sig_', count: 1, suffix: '000', loop: false },

                // Side Sig -> MISSING in JSON. Mapping to Side Light or Up Sig?
                // Using Side Light as placeholder to prevent invisible sprite
                attack_heavy_side: { prefix: 'sga_Side_Light_', count: 1, suffix: '000', loop: false },

                // Down Sig 
                attack_heavy_down: { prefix: 'sga_Down_Sig_', count: 1, suffix: '000', loop: false },
            },
            'sgu': {
                // Sgu specific mappings
                idle: { prefix: 'Sgu_Idle_', count: 12, loop: true },
                run: { prefix: 'Sgu_Idle_', count: 12, loop: true },
                charging: { prefix: 'sgu_Charge_', count: 2, loop: true },
                dash: { prefix: 'sgu_Dash_', count: 1, suffix: '000', loop: false },
                spot_dodge: { prefix: 'sgu_Dodge_', count: 1, suffix: '000', loop: false },
                jump: { prefix: 'sgu_Jump_', count: 1, suffix: '000', loop: false },
                fall: { prefix: 'Sgu_Fall_', count: 1, suffix: '000', loop: false },
                hurt: { prefix: 'sgu_Hurt_', count: 1, suffix: '000', loop: false },
                wall_slide: { prefix: 'sgu_Wall_Slide_', count: 1, suffix: '000', loop: false },
                recovery: { prefix: 'sgu_Recovery_', count: 1, suffix: '000', loop: false },
                ground_pound: { prefix: 'sgu_Ground_Pound_', count: 1, suffix: '000', loop: false },
                slide: { prefix: 'sgu_Dodge_', count: 1, suffix: '000', loop: false },
                attack_light_neutral: { prefix: 'sgu_Side_Light_', count: 1, suffix: '000', loop: false },
                attack_light_side: { prefix: 'sgu_Side_Light_', count: 1, suffix: '000', loop: false },
                attack_light_up: { prefix: 'sgu_Side_Light_', count: 1, suffix: '000', loop: false },
                attack_light_up_air: { prefix: 'sgu_Side_Air_', count: 1, suffix: '000', loop: false },
                attack_light_side_air: { prefix: 'sgu_Side_Air_', count: 1, suffix: '000', loop: false },
                attack_light_down: { prefix: 'sgu_Down_Light_', count: 1, suffix: '000', loop: false },
                attack_light_run: { prefix: 'sgu_Side_Run_', count: 1, suffix: '000', loop: false },
                attack_heavy_neutral: { prefix: 'sgu_Up_Sig_', count: 1, suffix: '000', loop: false },
                attack_heavy_up: { prefix: 'sgu_Up_Sig_', count: 1, suffix: '000', loop: false },
                attack_heavy_side: { prefix: 'sgu_Side_Light_', count: 1, suffix: '000', loop: false },
                // Map Down Sig to Side Sig due to missing asset
                attack_heavy_down: { prefix: 'sgu_Side_Sig_', count: 1, suffix: '000', loop: false },
            }
        };

        const characters = ['fok_v3', 'sga', 'sgu'];

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
                    frameRate: animName === 'run' ? 20 : 15,
                    repeat: animData.loop ? -1 : 0
                });
            });
        });

        // Manual Animation: Fok Side Sig Ghost (from standalone images)
        if (!this.anims.exists('fok_side_sig_ghost')) {
            this.anims.create({
                key: 'fok_side_sig_ghost',
                frames: [
                    { key: 'fok_ghost_0' },
                    { key: 'fok_ghost_1' }
                ],
                frameRate: 10,
                repeat: -1
            });
        }
    }

    private setupCameras(): void {
        // Main camera is manually controlled via updateCamera()

        // Create a separate UI camera that ignores zoom
        this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.uiCamera.setScroll(0, 0);
        // UI camera ignores main camera zoom
        this.uiCamera.setZoom(1);
    }

    private configureCameraExclusions(): void {
        if (!this.uiCamera) return;

        // Ignore static world elements
        if (this.platforms.length > 0) this.uiCamera.ignore(this.platforms);
        if (this.softPlatforms.length > 0) this.uiCamera.ignore(this.softPlatforms);

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

    async create(): Promise<void> {
        // Font is pre-loaded in PreloadScene (active polling ensures it's ready)

        // Create animations first
        this.createAnimations();

        // Setup cameras (UI separation)
        this.setupCameras();
        // PREVENT GHOSTING: UI Camera should ignore game world objects
        this.configureCameraExclusions();

        // Setup network callbacks
        this.networkManager.onStateUpdate((state) => this.handleStateUpdate(state));
        this.networkManager.onDisconnect(() => this.handleDisconnect());
        this.networkManager.onAttack((event) => this.handleAttackEvent(event));
        this.networkManager.onHit((event) => this.handleHitEvent(event));
        this.networkManager.onRematchStart(() => this.handleRematchStart());
        this.networkManager.onPlayerLeft((playerId) => this.handlePlayerLeft(playerId));
        // Selection phase callbacks
        this.networkManager.onSelectionStart((countdown) => this.handleSelectionStart(countdown));
        this.networkManager.onSelectionTick((countdown) => this.handleSelectionTick(countdown));
        this.networkManager.onCharacterSelect((playerId, character) => this.handleOpponentCharacterSelect(playerId, character));
        this.networkManager.onCharacterConfirm((playerId) => this.handleCharacterConfirm(playerId));
        this.networkManager.onGameStart((players) => this.handleGameStart(players));
        this.networkManager.onChestSpawn((x) => this.spawnChestAt(x));

        // Silence unused but maintained state
        void this.selectionCountdown;
        void this.isOpponentConfirmed;

        // Try to connect
        this.showConnectionStatus('Connecting...');
        const connected = await this.networkManager.connect();

        if (!connected) {
            this.showConnectionStatus('Connection Failed. Press ESC to return.');
            this.setupEscapeKey();
            return;
        }

        this.isConnected = true;
        this.localPlayerId = this.networkManager.getLocalPlayerId();
        this.phase = 'WAITING';
        this.showConnectionStatus(`Connected as Player ${this.localPlayerId + 1}. Waiting for opponent...`);

        // Setup stage (but don't spawn players yet)
        this.createStage();

        // Initialize HUD
        this.matchHUD = new MatchHUD(this);
        this.matchHUD.addToCameraIgnore(this.cameras.main);

        // Debug Overlay
        this.debugOverlay = new DebugOverlay(this);
        this.debugOverlay.setCameraIgnore(this.cameras.main);

        // Debug Toggle Key
        this.debugToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

        // Setup input (local player only)
        this.inputManager = new InputManager(this, {
            playerId: this.localPlayerId,
            useKeyboard: true,
            gamepadIndex: 0,
            enableGamepad: true
        });

        // Setup selection UI (hidden initially)
        this.createSelectionUI();

        // Setup escape key
        this.setupEscapeKey();

        // Start ping loop
        this.time.addEvent({
            delay: 2000,
            callback: () => this.networkManager.ping(),
            loop: true
        });
    }

    update(_time: number, delta: number): void {
        if (!this.isConnected) return;

        // Handle selection phase input
        if (this.phase === 'SELECTING') {
            this.pollSelectionInput();
            return;
        }

        // Stop updates if game over
        if (this.isGameOver) {
            // Poll gamepad for menu navigation
            this.pollGamepadForMenu();
            return;
        }

        // Only run game loop in PLAYING phase
        if (this.phase !== 'PLAYING') return;

        this.localFrame++;

        // Poll and send local input (throttled to ~30Hz)
        const input = this.inputManager.poll();
        this.inputThrottleCounter++;
        if (this.inputThrottleCounter >= this.INPUT_SEND_INTERVAL) {
            this.inputThrottleCounter = 0;
            this.networkManager.sendInput(input);
        }

        // Save snapshot every 3 frames (reduce GC pressure)
        if (this.localPlayer && this.localFrame % 3 === 0) {
            const snapshot: GameSnapshot = {
                frame: this.localFrame,
                timestamp: Date.now(),
                players: this.captureAllPlayerSnapshots()
            };
            this.networkManager.saveSnapshot(snapshot);
        }

        // Update local player prediction (client-side)
        if (this.localPlayer) {
            this.localPlayer.setInput(input);
            this.localPlayer.updatePhysics(delta);

            // Collisions
            this.platforms.forEach(platform => this.localPlayer!.checkPlatformCollision(platform, false));
            this.softPlatforms.forEach(platform => this.localPlayer!.checkPlatformCollision(platform, true));
            this.localPlayer.checkWallCollision(this.wallRects);

            this.localPlayer.updateLogic(delta);

            // Blast zone check - respawn if player falls off
            this.checkBlastZone(this.localPlayer);

            // Send local player's actual position to server for relay to other clients
            const stateToSend = {
                playerId: this.localPlayerId,
                x: this.localPlayer.x,
                y: this.localPlayer.y,
                velocityX: this.localPlayer.velocity.x,
                velocityY: this.localPlayer.velocity.y,
                facingDirection: this.localPlayer.getFacingDirection(),
                isGrounded: this.localPlayer.isGrounded,
                isAttacking: this.localPlayer.isAttacking,
                animationKey: this.localPlayer.animationKey,
                damagePercent: this.localPlayer.damagePercent,
                lives: this.localPlayer.lives
            };
            // Throttle state updates to reduce bandwidth (every 3rd frame = ~20Hz)
            this.stateThrottleCounter++;
            const shouldSendState = this.stateThrottleCounter >= this.STATE_SEND_INTERVAL ||
                stateToSend.animationKey === 'hurt' || // Always send on damage
                stateToSend.isAttacking; // Always send on attack

            if (shouldSendState) {
                this.stateThrottleCounter = 0;
                this.networkManager.sendState(stateToSend);
            }

            // Check local player attacks against all remote players
            this.players.forEach((target) => {
                if (target !== this.localPlayer) {
                    this.localPlayer!.checkHitAgainst(target);
                }
            });

            // Chest Interaction (attack near chest to open)
            this.checkChestInteractions();
        }

        // JITTER BUFFER (Fixed Timeline Interpolation)
        // ----------------------------------------------------------------
        // Interpolate from reconstructed server timeline, decoupled from network jitter.

        // 1. Advance Stable Interpolation Clock (with drift correction)
        if (this.isBufferInitialized) {
            // Check if we're running too far ahead (buffer starvation)
            let maxBufferTime = 0;
            this.snapshotBuffer.forEach((buffer) => {
                if (buffer.length > 0) {
                    maxBufferTime = Math.max(maxBufferTime, buffer[buffer.length - 1].serverTime);
                }
            });

            const targetLead = maxBufferTime - this.interpolationTime;

            // Smooth continuous clock speed curve (eliminates discrete jumps)
            // Maps targetLead to clockSpeed: closer to target = slower adjustment
            const leadError = targetLead - this.RENDER_DELAY_MS;
            const clockSpeed = Phaser.Math.Clamp(
                1.0 + (leadError * 0.002), // Gentle adjustment factor
                0.95,  // Lower bound (slow down when buffer is low)
                1.05   // Upper bound (speed up when buffer is high)
            );

            this.interpolationTime += delta * clockSpeed;
        }

        // 2. Interpolate Remote Players
        this.players.forEach((player, playerId) => {
            if (playerId !== this.localPlayerId) {
                const buffer = this.snapshotBuffer.get(playerId);

                if (buffer && buffer.length >= 2) {
                    // Find snapshots A and B such that A.serverTime <= interpolationTime < B.serverTime
                    let fromSnap = buffer[0];
                    let toSnap = buffer[1];

                    // Shift buffer based on interpolationTime
                    while (buffer.length >= 2 && this.interpolationTime > buffer[1].serverTime) {
                        buffer.shift();
                        if (buffer.length >= 2) {
                            fromSnap = buffer[0];
                            toSnap = buffer[1];
                        }
                    }

                    // Perform Interpolation
                    if (buffer.length >= 2 && this.interpolationTime >= fromSnap.serverTime && this.interpolationTime <= toSnap.serverTime) {
                        const segmentDuration = toSnap.serverTime - fromSnap.serverTime;
                        const t = segmentDuration > 0 ? (this.interpolationTime - fromSnap.serverTime) / segmentDuration : 0;

                        // Linear Interpolation for Position
                        player.x = Phaser.Math.Linear(fromSnap.x, toSnap.x, t);
                        player.y = Phaser.Math.Linear(fromSnap.y, toSnap.y, t);

                        // Discrete State Updates
                        if (fromSnap.animationKey && fromSnap.animationKey !== player.animationKey) {
                            player.playAnim(fromSnap.animationKey, true);
                        }
                        player.setFacingDirection(fromSnap.facingDirection);
                    } else if (buffer.length > 0) {
                        // Smooth extrapolation using last known velocity
                        const latest = buffer[buffer.length - 1];
                        const timeSinceLast = this.interpolationTime - latest.serverTime;

                        // Use velocity for smooth prediction instead of snapping
                        const predictedX = latest.x + (latest.velocityX || 0) * (timeSinceLast / 1000);
                        const predictedY = latest.y + (latest.velocityY || 0) * (timeSinceLast / 1000);

                        // Gentler lerp (0.15) to reduce snap-back when new data arrives
                        player.x = Phaser.Math.Linear(player.x, predictedX, 0.15);
                        player.y = Phaser.Math.Linear(player.y, predictedY, 0.15);

                        if (latest.animationKey) player.playAnim(latest.animationKey, true);
                        player.setFacingDirection(latest.facingDirection);
                    }

                    // Update Visuals (Timers, Blink, etc.) independent of interpolation
                    player.updateVisuals(delta);
                }

                // Check blast zone for remote players
                this.checkBlastZone(player);
            }
        });

        // Update MatchHUD
        if (this.matchHUD) {
            this.matchHUD.updatePlayers(this.players);
            // Debug moved to DebugOverlay
        }

        // Update Debug Overlay
        const qKeyPressed = Phaser.Input.Keyboard.JustDown(this.debugToggleKey);
        const gamepadSelectPressed = this.checkGamepadSelect();
        if (qKeyPressed || gamepadSelectPressed) {
            this.debugVisible = !this.debugVisible;
            this.debugOverlay.setVisible(this.debugVisible);
            this.players.forEach(p => p.setDebug(this.debugVisible));
        }

        if (this.debugVisible && this.localPlayer) {
            const velocity = this.localPlayer.getVelocity();
            const currentAttack = this.localPlayer.getCurrentAttack();
            const attackInfo = currentAttack
                ? `${currentAttack.data.type} ${currentAttack.data.direction} (${currentAttack.phase})`
                : 'None';

            this.debugOverlay.update(
                velocity.x,
                velocity.y,
                this.localPlayer.getState(),
                this.localPlayer.getRecoveryAvailable(),
                attackInfo,
                this.localPlayer.isGamepadConnected(),
                this.networkManager.getLatency()
            );
        } else if (!this.debugVisible) {
            // Ensure hidden if toggled off
            this.debugOverlay.setVisible(false);
        }

        // Dynamic Camera
        this.updateCamera();

        // Check for Game Over
        this.checkGameOver();
    }

    /**
     * Capture snapshots of all players for rollback
     */
    private captureAllPlayerSnapshots(): PlayerSnapshot[] {
        const snapshots: PlayerSnapshot[] = [];
        this.players.forEach((player) => {
            snapshots.push(player.captureSnapshot());
        });
        return snapshots;
    }

    private handleStateUpdate(state: NetGameState): void {
        // Process state updates immediately (no jitter buffer)
        this.processStateUpdate(state);
    }

    private processStateUpdate(state: NetGameState): void {
        // Only process player state during PLAYING phase
        if (this.phase !== 'PLAYING') return;

        const serverFrame = state.frame;

        state.players.forEach((netPlayer: NetPlayerState) => {
            let player = this.players.get(netPlayer.playerId);

            // Create player if new
            if (!player) {
                player = this.createPlayer(netPlayer.playerId, netPlayer.x, netPlayer.y);
                this.players.set(netPlayer.playerId, player);

                if (netPlayer.playerId === this.localPlayerId) {
                    this.localPlayer = player;
                    // Let the player poll its own internal InputManager (like GameScene does)
                    // this.localPlayer.useExternalInput = true;
                }

                // Add to HUD
                if (this.matchHUD) {
                    const isLocal = netPlayer.playerId === this.localPlayerId;
                    // For online, use "Player X" or name if available
                    // We don't have character in NetPlayerState? We DO in CharacterSelect but maybe not in state?
                    // NetPlayerState has: playerId, x, y, velX, velY, facing, isGrounded, isAttacking, animKey, damage, lives.
                    // It DOES NOT have character (yet). 
                    // However, we handle CharacterSelect events. We should store map of ID -> Character.

                    // Note: OnlineGameScene handles "onCharacterSelect". 
                    // We probably need to store character mapping to pass here.
                    // For now, default to 'fok' if unknown, but better to fix.
                    const character = this.playerCharacters.get(netPlayer.playerId) || 'fok';

                    this.matchHUD.addPlayer(netPlayer.playerId, `Player ${netPlayer.playerId + 1}`, isLocal, character);
                }
            }

            // For local player: check for deviation/reconciliation
            if (netPlayer.playerId === this.localPlayerId && this.localPlayer) {
                this.checkAndReconcile(netPlayer, serverFrame);
                return;
            }

            // --- JITTER BUFFER: Store Snapshot ---
            let buffer = this.snapshotBuffer.get(netPlayer.playerId);
            if (!buffer) {
                buffer = [];
                this.snapshotBuffer.set(netPlayer.playerId, buffer);
            }

            // Create a snapshot with CLIENT ARRIVAL timestamp (not reconstructed from frame)
            // This decouples interpolation from server frame timing issues
            const arrivalTime = performance.now();
            const snapshot: NetPlayerSnapshot = {
                ...netPlayer,
                frame: serverFrame,
                serverTime: arrivalTime // Use real wall-clock arrival time
            };

            // Add to buffer in chronological order
            if (buffer.length === 0 || snapshot.frame > buffer[buffer.length - 1].frame) {
                buffer.push(snapshot);
            }

            // Cap buffer size (keeping 10 snapshots = 500ms at 20Hz)
            if (buffer.length > 10) {
                buffer.shift();
            }

            // Initialize clock
            if (!this.isBufferInitialized && buffer.length >= 2) {
                // Initialize interpolationTime to RENDER_DELAY behind the newest arrival
                this.interpolationTime = arrivalTime - this.RENDER_DELAY_MS;
                this.isBufferInitialized = true;
                console.log(`[JitterBuffer] Initialized. interpolationTime: ${this.interpolationTime.toFixed(0)}, arrivalTime: ${arrivalTime.toFixed(0)}`);
            }

            // Sync stats (stateless)
            if (typeof netPlayer.lives === 'number' && player.lives !== netPlayer.lives) {
                player.lives = netPlayer.lives;
            }
            if (typeof netPlayer.damagePercent === 'number') {
                player.setDamage(netPlayer.damagePercent);
            }
        });
    }

    private checkAndReconcile(_serverPlayerState: NetPlayerState, _serverFrame: number): void {
        // Intentionally empty - client is authoritative for local player
        // Server physics is too simplified to correct client state
    }

    /**
     * Handle remote attack events - trigger full attack logic on remote player
     */
    private handleAttackEvent(event: NetAttackEvent): void {
        const player = this.players.get(event.playerId);
        if (player) {
            // Trigger full attack (animation + effects like ghost sprites)
            player.combat.startAttack(event.attackKey);
        }
    }

    /**
     * Handle remote hit events - apply damage/knockback
     */
    private handleHitEvent(event: NetHitEvent): void {
        // If we are the victim, apply damage/knockback
        if (event.victimId === this.localPlayerId && this.localPlayer) {
            // Apply damage
            this.localPlayer.takeDamage(event.damage);

            // Apply knockback
            this.localPlayer.setVelocity(event.knockbackX, event.knockbackY);

            // Play hurt animation
            this.localPlayer.playHurtAnimation();

            // Apply hitstop/stun if needed (simplified for now)
        }

        // FIX: If we hit a remote player, apply visual knockback to them locally
        const remoteVictim = this.players.get(event.victimId);
        if (remoteVictim && event.victimId !== this.localPlayerId) {
            remoteVictim.setVelocity(event.knockbackX, event.knockbackY);
            remoteVictim.playHurtAnimation();

            // FIX: Trigger damage flash visual
            // We use current + event damage for the color calculation (visual only)
            // Actual damagePercent is synced via state_update
            remoteVictim.flashDamageColor(remoteVictim.damagePercent + event.damage);
        }
    }




    /**
     * Handle player disconnect - clean up ghost entities
     */
    private handlePlayerLeft(playerId: number): void {
        const player = this.players.get(playerId);
        if (!player) return;

        // Remove from active players map
        this.players.delete(playerId);

        // Remove from dead-reckoning targets
        this.remoteTargets.delete(playerId);

        // Remove from HUD
        this.matchHUD.removePlayer(playerId);

        // Destroy Phaser sprite and cleanup
        player.destroy();
    }

    /**
     * Spawn a chest at a specific X position (called by server broadcast)
     */
    private spawnChestAt(x: number): void {
        const y = 0;
        const chest = new Chest(this, x, y);
        if (this.uiCamera) {
            this.uiCamera.ignore(chest);
        }
    }

    /**
     * Check if any attacking player is near a chest and open it
     */
    private checkChestInteractions(): void {
        if (!this.chests || this.chests.length === 0) return;

        const interactRange = 120;

        this.players.forEach((player) => {
            if (!player.isAttacking) return;

            for (const chest of [...this.chests]) {
                if (chest.isOpened) continue;

                const dist = Phaser.Math.Distance.Between(player.x, player.y, chest.x, chest.y);
                if (dist < interactRange) {
                    chest.open();
                }
            }
        });
    }

    /**
     * Check if player is outside blast zones and respawn if so
     */
    private checkBlastZone(player: Player): void {
        if (!player.active) return;

        // ONLY Local player logic determines death for self (Client Authoritative)
        const isLocal = player === this.localPlayer;
        if (!isLocal) return;

        // Check bounds
        const bounds = player.getBounds();
        if (bounds.left < this.BLAST_ZONE_LEFT ||
            bounds.right > this.BLAST_ZONE_RIGHT ||
            bounds.top < this.BLAST_ZONE_TOP ||
            bounds.bottom > this.BLAST_ZONE_BOTTOM) {

            // Score update (lives)
            player.lives = Math.max(0, player.lives - 1);

            // Hide immediately
            player.setActive(false);
            player.setVisible(false);

            if (player.lives > 0) {
                this.time.delayedCall(2000, () => {
                    this.respawnPlayer(player);
                });
            } else {
                this.killPlayer(player);
                // We rely on the regular checkGameOver call to trigger the end
            }
        }
    }

    private respawnPlayer(player: Player): void {
        player.setActive(true);
        player.setVisible(true);

        // Respawn position
        const spawnPoints = [
            { x: 450, y: 300 },
            { x: 1470, y: 300 },
            { x: 960, y: 200 },
            { x: 960, y: 400 }
        ];
        // Use local player ID for spawn point
        const spawn = spawnPoints[this.localPlayerId] || { x: 960, y: 300 };

        player.setPosition(spawn.x, 300);
        player.physics.reset();
        player.setState(PlayerState.AIRBORNE);
        player.setDamage(0);
        player.resetVisuals();
        player.setInvulnerable(1000); // 1 full second invulnerability

        // Flash effect
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 0.8);
        flash.fillCircle(spawn.x, 300, 75);
        if (this.uiCamera) this.uiCamera.ignore(flash);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            scale: 2,
            duration: 300,
            onComplete: () => flash.destroy()
        });
    }

    private killPlayer(player: Player): void {
        player.setActive(false);
        player.setVisible(false);
        player.setPosition(-9999, -9999);
        if (player.body) {
            this.matter.world.remove(player.body);
        }
    }

    private checkGameOver(): void {
        if (this.isGameOver) return;

        // Wait for setup (ensure we have >1 player or it is a test)
        if (this.players.size < 2 && this.localFrame < 600) return; // Allow 10s for connections? Or just check if we ever had >1.
        // Actually, if we are playing 1v1, we need 2 players.
        // If opponent disconnects, player list size drops?
        // NetworkManager player_left event? We haven't handled it in OnlineGameScene yet.
        // Assuming players map retains leaving players?
        // If opponent leaves, they should be eliminated?
        // For now: Count survivors.

        let survivorCount = 0;
        let lastSurvivor: Player | null = null;

        this.players.forEach(p => {
            if (p.lives > 0) {
                survivorCount++;
                lastSurvivor = p;
            }
        });

        // If game has started (we can use frame count or just if we have >= 2 players)
        // Simple rule: If <= 1 survivor, Game Over.
        if (survivorCount <= 1 && this.players.size >= 2) {
            this.handleGameOver(lastSurvivor ? (lastSurvivor as Player & { playerId: number }).playerId : -1);
        }
    }

    private handleGameOver(winnerId: number): void {
        this.isGameOver = true;
        this.hasVotedRematch = false;

        const { width, height } = this.scale;

        // Create container for game over UI
        this.gameOverContainer = this.add.container(0, 0);
        this.gameOverContainer.setDepth(2000);

        // Darken background
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        this.gameOverContainer.add(overlay);

        let winnerText = "GAME!";
        if (winnerId >= 0) {
            winnerText += `\nPLAYER ${winnerId + 1} WINS!`;
        } else {
            winnerText += "\nGAME OVER";
        }

        const text = this.add.text(width / 2, height / 2 - 50, winnerText, {
            fontSize: '64px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#ffffff',
            align: 'center',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);
        this.gameOverContainer.add(text);

        // Rematch Button
        this.rematchButton = this.add.text(width / 2 - 120, height / 2 + 80, 'REMATCH', {
            fontSize: '32px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#00ff00',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.rematchButton.on('pointerdown', () => this.handleRematchVote());
        this.rematchButton.on('pointerover', () => { this.selectedButtonIndex = 0; this.updateButtonSelection(); });
        this.gameOverContainer.add(this.rematchButton);

        // Leave Button
        this.leaveButton = this.add.text(width / 2 + 120, height / 2 + 80, 'LEAVE', {
            fontSize: '32px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#ff4444',
            backgroundColor: '#333333',
            padding: { x: 20, y: 10 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        this.leaveButton.on('pointerdown', () => this.handleLeave());
        this.leaveButton.on('pointerover', () => { this.selectedButtonIndex = 1; this.updateButtonSelection(); });
        this.gameOverContainer.add(this.leaveButton);

        // Store buttons for navigation
        this.menuButtons = [this.rematchButton, this.leaveButton];
        this.selectedButtonIndex = 0;
        this.updateButtonSelection();

        // Setup keyboard/gamepad navigation
        this.setupGameOverInput();

        // Ignore container from main camera (UI camera only)
        this.cameras.main.ignore(this.gameOverContainer);
    }

    private setupGameOverInput(): void {
        // Keyboard navigation
        this.input.keyboard?.on('keydown-LEFT', () => this.navigateMenu(-1));
        this.input.keyboard?.on('keydown-RIGHT', () => this.navigateMenu(1));
        this.input.keyboard?.on('keydown-A', () => this.navigateMenu(-1));
        this.input.keyboard?.on('keydown-D', () => this.navigateMenu(1));
        this.input.keyboard?.on('keydown-ENTER', () => this.confirmSelection());
        this.input.keyboard?.on('keydown-SPACE', () => this.confirmSelection());

        // Gamepad support (poll in update or use events)
        // We'll poll gamepad in the isGameOver section of update()
    }

    private navigateMenu(direction: number): void {
        if (!this.isGameOver || this.hasVotedRematch) return;
        this.selectedButtonIndex = (this.selectedButtonIndex + direction + this.menuButtons.length) % this.menuButtons.length;
        this.updateButtonSelection();
    }

    private updateButtonSelection(): void {
        this.menuButtons.forEach((btn, idx) => {
            if (idx === this.selectedButtonIndex) {
                btn.setScale(1.1);
                btn.setAlpha(1);
                if (idx === 0 && !this.hasVotedRematch) {
                    btn.setColor('#88ff88');
                } else if (idx === 1) {
                    btn.setColor('#ff8888');
                }
            } else {
                btn.setScale(1);
                btn.setAlpha(0.7);
                if (idx === 0 && !this.hasVotedRematch) {
                    btn.setColor('#00ff00');
                } else if (idx === 1) {
                    btn.setColor('#ff4444');
                }
            }
        });
    }

    private confirmSelection(): void {
        if (!this.isGameOver) return;
        if (this.selectedButtonIndex === 0) {
            this.handleRematchVote();
        } else {
            this.handleLeave();
        }
    }

    private lastGamepadNavTime: number = 0;
    private pollGamepadForMenu(): void {
        const gamepads = navigator.getGamepads();
        if (!gamepads) return;

        const now = Date.now();
        const NAV_COOLDOWN = 200; // ms between navigation inputs

        for (const gamepad of gamepads) {
            if (!gamepad) continue;

            // D-pad or left stick for navigation
            const leftStickX = gamepad.axes[0] || 0;
            const dpadLeft = gamepad.buttons[14]?.pressed || false;
            const dpadRight = gamepad.buttons[15]?.pressed || false;

            if (now - this.lastGamepadNavTime > NAV_COOLDOWN) {
                if (leftStickX < -0.5 || dpadLeft) {
                    this.navigateMenu(-1);
                    this.lastGamepadNavTime = now;
                } else if (leftStickX > 0.5 || dpadRight) {
                    this.navigateMenu(1);
                    this.lastGamepadNavTime = now;
                }
            }

            // A button (button 0) or Start (button 9) to confirm
            const aButton = gamepad.buttons[0]?.pressed || false;
            const startButton = gamepad.buttons[9]?.pressed || false;

            if (aButton || startButton) {
                if (now - this.lastGamepadNavTime > NAV_COOLDOWN) {
                    this.confirmSelection();
                    this.lastGamepadNavTime = now;
                }
            }
        }
    }

    private handleRematchVote(): void {
        if (this.hasVotedRematch) return;
        this.hasVotedRematch = true;
        this.networkManager.sendRematchVote();
        this.rematchButton.setText('WAITING...');
        this.rematchButton.setColor('#888888');
        this.rematchButton.disableInteractive();
    }

    private handleLeave(): void {
        this.networkManager.disconnect();
        this.scene.start('MainMenuScene');
    }

    private handleRematchStart(): void {

        // Clear game over UI
        if (this.gameOverContainer) {
            this.gameOverContainer.destroy(true);
        }

        // Reset game state
        this.isGameOver = false;
        this.hasVotedRematch = false;
        this.localFrame = 0;

        // Reset all players
        this.players.forEach((player, playerId) => {
            player.setActive(true);
            player.setVisible(true);
            player.lives = 3;
            player.setDamage(0);
            player.velocity.x = 0;
            player.velocity.y = 0;

            // Respawn position
            const spawnPoints = [
                { x: 600, y: 780 },
                { x: 1200, y: 780 }
            ];
            const spawn = spawnPoints[playerId % 2] || spawnPoints[0];
            player.setPosition(spawn.x, spawn.y);
            player.physics.reset();
            player.resetVisuals();
        });

    }

    private createPlayer(playerId: number, x: number, y: number, character: string = 'fok_v3'): Player {
        const isLocal = playerId === this.localPlayerId;

        const player = new Player(this, x, y, {
            playerId: playerId,
            isAI: false,
            useKeyboard: isLocal,
            gamepadIndex: isLocal ? 0 : null, // All local players try to use index 0 (gated by focus)
            character: character as 'fok_v3'
        });

        // Network hooks for local player
        if (isLocal) {
            player.onAttack = (key, dir) => {
                this.networkManager.sendAttack(key, dir);
            };

            player.onHit = (target, dmg, kx, ky) => {
                // Determine victim ID
                if (target instanceof Player) {
                    this.networkManager.sendHit(target.playerId, dmg, kx, ky);
                }
            };
        }

        // Visual distinction for remote players
        if (!isLocal) {
            player.spriteObject.clearTint(); // Ensure no tint for remote players

            // CRITICAL FIX: Override takeDamage for remote players
            // Remote players should ONLY update damage from server state (interpolatePlayer)
            // Local hits on remote players should visual flash, but NOT update damage property
            player.takeDamage = (amount: number) => {
                // Calculate what damage would be for Visual Flash only
                const estimatedDamage = player.damagePercent + amount;
                player.flashDamageColor(estimatedDamage);
            };
        }

        // Hide player from UI camera
        if (this.uiCamera) {
            player.addToCameraIgnore(this.uiCamera);
        }

        return player;
    }

    private handleDisconnect(): void {
        this.isConnected = false;
        this.showConnectionStatus('Disconnected. Press ESC to return.');
    }

    private showConnectionStatus(message: string): void {
        if (!this.connectionStatusBg) {
            this.connectionStatusBg = this.add.rectangle(
                this.scale.width / 2, this.scale.height / 2,
                this.scale.width, this.scale.height, 0x000000, 0.95
            ).setDepth(999);
            if (this.uiCamera) this.cameras.main.ignore(this.connectionStatusBg);
        }
        this.connectionStatusBg.setVisible(true);

        if (!this.connectionStatusText) {
            this.connectionStatusText = this.add.text(
                this.scale.width / 2,
                this.scale.height / 2,
                message,
                { fontSize: '32px', color: '#ffffff', backgroundColor: '#333333', padding: { x: 20, y: 10 }, fontFamily: '"Pixeloid Sans"' }
            ).setOrigin(0.5).setDepth(1000);
            if (this.uiCamera) this.cameras.main.ignore(this.connectionStatusText);
        } else {
            this.connectionStatusText.setText(message);
        }
        this.connectionStatusText.setVisible(true);
    }

    private createUI(): void {
        // Destroy connection status UI
        if (this.connectionStatusText) { this.connectionStatusText.destroy(); this.connectionStatusText = null as any; }
        if (this.connectionStatusBg) { this.connectionStatusBg.destroy(); this.connectionStatusBg = null as any; }
        // Ping/FPS display is handled by MatchHUD (centered)
    }

    private createSelectionUI(): void {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Container for selection UI (initially hidden)
        this.selectionContainer = this.add.container(centerX, centerY);
        this.selectionContainer.setDepth(500);
        this.selectionContainer.setVisible(false);


        // Background overlay (Fullscreen, Dark)
        const bg = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.95);
        this.selectionContainer.add(bg);

        // Per-Player Cards (Rounded Rectangles with Player-Colored Strokes)
        const cardWidth = 180;
        const cardHeight = 300;
        const cardY = -20; // Vertical center offset
        const p1X = -130; // Left card center
        const p2X = 130;  // Right card center

        // Determine labels: local player gets their actual P# based on join order
        const myPlayerNum = this.localPlayerId + 1; // 1-based
        const oppPlayerNum = myPlayerNum === 1 ? 2 : 1;
        const myColorIdx = this.localPlayerId;       // 0 for P1, 1 for P2
        const oppColorIdx = myColorIdx === 0 ? 1 : 0;

        // P1 Card (Left = local player)
        const p1Card = this.add.graphics();
        p1Card.lineStyle(3, this.PLAYER_COLORS[myColorIdx]);
        p1Card.fillStyle(0x000000, 0.4);
        p1Card.fillRoundedRect(p1X - cardWidth / 2, cardY - cardHeight / 2, cardWidth, cardHeight, 16);
        p1Card.strokeRoundedRect(p1X - cardWidth / 2, cardY - cardHeight / 2, cardWidth, cardHeight, 16);
        this.selectionContainer.add(p1Card);

        // P2 Card (Right = opponent)
        const p2Card = this.add.graphics();
        p2Card.lineStyle(3, this.PLAYER_COLORS[oppColorIdx]);
        p2Card.fillStyle(0x000000, 0.4);
        p2Card.fillRoundedRect(p2X - cardWidth / 2, cardY - cardHeight / 2, cardWidth, cardHeight, 16);
        p2Card.strokeRoundedRect(p2X - cardWidth / 2, cardY - cardHeight / 2, cardWidth, cardHeight, 16);
        this.selectionContainer.add(p2Card);

        // Title
        const title = this.add.text(0, -245, 'SELECT CHARACTER', {
            fontSize: '36px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.selectionContainer.add(title);

        // Countdown timer
        this.countdownText = this.add.text(0, -195, '10', {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.selectionContainer.add(this.countdownText);

        // --- Local Player (Left Side) ---
        // Convert player color to hex string for text
        const myColorHex = '#' + this.PLAYER_COLORS[myColorIdx].toString(16).padStart(6, '0');
        const oppColorHex = '#' + this.PLAYER_COLORS[oppColorIdx].toString(16).padStart(6, '0');

        const myLabel = this.add.text(p1X, 75, `P${myPlayerNum}`, {
            fontSize: '20px',
            color: myColorHex,
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.selectionContainer.add(myLabel);

        this.myCharacterText = this.add.text(p1X, 105, this.getCharacterDisplayName(this.selectedCharacter), {
            fontSize: '24px',
            color: '#ffffff',
            fontStyle: 'bold',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.selectionContainer.add(this.myCharacterText);

        // Left/Right arrows
        const leftArrow = this.add.text(p1X - 70, cardY, '◀', {
            fontSize: '32px',
            color: myColorHex,
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.selectionContainer.add(leftArrow);

        const rightArrow = this.add.text(p1X + 70, cardY, '▶', {
            fontSize: '32px',
            color: myColorHex,
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.selectionContainer.add(rightArrow);

        // --- Opponent (Right Side) ---
        const oppLabel = this.add.text(p2X, 75, `P${oppPlayerNum}`, {
            fontSize: '20px',
            color: oppColorHex,
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.selectionContainer.add(oppLabel);

        this.opponentCharacterText = this.add.text(p2X, 105, this.getCharacterDisplayName(this.opponentCharacter), {
            fontSize: '24px',
            color: '#888888',
            fontStyle: 'bold',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.selectionContainer.add(this.opponentCharacterText);

        // Instructions removed as per request.

        // Make UI camera render this on top
        if (this.uiCamera) {
            this.cameras.main.ignore(this.selectionContainer);
        }

        // Add Character Sprites (Side-by-Side)
        // Local Player (Left side)
        this.myCharacterSprite = this.add.sprite(p1X, -45, 'fok_v3', 'fok_v3_idle_000');
        this.myCharacterSprite.setScale(1);
        this.selectionContainer.add(this.myCharacterSprite);

        // Opponent (Right side)
        this.opponentCharacterSprite = this.add.sprite(p2X, -45, 'fok_v3', 'fok_v3_idle_000');
        this.opponentCharacterSprite.setScale(1);
        this.opponentCharacterSprite.setFlipX(true);
        this.selectionContainer.add(this.opponentCharacterSprite);

        // Confirmation Status Labels - Added AFTER sprites so they render on top
        this.myConfirmText = this.add.text(p1X, -45, 'READY', {
            fontSize: '16px',
            color: '#00ff00',
            fontStyle: 'bold',
            backgroundColor: '#004400',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5).setVisible(false);
        this.selectionContainer.add(this.myConfirmText);

        this.opponentConfirmText = this.add.text(p2X, -45, 'READY', {
            fontSize: '16px',
            color: '#00ff00',
            fontStyle: 'bold',
            backgroundColor: '#004400',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5).setVisible(false);
        this.selectionContainer.add(this.opponentConfirmText);

        // Initial update
        this.updateSelectionVisuals();
    }

    private updateSelectionVisuals(): void {
        // Update Local Character
        if (this.myCharacterSprite) {
            const charKey = this.selectedCharacter;
            // Handle naming convention differences
            const idleAnim = charKey === 'fok_v3' ? 'fok_v3_idle' : `${charKey}_idle`;
            this.myCharacterSprite.play(idleAnim, true);
        }

        // Update Opponent Character
        if (this.opponentCharacterSprite) {
            const charKey = this.opponentCharacter;
            const idleAnim = charKey === 'fok_v3' ? 'fok_v3_idle' : `${charKey}_idle`;
            this.opponentCharacterSprite.play(idleAnim, true);
        }
    }

    private handleSelectionStart(countdown: number): void {
        console.log(`[OnlineGameScene] Selection phase started: ${countdown}s`);
        this.phase = 'SELECTING';
        this.selectionCountdown = countdown;
        // Destroy connection status UI completely
        if (this.connectionStatusText) { this.connectionStatusText.destroy(); this.connectionStatusText = null as any; }
        if (this.connectionStatusBg) { this.connectionStatusBg.destroy(); this.connectionStatusBg = null as any; }

        this.selectionContainer.setVisible(true);
        this.countdownText.setText(countdown.toString());

        // Force font refresh on all selection UI text elements
        this.selectionContainer.each((child: Phaser.GameObjects.GameObject) => {
            if (child instanceof Phaser.GameObjects.Text) {
                child.setFontFamily('"Pixeloid Sans"');
            }
        });
    }

    private handleSelectionTick(countdown: number): void {
        this.selectionCountdown = countdown;
        this.countdownText.setText(countdown.toString());

        // Flash effect on low countdown
        if (countdown <= 3) {
            this.countdownText.setColor('#ff5555');
        }
    }

    private handleOpponentCharacterSelect(playerId: number, character: string): void {
        console.log(`[OnlineGameScene] Opponent ${playerId} selected ${character}`);
        this.opponentCharacter = character;
        this.playerCharacters.set(playerId, character);
        if (this.opponentCharacterText) {
            this.opponentCharacterText.setText(this.getCharacterDisplayName(character));
        }
        this.updateSelectionVisuals();
    }

    private handleCharacterConfirm(playerId: number): void {
        if (playerId === this.localPlayerId) {
            this.isConfirmed = true;
            this.myConfirmText.setVisible(true);
        } else {
            this.isOpponentConfirmed = true;
            this.opponentConfirmText.setVisible(true);
        }
    }

    private handleGameStart(players: { playerId: number; character: string }[]): void {
        console.log('[OnlineGameScene] Game starting with players:', JSON.stringify(players));
        players.forEach(p => {
            console.log(`Player ${p.playerId} char: "${p.character}"`);
            this.playerCharacters.set(p.playerId, p.character);
        });
        this.phase = 'PLAYING';

        // Hide selection UI
        this.selectionContainer.setVisible(false);
        this.isConfirmed = false;
        this.isOpponentConfirmed = false;
        this.myConfirmText.setVisible(false);
        this.opponentConfirmText.setVisible(false);

        // Create MatchHUD
        this.createUI();
        this.matchHUD = new MatchHUD(this);
        this.matchHUD.addToCameraIgnore(this.cameras.main);

        // Spawn players with their selected characters
        const spawnPoints = [600, 1200];
        players.forEach((p, idx) => {
            // Validate character against loaded textures. Fallback to 'fok_v3' if invalid.
            const validChars = ['fok_v3', 'sga', 'sgu'];
            const char = validChars.includes(p.character) ? p.character : 'fok_v3';
            console.log(`[OnlineGameScene] Creating player ${p.playerId} with char: ${char} (Server sent: "${p.character}")`);

            const player = this.createPlayer(p.playerId, spawnPoints[idx % 2], 780, char);
            this.players.set(p.playerId, player);

            if (p.playerId === this.localPlayerId) {
                this.localPlayer = player;

                // Add small bobbing triangle indicator above local player (matching his color)
                const triColor = this.PLAYER_COLORS[p.playerId % this.PLAYER_COLORS.length];
                const tri = this.add.graphics();
                tri.fillStyle(triColor, 0.5);
                tri.fillTriangle(-6, -6, 6, -6, 0, 6); // Downward-pointing
                tri.setPosition(0, -120); // Above nameTag
                player.add(tri);
                this.tweens.add({
                    targets: tri,
                    y: tri.y - 5,
                    duration: 600,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });
                if (this.uiCamera) {
                    this.uiCamera.ignore(tri);
                }
            }

            // Add to HUD
            const isLocal = p.playerId === this.localPlayerId;
            const charDisplay = this.getCharacterDisplayName(p.character);
            this.matchHUD.addPlayer(p.playerId, `P${p.playerId + 1} ${charDisplay}`, isLocal, p.character === 'fok_v3' ? 'fok' : p.character);
        });

        // Setup collision overlap for hit detection
        // ... (existing collision code)
    }

    private cycleCharacter(direction: number): void {
        if (this.phase !== 'SELECTING') return;

        this.selectedCharIndex = (this.selectedCharIndex + direction + this.availableCharacters.length) % this.availableCharacters.length;
        this.selectedCharacter = this.availableCharacters[this.selectedCharIndex];
        this.myCharacterText.setText(this.getCharacterDisplayName(this.selectedCharacter));
        this.updateSelectionVisuals();

        // Send to server
        this.networkManager.sendCharacterSelect(this.selectedCharacter);
    }

    private getCharacterDisplayName(charKey: string): string {
        if (charKey === 'fok_v3') return 'FOK';
        return charKey.toUpperCase();
    }

    // Input state for debouncing
    private selectionInputHeld: boolean = false;

    private pollSelectionInput(): void {
        if (this.isConfirmed) return; // Input locked when confirmed

        // Check keyboard
        const cursors = this.input.keyboard?.createCursorKeys();
        const aKey = this.input.keyboard?.addKey('A');
        const dKey = this.input.keyboard?.addKey('D');
        const enterKey = this.input.keyboard?.addKey('ENTER');
        const spaceKey = this.input.keyboard?.addKey('SPACE');

        const leftPressed = cursors?.left?.isDown || aKey?.isDown;
        const rightPressed = cursors?.right?.isDown || dKey?.isDown;
        const confirmPressed = enterKey?.isDown || spaceKey?.isDown;

        // Check gamepad
        const pad = this.input.gamepad?.pad1;
        const padLeft = pad?.left || (pad?.leftStick?.x ?? 0) < -0.5;
        const padRight = pad?.right || (pad?.leftStick?.x ?? 0) > 0.5;
        const padConfirm = pad?.A || pad?.B; // Accept A or B (some controllers swap)

        const anyLeft = leftPressed || padLeft;
        const anyRight = rightPressed || padRight;
        const anyConfirm = confirmPressed || padConfirm;

        // Debounce: only trigger on press, not hold
        if ((anyLeft || anyRight || anyConfirm) && !this.selectionInputHeld) {
            this.selectionInputHeld = true;

            if (anyConfirm) {
                this.confirmCharacterSelection();
            } else if (anyLeft) {
                this.cycleCharacter(-1);
            } else if (anyRight) {
                this.cycleCharacter(1);
            }
        } else if (!anyLeft && !anyRight && !anyConfirm) {
            this.selectionInputHeld = false;
        }
    }

    private confirmCharacterSelection(): void {
        if (this.phase !== 'SELECTING' || this.isConfirmed) return;

        console.log('[OnlineGameScene] Confirmed selection');
        this.networkManager.sendCharacterConfirm();
        // Optimistic update (handler will also set this)
        this.handleCharacterConfirm(this.localPlayerId);
    }

    private wallRects: Phaser.Geom.Rectangle[] = [];

    private createStage(): void {
        // Background Image (Adria)
        const bg = this.add.image(this.scale.width / 2, this.scale.height / 2, 'adria_bg');
        // Scale to cover
        const scaleX = this.scale.width / bg.width;
        const scaleY = this.scale.height / bg.height;
        const scale = Math.max(scaleX, scaleY);
        // Refinement: Background Depth Tweak (Parallax 0.1, Scale +10%)
        bg.setScale(scale * 1.1).setScrollFactor(0.1);
        bg.setDepth(-10);
        if (this.uiCamera) this.uiCamera.ignore(bg);

        // Side walls (Shortened: Height 540, Y=560)
        bg.setDepth(-100);

        // Main platform (centered, smaller - Refinement 13)
        // Center: 960. Width 1200 (Was 2400). Y = 900
        const mainPlatform = this.add.rectangle(960, 900, 1200, 60, 0x2c3e50);
        mainPlatform.setStrokeStyle(3, 0x3a506b);
        // Important: Add to physics world but as static (no body needed for player collision unless using matter bodies for ground?)
        // In this game, ground collision is custom (y check).
        // BUT bombs use matter bodies.
        this.platforms.push(mainPlatform);
        this.matter.add.gameObject(mainPlatform, { isStatic: true });

        // Soft platform 1 (left, closer)
        // Refinement 13: Pushed in to 610 (Was 260)
        const softPlatform1 = this.add.rectangle(610, 500, 500, 30, 0x0f3460);
        softPlatform1.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform1.setAlpha(0.85);
        this.softPlatforms.push(softPlatform1);
        this.matter.add.gameObject(softPlatform1, { isStatic: true });

        // Soft platform 2 (right, closer)
        // Refinement 13: Pushed in to 1310 (Was 1660)
        const softPlatform2 = this.add.rectangle(1310, 500, 500, 30, 0x0f3460);
        softPlatform2.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform2.setAlpha(0.85);
        this.softPlatforms.push(softPlatform2);
        this.matter.add.gameObject(softPlatform2, { isStatic: true });

        // Walls
        const leftWall = this.add.rectangle(this.WALL_LEFT_X, 560, this.WALL_THICKNESS, 540, 0x2a3a4e);
        leftWall.setStrokeStyle(4, 0x4a6a8e);
        leftWall.setAlpha(0.6);
        leftWall.setDepth(-5);

        const rightWall = this.add.rectangle(this.WALL_RIGHT_X, 560, this.WALL_THICKNESS, 540, 0x2a3a4e);
        rightWall.setStrokeStyle(4, 0x4a6a8e);
        rightWall.setAlpha(0.6);
        rightWall.setDepth(-5);

        // Wall Collision Rects
        this.wallRects = [
            // Left Wall
            new Phaser.Geom.Rectangle(this.WALL_LEFT_X - this.WALL_THICKNESS / 2, 290, this.WALL_THICKNESS, 540),
            // Right Wall
            new Phaser.Geom.Rectangle(this.WALL_RIGHT_X - this.WALL_THICKNESS / 2, 290, this.WALL_THICKNESS, 540)
        ];

        // Wall Text
        const leftWallText = this.add.text(this.WALL_LEFT_X - 12, 375, 'WALL', {
            fontSize: '18px',
            color: '#8ab4f8',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold'
        });
        leftWallText.setRotation(-Math.PI / 2);
        leftWallText.setAlpha(0.5);
        leftWallText.setDepth(-4);

        const rightWallText = this.add.text(this.WALL_RIGHT_X + 12, 525, 'WALL', {
            fontSize: '18px',
            color: '#8ab4f8',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold'
        });
        rightWallText.setRotation(Math.PI / 2);
        rightWallText.setAlpha(0.5);
        rightWallText.setDepth(-4);

        // Initial camera center
        this.cameras.main.setZoom(1); // Start at 1x
        this.cameras.main.centerOn(960, 540);

        if (this.uiCamera) {
            this.uiCamera.ignore(this.platforms);
            this.uiCamera.ignore(this.softPlatforms);
            this.uiCamera.ignore(bg);
            this.uiCamera.ignore(leftWall);
            this.uiCamera.ignore(rightWall);
            this.uiCamera.ignore(leftWallText);
            this.uiCamera.ignore(rightWallText);
        }
    }

    private escapePromptVisible: boolean = false;
    private escapeContainer!: Phaser.GameObjects.Container;

    private setupEscapeKey(): void {
        this.input.keyboard?.on('keydown-ESC', () => {
            if (this.escapePromptVisible) {
                // If prompt is already open, dismiss it
                this.dismissEscapePrompt();
                return;
            }

            // Check if any chest overlay is open
            const isChestOverlayOpen = this.chests.some(chest => chest.isOverlayOpen);
            if (isChestOverlayOpen) {
                return; // Let chest handle the ESC key
            }

            this.showEscapePrompt();
        });
    }

    private showEscapePrompt(): void {
        this.escapePromptVisible = true;
        const { width, height } = this.scale;

        this.escapeContainer = this.add.container(width / 2, height / 2);
        this.escapeContainer.setDepth(10000);
        this.escapeContainer.setScrollFactor(0);

        // Dark overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
        this.escapeContainer.add(overlay);

        // Prompt box
        const box = this.add.rectangle(0, 0, 500, 200, 0x1a1a2e, 1);
        box.setStrokeStyle(3, 0x4a90d9);
        this.escapeContainer.add(box);

        const title = this.add.text(0, -50, 'Leave Match?', {
            fontSize: '36px', color: '#ffffff', fontFamily: '"Pixeloid Sans"', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.escapeContainer.add(title);

        const yesBtn = this.add.text(-80, 40, 'YES', {
            fontSize: '28px', color: '#ff4444', fontFamily: '"Pixeloid Sans"', fontStyle: 'bold',
            backgroundColor: '#333333', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        yesBtn.on('pointerdown', () => this.confirmEscape());
        this.escapeContainer.add(yesBtn);

        const noBtn = this.add.text(80, 40, 'NO', {
            fontSize: '28px', color: '#00ff00', fontFamily: '"Pixeloid Sans"', fontStyle: 'bold',
            backgroundColor: '#333333', padding: { x: 20, y: 8 }
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        noBtn.on('pointerdown', () => this.dismissEscapePrompt());
        this.escapeContainer.add(noBtn);

        // Keyboard shortcuts: Y = yes, N or ESC again = no
        this.input.keyboard?.once('keydown-Y', () => {
            if (this.escapePromptVisible) this.confirmEscape();
        });
        this.input.keyboard?.once('keydown-N', () => {
            if (this.escapePromptVisible) this.dismissEscapePrompt();
        });

        // Make main camera ignore prompt
        this.cameras.main.ignore(this.escapeContainer);
    }

    private dismissEscapePrompt(): void {
        if (!this.escapePromptVisible) return;
        this.escapePromptVisible = false;
        this.escapeContainer?.destroy();
    }

    private confirmEscape(): void {
        this.escapePromptVisible = false;
        this.escapeContainer?.destroy();
        this.networkManager.disconnect();
        this.scene.start('MainMenuScene');
    }

    /**
     * Dynamic camera that follows all players
     */
    private updateCamera(): void {
        const targets: Phaser.GameObjects.Components.Transform[] = [];

        this.players.forEach((player) => {
            if (!player.active) return; // Ignore inactive (dead/waiting respawn) players
            // Check bounds to filter out dying players
            if (player.x > this.BLAST_ZONE_LEFT + 50 &&
                player.x < this.BLAST_ZONE_RIGHT - 50 &&
                player.y < this.BLAST_ZONE_BOTTOM - 50 &&
                player.y > this.BLAST_ZONE_TOP + 50) {
                targets.push(player);
            }
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

    /**
     * Phaser lifecycle: Called when scene is stopped or destroyed.
     * Ensures all socket listeners and game objects are cleaned up.
     */
    shutdown(): void {
        // Disconnect from server (removes socket listeners)
        this.networkManager.disconnect();

        // Destroy all player instances
        this.players.forEach(player => player.destroy());
        this.players.clear();
        this.remoteTargets.clear();
        this.snapshotBuffer.clear();

        // Clear HUD
        if (this.matchHUD) {
            this.matchHUD.destroy();
        }

        // Destroy escape prompt if open
        this.escapePromptVisible = false;
        this.escapeContainer?.destroy();

        // Destroy game over UI
        this.gameOverContainer?.destroy();

        // Destroy selection UI
        this.selectionContainer?.destroy();

        // Destroy connection status
        this.connectionStatusText?.destroy();
        this.connectionStatusText = null as any;

        // Remove ALL keyboard listeners (prevents stacking on re-entry)
        this.input.keyboard?.removeAllListeners();

        // Remove all time events
        this.time.removeAllEvents();

        // Reset phase
        this.phase = 'WAITING';
        this.isConnected = false;
        this.isConfirmed = false;
    }

    private checkGamepadSelect(): boolean {
        const gamepads = navigator.getGamepads();
        let currentSelectPressed = false;

        for (let i = 0; i < gamepads.length; i++) {
            const gamepad = gamepads[i];
            if (gamepad) {
                // Button 8 is SELECT/BACK/VIEW on standard gamepads
                currentSelectPressed = gamepad.buttons[8]?.pressed || false;
                break;
            }
        }

        const justPressed = currentSelectPressed && !this.previousSelectPressed;
        this.previousSelectPressed = currentSelectPressed;
        return justPressed;
    }
}
