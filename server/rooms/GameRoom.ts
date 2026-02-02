import { Room, Client } from "@colyseus/core";
import { GameState, Player } from "@shared/schema/GameState";
import { PlayerState } from "../../shared/entities/PlayerState";
import { InputState } from "../../shared/input/InputState";
import { PhysicsConfig } from "../../shared/physics/PhysicsConfig";

export class GameRoom extends Room<GameState> {
    maxClients = 4;

    // Server-side physics state (Not synced directly, synced via Schema)
    public playerEntities = new Map<string, PlayerState>();

    // Input buffer & Queues
    private playerInputs = new Map<string, InputState>(); // Keep for compatibility if needed, but we use queues
    private playerInputQueues: Map<string, InputState[]> = new Map();
    private lastProcessedInputs: Map<string, InputState> = new Map();

    private physicsAccumulator = 0;
    private readonly FIXED_STEP = 1000 / 60; // 16.66ms

    onCreate(options: any) {
        console.log("GameRoom created!", options);
        this.setState(new GameState());

        // Set simulation interval (60 FPS)
        this.setSimulationInterval((dt) => this.update(dt), 1000 / 60);

        // 30Hz patch rate is standard for smooth interpolation with less congestion
        this.setPatchRate(33);


        // Input Handler
        this.onMessage("input", (client, input: InputState) => {
            if (!this.playerInputQueues.has(client.sessionId)) {
                this.playerInputQueues.set(client.sessionId, []);
            }
            this.playerInputQueues.get(client.sessionId).push(input);

            // Debug log occasionally
            if (input.sequence % 60 === 0 && (input.moveLeft || input.moveRight || input.jump)) {
                console.log(`[Server] Recv Seq ${input.sequence} from ${client.sessionId.substr(0, 4)}`);
            }
        });

        // Debug/Cheat handler
        this.onMessage("move", (client, data) => {
            const player = this.playerEntities.get(client.sessionId);
            if (player) {
                player.y = data.y;
            }
        });

        // Lobby Handlers
        this.onMessage("select_character", (client, charId: string) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.character = charId;
                player.isReady = false; // Reset ready on change
            }
        });

        this.onMessage("ready", (client, isReady: boolean) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.isReady = isReady;
                this.checkAllPlayersReady();
            }
        });
    }

    onJoin(client: Client, options: any) {
        console.log(client.sessionId, "joined!");

        // Initialize state and queue
        this.playerInputQueues.set(client.sessionId, []);

        // 1. Create Schema (Network Data)
        const playerSchema = new Player();
        playerSchema.id = client.sessionId;

        // Find used slots
        const usedSlots = new Set<number>();
        this.state.players.forEach(p => {
            if (p.slotIndex !== -1) usedSlots.add(p.slotIndex);
        });

        // Assign first available Slot Index (0-3)
        for (let i = 0; i < this.maxClients; i++) {
            if (!usedSlots.has(i)) {
                playerSchema.slotIndex = i;
                break;
            }
        }

        // --- Aligned Spawn Points (Same as GameScene.ts) ---
        const spawnPoints = [
            { x: 450, y: 300 },
            { x: 1470, y: 300 },
            { x: 960, y: 200 },
            { x: 960, y: 400 }
        ];
        const spawn = spawnPoints[playerSchema.slotIndex] || { x: 960, y: 300 };
        playerSchema.x = spawn.x;
        playerSchema.y = spawn.y;

        console.log(`Assigned Slot ${playerSchema.slotIndex} at [${playerSchema.x}, ${playerSchema.y}] to ${client.sessionId}`);

        // 2. Create Logic Entity (Physics)
        const playerLogic = new PlayerState(spawn.x, spawn.y);
        this.playerEntities.set(client.sessionId, playerLogic);

        // 3. Add to Room State
        this.state.players.set(client.sessionId, playerSchema);
    }

    onLeave(client: Client, consented: boolean) {
        console.log(client.sessionId, "left!");
        this.state.players.delete(client.sessionId);
        this.playerEntities.delete(client.sessionId);
        this.playerInputQueues.delete(client.sessionId);
        this.lastProcessedInputs.delete(client.sessionId);
    }

    onDispose() {
        console.log("room", this.roomId, "disposing...");
    }

    update(deltaTime: number) {
        // deltaTime is in milliseconds
        this.physicsAccumulator += deltaTime;

        // Safety cap
        if (this.physicsAccumulator > 250) this.physicsAccumulator = 250;

        while (this.physicsAccumulator >= this.FIXED_STEP) {
            this.physicsAccumulator -= this.FIXED_STEP;
            this.fixedUpdate(this.FIXED_STEP);
        }
    }

    fixedUpdate(delta: number) {
        this.playerEntities.forEach((playerLogic, sessionId) => {
            const schema = this.state.players.get(sessionId);
            if (!schema) return;

            const queue = this.playerInputQueues.get(sessionId) || [];

            // --- 1. PROCESS INPUTS & UPDATE LOGIC ---
            if (queue.length === 0) {
                // If no input this frame, update with 'undefined' (still applies gravity/friction)
                playerLogic.update(delta, undefined);
            } else {
                // Controlled Catch-Up: 
                // - Process 1 input normally.
                // - Process 2 inputs if we are falling behind (queue > 2).
                const inputsToProcess = queue.length > 2 ? 2 : 1;

                for (let i = 0; i < inputsToProcess; i++) {
                    const input = queue.shift();
                    if (!input) break;

                    playerLogic.update(delta, input);

                    if (input.sequence !== undefined && input.sequence !== -1) {
                        schema.lastProcessedInput = input.sequence;
                    }
                }
            }

            // --- 2. COLLISIONS (Now internal to playerLogic.update) ---
            // checkBlastZones is still external as it potentially modifies room state (respawn)
            this.checkBlastZones(playerLogic, sessionId);

            // --- 3. SYNC LOGIC TO SCHEMA ---
            schema.x = playerLogic.x;
            schema.y = playerLogic.y;
            schema.vx = playerLogic.velocity.x;
            schema.vy = playerLogic.velocity.y;
            schema.isGrounded = playerLogic.isGrounded;
            schema.isJumping = playerLogic.velocity.y < 0 && !playerLogic.isGrounded;
            schema.isDodging = playerLogic.isDodging;
            schema.isAttacking = playerLogic.isAttacking;
            schema.isHitStunned = playerLogic.isHitStunned;
            schema.isWallSliding = playerLogic.isWallSliding;
            schema.isTouchingWall = playerLogic.isTouchingWall;
            schema.facingDirection = playerLogic.facingDirection;
            schema.isRunning = playerLogic.isRunning;
            schema.isFastFalling = playerLogic.isFastFalling;
            schema.wallDirection = playerLogic.wallDirection;
            schema.jumpsRemaining = playerLogic.jumpsRemaining;
            schema.airActionCounter = playerLogic.airActionCounter;
            schema.attackTimer = playerLogic.attackTimer;
            schema.isRecovering = playerLogic.isRecovering;
            schema.recoveryTimer = playerLogic.recoveryTimer;
            schema.dodgeTimer = playerLogic.dodgeTimer;
            schema.dodgeCooldownTimer = playerLogic.dodgeCooldownTimer;
            schema.wallTouchesExhausted = playerLogic.wallTouchesExhausted;
            schema.health = playerLogic.health;
            schema.wasJumpHeld = playerLogic.wasJumpHeld;
            schema.recoveryAvailable = playerLogic.recoveryAvailable;

            this.checkBlastZones(playerLogic, sessionId);

            // (Collisions handled in playerLogic.update)
        });
    }

    private checkBlastZones(playerLogic: PlayerState, sessionId: string): void {
        // Same dimensions as GameScene.ts
        const WORLD_WIDTH = 1920;
        const WORLD_HEIGHT = 1080;
        const BUFFER = 600;

        const BLAST_ZONE_LEFT = -BUFFER;
        const BLAST_ZONE_RIGHT = WORLD_WIDTH + BUFFER;
        const BLAST_ZONE_TOP = -BUFFER;
        const BLAST_ZONE_BOTTOM = WORLD_HEIGHT + BUFFER;

        if (playerLogic.x < BLAST_ZONE_LEFT ||
            playerLogic.x > BLAST_ZONE_RIGHT ||
            playerLogic.y < BLAST_ZONE_TOP ||
            playerLogic.y > BLAST_ZONE_BOTTOM) {

            console.log(`Player ${sessionId} died! Respawning...`);

            // Respawn logic
            const schema = this.state.players.get(sessionId);
            const slotIdx = schema ? schema.slotIndex : 0;

            const spawnPoints = [
                { x: 450, y: 300 },
                { x: 1470, y: 300 },
                { x: 960, y: 200 },
                { x: 960, y: 400 }
            ];
            const spawn = spawnPoints[slotIdx] || { x: 960, y: 300 };

            playerLogic.x = spawn.x;
            playerLogic.y = spawn.y;
            playerLogic.reset(); // Resets velocity, health, etc. on logic side

            if (schema) {
                schema.health = 0;
                // We could also broadcast a 'death' event if we want effects
                this.broadcast("player_death", { id: sessionId, x: spawn.x, y: spawn.y });
            }
        }
    }

    checkAllPlayersReady() {
        // Simple check: are there at least 2 players and are they all ready?
        // For testing, even 1 player ready might be enough.
        const players = Array.from(this.state.players.values());
        if (players.length > 0 && players.every(p => p.isReady)) {
            // Broadcast start
            console.log("All players ready! Broadcasting start_game");
            this.broadcast("start_game", {
                seed: Math.floor(Math.random() * 100000) // Sync RNG seed if we had one
            });

            // Lock room? 
            // this.lock();
        }
    }
}
