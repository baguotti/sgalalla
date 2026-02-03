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
import { Player } from '../entities/Player';
import NetworkManager from '../network/NetworkManager';
import type { NetGameState, NetPlayerState, NetAttackEvent, NetHitEvent } from '../network/NetworkManager';
import { InputManager } from '../input/InputManager';
import type { GameSnapshot, PlayerSnapshot } from '../network/StateSnapshot';

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
    private latencyText!: Phaser.GameObjects.Text;

    // Rollback netcode
    private localFrame: number = 0;

    // Wall configuration (matching GameScene)
    private readonly WALL_THICKNESS = 45;
    private readonly WALL_LEFT_X = 150;
    private readonly WALL_RIGHT_X = 1770;
    private readonly PLAY_BOUND_LEFT = this.WALL_LEFT_X + this.WALL_THICKNESS / 2;
    private readonly PLAY_BOUND_RIGHT = this.WALL_RIGHT_X - this.WALL_THICKNESS / 2;

    // Blast zone boundaries (matching GameScene)
    private readonly BLAST_ZONE_LEFT = -300;
    private readonly BLAST_ZONE_RIGHT = 2220;
    private readonly BLAST_ZONE_TOP = -300;
    private readonly BLAST_ZONE_BOTTOM = 1350;

    constructor() {
        super({ key: 'OnlineGameScene' });
        this.networkManager = NetworkManager.getInstance();
    }

    preload(): void {
        // Load character assets (same as GameScene)
        this.loadCharacterAssets();
    }

    private loadCharacterAssets(): void {
        this.load.atlas('fok', 'assets/fok/fok_sprites/fok.png', 'assets/fok/fok_sprites/fok.json');
    }

    private createAnimations(): void {
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
            // Skip if already exists
            if (this.anims.exists(`fok_${anim.key}`)) return;

            let frames;
            if (anim.count === 1 && anim.suffix) {
                // Manual single frame with specific suffix
                frames = this.anims.generateFrameNames('fok', {
                    prefix: anim.prefix,
                    start: parseInt(anim.suffix),
                    end: parseInt(anim.suffix),
                    zeroPad: 3
                });
            } else {
                // Sequence
                frames = this.anims.generateFrameNames('fok', {
                    prefix: anim.prefix,
                    start: 0,
                    end: anim.count - 1,
                    zeroPad: 3
                });
            }

            this.anims.create({
                key: `fok_${anim.key}`,
                frames: frames,
                frameRate: anim.key === 'run' ? 20 : 15,
                repeat: anim.loop ? -1 : 0
            });
        });

        // Additional animation mappings
        if (!this.anims.exists('fok_attack_light_0')) {
            this.anims.create({
                key: 'fok_attack_light_0',
                frames: this.anims.generateFrameNames('fok', { prefix: '0_Fok_AttackLight_', start: 0, end: 0, zeroPad: 3 }),
                frameRate: 10,
                repeat: 0
            });
        }
        if (!this.anims.exists('fok_attack_light_1')) {
            this.anims.create({
                key: 'fok_attack_light_1',
                frames: this.anims.generateFrameNames('fok', { prefix: '0_Fok_AttackLight_', start: 0, end: 0, zeroPad: 3 }),
                frameRate: 10,
                repeat: 0
            });
        }
        if (!this.anims.exists('fok_dodge')) {
            this.anims.create({
                key: 'fok_dodge',
                frames: this.anims.generateFrameNames('fok', { prefix: '0_Fok_Sliding_', start: 0, end: 0, zeroPad: 3 }),
                frameRate: 10,
                repeat: 0
            });
        }
        if (!this.anims.exists('fok_jump_start')) {
            // Fallback to jump loop if start doesn't exist
            this.anims.create({
                key: 'fok_jump_start',
                frames: this.anims.generateFrameNames('fok', { prefix: '0_Fok_Jump_', start: 0, end: 0, zeroPad: 3 }),
                frameRate: 10,
                repeat: 0
            });
        }
    }

    async create(): Promise<void> {
        console.log('[OnlineGameScene] Initializing...');

        // Create animations first
        this.createAnimations();

        // Setup network callbacks
        this.networkManager.onStateUpdate((state) => this.handleStateUpdate(state));
        this.networkManager.onDisconnect(() => this.handleDisconnect());
        this.networkManager.onAttack((event) => this.handleAttackEvent(event));
        this.networkManager.onHit((event) => this.handleHitEvent(event));

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
        this.showConnectionStatus(`Connected as Player ${this.localPlayerId + 1}`);

        // Setup stage
        this.createStage();

        // Setup input (local player only)
        this.inputManager = new InputManager(this, {
            playerId: this.localPlayerId,
            useKeyboard: true,
            gamepadIndex: null,
            enableGamepad: true
        });

        // Setup UI
        this.createUI();
        this.setupEscapeKey();

        // Start ping loop
        this.time.addEvent({
            delay: 1000,
            callback: () => this.networkManager.ping(),
            loop: true
        });
    }

    update(_time: number, delta: number): void {
        if (!this.isConnected) return;

        this.localFrame++;

        // Poll and send local input
        const input = this.inputManager.poll();
        this.networkManager.sendInput(input);

        // Save snapshot BEFORE applying input (for rollback)
        if (this.localPlayer) {
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
            this.networkManager.sendState({
                playerId: this.localPlayerId,
                x: this.localPlayer.x,
                y: this.localPlayer.y,
                velocityX: this.localPlayer.velocity.x,
                velocityY: this.localPlayer.velocity.y,
                facingDirection: this.localPlayer.getFacingDirection(),
                isGrounded: this.localPlayer.isGrounded,
                isAttacking: this.localPlayer.isAttacking,
                damagePercent: this.localPlayer.damagePercent
            });

            // Check local player attacks against all remote players
            this.players.forEach((target) => {
                if (target !== this.localPlayer) {
                    this.localPlayer!.checkHitAgainst(target);
                }
            });
        }

        // Update remote players (animations/logic, no physics)
        this.players.forEach((player) => {
            if (player !== this.localPlayer) {
                // Update logic for animations (but not physics)
                player.updateLogic(delta);
                this.checkBlastZone(player);
            }
        });

        // Update latency display
        this.latencyText?.setText(`Ping: ${this.networkManager.getLatency()}ms | Frame: ${this.localFrame}`);
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
        const serverFrame = state.frame;

        state.players.forEach((netPlayer: NetPlayerState) => {
            let player = this.players.get(netPlayer.playerId);

            // Create player if new
            if (!player) {
                player = this.createPlayer(netPlayer.playerId, netPlayer.x, netPlayer.y);
                this.players.set(netPlayer.playerId, player);

                if (netPlayer.playerId === this.localPlayerId) {
                    this.localPlayer = player;
                }
            }

            // For local player: check for divergence and reconcile if needed
            if (netPlayer.playerId === this.localPlayerId && this.localPlayer) {
                this.checkAndReconcile(netPlayer, serverFrame);
                return;
            }

            // Interpolate remote players
            this.interpolatePlayer(player, netPlayer);
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
    }

    private interpolatePlayer(player: Player, netState: NetPlayerState): void {
        // Simple lerp interpolation (can be improved with buffer)
        const lerpFactor = 0.3;
        player.x = Phaser.Math.Linear(player.x, netState.x, lerpFactor);
        player.y = Phaser.Math.Linear(player.y, netState.y, lerpFactor);
        player.velocity.x = netState.velocityX;
        player.velocity.y = netState.velocityY;
        player.isGrounded = netState.isGrounded;
        player.isAttacking = netState.isAttacking;
        player.setFacingDirection(netState.facingDirection);

        // Debug: Log state changes
        if (netState.isAttacking) {
            console.log(`[Remote] Player ${netState.playerId} isAttacking=${netState.isAttacking}`);
        }
    }

    /**
     * Check if player is outside blast zones and respawn if so
     */
    private checkBlastZone(player: Player): void {
        const inBlastZone =
            player.x < this.BLAST_ZONE_LEFT ||
            player.x > this.BLAST_ZONE_RIGHT ||
            player.y < this.BLAST_ZONE_TOP ||
            player.y > this.BLAST_ZONE_BOTTOM;

        if (inBlastZone) {
            // Respawn at center of stage
            player.x = 960;
            player.y = 700;
            player.velocity.x = 0;
            player.velocity.y = 0;
            player.respawn();
            console.log(`[OnlineGame] Player ${player.playerId} respawned from blast zone`);
        }
    }

    private createPlayer(playerId: number, x: number, y: number): Player {
        const isLocal = playerId === this.localPlayerId;

        const player = new Player(this, x, y, {
            playerId: playerId,
            isAI: false,
            useKeyboard: isLocal,
            gamepadIndex: null,
            character: 'fok'
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
                    console.log(`[OnlineGame] Hit remote player ${target.playerId} for ${dmg} dmg`);
                }
            };
        }

        // Visual distinction for remote players
        if (!isLocal) {
            player.spriteObject.setTint(0x888888); // Gray tint for remote
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

        this.latencyText = this.add.text(10, 10, 'Ping: ---', {
            fontSize: '16px',
            color: '#00ff00'
        }).setScrollFactor(0).setDepth(1000);
    }

    private createStage(): void {
        // Background gradient
        const bg = this.add.graphics();
        bg.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a1a2e, 0x1a1a2e, 1);
        bg.fillRect(0, 0, this.scale.width, this.scale.height);
        bg.setDepth(-10);

        // Side walls (matching GameScene)
        const leftWall = this.add.rectangle(this.WALL_LEFT_X, 540, this.WALL_THICKNESS, 1080, 0x2a3a4e);
        leftWall.setStrokeStyle(4, 0x4a6a8e);
        leftWall.setAlpha(0.6);
        leftWall.setDepth(-5);

        const rightWall = this.add.rectangle(this.WALL_RIGHT_X, 540, this.WALL_THICKNESS, 1080, 0x2a3a4e);
        rightWall.setStrokeStyle(4, 0x4a6a8e);
        rightWall.setAlpha(0.6);
        rightWall.setDepth(-5);

        // Main platform (matching GameScene)
        const mainPlatform = this.add.rectangle(960, 825, 1350, 45, 0x2c3e50);
        mainPlatform.setStrokeStyle(3, 0x3a506b);
        this.platforms.push(mainPlatform);

        // Soft platforms
        const softPlatform1 = this.add.rectangle(570, 600, 360, 24, 0x0f3460);
        softPlatform1.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform1.setAlpha(0.85);
        this.softPlatforms.push(softPlatform1);

        const softPlatform2 = this.add.rectangle(1350, 600, 360, 24, 0x0f3460);
        softPlatform2.setStrokeStyle(2, 0x1a4d7a, 0.8);
        softPlatform2.setAlpha(0.85);
        this.softPlatforms.push(softPlatform2);
    }

    private setupEscapeKey(): void {
        this.input.keyboard?.on('keydown-ESC', () => {
            this.networkManager.disconnect();
            this.scene.start('MainMenuScene');
        });
    }
}
