/**
 * Server-Side Lobby Manager
 * Handles player registration, character selection, ready status, and match start
 */

interface LobbyPlayer {
    slotIndex: number;
    socketId: string;
    characterId: string;
    isReady: boolean;
}

interface LobbyRoom {
    players: Map<number, LobbyPlayer>; // slotIndex → player
    minPlayers: number;
    maxPlayers: number;
}

export class LobbyManager {
    private lobbies: Map<string, LobbyRoom> = new Map();

    /**
     * Create a new lobby for a room
     */
    createLobby(roomId: string): void {
        this.lobbies.set(roomId, {
            players: new Map(),
            minPlayers: 2,
            maxPlayers: 4
        });
    }

    /**
     * Register a player to the lobby
     */
    joinLobby(roomId: string, socketId: string): { success: boolean; slotIndex?: number; error?: string } {
        const lobby = this.lobbies.get(roomId);
        if (!lobby) {
            return { success: false, error: 'Lobby not found' };
        }

        // Check if player already joined
        const existingPlayer = Array.from(lobby.players.values()).find(p => p.socketId === socketId);
        if (existingPlayer) {
            return { success: false, error: 'Already joined' };
        }

        // Check if lobby is full
        if (lobby.players.size >= lobby.maxPlayers) {
            return { success: false, error: 'Lobby full' };
        }

        // Find available slot
        const slotIndex = this.findAvailableSlot(lobby);
        if (slotIndex === -1) {
            return { success: false, error: 'No available slots' };
        }

        // Add player
        const player: LobbyPlayer = {
            slotIndex,
            socketId,
            characterId: 'fok', // Default character
            isReady: false
        };

        lobby.players.set(slotIndex, player);
        return { success: true, slotIndex };
    }

    /**
     * Update player's character selection
     */
    selectCharacter(roomId: string, socketId: string, characterId: string): boolean {
        const lobby = this.lobbies.get(roomId);
        if (!lobby) return false;

        const player = Array.from(lobby.players.values()).find(p => p.socketId === socketId);
        if (!player) return false;

        player.characterId = characterId;
        return true;
    }

    /**
     * Toggle player's ready status
     */
    toggleReady(roomId: string, socketId: string): boolean {
        const lobby = this.lobbies.get(roomId);
        if (!lobby) return false;

        const player = Array.from(lobby.players.values()).find(p => p.socketId === socketId);
        if (!player) return false;

        player.isReady = !player.isReady;
        return true;
    }

    /**
     * Remove player from lobby
     */
    leaveLobby(roomId: string, socketId: string): boolean {
        const lobby = this.lobbies.get(roomId);
        if (!lobby) return false;

        const player = Array.from(lobby.players.values()).find(p => p.socketId === socketId);
        if (!player) return false;

        lobby.players.delete(player.slotIndex);
        return true;
    }

    /**
     * Check if lobby can start match
     */
    canStartMatch(roomId: string): boolean {
        const lobby = this.lobbies.get(roomId);
        if (!lobby) return false;

        const playerCount = lobby.players.size;
        if (playerCount < lobby.minPlayers) return false;

        // All players must be ready
        return Array.from(lobby.players.values()).every(p => p.isReady);
    }

    /**
     * Get lobby state for broadcasting
     */
    getLobbyState(roomId: string): LobbyPlayer[] | null {
        const lobby = this.lobbies.get(roomId);
        if (!lobby) return null;

        return Array.from(lobby.players.values());
    }

    /**
     * Destroy lobby
     */
    destroyLobby(roomId: string): void {
        this.lobbies.delete(roomId);
    }

    private findAvailableSlot(lobby: LobbyRoom): number {
        for (let i = 0; i < lobby.maxPlayers; i++) {
            if (!lobby.players.has(i)) return i;
        }
        return -1;
    }
}
