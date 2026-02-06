/**
 * NetworkManager.ts
 * Singleton for handling client-side networking via Geckos.io (WebRTC DataChannels)
 * 
 * Architecture:
 * - Client polls local input, sends to server each frame
 * - Server broadcasts authoritative game state
 * - Client interpolates/predicts based on received state
 * - INPUT BUFFER: Stores last N frames of inputs for rollback replay
 */

import geckos from '@geckos.io/client';
import type { ClientChannel, Data } from '@geckos.io/client';
import type { InputState } from '../input/InputManager';
import { InputBuffer, SnapshotBuffer } from './StateSnapshot';
import type { FrameInput, GameSnapshot } from './StateSnapshot';
import { shouldSendState } from './BinaryCodec';

// Network message types
export const NetMessageType = {
    INPUT: 'input',
    STATE_UPDATE: 'state_update',
    POSITION_UPDATE: 'position_update', // Client sends its position to server
    ATTACK_START: 'attack_start',       // Client started an attack
    HIT_EVENT: 'hit_event',             // Attack hit confirmed
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    GAME_START: 'game_start',
    PING: 'ping',
    PONG: 'pong',
    INPUT_ACK: 'input_ack', // Server acknowledges input received
    REMATCH_VOTE: 'rematch_vote',
    REMATCH_START: 'rematch_start',
    // Character Selection
    CHARACTER_SELECT: 'character_select',
    SELECTION_START: 'selection_start',
    SELECTION_TICK: 'selection_tick',
    CHARACTER_CONFIRM: 'character_confirm'
} as const;

// Serialized input for network transmission
export interface NetInput {
    frame: number;
    playerId: number;
    input: InputState;
}

// Minimal player state for sync
export interface NetPlayerState {
    playerId: number;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    facingDirection: number;
    isGrounded: boolean;
    isAttacking: boolean;
    animationKey?: string; // e.g. 'attack_heavy', 'attack_up', 'hurt', 'slide'
    damagePercent: number;
    lives: number;
}

// Full game state snapshot from server
export interface NetGameState {
    frame: number;
    players: NetPlayerState[];
    confirmedInputFrame?: number; // Last frame server has confirmed all inputs for
}

// Attack event for sync
export interface NetAttackEvent {
    playerId: number;
    attackKey: string;     // e.g. 'light_neutral_grounded'
    facingDirection: number;
}

// Hit event for damage sync
export interface NetHitEvent {
    attackerId: number;
    victimId: number;
    damage: number;
    knockbackX: number;
    knockbackY: number;
}

export type ConnectionCallback = (playerId: number) => void;
export type StateUpdateCallback = (state: NetGameState) => void;
export type DisconnectCallback = () => void;
export type RollbackCallback = (targetFrame: number, confirmedState: NetGameState) => void;
export type AttackCallback = (attack: NetAttackEvent) => void;
export type HitCallback = (hit: NetHitEvent) => void;
export type RematchStartCallback = () => void;
export type PlayerLeftCallback = (playerId: number) => void;
// Selection callbacks
export type SelectionStartCallback = (countdown: number) => void;
export type SelectionTickCallback = (countdown: number) => void;
export type CharacterSelectCallback = (playerId: number, character: string) => void;
export type CharacterConfirmCallback = (playerId: number) => void;
export type GameStartCallback = (players: { playerId: number; character: string }[]) => void;

class NetworkManager {
    private static instance: NetworkManager | null = null;

    private channel: ClientChannel | null = null;
    private connected: boolean = false;
    private localPlayerId: number = -1;
    private currentFrame: number = 0;

    // ============ ROLLBACK NETCODE SUPPORT ============
    // Input buffer for replay
    private inputBuffer: InputBuffer = new InputBuffer(120);
    // State snapshot buffer for rollback
    private snapshotBuffer: SnapshotBuffer = new SnapshotBuffer(60);
    // Last frame confirmed by server (all inputs received)
    private confirmedFrame: number = 0;
    // Local prediction frame (always >= confirmedFrame)
    private localFrame: number = 0;

