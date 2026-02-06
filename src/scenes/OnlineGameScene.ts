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
import { InputManager } from '../input/InputManager';
import type { GameSnapshot, PlayerSnapshot } from '../network/StateSnapshot';
import { MatchHUD } from '../ui/PlayerHUD';

export class OnlineGameScene extends Phaser.Scene {
    // Networking
    private networkManager: NetworkManager;
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
    private readonly WALL_LEFT_X = -200; // Moved way out
    private readonly WALL_RIGHT_X = 2120; // 1920 + 200
    private readonly PLAY_BOUND_LEFT = this.WALL_LEFT_X + this.WALL_THICKNESS / 2;
    private readonly PLAY_BOUND_RIGHT = this.WALL_RIGHT_X - this.WALL_THICKNESS / 2;

    // Blast zone boundaries (matching GameScene)
    private readonly BLAST_ZONE_LEFT = -2000; // Extended from -1000
    private readonly BLAST_ZONE_RIGHT = 4000; // Extended from 3000
    private readonly BLAST_ZONE_TOP = -2500; // Extended from -1000
    private readonly BLAST_ZONE_BOTTOM = 3500; // Extended from 2000

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
    private selectedCharacter: string = 'fok';
    private opponentCharacter: string = 'fok';
    private readonly availableCharacters = ['fok', 'fok_alt'];
    private selectedCharIndex: number = 0;

    // Selection UI Elements
    private selectionContainer!: Phaser.GameObjects.Container;
    private countdownText!: Phaser.GameObjects.Text;
    private myCharacterText!: Phaser.GameObjects.Text;
    private opponentCharacterText!: Phaser.GameObjects.Text;
    private selectionInstructions!: Phaser.GameObjects.Text;

    constructor() {
        super({ key: 'OnlineGameScene' });
        this.networkManager = NetworkManager.getInstance();
    }

    preload(): void {
        this.load.image('platform', 'assets/platform.png');
        this.load.image('background', 'assets/background.png');
        this.load.atlas('fok', 'assets/fok/fok_sprites/fok.png', 'assets/fok/fok_sprites/fok.json');
        this.load.atlas('fok_alt', 'assets/fok_alt.png', 'assets/fok_alt.json');
    }

