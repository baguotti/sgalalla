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
import Phaser from 'phaser';
import { Player, PlayerState } from '../entities/Player';
import { Bomb } from '../entities/Bomb';
import { Chest } from '../entities/Chest';
import NetworkManager from '../network/NetworkManager';
import type { NetGameState, NetPlayerState, NetAttackEvent, NetHitEvent } from '../network/NetworkManager';
import { AnimationHelpers } from '../managers/AnimationHelpers';
import { MapConfig, ZOOM_SETTINGS } from '../config/MapConfig';
import type { ZoomLevel } from '../config/MapConfig';
import { createStage as createSharedStage } from '../stages/StageFactory';
import type { StageResult } from '../stages/StageFactory';

// Define a snapshot type that includes reconstructed server timestamp for fixed-timeline interpolation
type NetPlayerSnapshot = NetPlayerState & { frame: number; serverTime: number };
import { InputManager } from '../input/InputManager';
import type { GameSnapshot, PlayerSnapshot } from '../network/StateSnapshot';
import { MatchHUD, SMASH_COLORS } from '../ui/PlayerHUD';
import { DebugOverlay } from '../components/DebugOverlay';

import type { GameSceneInterface } from './GameSceneInterface';

export class OnlineGameScene extends Phaser.Scene implements GameSceneInterface {
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

    public addBomb(_bomb: Bomb): void {
        // Online bombs are managed by NetworkManager typically.
        // If this is a local visual bomb, we might not track it in the main map?
        // Or if it's predicted...
        // For now, no-op or simple log as strictly local bombs shouldn't exist online?
        // Actually, preventing crash is the goal.
    }

    public removeBomb(bomb: Bomb): void {
        // Find by value and remove?
        for (const [id, b] of this.bombs.entries()) {
            if (b === bomb) {
                this.bombs.delete(id);
                break;
            }
        }
    }

    public getBombs(): Bomb[] {
        return Array.from(this.bombs.values());
    }

    public getPlayers(): Player[] {
        return Array.from(this.players.values());
    }

    preload(): void {
        this.load.image('platform', 'assets/platform.png');
        this.load.image('background', 'assets/background.png'); // Keep for fallback?
        AnimationHelpers.loadCharacterAssets(this);
        AnimationHelpers.loadCommonAssets(this);

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


        // Initialize fast with Black Screen + Loading Text (User Request)
        this.cameras.main.setBackgroundColor('#000000');
        this.showConnectionStatus('LOADING...');

        // Try to connect
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

        this.cameras.main.setBackgroundColor('#99d7f0');

        // Note: createStage() calls configureCameraExclusions, which now ignores waterOverlay on uiCamera.

        // Initialize HUD
        this.matchHUD = new MatchHUD(this);
        this.matchHUD.addToCameraIgnore(this.cameras.main);

        // Debug Overlay
        this.debugOverlay = new DebugOverlay(this);
        this.debugOverlay.setCameraIgnore(this.cameras.main);

        // Debug Toggle Key
        this.debugToggleKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);

        // Initialize EffectManager
        this.effectManager = new EffectManager(this);

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
            this.players.forEach(p => p.updateVisuals(delta));
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
            this.localPlayer.checkWallCollision(this.walls);

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
                const dist = Phaser.Math.Distance.Between(player.x, player.y, chest.x, chest.y);

                if (!chest.isOpened) {
                    if (dist < interactRange) {
                        chest.open();
                    }
                } else {
                    // Opened: knock it around! (if cooldown is over)
                    if (dist < interactRange && chest.canBePunched) {
                        const angle = Phaser.Math.Angle.Between(player.x, player.y, chest.x, chest.y);
                        // Pulse force to match GameScene
                        const force = 2.0;
                        chest.applyForce(new Phaser.Math.Vector2(
                            Math.cos(angle) * force,
                            Math.sin(angle) * force - 0.15
                        ));
                    }
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
        if (bounds.left < MapConfig.BLAST_ZONE_LEFT ||
            bounds.right > MapConfig.BLAST_ZONE_RIGHT ||
            bounds.top < MapConfig.BLAST_ZONE_TOP ||
            bounds.bottom > MapConfig.BLAST_ZONE_BOTTOM) {

            // Score update (lives)
            player.lives = Math.max(0, player.lives - 1);

            // IMPACT POLISH (Local only for shake, visual for all? Actually local visual is fine for now)
            // Ideally we broadcast this event, but for now client-side prediction visual is okay.
            this.cameras.main.shake(300, 0.02);
            // Clamp impact position
            // const impactX = Phaser.Math.Clamp(bounds.centerX, MapConfig.BLAST_ZONE_LEFT + 100, MapConfig.BLAST_ZONE_RIGHT - 100);
            // const impactY = Phaser.Math.Clamp(bounds.centerY, MapConfig.BLAST_ZONE_TOP + 100, MapConfig.BLAST_ZONE_BOTTOM - 100);
            // this.effectManager.spawnDeathExplosion(impactX, impactY, 0xff4444);

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
        this.cameras.main.ignore(this.gameOverContainer); // Ensure UI doesn't zoom with the game world

        // Darken background
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
        this.gameOverContainer.add(overlay);

        let winnerText = "GAME!";
        if (winnerId >= 0) {
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
                this.cameras.main.pan(winner.x, winner.y, 1500, 'Power2');
                this.cameras.main.zoomTo(2.0, 1500, 'Power2');
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

    private createPlayer(playerId: number, x: number, y: number, character: string = 'fok'): Player {
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
                { fontSize: '32px', color: '#ffffff', fontFamily: '"Pixeloid Sans"' } // Removed bg color
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
        // Updated for 4-player spawn points
        const spawnPoints = [400, 1520, 800, 1120];
        players.forEach(p => {
            // Validate character against loaded textures. Fallback to 'fok_v3' if invalid.
            const validChars = ['fok', 'sgu', 'sga'];
            const char = validChars.includes(p.character) ? p.character : 'fok';

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
            }

            // Add to HUD
            const isLocal = p.playerId === this.localPlayerId;
            const charDisplay = this.getCharacterDisplayName(p.character);
            this.matchHUD.addPlayer(p.playerId, `P${p.playerId + 1} ${charDisplay}`, isLocal, p.character);
        });

        // Setup collision overlap for hit detection
        // ... (existing collision code)
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
        this.walls = stage.wallCollisionRects;

        // Camera exclusions
        if (this.uiCamera) {
            this.uiCamera.ignore(stage.background);

            this.uiCamera.ignore(this.platforms);
            this.uiCamera.ignore(this.softPlatforms);
            // Removed wallVisuals/Texts as they are gone
        }

        return stage;
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
