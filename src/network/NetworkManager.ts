import { Client, Room } from "colyseus.js";
import { GameState } from "@shared/schema/GameState";

export class NetworkManager {
    private static instance: NetworkManager;
    private client: Client;
    private room: Room<GameState> | null = null;
    private _sessionId: string = "";

    public get sessionId(): string {
        return this._sessionId;
    }

    private constructor() {
        // Adjust URL for production vs local
        const protocol = window.location.protocol.replace("http", "ws");
        const host = window.location.hostname;

        // Robust simple check - if port is 5173 (Vite default), we are likely in dev
        // otherwise assume production or custom setup
        const isDev = window.location.port === "5173" || !import.meta.env.PROD;

        const endpoint = isDev
            ? `${protocol}//${host}:2567`
            : `${protocol}//${window.location.host}`;

        console.log("NetworkManager initializing with endpoint:", endpoint);
        this.client = new Client(endpoint);
    }

    public static getInstance(): NetworkManager {
        if (!NetworkManager.instance) {
            NetworkManager.instance = new NetworkManager();
        }
        return NetworkManager.instance;
    }

    public async connect(): Promise<Room<GameState>> {
        if (this.room) return this.room;

        try {
            this.room = await this.client.joinOrCreate<GameState>("game_room");
            this._sessionId = this.room.sessionId;
            console.log("Connected to server! Session ID:", this._sessionId);
            return this.room;
        } catch (e) {
            console.error("Failed to connect:", e);
            throw e;
        }
    }

    public onPlayerJoined(callback: (id: string, player: any) => void): () => void {
        if (!this.room) return () => { };
        console.log("[Network] Registering onPlayerJoined listener");
        const unregister = this.room.state.players.onAdd((player, key) => callback(key, player));
        return () => {
            console.log("[Network] Unregistering onPlayerJoined listener");
            unregister();
        };
    }

    public onPlayerLeft(callback: (id: string) => void): () => void {
        if (!this.room) return () => { };
        console.log("[Network] Registering onPlayerLeft listener");
        const unregister = this.room.state.players.onRemove((player, key) => callback(key));
        return () => {
            console.log("[Network] Unregistering onPlayerLeft listener");
            unregister();
        };
    }

    public send(type: string | number, message?: any): void {
        if (this.room) {
            this.room.send(type, message);
        }
    }
}
