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
import NetworkManager from '../network/NetworkManager';
import type { NetGameState, NetPlayerState, NetAttackEvent, NetHitEvent } from '../network/NetworkManager';

// Define a snapshot type that includes reconstructed server timestamp for fixed-timeline interpolation
type NetPlayerSnapshot = NetPlayerState & { frame: number; serverTime: number };
import { InputManager } from '../input/InputManager';
import type { GameSnapshot, PlayerSnapshot } from '../network/StateSnapshot';
import { MatchHUD } from '../ui/PlayerHUD';

export class OnlineGameScene extends Phaser.Scene {
    // Networking
    private networkManager: NetworkManager;
    private snapshotBuffer: Map<number, NetPlayerSnapshot[]> = new Map();
    private interpolationTime: number = 0; // Stable playback timeline
    private isBufferInitialized: boolean = false;
    private readonly RENDER_DELAY_MS = 100; // 100ms historical window
    private readonly SERVER_TICK_MS = 50;   // 20Hz fixed rate
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

    // UI
    private connectionStatusText!: Phaser.GameObjects.Text;
    private matchHUD!: MatchHUD;

    // Rollback netcode
    private localFrame: number = 0;

    // Network throttling
    private stateThrottleCounter: number = 0;
    private readonly STATE_SEND_INTERVAL: number = 2; // sendState every 2nd frame (~30Hz)
    private inputThrottleCounter: number = 0;
    private readonly INPUT_SEND_INTERVAL: number = 1; // sendInput every frame (~60Hz)

    // Remote player target state for smooth interpolation
    private remoteTargets: Map<number, NetPlayerState> = new Map();

    // Wall configuration (matching GameScene)
    private readonly WALL_THICKNESS = 45;
    private readonly WALL_LEFT_X = -400; // Refinement 12: Pushed out from -200
    private readonly WALL_RIGHT_X = 2320; // Refinement 12: Pushed out from 2120
    private readonly PLAY_BOUND_LEFT = this.WALL_LEFT_X + this.WALL_THICKNESS / 2;
    private readonly PLAY_BOUND_RIGHT = this.WALL_RIGHT_X - this.WALL_THICKNESS / 2;

    // Blast zone boundaries (matching GameScene)
    private readonly BLAST_ZONE_LEFT = -3000; // Extended from -2000
    private readonly BLAST_ZONE_RIGHT = 5000; // Extended from 4000
    private readonly BLAST_ZONE_TOP = -2500;
    private readonly BLAST_ZONE_BOTTOM = 3500;

    // Camera Settings (matching GameScene)
    // Camera Settings (matching GameScene)
    private currentZoomLevel: 'CLOSE' | 'NORMAL' | 'WIDE' = 'NORMAL';
    private readonly ZOOM_SETTINGS = {
        CLOSE: { padX: 250, padY: 100, minZoom: 0.5, maxZoom: 1.5 }, // Increased padding and range
        NORMAL: { padX: 450, padY: 300, minZoom: 0.5, maxZoom: 1.1 },
        WIDE: { padX: 600, padY: 450, minZoom: 0.3, maxZoom: 0.8 }
    };

    // UI Camera
    private uiCamera!: Phaser.Cameras.Scene2D.Camera;

    // Game Over State
    private isGameOver: boolean = false;
    private gameOverContainer!: Phaser.GameObjects.Container;
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
    private availableCharacters: string[] = ['fok_v3']; // Refinement: fok_v3 is default
    private selectedCharIndex: number = 0;
    private isConfirmed: boolean = false;
    private isOpponentConfirmed: boolean = false;

