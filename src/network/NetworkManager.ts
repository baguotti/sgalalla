/**
 * NetworkManager.ts
 * Singleton for handling client-side networking via Geckos.io (WebRTC DataChannels)
 * 
 * Architecture:
 * - Client polls local input, sends to server each frame
 * - Server broadcasts authoritative game state
 * - Client interpolates/predicts based on received state
 */

import geckos from '@geckos.io/client';
import type { ClientChannel, Data } from '@geckos.io/client';
import type { InputState } from '../input/InputManager';

// Network message types
export const NetMessageType = {
    INPUT: 'input',
    STATE_UPDATE: 'state_update',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    GAME_START: 'game_start',
    PING: 'ping',
    PONG: 'pong'
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

// Full game state snapshot
export interface NetGameState {
    frame: number;
    players: NetPlayerState[];
}

export type ConnectionCallback = (playerId: number) => void;
export type StateUpdateCallback = (state: NetGameState) => void;
export type DisconnectCallback = () => void;

class NetworkManager {
    private static instance: NetworkManager | null = null;

    private channel: ClientChannel | null = null;
    private connected: boolean = false;
    private localPlayerId: number = -1;
    private currentFrame: number = 0;

    // Callbacks
    private onConnectedCallback: ConnectionCallback | null = null;
    private onStateUpdateCallback: StateUpdateCallback | null = null;
    private onDisconnectCallback: DisconnectCallback | null = null;

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
            this.onStateUpdateCallback?.(state);
        });

        // Latency measurement
        this.channel.on(NetMessageType.PONG, () => {
            this.latency = Date.now() - this.lastPingTime;
        });
    }

    /**
     * Send local input to server
     */
    public sendInput(input: InputState): void {
        if (!this.connected || !this.channel) return;

        const netInput: NetInput = {
            frame: this.currentFrame,
            playerId: this.localPlayerId,
            input: input
        };

        this.channel.emit(NetMessageType.INPUT, netInput, { reliable: false });
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
    }

    // Getters
    public isConnected(): boolean { return this.connected; }
    public getLocalPlayerId(): number { return this.localPlayerId; }
    public getLatency(): number { return this.latency; }
    public getCurrentFrame(): number { return this.currentFrame; }

    // Callback setters
    public onConnected(callback: ConnectionCallback): void { this.onConnectedCallback = callback; }
    public onStateUpdate(callback: StateUpdateCallback): void { this.onStateUpdateCallback = callback; }
    public onDisconnect(callback: DisconnectCallback): void { this.onDisconnectCallback = callback; }
}

export default NetworkManager;