    // Callbacks
    private onConnectedCallback: ConnectionCallback | null = null;
    private onStateUpdateCallback: StateUpdateCallback | null = null;
    private onDisconnectCallback: DisconnectCallback | null = null;
    private onAttackCallback: AttackCallback | null = null;
    private onHitCallback: HitCallback | null = null;
    private onRematchStartCallback: RematchStartCallback | null = null;
    private onPlayerLeftCallback: PlayerLeftCallback | null = null;
    // Selection callbacks
    private onSelectionStartCallback: SelectionStartCallback | null = null;
    private onSelectionTickCallback: SelectionTickCallback | null = null;
    private onCharacterSelectCallback: CharacterSelectCallback | null = null;
    private onCharacterConfirmCallback: CharacterConfirmCallback | null = null;
    private onGameStartCallback: GameStartCallback | null = null;

    // Latency tracking with smoothing
    private lastPingTime: number = 0;
    private latency: number = 0;
    private smoothedLatency: number = 0;  // EMA for stable display

    private constructor() { }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    /**
     * Connect to the game server
     * @param port - Override server port (default: 9208 local, fly.io production)
     */
    public async connect(overridePort?: number): Promise<boolean> {
        return new Promise((resolve) => {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const url = isLocal ? `http://localhost` : `https://sgalalla-geckos.fly.dev`;
            const port = overridePort || (isLocal ? 9208 : 443);

            console.log(`[NetworkManager] Connecting to ${url}:${port}...`);

            this.channel = geckos({
                url: url,
                port: port
            });

            this.channel.onConnect((error) => {
                if (error) {
                    console.error('[NetworkManager] Connection failed:', error);
                    this.connected = false;
                    resolve(false);
                    return;
                }

                console.log('[NetworkManager] WebRTC connected, waiting for player assignment...');
                this.connected = true;

                // Clear buffers on new connection
                this.inputBuffer.clear();
                this.snapshotBuffer.clear();
                this.localFrame = 0;
                this.confirmedFrame = 0;

                // Setup message handlers and wait for PLAYER_JOINED
                this.setupMessageHandlers(resolve);
            });

            this.channel.onDisconnect(() => {
                console.log('[NetworkManager] Disconnected');
                this.connected = false;
                this.onDisconnectCallback?.();
            });
        });
    }

