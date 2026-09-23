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
import { EffectManager } from '../effects/EffectManager';
import { getMenuNavX, getConfirmButtonIndex } from '../input/JoyConMapper';
import Phaser from 'phaser';
import { Player, PlayerState } from '../entities/Player';

import { Chest } from '../entities/Chest';
import NetworkManager from '../network/NetworkManager';
import type { NetGameState, NetPlayerState, NetAttackEvent, NetHitEvent } from '../network/NetworkManager';
import { AnimationHelpers } from '../managers/AnimationHelpers';
import { AudioManager } from '../managers/AudioManager';
import { MapConfig, ZOOM_SETTINGS } from '../config/MapConfig';
import type { ZoomLevel } from '../config/MapConfig';
import { ALL_CHARACTERS } from '../config/CharacterConfig';
import { createStage as createSharedStage } from '../stages/StageFactory';
import type { StageResult } from '../stages/StageFactory';

import { InputManager, type InputState } from '../input/InputManager';
import { RollbackBuffer } from '../network/StateSnapshot';
import {
    encodeInputMask, decodeInputMask, toSimInput,
    EMPTY_PLAYER_INPUT, type FullPlayerInput
} from '../../shared/NetworkProtocol';
import {
    stepPhysics, checkPlatformCollisions, checkWallCollisions,
    type SimInput
} from '../../shared/PhysicsSimulation';
import { ADRIA_STAGE } from '../../shared/StageData';
import { MatchHUD, SMASH_COLORS } from '../ui/PlayerHUD';
import { DebugOverlay } from '../components/DebugOverlay';
import { ControlsOverlay } from '../components/ControlsOverlay';
import { TouchController } from '../components/TouchController';

import type { GameSceneInterface } from './GameSceneInterface';

function inputStateToFullPlayerInput(state: InputState, dst?: FullPlayerInput): FullPlayerInput {
    const target = dst || { ...EMPTY_PLAYER_INPUT };
    target.moveLeft = state.moveLeft;
    target.moveRight = state.moveRight;
    target.moveUp = state.moveUp;
    target.moveDown = state.moveDown;
    target.jumpBuffered = state.jump;
    target.jumpHeld = state.jumpHeld;
    target.lightAttack = state.lightAttack;
    target.lightAttackHeld = state.lightAttackHeld;
    target.heavyAttack = state.heavyAttack;
    target.heavyAttackHeld = state.heavyAttackHeld;
    target.dodgeBuffered = state.dodge;
    target.dodgeHeld = state.dodgeHeld;
    target.aimUp = state.aimUp;
    target.aimDown = state.aimDown;
    target.recoveryRequested = state.recovery;
    target.taunt = state.taunt;
    return target;
}

function fullPlayerInputToInputState(input: FullPlayerInput, dst?: InputState): InputState {
    const target = dst || {
        moveLeft: false, moveRight: false, moveUp: false, moveDown: false,
        moveX: 0, moveY: 0,
        jump: false, jumpHeld: false,
        lightAttack: false, lightAttackHeld: false,
        heavyAttack: false, heavyAttackHeld: false,
        dodge: false, dodgeHeld: false,
        recovery: false, taunt: false, defeat: false,
        aimUp: false, aimDown: false, aimLeft: false, aimRight: false,
        usingGamepad: false
    };
    target.moveLeft = input.moveLeft;
    target.moveRight = input.moveRight;
    target.moveUp = input.moveUp;
    target.moveDown = input.moveDown;
    target.moveX = input.moveLeft ? -1 : (input.moveRight ? 1 : 0);
    target.moveY = input.moveUp ? -1 : (input.moveDown ? 1 : 0);
    target.jump = input.jumpBuffered;
    target.jumpHeld = input.jumpHeld;
    target.lightAttack = input.lightAttack;
    target.lightAttackHeld = input.lightAttackHeld;
    target.heavyAttack = input.heavyAttack;
    target.heavyAttackHeld = input.heavyAttackHeld;
    target.dodge = input.dodgeBuffered;
    target.dodgeHeld = input.dodgeHeld;
    target.recovery = input.recoveryRequested;
    target.taunt = input.taunt;
    target.aimUp = input.aimUp;
    target.aimDown = input.aimDown;
    target.aimLeft = input.moveLeft;
    target.aimRight = input.moveRight;
    return target;
}

export class OnlineGameScene extends Phaser.Scene implements GameSceneInterface {
    // Networking
    private networkManager: NetworkManager;
    private localPlayerId: number = -1;
    private isConnected: boolean = false;

    private players: Map<number, Player> = new Map();
    private localPlayer: Player | null = null;
    private remotePlayer: Player | null = null;

    // Input
    private inputManager!: InputManager;
    private touchController!: TouchController;

    // Stage
    private platforms: Phaser.GameObjects.Rectangle[] = [];
    private softPlatforms: Phaser.GameObjects.Rectangle[] = [];
    private sidePlatforms: Phaser.GameObjects.Rectangle[] = [];

    public chests!: Phaser.GameObjects.Group;

    // UI
    private connectionStatusText!: Phaser.GameObjects.Text;
    private connectionStatusBg!: Phaser.GameObjects.Rectangle;
    private matchHUD!: MatchHUD;

    // Rollback Netcode System
    private rollbackBuffer: RollbackBuffer = new RollbackBuffer(128);
    private currentSimFrame: number = 0;
    private lastConfirmedRemoteFrame: number = 0;
    private lastRemoteInputMask: number = 0;
    private localInputHistory: number[] = [0, 0, 0]; // [maskN, maskN-1, maskN-2]
    private stateThrottleCounter: number = 0;

    // Zero-allocation pre-allocated scratch objects for simulation & conversion
    private tempLocalSimInput: SimInput = {
        moveLeft: false, moveRight: false, moveUp: false, moveDown: false,
        jumpBuffered: false, jumpHeld: false, dodgeBuffered: false,
        aimUp: false, aimDown: false, recoveryRequested: false
    };
    private tempRemoteSimInput: SimInput = {
        moveLeft: false, moveRight: false, moveUp: false, moveDown: false,
        jumpBuffered: false, jumpHeld: false, dodgeBuffered: false,
        aimUp: false, aimDown: false, recoveryRequested: false
    };
    private tempFullInput1: FullPlayerInput = { ...EMPTY_PLAYER_INPUT };
    private tempFullInput2: FullPlayerInput = { ...EMPTY_PLAYER_INPUT };
    private tempRemoteInputState: InputState = {
        moveLeft: false, moveRight: false, moveUp: false, moveDown: false,
        moveX: 0, moveY: 0,
        jump: false, jumpHeld: false,
        lightAttack: false, lightAttackHeld: false,
        heavyAttack: false, heavyAttackHeld: false,
        dodge: false, dodgeHeld: false,
        recovery: false, taunt: false, defeat: false,
        aimUp: false, aimDown: false, aimLeft: false, aimRight: false,
        usingGamepad: false
    };