    private createAnimations(): void {
        const characters = ['fok', 'fok_alt'];

        characters.forEach(char => {
            const fokAnims = [
                { key: 'idle', prefix: '0_Fok_Idle_', count: 19, loop: true },
                { key: 'run', prefix: '0_Fok_Running_', count: 12, loop: true },
                { key: 'charging', prefix: '0_Fok_Charging_', count: 8, loop: true },
                // Single frame animations (but defined as animations for consistency)
                { key: 'attack_light', prefix: '0_Fok_AttackLight_', count: 1, suffix: '000', loop: false },
                { key: 'attack_heavy', prefix: '0_Fok_AttackHeavy_', count: 1, suffix: '000', loop: false },
                { key: 'attack_up', prefix: '0_Fok_AttackUp_', count: 1, suffix: '001', loop: false },
                { key: 'attack_down', prefix: '0_Fok_DownSig_', count: 1, suffix: '001', loop: false },
                { key: 'attack_side', prefix: '0_Fok_SideSig_', count: 1, suffix: '001', loop: false },
                { key: 'hurt', prefix: '0_Fok_Hurt_', count: 1, suffix: '001', loop: false },
                { key: 'ground_pound', prefix: '0_Fok_Gpound_', count: 1, suffix: '001', loop: false },
                { key: 'fall', prefix: '0_Fok_Falling_', count: 1, suffix: '001', loop: false },
                { key: 'jump', prefix: '0_Fok_Jump_', count: 1, suffix: '000', loop: false },
                { key: 'slide', prefix: '0_Fok_Sliding_', count: 1, suffix: '000', loop: false }
            ];

            fokAnims.forEach(anim => {
                const animKey = `${char}_${anim.key}`;
                if (this.anims.exists(animKey)) return;

                let frames;
                if (anim.count === 1 && anim.suffix) {
                    frames = this.anims.generateFrameNames(char, {
                        prefix: anim.prefix,
                        start: parseInt(anim.suffix),
                        end: parseInt(anim.suffix),
                        zeroPad: 3
                    });
                } else {
                    frames = this.anims.generateFrameNames(char, {
                        prefix: anim.prefix,
                        start: 0,
                        end: anim.count - 1,
                        zeroPad: 3
                    });
                }

                this.anims.create({
                    key: animKey,
                    frames: frames,
                    frameRate: anim.key === 'run' ? 20 : 15,
                    repeat: anim.loop ? -1 : 0
                });
            });

            // Additional animation mappings
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
        this.networkManager.onGameStart((players) => this.handleGameStart(players));

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

        // Dead-reckoning: update remote players based on velocity every frame
        this.players.forEach((player, playerId) => {
            if (playerId !== this.localPlayerId) {
                const dt = delta / 1000; // Convert to seconds
                const target = this.remoteTargets.get(playerId);

                if (target) {
                    // Apply velocity-based prediction
                    player.x += player.velocity.x * dt;
                    player.y += player.velocity.y * dt;

                    // Smooth correction toward target (entity interpolation)
                    const dx = target.x - player.x;
                    const dy = target.y - player.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Snap if too far, otherwise blend
                    if (dist > 300) {
                        player.x = target.x;
                        player.y = target.y;
                    } else if (dist > 1) {
                        // Blend toward target (0.4 = balanced smoothness/responsiveness)
                        player.x += dx * 0.4;
                        player.y += dy * 0.4;
                    }
                }

                // Check blast zone for remote players
                this.checkBlastZone(player);
            }
        });

        // Update remote players (animations/logic, no physics)
        this.players.forEach((player) => {
            if (player !== this.localPlayer) {
                // Update logic for animations (but not physics)
                player.updateLogic(delta);
                // checkBlastZone is now handled in the dead-reckoning loop above
            }
        });



        // Update MatchHUD
        this.matchHUD.updatePlayers(this.players);
        this.matchHUD.updateDebug(this.networkManager.getLatency(), this.game.loop.actualFps);

        // Dynamic Camera
        this.updateCamera();
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

            // For local player: check for divergence and reconcile if needed
            if (netPlayer.playerId === this.localPlayerId && this.localPlayer) {
                this.checkAndReconcile(netPlayer, serverFrame);
                return;
            }

            // Interpolate remote players
            this.interpolatePlayer(player, netPlayer);

            // Sync lives (only if server sends it)
            if (typeof netPlayer.lives === 'number' && player.lives !== netPlayer.lives) {
                player.lives = netPlayer.lives;
            }
        });

        // Check for Game Over after state updates
        this.checkGameOver();
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

    private interpolatePlayer(player: Player, netState: NetPlayerState): void {
        // Store target for dead-reckoning in update loop
        this.remoteTargets.set(netState.playerId, netState);

        // Update velocity immediately (used for dead-reckoning prediction)
        player.velocity.x = netState.velocityX;
        player.velocity.y = netState.velocityY;

        // Sync other state directly
        player.isGrounded = netState.isGrounded;
        player.isAttacking = netState.isAttacking;
        player.animationKey = netState.animationKey || '';
        player.setFacingDirection(netState.facingDirection);

        // Sync Damage
        if (player.damagePercent !== netState.damagePercent) {
            player.setDamage(netState.damagePercent);
        }

        // Debug: Log state changes
        if (netState.animationKey && netState.animationKey !== 'idle' && netState.animationKey !== 'run') {
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

            if (player.lives > 0) {
                this.respawnPlayer(player);
            } else {
                this.killPlayer(player);
                // We rely on the regular checkGameOver call to trigger the end
            }
        }
    }

    private respawnPlayer(player: Player): void {
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

    private createPlayer(playerId: number, x: number, y: number, character: string = 'fok'): Player {
        const isLocal = playerId === this.localPlayerId;

        const player = new Player(this, x, y, {
            playerId: playerId,
            isAI: false,
            useKeyboard: isLocal,
            gamepadIndex: isLocal ? 0 : null, // All local players try to use index 0 (gated by focus)
            character: character as 'fok' | 'fok_alt'
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

        this.myCharacterText = this.add.text(0, 20, this.selectedCharacter.toUpperCase(), {
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

        this.opponentCharacterText = this.add.text(0, 80, this.opponentCharacter.toUpperCase(), {
            fontSize: '28px',
            color: '#888888',
            fontStyle: 'bold'
        }).setOrigin(0.5);
        this.selectionContainer.add(this.opponentCharacterText);

        // Instructions
        this.selectionInstructions = this.add.text(0, 150, '← / → to change | A/D keys', {
            fontSize: '18px',
            color: '#888888'
        }).setOrigin(0.5);
        this.selectionContainer.add(this.selectionInstructions);

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
        this.opponentCharacterText.setText(character.toUpperCase());
    }

    private handleGameStart(players: { playerId: number; character: string }[]): void {
        console.log('[OnlineGameScene] Game starting with players:', players);
        this.phase = 'PLAYING';

        // Hide selection UI
        this.selectionContainer.setVisible(false);

        // Create MatchHUD
        this.createUI();
        this.matchHUD = new MatchHUD(this);
        this.matchHUD.addToCameraIgnore(this.cameras.main);

        // Spawn players with their selected characters
        const spawnPoints = [600, 1200];
        players.forEach((p, idx) => {
            const player = this.createPlayer(p.playerId, spawnPoints[idx % 2], 780, p.character);
            this.players.set(p.playerId, player);

            if (p.playerId === this.localPlayerId) {
                this.localPlayer = player;
            }
        });
    }

    private cycleCharacter(direction: number): void {
        if (this.phase !== 'SELECTING') return;

        this.selectedCharIndex = (this.selectedCharIndex + direction + this.availableCharacters.length) % this.availableCharacters.length;
        this.selectedCharacter = this.availableCharacters[this.selectedCharIndex];
        this.myCharacterText.setText(this.selectedCharacter.toUpperCase());

        // Send to server
        this.networkManager.sendCharacterSelect(this.selectedCharacter);
    }

    // Input state for debouncing
    private selectionInputHeld: boolean = false;

    private pollSelectionInput(): void {
        // Check keyboard
        const cursors = this.input.keyboard?.createCursorKeys();
        const aKey = this.input.keyboard?.addKey('A');
        const dKey = this.input.keyboard?.addKey('D');

        const leftPressed = cursors?.left?.isDown || aKey?.isDown;
        const rightPressed = cursors?.right?.isDown || dKey?.isDown;

        // Check gamepad
        const pad = this.input.gamepad?.pad1;
        const padLeft = pad?.left || (pad?.leftStick?.x ?? 0) < -0.5;
        const padRight = pad?.right || (pad?.leftStick?.x ?? 0) > 0.5;

        const anyLeft = leftPressed || padLeft;
        const anyRight = rightPressed || padRight;

        // Debounce: only trigger on press, not hold
        if ((anyLeft || anyRight) && !this.selectionInputHeld) {
            this.selectionInputHeld = true;
            if (anyLeft) this.cycleCharacter(-1);
            else if (anyRight) this.cycleCharacter(1);
        } else if (!anyLeft && !anyRight) {
            this.selectionInputHeld = false;
        }
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

        // Main platform (centered, wider - Brawlhaven style)
        // Center: 960. Width 1800. Y = 900
        const mainPlatform = this.add.rectangle(960, 900, 1800, 60, 0x2c3e50);
        mainPlatform.setStrokeStyle(3, 0x3a506b);
        this.platforms.push(mainPlatform);
        if (this.uiCamera) this.uiCamera.ignore(mainPlatform);

        // Soft platforms (floating HIGHER)
        // Left
        const softPlatform1 = this.add.rectangle(460, 500, 500, 30, 0x0f3460);
        softPlatform1.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform1.setAlpha(0.85);
        this.softPlatforms.push(softPlatform1);

        // Right
        const softPlatform2 = this.add.rectangle(1460, 500, 500, 30, 0x0f3460);
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