    private setupMessageHandlers(onPlayerAssigned: (success: boolean) => void): void {
        if (!this.channel) return;

        // Player assignment from server - resolve connect() promise here
        this.channel.on(NetMessageType.PLAYER_JOINED, (data: Data) => {
            const payload = data as { playerId: number };
            this.localPlayerId = payload.playerId;
            console.log(`[NetworkManager] Assigned Player ID: ${this.localPlayerId}`);
            this.onConnectedCallback?.(this.localPlayerId);
            onPlayerAssigned(true); // Now resolve the connect() promise
        });

        // Game state updates from server
        this.channel.on(NetMessageType.STATE_UPDATE, (data: Data) => {
            const state = data as NetGameState;
            this.currentFrame = state.frame;

            // Check for state divergence that requires rollback
            if (state.confirmedInputFrame && state.confirmedInputFrame > this.confirmedFrame) {
                const oldConfirmed = this.confirmedFrame;
                this.confirmedFrame = state.confirmedInputFrame;

                // Mark inputs as confirmed
                for (let f = oldConfirmed + 1; f <= this.confirmedFrame; f++) {
                    this.inputBuffer.confirmInput(f, this.localPlayerId);
                }
            }

            this.onStateUpdateCallback?.(state);
        });

        // Latency measurement with EMA smoothing
        this.channel.on(NetMessageType.PONG, () => {
            this.latency = Date.now() - this.lastPingTime;
            // EMA: smoothed = alpha * new + (1 - alpha) * old (alpha = 0.3 for responsive smoothing)
            if (this.smoothedLatency === 0) {
                this.smoothedLatency = this.latency;
            } else {
                this.smoothedLatency = 0.3 * this.latency + 0.7 * this.smoothedLatency;
            }
        });

        // Attack events from other players
        this.channel.on(NetMessageType.ATTACK_START, (data: Data) => {
            const attack = data as NetAttackEvent;
            // Only trigger callback for remote players (not our own attack echo)
            if (attack.playerId !== this.localPlayerId) {
                this.onAttackCallback?.(attack);
            }
        });

        // Hit events (damage/knockback)
        this.channel.on(NetMessageType.HIT_EVENT, (data: Data) => {
            const hit = data as NetHitEvent;
            // Only apply if we are the victim
            if (hit.victimId === this.localPlayerId) {
                this.onHitCallback?.(hit);
            }
        });

        // Rematch start event
        this.channel.on(NetMessageType.REMATCH_START, () => {
            console.log('[NetworkManager] Rematch starting!');
            this.onRematchStartCallback?.();
        });

        // Player left event
        this.channel.on(NetMessageType.PLAYER_LEFT, (data: Data) => {
            const { playerId } = data as { playerId: number };
            this.onPlayerLeftCallback?.(playerId);
        });

        // Selection phase events
        this.channel.on(NetMessageType.SELECTION_START, (data: Data) => {
            const { countdown } = data as { countdown: number };
            console.log(`[NetworkManager] Selection started, ${countdown}s`);
            this.onSelectionStartCallback?.(countdown);
        });

        this.channel.on(NetMessageType.SELECTION_TICK, (data: Data) => {
            const { countdown } = data as { countdown: number };
            this.onSelectionTickCallback?.(countdown);
        });

        this.channel.on(NetMessageType.CHARACTER_SELECT, (data: Data) => {
            const { playerId, character } = data as { playerId: number; character: string };
            // Only notify for other players (not self echo)
            if (playerId !== this.localPlayerId) {
                this.onCharacterSelectCallback?.(playerId, character);
            }
        });

        this.channel.on(NetMessageType.CHARACTER_CONFIRM, (data: Data) => {
            const { playerId } = data as { playerId: number };
            this.onCharacterConfirmCallback?.(playerId);
        });

        this.channel.on(NetMessageType.GAME_START, (data: Data) => {
            const { players } = data as { players: { playerId: number; character: string }[] };
            console.log('[NetworkManager] Game starting!', players);
            this.onGameStartCallback?.(players);
        });
    }

    /**
     * Record and send local input to server
     * Call this every frame with the local player's input
     */
    public sendInput(input: InputState): void {
        if (!this.connected || !this.channel) return;

        this.localFrame++;

        // Store in local buffer for potential replay
        const frameInput: FrameInput = {
            frame: this.localFrame,
            playerId: this.localPlayerId,
            input: input,
            confirmed: false
        };
        this.inputBuffer.addInput(frameInput);

        // Send to server
        const netInput: NetInput = {
            frame: this.localFrame,
            playerId: this.localPlayerId,
            input: input
        };

        this.channel.emit(NetMessageType.INPUT, netInput, { reliable: false });
    }

    // Delta compression: track last sent state
    private lastSentState: NetPlayerState | null = null;

    /**
     * Send local player's actual position state to server (with delta compression)
     * Server will relay this to other clients
     */
    public sendState(state: NetPlayerState): void {
        if (!this.connected || !this.channel) return;

        // Delta compression: skip if state hasn't changed significantly
        if (!shouldSendState(state, this.lastSentState)) {
            return;
        }

        // Send as JSON (binary encoding deferred until server decode is fixed)
        this.channel.emit(NetMessageType.POSITION_UPDATE, state, { reliable: false });
        this.lastSentState = { ...state };
    }

    /**
     * Send attack start event to server for relay to other clients
     */
    public sendAttack(attackKey: string, facingDirection: number): void {
        if (!this.connected || !this.channel) return;
        const attack: NetAttackEvent = {
            playerId: this.localPlayerId,
            attackKey,
            facingDirection
        };
        this.channel.emit(NetMessageType.ATTACK_START, attack, { reliable: true });
    }

    /**
     * Send hit event to server (attacker confirms hit)
     */
    public sendHit(victimId: number, damage: number, knockbackX: number, knockbackY: number): void {
        if (!this.connected || !this.channel) return;
        const hit: NetHitEvent = {
            attackerId: this.localPlayerId,
            victimId,
            damage,
            knockbackX,
            knockbackY
        };
        this.channel.emit(NetMessageType.HIT_EVENT, hit, { reliable: true });
    }