    // Selection UI Visuals
    private playerSelectionSprites: Map<number, Phaser.GameObjects.Sprite> = new Map();
    private playerSelectionTexts: Map<number, Phaser.GameObjects.Text> = new Map();
    private playerConfirmTexts: Map<number, Phaser.GameObjects.Text> = new Map();

    // Remote player target state for smooth interpolation
    private remoteTargets: Map<number, NetPlayerState> = new Map();
    private playerCharacters: Map<number, string> = new Map(); // Store character selections
    private confirmedPlayers: Set<number> = new Set();

    public walls: Phaser.Geom.Rectangle[] = [];

    // Camera Settings
    private currentZoomLevel: ZoomLevel = 'CLOSE';

    // UI Camera
    public uiCamera!: Phaser.Cameras.Scene2D.Camera;

    // Debug Overlay
    private debugOverlay!: DebugOverlay;
    private controlsOverlay!: ControlsOverlay;
    private debugVisible: boolean = false;
    private debugToggleKey!: Phaser.Input.Keyboard.Key;
    private previousSelectPressed: boolean = false;

    // Game Over State
    private isGameOver: boolean = false;
    private gameOverContainer!: Phaser.GameObjects.Container;

    // Effects
    public effectManager!: EffectManager;

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
    private selectedCharacter: string = 'fok';
    // Character Selection
    private availableCharacters: string[] = ['fok', 'sgu', 'sga', 'pe', 'nock', 'greg'];
    private selectedCharIndex: number = 0;

    // Selection UI Elements
    private selectionContainer!: Phaser.GameObjects.Container;
    private countdownText!: Phaser.GameObjects.Text;
    // Maps defined above replace individual text fields

    constructor() {
        super({ key: 'OnlineGameScene' });
        this.networkManager = NetworkManager.getInstance();
    }

    public getPlayers(): Player[] {
        return Array.from(this.players.values());
    }

    public getThrowableChests(): Chest[] {
        return (this.chests.getChildren() as Chest[]).filter(
            chest => chest.active && chest.isBombMode && !chest.isExploded
        );
    }

    preload(): void {
        AnimationHelpers.loadCharacterAssets(this);
        AnimationHelpers.loadCommonAssets(this);
        AnimationHelpers.loadUIAudio(this);

        this.load.on('loaderror', (file: { src: string }) => {
            console.error('Asset load failed:', file.src);
        });
    }

    private createAnimations(): void {
        AnimationHelpers.createAnimations(this);
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
        this.networkManager.onBinaryInput((packet) => this.handleRemoteBinaryInput(packet));
        this.networkManager.onDisconnect(() => this.handleDisconnect());
        this.networkManager.onChargeStart((playerId, _dir) => {
            const player = this.players.get(playerId);
            if (player && player !== this.localPlayer) {
                // Remote charge visual/sfx handled by state machine or specific trigger
            }
        });

        this.networkManager.onGroundPoundLand((playerId) => {
            if (playerId === this.localPlayerId) return;
            const player = this.players.get(playerId);
            if (player) {
                this.sound.play('sfx_landing', { volume: 0.8 });
                this.sound.play('sfx_chest_drop', { volume: 0.5 });
            }
        });
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
        this.networkManager.onChestOpen((imageIndex, chestX, chestY) => this.handleRemoteChestOpen(imageIndex, chestX, chestY));
        this.networkManager.onChestClose(() => this.handleRemoteChestClose());

        // Silence unused but maintained state
        void this.selectionCountdown;


        // Setup escape key immediately so user can exit at any point
        this.setupEscapeKey();

        // Initialize fast with Black Screen + Loading Text (User Request)
        this.cameras.main.setBackgroundColor('#000000');
        this.showConnectionStatus('Connecting to server...');

        // Try to connect
        const connected = await this.networkManager.connect();

        if (!connected) {
            this.showConnectionStatus('Connection Failed.\nPress ESC or (B) to return.');
            return;
        }

        this.isConnected = true;
        this.localPlayerId = this.networkManager.getLocalPlayerId();
        this.phase = 'WAITING';
        this.showConnectionStatus(`Connected as Player ${this.localPlayerId + 1}. Waiting for opponent...`);
        // Setup stage (but don't spawn players yet)
        this.createStage();

        this.cameras.main.setBackgroundColor('#99d7f0');

        // Note: createStage() calls configureCameraExclusions, which now ignores waterOverlay on uiCamera.

        // Initialize HUD
        this.matchHUD = new MatchHUD(this);
        this.matchHUD.addToCameraIgnore(this.cameras.main);

        // Touch Controller Overlay
        this.touchController = new TouchController(this);
        if (this.uiCamera) {
            this.touchController.setCameraIgnore(this.cameras.main, this.uiCamera);
        }

        // Debug Overlay (minimal: FPS + Ping only for online)
        this.debugOverlay = new DebugOverlay(this);
        this.debugOverlay.setCameraIgnore(this.cameras.main);
        this.debugOverlay.setMinimalMode(true);

        // F1 Controls Overlay
        this.controlsOverlay = new ControlsOverlay(this);
        this.cameras.main.ignore(this.controlsOverlay.getElements());

        // Listen for chest close        // Chest Interaction (attack near chest to open)
        this.events.on('chest_close_local', () => {
            this.networkManager.sendChestClose();
        });

        // --- Chest Bomb Mode ---
        this.events.on('bomb_pickup', (chest: Chest) => {
            if (chest.isBombMode && !chest.isExploded) {
                this.networkManager.sendChestBombPickup(this.localPlayerId);
            }
        });

        this.events.on('bomb_throw', (player: Player, x: number, y: number, vx: number, vy: number, power: number) => {
            if (player.playerId === this.localPlayerId) {
                this.networkManager.sendChestBombThrow(this.localPlayerId, x, y, vx, vy, power);
            }
        });

        this.events.on('bomb_explode', (x: number, y: number) => {
            // Only sender determines explosion to prevent double messages, OR if it's our bomb
            const localChest = (this.chests.getChildren() as Chest[]).find(c => c.isBombMode && c.isExploded && c.x === x && c.y === y);
            if (localChest) {
                this.networkManager.sendChestBombExplode(x, y);
            }
        });

        // --- Missing Ghost Visuals ---
        this.events.on('recovery_start', (player: Player) => {
            if (player.playerId === this.localPlayerId) {
                this.networkManager.sendRecoveryStart(this.localPlayerId);
            }
        });

        this.events.on('charge_start', (player: Player, direction: number) => {
            if (player.playerId === this.localPlayerId) {
                this.networkManager.sendChargeStart(this.localPlayerId, direction);
            }
        });

        // ==========================================
        //  INBOUND NETWORK (Receive)
        // ==========================================
        // --- Missing Ghost Visuals ---
        this.networkManager.onRecoveryStart((playerId: number) => {
            const remotePlayer = this.players.get(playerId);
            if (!remotePlayer || remotePlayer.playerId === this.localPlayerId) return;
            remotePlayer.physics.spawnRecoveryGhost();
        });

        this.networkManager.onChargeStart((playerId: number, direction: number) => {
            const remotePlayer = this.players.get(playerId);
            if (!remotePlayer || remotePlayer.playerId === this.localPlayerId) return;
            remotePlayer.combat.startRemoteCharge(direction as any);
        });

        this.networkManager.onChestBombPickup((playerId: number) => {
            const remotePlayer = this.players.get(playerId);
            if (!remotePlayer || remotePlayer === this.localPlayer) return;

            // Find the active bomb-mode chest
            const chest = (this.chests.getChildren() as Chest[]).find(
                c => c.active && c.isBombMode && !c.isExploded
            );
            if (chest) {
                remotePlayer.pickupItem(chest);
            }
        });

        this.networkManager.onChestBombThrow((playerId: number, x: number, y: number, vx: number, vy: number, power: number) => {
            const remotePlayer = this.players.get(playerId);
            if (!remotePlayer || remotePlayer === this.localPlayer) return;

            // Find the chest this player is holding
            if (remotePlayer.heldItem) {
                const bomb = remotePlayer.heldItem;
                // Snap position to the synced coordinates
                bomb.setPosition(x, y);
                remotePlayer.throwItem(vx, vy);
                if (bomb.onThrown) {
                    bomb.onThrown(remotePlayer, power);
                }
            }
        });

        this.networkManager.onChestBombExplode((x: number, y: number) => {
            // Find the active bomb-mode chest and force-explode it at the synced position
            const chest = (this.chests.getChildren() as Chest[]).find(
                c => c.active && c.isBombMode && !c.isExploded
            );
            if (chest) {
                chest.setPosition(x, y);
                chest.explode();
            }
        });

        // Debug Toggle Key
        this.debugToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);




