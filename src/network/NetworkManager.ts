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

// Network message types
export const NetMessageType = {
    INPUT: 'input',
    STATE_UPDATE: 'state_update',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    GAME_START: 'game_start',
    PING: 'ping',
    PONG: 'pong',
    INPUT_ACK: 'input_ack' // Server acknowledges input received
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
    damagePercent: number;
}

// Full game state snapshot from server
export interface NetGameState {
    frame: number;
    players: NetPlayerState[];
    confirmedInputFrame?: number; // Last frame server has confirmed all inputs for
}

export type ConnectionCallback = (playerId: number) => void;
export type StateUpdateCallback = (state: NetGameState) => void;
export type DisconnectCallback = () => void;
export type RollbackCallback = (targetFrame: number, confirmedState: NetGameState) => void;

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
    private onRollbackCallback: RollbackCallback | null = null;

    // Latency tracking
    private lastPingTime: number = 0;
    private latency: number = 0;

    private constructor() { }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    /**
     * Connect to the game server
     * @param port - Server port (default: 9208)
     */
    public async connect(port: number = 9208): Promise<boolean> {
        return new Promise((resolve) => {
            console.log(`[NetworkManager] Connecting to localhost:${port}...`);

            this.channel = geckos({ port: port });

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

        // Latency measurement
        this.channel.on(NetMessageType.PONG, () => {
            this.latency = Date.now() - this.lastPingTime;
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
    public getLatency(): number { return this.latency; }
    public getCurrentFrame(): number { return this.currentFrame; }
    public getLocalFrame(): number { return this.localFrame; }
    public getConfirmedFrame(): number { return this.confirmedFrame; }

    // Callback setters
    public onConnected(callback: ConnectionCallback): void { this.onConnectedCallback = callback; }
    public onStateUpdate(callback: StateUpdateCallback): void { this.onStateUpdateCallback = callback; }
    public onDisconnect(callback: DisconnectCallback): void { this.onDisconnectCallback = callback; }
    public onRollback(callback: RollbackCallback): void { this.onRollbackCallback = callback; }
}

export default NetworkManager;