    /**
     * Store a game state snapshot for potential rollback
     */
    public saveSnapshot(snapshot: GameSnapshot): void {
        this.snapshotBuffer.push(snapshot);
    }

    /**
     * Get a snapshot for rollback
     */
    public getSnapshot(frame: number): GameSnapshot | undefined {
        return this.snapshotBuffer.get(frame);
    }

    /**
     * Get inputs stored for a specific frame
     */
    public getInputsForFrame(frame: number): FrameInput[] {
        return this.inputBuffer.getInputs(frame);
    }

    /**
     * Check if we need to rollback (prediction diverged from server)
     * Returns the frame we need to rollback to, or -1 if no rollback needed
     */
    public checkRollback(_serverState: NetGameState): number {
        // Simple check: if server frame is behind our local prediction by too much
        // we might need to correct. For now, return -1 (no rollback).
        // TODO: Implement proper state comparison
        return -1;
    }

    /**
     * Ping server for latency measurement
     */
    public ping(): void {
        if (!this.connected || !this.channel) return;
        this.lastPingTime = Date.now();
        this.channel.emit(NetMessageType.PING, {});
    }

    /**
     * Disconnect from server
     */
    public disconnect(): void {
        if (this.channel) {
            this.channel.close();
            this.channel = null;
        }
        this.connected = false;
        this.localPlayerId = -1;
        this.inputBuffer.clear();
        this.snapshotBuffer.clear();
    }

    // Getters
    public isConnected(): boolean { return this.connected; }
    public getLocalPlayerId(): number { return this.localPlayerId; }
    public getLatency(): number { return Math.round(this.smoothedLatency); }
    public getCurrentFrame(): number { return this.currentFrame; }
    public getLocalFrame(): number { return this.localFrame; }
    public getConfirmedFrame(): number { return this.confirmedFrame; }

    // Callback setters
    public onConnected(callback: ConnectionCallback): void { this.onConnectedCallback = callback; }
    public onStateUpdate(callback: StateUpdateCallback): void { this.onStateUpdateCallback = callback; }
    public onDisconnect(callback: DisconnectCallback): void { this.onDisconnectCallback = callback; }
    public onAttack(callback: AttackCallback): void { this.onAttackCallback = callback; }
    public onHit(callback: HitCallback): void { this.onHitCallback = callback; }
    public onRematchStart(callback: RematchStartCallback): void { this.onRematchStartCallback = callback; }
    public onPlayerLeft(callback: PlayerLeftCallback): void { this.onPlayerLeftCallback = callback; }
    // Selection callbacks
    public onSelectionStart(callback: SelectionStartCallback): void { this.onSelectionStartCallback = callback; }
    public onSelectionTick(callback: SelectionTickCallback): void { this.onSelectionTickCallback = callback; }
    public onCharacterSelect(callback: CharacterSelectCallback): void { this.onCharacterSelectCallback = callback; }
    public onCharacterConfirm(callback: CharacterConfirmCallback): void { this.onCharacterConfirmCallback = callback; }
    public onGameStart(callback: GameStartCallback): void { this.onGameStartCallback = callback; }

    /**
     * Send rematch vote to server
     */
    public sendRematchVote(): void {
        if (!this.connected || !this.channel) return;
        this.channel.emit(NetMessageType.REMATCH_VOTE, { playerId: this.localPlayerId }, { reliable: true });
    }

    /**
     * Send character selection to server
     */
    public sendCharacterSelect(character: string): void {
        if (!this.connected || !this.channel) return;
        this.channel.emit(NetMessageType.CHARACTER_SELECT, { character }, { reliable: true });
    }

    /**
     * Send character confirmation to server
     */
    public sendCharacterConfirm(): void {
        if (!this.connected || !this.channel) return;
        this.channel.emit(NetMessageType.CHARACTER_CONFIRM, {}, { reliable: true });
    }
}

export default NetworkManager;