        // Initialize EffectManager
        this.effectManager = new EffectManager(this);

        // Initialize Chests Group
        this.chests = this.add.group({
            classType: Chest,
            runChildUpdate: true,
            maxSize: 10
        });

        // Setup input (local player only)
        this.inputManager = new InputManager(this, {
            playerId: this.localPlayerId,
            useKeyboard: true,
            gamepadIndex: 0,
            enableGamepad: true
        }, this.touchController);

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
        // Poll LB for controls overlay toggle if instantiated
        if (this.controlsOverlay) {
            this.controlsOverlay.update();
        }

        if (!this.isConnected) {
            // Check gamepad B / Start / Select to return to menu if connection failed or waiting
            const gamepads = navigator.getGamepads();
            for (let i = 0; i < gamepads.length; i++) {
                const pad = gamepads[i];
                if (pad) {
                    if (pad.buttons[1]?.pressed || pad.buttons[9]?.pressed || pad.buttons[8]?.pressed) {
                        this.scene.start('MainMenuScene');
                        return;
                    }
                }
            }
            return;
        }

        // Handle selection phase input
        if (this.phase === 'SELECTING') {
            this.pollSelectionInput();
            return;
        }

        // Stop updates if game over
        if (this.isGameOver) {
            // Poll gamepad for menu navigation
            this.pollGamepadForMenu();
            this.players.forEach(p => p.updateVisuals(delta));
            return;
        }

        // Only run game loop in PLAYING phase
        if (this.phase !== 'PLAYING') return;

        // Ensure players are assigned
        if (!this.localPlayer || !this.remotePlayer) {
            if (!this.remotePlayer) {
                this.remotePlayer = Array.from(this.players.values()).find(p => p !== this.localPlayer) || null;
                if (this.remotePlayer) {
                    this.remotePlayer.useExternalInput = true;
                }
            }
            if (!this.localPlayer || !this.remotePlayer) return;
        }

        const frame = this.currentSimFrame;

        // 1. Poll and map local input (0ms delay!)
        const input = this.inputManager.poll();

        // If escape prompt is open, steal input for menu navigation
        if (this.escapePromptVisible) {
            const now = this.time.now;
            // 200ms debounce
            if (now - this.lastEscapeInputTime > 200) {
                if (input.moveLeft) {
                    this.escapeSelectedIndex = 0; // YES
                    this.updateEscapePromptSelection();
                    this.lastEscapeInputTime = now;
                } else if (input.moveRight) {
                    this.escapeSelectedIndex = 1; // NO
                    this.updateEscapePromptSelection();
                    this.lastEscapeInputTime = now;
                } else if (input.jump || input.lightAttack || input.heavyAttack) {
                    this.lastEscapeInputTime = now;
                    if (this.escapeSelectedIndex === 0) {
                        this.confirmEscape();
                    } else {
                        this.dismissEscapePrompt();
                    }
                }
            }
            return; // Block game input while prompt is open
        }

        // Convert local input to 16-bit bitmask
        inputStateToFullPlayerInput(input, this.tempFullInput1);
        const localMask = encodeInputMask(this.tempFullInput1);

        // Update 3-frame redundancy
        this.localInputHistory[2] = this.localInputHistory[1];
        this.localInputHistory[1] = this.localInputHistory[0];
        this.localInputHistory[0] = localMask;

        // 2. Transmit compact binary packet over Geckos
        this.networkManager.sendBinaryInput(frame, this.localInputHistory[0], this.localInputHistory[1], this.localInputHistory[2]);

        // 3. Predict remote input for frame (input repetition / zero-order hold)
        const predictedRemoteMask = this.lastRemoteInputMask;
        decodeInputMask(predictedRemoteMask, this.tempFullInput2);
        toSimInput(this.tempFullInput2, this.tempRemoteSimInput);
        fullPlayerInputToInputState(this.tempFullInput2, this.tempRemoteInputState);

        // 4. Save state snapshot at frame before advancing
        this.rollbackBuffer.saveFrame(
            frame,
            this.localPlayer.physics.body,
            this.remotePlayer.physics.body,
            localMask,
            predictedRemoteMask,
            true
        );