    // Selection UI Elements
    private selectionContainer!: Phaser.GameObjects.Container;
    private countdownText!: Phaser.GameObjects.Text;
    private myCharacterText!: Phaser.GameObjects.Text;
    private opponentCharacterText!: Phaser.GameObjects.Text;
    private selectionInstructions!: Phaser.GameObjects.Text;
    private confirmInstructions!: Phaser.GameObjects.Text;
    private myConfirmText!: Phaser.GameObjects.Text;
    private opponentConfirmText!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'OnlineGameScene' });
        this.networkManager = NetworkManager.getInstance();
    }

    preload(): void {
        this.load.image('platform', 'assets/platform.png');
        this.load.image('background', 'assets/background.png');
        this.load.atlas('fok_v3', 'assets/fok_v3/fok_v3.png', 'assets/fok_v3/fok_v3.json');
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
                    frameRate: animName === 'run' ? 20 : 15,
                    repeat: animData.loop ? -1 : 0
                });
            });
        });
    }

    private setupCameras(): void {
        // Main camera is manually controlled via updateCamera()

        // Create a separate UI camera that ignores zoom
        this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
        this.uiCamera.setScroll(0, 0);
        // UI camera ignores main camera zoom
        this.uiCamera.setZoom(1);
    }

    async create(): Promise<void> {

        // Create animations first
        this.createAnimations();

        // Setup cameras (UI separation)
        this.setupCameras();

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
            this.localPlayer.checkWallCollision(this.PLAY_BOUND_LEFT, this.PLAY_BOUND_RIGHT);

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
        }

        // JITTER BUFFER (Fixed Timeline Interpolation)
        // ----------------------------------------------------------------
        // Interpolate from reconstructed server timeline, decoupled from network jitter.

        // 1. Advance Stable Interpolation Clock
        if (this.isBufferInitialized) {
            this.interpolationTime += delta;
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
                        // Extrapolation fallback: snap to latest
                        const latest = buffer[buffer.length - 1];
                        player.x = latest.x;
                        player.y = latest.y;
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
        this.matchHUD.updatePlayers(this.players);
        this.matchHUD.updateDebug(this.networkManager.getLatency(), this.game.loop.actualFps);

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
                const isLocal = netPlayer.playerId === this.localPlayerId;
                this.matchHUD.addPlayer(netPlayer.playerId, `Player ${netPlayer.playerId + 1}`, isLocal);
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

            // Create a snapshot with reconstructed server timestamp
            const snapshot: NetPlayerSnapshot = {
                ...netPlayer,
                frame: serverFrame,
                serverTime: serverFrame * this.SERVER_TICK_MS
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
                // Initialize interpolationTime to ~100ms behind the latest server snapshot
                this.interpolationTime = snapshot.serverTime - this.RENDER_DELAY_MS;
                this.isBufferInitialized = true;
                console.log(`[JitterBuffer] Initialized. interpolationTime: ${this.interpolationTime}, ServerTime: ${snapshot.serverTime}`);
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
     * Handle remote attack events - play animation on remote player
     */
    private handleAttackEvent(event: NetAttackEvent): void {
        const player = this.players.get(event.playerId);
        if (player) {
            // Force attack animation on remote player
            player.playAttackAnimation(event.attackKey);
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
            fontFamily: 'Arial',
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
            fontFamily: 'Arial',
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
            fontFamily: 'Arial',
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
        if (!this.connectionStatusText) {
            this.connectionStatusText = this.add.text(
                this.scale.width / 2,
                this.scale.height / 2,
                message,
                { fontSize: '32px', color: '#ffffff', backgroundColor: '#333333', padding: { x: 20, y: 10 } }
            ).setOrigin(0.5).setDepth(1000);
        } else {
            this.connectionStatusText.setText(message);
        }
    }

    private createUI(): void {
        this.connectionStatusText?.setVisible(false);
        // Ping/FPS display is handled by MatchHUD (centered)
    }

    private createSelectionUI(): void {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Container for selection UI (initially hidden)
        this.selectionContainer = this.add.container(centerX, centerY);
        this.selectionContainer.setDepth(500);
        this.selectionContainer.setVisible(false);

        // Background overlay
        const bg = this.add.rectangle(0, 0, 600, 400, 0x000000, 0.85);
        bg.setStrokeStyle(3, 0x4a90d9);
        this.selectionContainer.add(bg);

        // Title
        const title = this.add.text(0, -160, 'SELECT CHARACTER', {
            fontSize: '36px',
            color: '#4a90d9',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.selectionContainer.add(title);

        // Countdown timer
        this.countdownText = this.add.text(0, -100, '10', {
            fontSize: '72px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.selectionContainer.add(this.countdownText);

        // My character label
        const myLabel = this.add.text(-120, 20, 'YOU:', {
            fontSize: '24px',
            color: '#88ff88'
        }).setOrigin(1, 0.5);
        this.selectionContainer.add(myLabel);

        this.myCharacterText = this.add.text(0, 20, this.getCharacterDisplayName(this.selectedCharacter), {
            fontSize: '28px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.selectionContainer.add(this.myCharacterText);

        // Left/Right arrows
        const leftArrow = this.add.text(-150, 20, '◀', {
            fontSize: '32px',
            color: '#4a90d9'
        }).setOrigin(0.5);
        this.selectionContainer.add(leftArrow);

        const rightArrow = this.add.text(150, 20, '▶', {
            fontSize: '32px',
            color: '#4a90d9'
        }).setOrigin(0.5);
        this.selectionContainer.add(rightArrow);

        // Opponent character label
        const oppLabel = this.add.text(-120, 80, 'OPP:', {
            fontSize: '24px',
            color: '#ff8888'
        }).setOrigin(1, 0.5);
        this.selectionContainer.add(oppLabel);

        this.opponentCharacterText = this.add.text(0, 80, this.getCharacterDisplayName(this.opponentCharacter), {
            fontSize: '28px',
            color: '#888888',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.selectionContainer.add(this.opponentCharacterText);

        // Instructions
        this.selectionInstructions = this.add.text(0, 150, '← / → to change', {
            fontSize: '18px',
            color: '#888888'
        }).setOrigin(0.5);
        this.selectionContainer.add(this.selectionInstructions);

        // Confirm Instructions
        this.confirmInstructions = this.add.text(0, 180, 'Press SPACE / A to Confirm', {
            fontSize: '20px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.selectionContainer.add(this.confirmInstructions);

        // Confirmation Status Labels (Hidden initially)
        this.myConfirmText = this.add.text(0, 50, 'READY', {
            fontSize: '16px',
            color: '#00ff00',
            fontStyle: 'bold',
            backgroundColor: '#004400'
        }).setOrigin(0.5).setVisible(false);
        this.selectionContainer.add(this.myConfirmText);

        this.opponentConfirmText = this.add.text(0, 110, 'READY', {
            fontSize: '16px',
            color: '#00ff00',
            fontStyle: 'bold',
            backgroundColor: '#004400'
        }).setOrigin(0.5).setVisible(false);
        this.selectionContainer.add(this.opponentConfirmText);

        // Make UI camera render this on top
        if (this.uiCamera) {
            this.cameras.main.ignore(this.selectionContainer);
        }
    }

    private handleSelectionStart(countdown: number): void {
        console.log(`[OnlineGameScene] Selection phase started: ${countdown}s`);
        this.phase = 'SELECTING';
        this.selectionCountdown = countdown;
        this.connectionStatusText?.setVisible(false);
        this.selectionContainer.setVisible(true);
        this.countdownText.setText(countdown.toString());
    }

    private handleSelectionTick(countdown: number): void {
        this.selectionCountdown = countdown;
        this.countdownText.setText(countdown.toString());

        // Flash effect on low countdown
        if (countdown <= 3) {
            this.countdownText.setColor('#ff5555');
        }
    }

    private handleOpponentCharacterSelect(_playerId: number, character: string): void {
        this.opponentCharacter = character;
        this.opponentCharacterText.setText(this.getCharacterDisplayName(character));
    }

    private handleCharacterConfirm(playerId: number): void {
        if (playerId === this.localPlayerId) {
            this.isConfirmed = true;
            this.myConfirmText.setVisible(true);
            this.confirmInstructions.setText('Waiting for opponent...');
        } else {
            this.isOpponentConfirmed = true;
            this.opponentConfirmText.setVisible(true);
        }
    }

    private handleGameStart(players: { playerId: number; character: string }[]): void {
        console.log('[OnlineGameScene] Game starting with players:', JSON.stringify(players));
        players.forEach(p => console.log(`Player ${p.playerId} char: "${p.character}"`));
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
            const validChars = ['fok_v3'];
            const char = validChars.includes(p.character) ? p.character : 'fok_v3';
            console.log(`[OnlineGameScene] Creating player ${p.playerId} with char: ${char} (Server sent: "${p.character}")`);

            const player = this.createPlayer(p.playerId, spawnPoints[idx % 2], 780, char);
            this.players.set(p.playerId, player);

            if (p.playerId === this.localPlayerId) {
                this.localPlayer = player;
            }

            // Add to HUD
            const isLocal = p.playerId === this.localPlayerId;
            this.matchHUD.addPlayer(p.playerId, `Player ${p.playerId + 1}`, isLocal);
        });

        // Setup collision overlap for hit detection
        // ... (existing collision code)
    }

    private cycleCharacter(direction: number): void {
        if (this.phase !== 'SELECTING') return;

        this.selectedCharIndex = (this.selectedCharIndex + direction + this.availableCharacters.length) % this.availableCharacters.length;
        this.selectedCharacter = this.availableCharacters[this.selectedCharIndex];
        this.myCharacterText.setText(this.getCharacterDisplayName(this.selectedCharacter));

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

    private createStage(): void {
        // Background gradient
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a2e, 0x1a1a2e, 1);
        bg.fillRect(0, 0, this.scale.width, this.scale.height);
        bg.setDepth(-10);
        if (this.uiCamera) this.uiCamera.ignore(bg);

        // Side walls (matching GameScene)
        const leftWall = this.add.rectangle(this.WALL_LEFT_X, 540, this.WALL_THICKNESS, 1080, 0x2a3a4e);
        leftWall.setStrokeStyle(4, 0x4a6a8e);
        leftWall.setAlpha(0.6);
        leftWall.setDepth(-5);

        const rightWall = this.add.rectangle(this.WALL_RIGHT_X, 540, this.WALL_THICKNESS, 1080, 0x2a3a4e);
        rightWall.setStrokeStyle(4, 0x4a6a8e);
        rightWall.setAlpha(0.6);
        rightWall.setDepth(-5);

        // Main platform (centered, wider - Refinement 12)
        // Center: 960. Width 2400 (Was 1800). Y = 900
        const mainPlatform = this.add.rectangle(960, 900, 2400, 60, 0x2c3e50);
        mainPlatform.setStrokeStyle(3, 0x3a506b);
        this.platforms.push(mainPlatform);
        if (this.uiCamera) this.uiCamera.ignore(mainPlatform);

        // Soft platforms (floating HIGHER)
        // Left - Refinement 12: Pushed left to 260
        const softPlatform1 = this.add.rectangle(260, 500, 500, 30, 0x0f3460);
        softPlatform1.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform1.setAlpha(0.85);
        this.softPlatforms.push(softPlatform1);

        // Right - Refinement 12: Pushed right to 1660
        const softPlatform2 = this.add.rectangle(1660, 500, 500, 30, 0x0f3460);
        softPlatform2.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform2.setAlpha(0.85);
        this.softPlatforms.push(softPlatform2);
        if (this.uiCamera) {
            this.uiCamera.ignore(this.platforms);
            this.uiCamera.ignore(this.softPlatforms);
            this.uiCamera.ignore(bg);
            // Also ignore walls which are locally created in block above
            // (Manually ignore them here as they aren't in array yet... wait walls are local consts)
            // Ideally we track walls in array like GameScene, but here they are local var.
            // But we can just use the scene display list ignore if needed, OR just ensure UI camera ignores everything except UI.
            // Better: Add walls to array or ignore explicitly.
        }

        // Initial camera center
        this.cameras.main.setZoom(1); // Start at 1x
        this.cameras.main.centerOn(960, 540);
    }

    private setupEscapeKey(): void {
        this.input.keyboard?.on('keydown-ESC', () => {
            this.networkManager.disconnect();
            this.scene.start('MainMenuScene');
        });
    }

    /**
     * Dynamic camera that follows all players
     */
    private updateCamera(): void {
        const targets: Phaser.GameObjects.Components.Transform[] = [];

        this.players.forEach((player) => {
            if (!player.active) return; // Ignore inactive (dead/waiting respawn) players
            // Check bounds to filter out dying players
            if (player.x > this.BLAST_ZONE_LEFT + 500 &&
                player.x < this.BLAST_ZONE_RIGHT - 500 &&
                player.y < this.BLAST_ZONE_BOTTOM - 500 &&
                player.y > this.BLAST_ZONE_TOP + 500) {
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
}