        // 5. Apply inputs and step physics & logic forward
        this.localPlayer.setInput(input);
        this.remotePlayer.setInput(this.tempRemoteInputState);

        this.localPlayer.updatePhysics(delta);
        this.platforms.forEach(platform => this.localPlayer!.checkPlatformCollision(platform, false));
        this.sidePlatforms.forEach(platform => this.localPlayer!.checkPlatformCollision(platform, false));
        this.softPlatforms.forEach(platform => this.localPlayer!.checkPlatformCollision(platform, true));
        this.localPlayer.checkWallCollision(this.walls);
        this.localPlayer.updateLogic(delta);

        this.remotePlayer.updatePhysics(delta);
        this.platforms.forEach(platform => this.remotePlayer!.checkPlatformCollision(platform, false));
        this.sidePlatforms.forEach(platform => this.remotePlayer!.checkPlatformCollision(platform, false));
        this.softPlatforms.forEach(platform => this.remotePlayer!.checkPlatformCollision(platform, true));
        this.remotePlayer.checkWallCollision(this.walls);
        this.remotePlayer.updateLogic(delta);
        this.remotePlayer.updateVisuals(delta);

        // 6. Blast zone check
        this.checkBlastZone(this.localPlayer);
        this.checkBlastZone(this.remotePlayer);

        // 7. Hit detection
        this.localPlayer.checkHitAgainst(this.remotePlayer);
        this.remotePlayer.checkHitAgainst(this.localPlayer);

        // 8. Chest interactions
        this.checkChestInteractions();

        // 9. Low-frequency stats heartbeat to server (every 6th frame = ~10Hz)
        this.stateThrottleCounter++;
        if (this.stateThrottleCounter >= 6) {
            this.stateThrottleCounter = 0;
            this.networkManager.sendState({
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
            });
        }

        // Advance simulation frame
        this.currentSimFrame++;

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
            // Online: minimal mode — no hitbox/collision debug visuals
        }

        if (this.debugVisible && this.localPlayer) {
            const velocity = this.localPlayer.getVelocity();
            const currentAttack = this.localPlayer.getCurrentAttack();
            const attackInfo = currentAttack
                ? `${currentAttack.data.type} ${currentAttack.data.direction} (${currentAttack.phase})`
                : 'None'; // Ensure attackInfo is always defined

            this.debugOverlay.update(
                velocity.x,
                velocity.y,
                this.localPlayer.getState(), // Assuming getState() returns the state string
                this.localPlayer.getRecoveryAvailable(),
                attackInfo,
                this.localPlayer.isGamepadConnected(),
                this.networkManager.getLatency()
            );
        } else {
            // Ensure hidden if toggled off
            this.debugOverlay.setVisible(false);
        }

        // Dynamic Camera
        this.updateCamera();

        // Check for Game Over
        this.checkGameOver();
    }

    /**
     * Inbound Binary Input: Process remote player's real inputs.
     * If a misprediction occurred within the ring buffer window, trigger GGPO Rollback.
     */
    private handleRemoteBinaryInput(packet: { frame: number; maskN: number; maskN1: number; maskN2: number }): void {
        if (this.phase !== 'PLAYING' || !this.localPlayer || !this.remotePlayer) return;

        const { frame, maskN, maskN1, maskN2 } = packet;

        // Process redundant inputs in chronological order: frame-2, frame-1, frame
        const frames = [frame - 2, frame - 1, frame];
        const masks = [maskN2, maskN1, maskN];

        let earliestMisprediction = -1;

        for (let i = 0; i < 3; i++) {
            const f = frames[i];
            const mask = masks[i];
            if (f < 0 || f > this.currentSimFrame) continue;

            const slot = this.rollbackBuffer.getFrame(f);
            if (slot) {
                if (slot.remotePredicted && slot.remoteInputMask !== mask) {
                    if (earliestMisprediction === -1 || f < earliestMisprediction) {
                        earliestMisprediction = f;
                    }
                }
                slot.remoteInputMask = mask;
                slot.remotePredicted = false;
            }

            if (f >= this.lastConfirmedRemoteFrame) {
                this.lastConfirmedRemoteFrame = f;
                this.lastRemoteInputMask = mask;
            }
        }

        if (earliestMisprediction !== -1) {
            this.performRollback(earliestMisprediction);
        }
    }

    /**
     * GGPO Rollback Engine:
     * Restores state from frame `fromFrame` and re-simulates forward to `currentSimFrame`.
     * Zero allocations, deterministic pure-math execution (<0.05ms).
     */
    private performRollback(fromFrame: number): void {
        if (!this.localPlayer || !this.remotePlayer) return;

        const localBody = this.localPlayer.physics.body;
        const remoteBody = this.remotePlayer.physics.body;

        // 1. Restore simulation state at fromFrame
        const restored = this.rollbackBuffer.restoreFrame(fromFrame, localBody, remoteBody);
        if (!restored) {
            return;
        }

        const DT = 1 / 60;

        // 2. Resimulate all frames from fromFrame up to currentSimFrame - 1
        for (let f = fromFrame; f < this.currentSimFrame; f++) {
            const slot = this.rollbackBuffer.getFrame(f);
            const localMask = slot ? slot.localInputMask : 0;
            const remoteMask = slot ? slot.remoteInputMask : this.lastRemoteInputMask;
            const isPredicted = slot ? slot.remotePredicted : true;

            decodeInputMask(localMask, this.tempFullInput1);
            toSimInput(this.tempFullInput1, this.tempLocalSimInput);

            decodeInputMask(remoteMask, this.tempFullInput2);
            toSimInput(this.tempFullInput2, this.tempRemoteSimInput);

            // Step local body physics
            stepPhysics(localBody, this.tempLocalSimInput, DT);
            checkPlatformCollisions(localBody, ADRIA_STAGE);
            checkWallCollisions(localBody, ADRIA_STAGE);

            // Step remote body physics
            stepPhysics(remoteBody, this.tempRemoteSimInput, DT);
            checkPlatformCollisions(remoteBody, ADRIA_STAGE);
            checkWallCollisions(remoteBody, ADRIA_STAGE);

            // Save re-simulated frame
            this.rollbackBuffer.saveFrame(
                f + 1,
                localBody,
                remoteBody,
                localMask,
                remoteMask,
                isPredicted
            );
        }

        // 3. Resync Phaser player visual transforms from bodies
        this.localPlayer.physics.syncFromBody();
        this.remotePlayer.physics.syncFromBody();
    }

    private handleStateUpdate(state: NetGameState): void {
        this.processStateUpdate(state);
    }

    private processStateUpdate(state: NetGameState): void {
        if (this.phase !== 'PLAYING') return;

        state.players.forEach((netPlayer: NetPlayerState) => {
            let player = this.players.get(netPlayer.playerId);

            // Create player if late-spawning
            if (!player) {
                const char = this.playerCharacters.get(netPlayer.playerId) || 'fok';
                player = this.createPlayer(netPlayer.playerId, netPlayer.x, netPlayer.y, char);
                this.players.set(netPlayer.playerId, player);

                if (netPlayer.playerId === this.localPlayerId) {
                    this.localPlayer = player;
                } else {
                    this.remotePlayer = player;
                    player.useExternalInput = true;
                }

                if (this.matchHUD) {
                    const isLocal = netPlayer.playerId === this.localPlayerId;
                    const character = this.playerCharacters.get(netPlayer.playerId) || 'fok';
                    this.matchHUD.addPlayer(netPlayer.playerId, `Player ${netPlayer.playerId + 1}`, isLocal, character);
                }
            }

            // Sync match stats (stateless: score, lives, damage)
            if (typeof netPlayer.lives === 'number' && player.lives !== netPlayer.lives) {
                if (netPlayer.lives < player.lives && netPlayer.playerId !== this.localPlayerId) {
                    AudioManager.getInstance().playSFX('sfx_death', { volume: 0.8 });
                    if (Math.random() > 0.5) {
                        AudioManager.getInstance().playSFX('sfx_death_crowd_1', { volume: 0.5 });
                    } else {
                        AudioManager.getInstance().playSFX('sfx_death_crowd_2', { volume: 0.5 });
                    }
                    this.cameras.main.shake(300, 0.02);
                }
                player.lives = netPlayer.lives;
            }
            if (typeof netPlayer.damagePercent === 'number') {
                player.setDamage(netPlayer.damagePercent);
            }
        });
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
        const chest = this.chests.get(x, y) as Chest;
        if (chest) {
            chest.enable(x, y);
            if (this.uiCamera) {
                this.uiCamera.ignore(chest);
            }
        }
    }

    /**
     * Handle remote chest open sync
     */
    private handleRemoteChestOpen(imageIndex: number, chestX: number, chestY: number): void {
        const chest = this.chests.getFirstAlive() as Chest; // Assume 1 chest for now
        if (chest && !chest.isOpened) {
            // Snap chest to the synced position to fix physics divergence
            chest.setPosition(chestX, chestY);
            chest.setVelocity(0, 0);
            chest.open(imageIndex);
        }
    }

    /**
     * Handle remote chest close sync
     */
    private handleRemoteChestClose(): void {
        const chest = this.chests.getFirstAlive() as Chest;
        if (chest && chest.isOverlayOpen) {
            chest.forceCloseOverlay();
        }
    }

    /**
     * Check if any attacking player is near a chest and open it
     */
    private checkChestInteractions(): void {
        if (!this.chests || this.chests.getLength() === 0) return;

        const interactRange = 120;
        const player = this.localPlayer;

        if (!player || !player.isAttacking) return;

        for (const chest of (this.chests.getChildren() as Chest[])) {
            if (!chest.isOpened) {
                const dist = Phaser.Math.Distance.Between(player.x, player.y, chest.x, chest.y);
                if (dist < interactRange) {
                    // Local player initiated open.
                    const imageIndex = chest.open();
                    // Tell the server this local player opened it, with the specific image chosen.
                    if (imageIndex !== undefined) {
                        this.networkManager.sendChestOpen(imageIndex, chest.x, chest.y);
                    }
                }
            }
            // No punch logic — matches offline GameScene exactly.
            // After opening, the chest goes into bomb mode when the UI is closed.
        }
    }

    /**
     * Check if player is outside blast zones and respawn if so
     */
    private checkBlastZone(player: Player): void {
        if (!player.active || player.isRespawning) return;

        // ONLY Local player logic determines death for self (Client Authoritative)
        const isLocal = player === this.localPlayer;
        if (!isLocal) return;

        // Check bounds
        const bounds = player.getBounds();
        if (bounds.left < MapConfig.BLAST_ZONE_LEFT ||
            bounds.right > MapConfig.BLAST_ZONE_RIGHT ||
            bounds.top < MapConfig.BLAST_ZONE_TOP ||
            bounds.bottom > MapConfig.BLAST_ZONE_BOTTOM) {

            // Score update (lives)
            player.lives = Math.max(0, player.lives - 1);

            // IMPACT POLISH (Local only for shake, visual for all? Actually local visual is fine for now)
            // Ideally we broadcast this event, but for now client-side prediction visual is okay.
            this.cameras.main.shake(300, 0.02);
            AudioManager.getInstance().playSFX('sfx_death', { volume: 0.8 });
            if (Math.random() > 0.5) {
                AudioManager.getInstance().playSFX('sfx_death_crowd_1', { volume: 0.5 });
            } else {
                AudioManager.getInstance().playSFX('sfx_death_crowd_2', { volume: 0.5 });
            }

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

        // Respawn position - Center them safely
        // Center is 960. We'll add a slight random offset
        const offsetX = Phaser.Math.Between(-50, 50);
        const spawn = { x: 960 + offsetX, y: 200 };

        player.setPosition(spawn.x, 300);

        // Grant invulnerability
        player.isRespawning = true;
        this.time.delayedCall(1500, () => {
            player.isRespawning = false;
        });

        // Re-add body if removed (critical for physics to resume)
        if (player.body) {
            if (!this.matter.world.has(player.body as MatterJS.BodyType)) {
                this.matter.world.add(player.body as MatterJS.BodyType);
            }
            this.matter.body.setPosition(player.body as MatterJS.BodyType, { x: spawn.x, y: 300 });
            this.matter.body.setVelocity(player.body as MatterJS.BodyType, { x: 0, y: 0 });
            this.matter.body.setAngle(player.body as MatterJS.BodyType, 0);
            this.matter.body.setAngularVelocity(player.body as MatterJS.BodyType, 0);
        }

        player.physics.reset();
        player.setState(PlayerState.AIRBORNE);
        player.setDamage(0);
        player.isWinner = false;
        player.fsm.changeState('Idle', player);
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
        if (this.players.size < 2 && this.currentSimFrame < 600) return; // Allow 10s for connections? Or just check if we ever had >1.
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
        this.cameras.main.ignore(this.gameOverContainer); // Ensure UI doesn't zoom with the game world

        let winnerText = "GAME!";
        if (winnerId >= 0) {
            AudioManager.getInstance().playSFX('sfx_knockout', { volume: 0.8 });
            winnerText += `\nPLAYER ${winnerId + 1} HA ARATO!`; // Custom Text

            // ZOOM LOGIC for Online
            // Find the winning player sprite
            // Players are in this.players (Map<string, Player> where key is sessionId? NO, it's a Map<string, Player>)
            // We need to find the player by ID.
            let winner: Player | undefined;
            // Iterate map values
            for (const p of this.players.values()) {
                if ((p as any).playerId === winnerId) {
                    winner = p;
                    break;
                }
            }

            if (winner) {
                winner.isWinner = true;
                winner.fsm.changeState('Win', winner); // Auto-taunt on victory
                this.cameras.main.pan(winner.x, winner.y, 1500, 'Power2');
                this.cameras.main.zoomTo(3.5, 1500, 'Power2');
            }

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

            // Use JoyConMapper for navigation (handles rotated axes for sideways Joy-Cons)
            const navX = getMenuNavX(gamepad);

            if (now - this.lastGamepadNavTime > NAV_COOLDOWN) {
                if (navX < 0) {
                    this.navigateMenu(-1);
                    this.lastGamepadNavTime = now;
                } else if (navX > 0) {
                    this.navigateMenu(1);
                    this.lastGamepadNavTime = now;
                }
            }

            // Confirm button (A or Start) — uses JoyConMapper
            const confirmIdx = getConfirmButtonIndex(gamepad);
            const aButton = gamepad.buttons[confirmIdx]?.pressed || false;
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
        this.rollbackBuffer.clear();
        this.currentSimFrame = 0;
        this.lastConfirmedRemoteFrame = 0;
        this.lastRemoteInputMask = 0;
        this.localInputHistory.fill(0);

        // Reset all players
        this.players.forEach((player, playerId) => {
            player.setActive(true);
            player.setVisible(true);
            player.lives = 3;
            player.setDamage(0);
            player.velocity.x = 0;
            player.velocity.y = 0;
            player.isWinner = false;
            player.fsm.changeState('Idle', player);

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

    private createPlayer(playerId: number, x: number, y: number, character: string): Player {
        const isLocal = playerId === this.localPlayerId;

        const player = new Player(this, x, y, {
            playerId: playerId,
            isAI: false,
            useKeyboard: isLocal,
            gamepadIndex: isLocal ? 0 : null, // All local players try to use index 0 (gated by focus)
            character: character
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

            player.onGroundPoundMiss = () => {
                this.networkManager.sendGroundPoundLand(player.playerId);
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
                this.scale.width, this.scale.height, 0x000000, 1.0 // Fully opaque
            ).setDepth(999);
            if (this.uiCamera) this.cameras.main.ignore(this.connectionStatusBg);
        }
        this.connectionStatusBg.setVisible(true);

        if (!this.connectionStatusText) {
            this.connectionStatusText = this.add.text(
                this.scale.width / 2,
                this.scale.height / 2,
                message,
                { fontSize: '32px', color: '#ffffff', fontFamily: '"Pixeloid Sans"', align: 'center' }
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

        // --- Dynamic Card Creation ---
        // Support up to 4 players
        const maxPlayers = 4;
        const cardWidth = 180;
        const cardHeight = 300;
        const cardY = -20;
        const spacing = 220;
        const totalWidth = (maxPlayers - 1) * spacing;
        const startX = -totalWidth / 2;

        // Clear existing maps
        this.playerSelectionSprites.clear();
        this.playerSelectionTexts.clear();
        this.playerConfirmTexts.clear();

        for (let i = 0; i < maxPlayers; i++) {
            const playerId = i;
            const x = startX + (i * spacing);

            // Determine color
            const colorIdx = playerId % this.PLAYER_COLORS.length;
            const color = this.PLAYER_COLORS[colorIdx];
            const colorHex = '#' + color.toString(16).padStart(6, '0');

            // Card Background (Gradient with Mask)
            const gradient = this.add.graphics();
            // Gradient: Top=Color, Bottom=Black. Alpha 0.2.
            gradient.fillGradientStyle(color, color, 0x000000, 0x000000, 0.2, 0.2, 0.2, 0.2);
            gradient.fillRect(x - cardWidth / 2, cardY - cardHeight / 2, cardWidth, cardHeight);

            // Mask for the gradient (Rounded Rect)
            const maskGraphics = this.make.graphics({});
            maskGraphics.fillStyle(0xffffff);
            // Mask coordinates must be absolute (Global Space)
            // Container is at (centerX, centerY). 'x' is relative. 'cardY' is relative.
            const absX = centerX + x;
            const absY = centerY + cardY;
            maskGraphics.fillRoundedRect(absX - cardWidth / 2, absY - cardHeight / 2, cardWidth, cardHeight, 16);
            gradient.setMask(maskGraphics.createGeometryMask());
            this.selectionContainer.add(gradient);

            // Card Border
            const card = this.add.graphics();
            card.lineStyle(3, color);
            // Keep the faint black tint behind to make text readable? 
            // User asked for "bottom black to Player's color". 
            // The gradient overlay does that. We can keep a base fill or remove it.
            // Let's keep a very base fill for readability if needed, or rely on the gradient.
            // User said "20% opacity". That's faint.
            // Let's add a solid black base at 0.4 to keep it distinct from the background, then the gradient on top.
            card.fillStyle(0x000000, 0.4);
            card.fillRoundedRect(x - cardWidth / 2, cardY - cardHeight / 2, cardWidth, cardHeight, 16);
            card.strokeRoundedRect(x - cardWidth / 2, cardY - cardHeight / 2, cardWidth, cardHeight, 16);
            this.selectionContainer.add(card);

            // Shadow (Circle under feet)
            // Sprite is at (x, -45). Assume feet at ~ +50y relative to sprite center?
            const shadow = this.add.ellipse(x, -45 + 55, 80, 20, 0x000000, 0.5);
            this.selectionContainer.add(shadow);

            // P# Label
            const label = this.add.text(x, 75, `P${playerId + 1}`, {
                fontSize: '20px',
                color: colorHex,
                fontFamily: '"Pixeloid Sans"'
            }).setOrigin(0.5);
            this.selectionContainer.add(label);

            // Character Name Text
            const charText = this.add.text(x, 105, '...', {
                fontSize: '24px',
                color: '#888888',
                fontStyle: 'bold',
                fontFamily: '"Pixeloid Sans"'
            }).setOrigin(0.5);
            this.playerSelectionTexts.set(playerId, charText);
            this.selectionContainer.add(charText);

            // Character Sprite
            // Create a sprite but update texture later. Default to 'fok' idle.
            const sprite = this.add.sprite(x, -45, 'fok', 'fok_idle_000');
            sprite.setScale(1);
            // Flip sprites on the right side if desired, or alternate.
            // Let's standardise: P2 and P4 face left.
            if (playerId % 2 !== 0) sprite.setFlipX(true);

            sprite.setVisible(false); // Hide until connected/selected
            this.playerSelectionSprites.set(playerId, sprite);
            this.selectionContainer.add(sprite);

            // Confirmation Text (Ready)
            const confirmText = this.add.text(x, -45, 'READY', {
                fontSize: '24px',
                color: '#00ff00',
                fontStyle: 'bold',
                backgroundColor: '#004400',
                fontFamily: '"Pixeloid Sans"'
            }).setOrigin(0.5).setVisible(false);
            this.playerConfirmTexts.set(playerId, confirmText);
            this.selectionContainer.add(confirmText);

            // Local Player Controls (Arrows)
            if (playerId === this.localPlayerId) {
                // Highlight local player
                card.lineStyle(5, color);
                card.strokeRoundedRect(x - cardWidth / 2, cardY - cardHeight / 2, cardWidth, cardHeight, 16);

                charText.setColor('#ffffff');
                sprite.setVisible(true);

                const leftArrow = this.add.text(x - 70, cardY, '◀', {
                    fontSize: '32px',
                    color: colorHex,
                    fontFamily: '"Pixeloid Sans"'
                }).setOrigin(0.5);
                this.selectionContainer.add(leftArrow);

                const rightArrow = this.add.text(x + 70, cardY, '▶', {
                    fontSize: '32px',
                    color: colorHex,
                    fontFamily: '"Pixeloid Sans"'
                }).setOrigin(0.5);
                this.selectionContainer.add(rightArrow);
            }
        }

        // Instructions
        const instr = this.add.text(0, 180, 'Waiting for players...', {
            fontSize: '20px',
            color: '#aaaaaa',
            fontFamily: '"Pixeloid Sans"'
        }).setOrigin(0.5);
        this.selectionContainer.add(instr);


        // Make UI camera render this on top
        if (this.uiCamera) {
            this.cameras.main.ignore(this.selectionContainer);
        }

        // Ensure visuals are updated initially
        this.updateSelectionVisuals();
    }


    private updateSelectionVisuals(): void {
        // Iterate over all potential players
        for (let i = 0; i < 4; i++) {
            const sprite = this.playerSelectionSprites.get(i);
            const text = this.playerSelectionTexts.get(i);

            // Check if we have data for this player
            let charKey = this.playerCharacters.get(i);

            // If it's local player, ensure we show current selection
            if (i === this.localPlayerId) {
                charKey = this.selectedCharacter;
                // Also update text immediately for local player
                if (text) {
                    text.setText(this.getCharacterDisplayName(charKey));
                    text.setColor('#ffffff');
                }
            }

            if (sprite && charKey) {
                sprite.setVisible(true);
                // Handle naming convention differences
                const idleAnim = charKey === 'fok' ? 'fok_idle' : `${charKey}_idle`;
                sprite.play(idleAnim, true);

                if (text) {
                    text.setText(this.getCharacterDisplayName(charKey));
                    // Update color if it's an opponent to show they are "active"
                    if (i !== this.localPlayerId) {
                        text.setColor('#dddddd'); // Connected/Selected
                    }
                }
            } else if (sprite) {
                // No character data yet (maybe not connected)
                sprite.setVisible(false);
                if (text && i !== this.localPlayerId) {
                    text.setText('...');
                }
            }
        }
    }

    private handleSelectionStart(countdown: number): void {
        this.phase = 'SELECTING';
        this.selectionCountdown = countdown;
        // Destroy connection status UI completely
        if (this.connectionStatusText) { this.connectionStatusText.destroy(); this.connectionStatusText = null as any; }
        if (this.connectionStatusBg) { this.connectionStatusBg.destroy(); this.connectionStatusBg = null as any; }

        this.selectionContainer.setVisible(true);
        this.countdownText.setText(countdown.toString());

        // Reset confirmations
        this.confirmedPlayers.clear();
        this.playerConfirmTexts.forEach(t => t.setVisible(false));

        // Force font refresh on all selection UI text elements
        this.selectionContainer.each((child: Phaser.GameObjects.GameObject) => {
            if (child instanceof Phaser.GameObjects.Text) {
                child.setFontFamily('"Pixeloid Sans"');
            }
        });

        // Ensure UI is built if it wasn't or rebuild if needed?
        // Let's safe-check: if sprites map is empty, we must build
        if (this.playerSelectionSprites.size === 0) {
            this.selectionContainer.removeAll(true);
            this.createSelectionUI();
        } else {
            // Just update visuals
            this.updateSelectionVisuals();
        }
        this.selectionContainer.setVisible(true);
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
        this.playerCharacters.set(playerId, character);
        // Note: opponentCharacter property removed, use Map
        if (this.playerSelectionTexts.has(playerId)) {
            const text = this.playerSelectionTexts.get(playerId);
            if (text) text.setText(this.getCharacterDisplayName(character));
        }
        this.updateSelectionVisuals();
    }

    private handleCharacterConfirm(playerId: number): void {
        this.confirmedPlayers.add(playerId);
        const confirmText = this.playerConfirmTexts.get(playerId);
        if (confirmText) {
            confirmText.setVisible(true);
            this.tweens.add({
                targets: confirmText,
                scale: { from: 1.5, to: 1 },
                duration: 200,
                ease: 'Back.out'
            });
        }
    }

    private handleGameStart(players: { playerId: number; character: string }[]): void {
        players.forEach(p => {
            this.playerCharacters.set(p.playerId, p.character);
        });
        this.phase = 'PLAYING';

        // Hide selection UI
        this.selectionContainer.setVisible(false);
        // Legacy flags removed as container visibility handles it

        // Create MatchHUD
        this.createUI();
        this.matchHUD = new MatchHUD(this);
        this.matchHUD.addToCameraIgnore(this.cameras.main);

        // Spawn players with their selected characters
        // Spawn points MUST match server (server-geckos/index.ts)
        const spawnPoints = [400, 1520, 800, 1120];
        players.forEach(p => {
            // Validate character against loaded textures. Fallback to 'fok' if invalid.
            const char = ALL_CHARACTERS.includes(p.character) ? p.character : 'fok';

            const spawnX = spawnPoints[p.playerId % spawnPoints.length];
            const player = this.createPlayer(p.playerId, spawnX, 780, char);
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
            } else {
                this.remotePlayer = player;
                player.useExternalInput = true;
            }

            // Add to HUD
            const isLocal = p.playerId === this.localPlayerId;
            const charDisplay = this.getCharacterDisplayName(p.character);
            this.matchHUD.addPlayer(p.playerId, `P${p.playerId + 1} ${charDisplay}`, isLocal, p.character);
        });

        // Initialize Rollback system for the match
        this.rollbackBuffer.clear();
        this.currentSimFrame = 0;
        this.lastConfirmedRemoteFrame = 0;
        this.lastRemoteInputMask = 0;
        this.localInputHistory.fill(0);
    }
    private cycleCharacter(direction: number): void {
        if (this.phase !== 'SELECTING') return;

        this.selectedCharIndex = (this.selectedCharIndex + direction + this.availableCharacters.length) % this.availableCharacters.length;
        this.selectedCharacter = this.availableCharacters[this.selectedCharIndex];

        // Update local map as well for visual consistency
        this.playerCharacters.set(this.localPlayerId, this.selectedCharacter);
        this.updateSelectionVisuals();

        // Send to server
        this.networkManager.sendCharacterSelect(this.selectedCharacter);
    }

    private getCharacterDisplayName(charKey: string): string {
        if (charKey === 'fok') return 'FOK';
        return charKey.toUpperCase();
    }

    // Input state for debouncing
    private selectionInputHeld: boolean = false;

    private pollSelectionInput(): void {
        if (this.confirmedPlayers.has(this.localPlayerId)) return; // Input locked when confirmed

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
        if (this.phase !== 'SELECTING' || this.confirmedPlayers.has(this.localPlayerId)) return;

        this.networkManager.sendCharacterConfirm();
        // Optimistic update (handler will also set this)
        this.handleCharacterConfirm(this.localPlayerId);
    }



    private createStage(): StageResult {
        const stage = createSharedStage(this);

        // Store references
        this.platforms.push(stage.mainPlatform);
        this.softPlatforms.push(...stage.softPlatforms);
        this.sidePlatforms = stage.sidePlatforms || [];
        this.walls = stage.wallCollisionRects;

        // Camera exclusions
        if (this.uiCamera) {
            this.uiCamera.ignore(stage.background);

            this.uiCamera.ignore(this.platforms);
            this.uiCamera.ignore(this.softPlatforms);

            if (stage.sidePlatforms && stage.sidePlatforms.length > 0) {
                this.uiCamera.ignore(stage.sidePlatforms);
            }
            if (stage.platformTextures && stage.platformTextures.length > 0) {
                this.uiCamera.ignore(stage.platformTextures);
            }
            // Removed wallVisuals/Texts as they are gone
        }

        return stage;
    }

    private escapePromptVisible: boolean = false;
    private escapeContainer!: Phaser.GameObjects.Container;
    private escapeSelectedIndex: number = 1; // 0 for YES, 1 for NO (default)
    private escapeOptions: Phaser.GameObjects.Text[] = [];
    private lastEscapeInputTime: number = 0;

    private setupEscapeKey(): void {
        // Remove existing listener if any to prevent duplicates
        this.input.keyboard?.off('keydown-ESC');
        this.input.keyboard?.on('keydown-ESC', () => {
            if (!this.isConnected) {
                this.scene.start('MainMenuScene');
                return;
            }

            if (this.escapePromptVisible) {
                // If prompt is already open, dismiss it
                this.dismissEscapePrompt();
                return;
            }

            // Check if any chest overlay is open
            const isChestOverlayOpen = this.chests ? (this.chests.getChildren() as Chest[]).some(chest => chest.isOverlayOpen) : false;
            if (isChestOverlayOpen) {
                return; // Let chest handle the ESC key
            }

            this.showEscapePrompt();
        });
    }

    private showEscapePrompt(): void {
        this.escapePromptVisible = true;
        this.escapeSelectedIndex = 1; // Default to NO
        this.escapeOptions = [];
        this.lastEscapeInputTime = this.time.now;

        const { width, height } = this.scale;

        this.escapeContainer = this.add.container(width / 2, height / 2);
        this.escapeContainer.setDepth(10000);
        this.escapeContainer.setScrollFactor(0);

        // Dark overlay
        const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7);
        this.escapeContainer.add(overlay);

        // Prompt box (pure black with white border)
        const box = this.add.rectangle(0, 0, 500, 200, 0x000000, 1);
        box.setStrokeStyle(3, 0xffffff);
        this.escapeContainer.add(box);

        const title = this.add.text(0, -50, 'Leave Match?', {
            fontSize: '36px', color: '#ffffff', fontFamily: '"Pixeloid Sans"', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.escapeContainer.add(title);

        const yesBtn = this.add.text(-80, 40, 'YES', {
            fontSize: '28px', color: '#ffffff', fontFamily: '"Pixeloid Sans"', fontStyle: 'bold',
            backgroundColor: '#000000', padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        this.escapeOptions.push(yesBtn);
        this.escapeContainer.add(yesBtn);

        const noBtn = this.add.text(80, 40, 'NO', {
            fontSize: '28px', color: '#ffffff', fontFamily: '"Pixeloid Sans"', fontStyle: 'bold',
            backgroundColor: '#000000', padding: { x: 20, y: 8 }
        }).setOrigin(0.5);
        this.escapeOptions.push(noBtn);
        this.escapeContainer.add(noBtn);

        this.updateEscapePromptSelection();

        // Make main camera ignore prompt
        this.cameras.main.ignore(this.escapeContainer);
    }

    private updateEscapePromptSelection(): void {
        this.escapeOptions.forEach((option, index) => {
            if (index === this.escapeSelectedIndex) {
                option.setBackgroundColor('#ffffff');
                option.setColor('#000000');
            } else {
                option.setBackgroundColor('#000000');
                option.setColor('#ffffff');
            }
        });
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
            if (player.x > MapConfig.BLAST_ZONE_LEFT + 50 &&
                player.x < MapConfig.BLAST_ZONE_RIGHT - 50 &&
                player.y < MapConfig.BLAST_ZONE_BOTTOM - 50 &&
                player.y > MapConfig.BLAST_ZONE_TOP + 50) {
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
        this.rollbackBuffer.clear();

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
        this.connectionStatusBg?.destroy();
        this.connectionStatusBg = null as any;

        // Remove ALL keyboard listeners (prevents stacking on re-entry)
        this.input.keyboard?.removeAllListeners();

        // Remove all time events
        this.time.removeAllEvents();

        // Reset phase
        this.phase = 'WAITING';
        this.isConnected = false;
        this.confirmedPlayers.clear();
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
