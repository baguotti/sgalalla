/**
 * Sgalalla Game Server
 * WebRTC server using Geckos.io for low-latency multiplayer
 */

import geckos, { iceServers } from '@geckos.io/server';
import { LobbyManager } from './LobbyManager';

// Network message types (mirrored from client)
const NetMessageType = {
    INPUT: 'input',
    STATE_UPDATE: 'state_update',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    GAME_START: 'game_start',
    PING: 'ping',
    PONG: 'pong',
    REMATCH_VOTE: 'rematch_vote',
    REMATCH_START: 'rematch_start',
    LOBBY_JOIN: 'lobby_join',
    LOBBY_CHARACTER: 'lobby_character',
    LOBBY_READY: 'lobby_ready',
    LOBBY_LEAVE: 'lobby_leave',
    LOBBY_STATE: 'lobby_state',
    LOBBY_START: 'lobby_start'
} as const;

interface PlayerState {
    playerId: number;
    x: number;
    y: number;
    velocityX: number;
    velocityY: number;
    facingDirection: number;
    isGrounded: boolean;
    isAttacking: boolean;
    animationKey: string;
    damagePercent: number;
    lives: number;
}

interface GameRoom {
    players: Map<string, PlayerState>;
    frame: number;
    rematchVotes: Set<string>; // Track channel IDs that voted for rematch
}

// Animation key enum for binary decoding (must match client BinaryCodec.ts)
const ANIMATION_KEYS = [
    '',           // 0 - empty/idle
    'idle',       // 1
    'run',        // 2
    'jump',       // 3
    'fall',       // 4
    'attack_light', // 5
    'attack_heavy', // 6
    'attack_up',  // 7
    'hurt',       // 8
    'slide',      // 9
    'dash',       // 10
    'block',      // 11
    'charge',     // 12
];

/**
 * Decode binary player state (15 bytes) from client
 */
function decodeBinaryPlayerState(buffer: ArrayBuffer): Partial<PlayerState> | null {
    if (buffer.byteLength !== 15) return null;

    const view = new DataView(buffer);
    const flags = view.getUint8(10);
    const animIndex = view.getUint8(11);

    return {
        playerId: view.getUint8(0),
        x: view.getInt16(1, true) / 10,
        y: view.getInt16(3, true) / 10,
        velocityX: view.getInt16(5, true) / 10,
        velocityY: view.getInt16(7, true) / 10,
        facingDirection: view.getInt8(9),
        isGrounded: (flags & 0x01) !== 0,
        isAttacking: (flags & 0x02) !== 0,
        animationKey: ANIMATION_KEYS[animIndex] || '',
        damagePercent: view.getUint16(12, true),
        lives: view.getUint8(14),
    };
}

const PORT = 9208;
const rooms: Map<string, GameRoom> = new Map();
const lobbyManager = new LobbyManager();
// Removed global nextPlayerId

// Create Geckos.io server (v3 API - no separate HTTP server needed)
const io = geckos({
    iceServers: iceServers,
    cors: { origin: '*', allowAuthorization: true }
});

io.listen(PORT);
console.log(`[Server] Geckos.io server running on port ${PORT}`);

io.onConnection((channel) => {
    const roomId = 'default'; // Single room for now

    // Create room if needed
    if (!rooms.has(roomId)) {
        rooms.set(roomId, { players: new Map(), frame: 0, rematchVotes: new Set() });
    }
    const room = rooms.get(roomId)!;



    console.log(`[Server] Player connected (${channel.id})`);

    // Join channel to room for broadcasting
    channel.join(roomId);

    // Notify player of connection (triggers client onConnected callback)
    channel.emit(NetMessageType.PLAYER_JOINED, { playerId: 0 }); // playerId will be assigned by lobby

    // NOTE: Game room player creation is deferred until lobby match start
    // Lobby handles player registration separately via LOBBY_JOIN event


    // Handle input from client (legacy - still accept inputs but don't use for physics)
    channel.on(NetMessageType.INPUT, (data: any) => {
        const player = room.players.get(channel.id!);
        if (!player) return;
        // Input received - we no longer simulate based on this
        // Client is authoritative and will send position updates
    });

    // Handle position update from client (client-authoritative, binary encoded)
    channel.on('position_update', (data: any) => {
        const player = room.players.get(channel.id!);
        if (!player) return;

        // Try to decode binary data (Geckos.io sends as Uint8Array)
        let decoded: Partial<PlayerState> | null = null;

        if (data instanceof Uint8Array) {
            // Direct Uint8Array from Geckos.io
            decoded = decodeBinaryPlayerState(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
        } else if (data instanceof ArrayBuffer) {
            decoded = decodeBinaryPlayerState(data);
        } else if (data?.buffer instanceof ArrayBuffer) {
            // Typed array view
            decoded = decodeBinaryPlayerState(data.buffer);
        }

        // Use decoded data or fall back to JSON (backwards compatibility)
        const src = decoded || data;
        if (src) {
            player.x = src.x ?? player.x;
            player.y = src.y ?? player.y;
            player.velocityX = src.velocityX ?? player.velocityX;
            player.velocityY = src.velocityY ?? player.velocityY;
            player.facingDirection = src.facingDirection ?? player.facingDirection;
            player.isGrounded = src.isGrounded ?? player.isGrounded;
            player.isAttacking = src.isAttacking ?? player.isAttacking;
            player.animationKey = src.animationKey ?? player.animationKey;
            player.damagePercent = src.damagePercent ?? player.damagePercent;
            player.lives = src.lives ?? player.lives;
        }
    });

    // Handle ping
    channel.on(NetMessageType.PING, () => {
        channel.emit(NetMessageType.PONG, {});
    });

    // Relay attack events to all clients
    channel.on('attack_start', (data: any) => {
        io.emit('attack_start', data);
    });

    // Relay hit events to all clients
    channel.on('hit_event', (data: any) => {
        io.emit('hit_event', data);
    });

    // ===== LOBBY EVENT HANDLERS =====

    // Create lobby for this room
    if (!lobbyManager.getLobbyState(roomId)) {
        lobbyManager.createLobby(roomId);
    }

    // Lobby join
    channel.on(NetMessageType.LOBBY_JOIN, () => {
        const result = lobbyManager.joinLobby(roomId, channel.id!);
        if (result.success) {
            console.log(`[Server] Player joined lobby: slot ${result.slotIndex}`);
            const lobbyState = lobbyManager.getLobbyState(roomId);
            channel.room?.emit(NetMessageType.LOBBY_STATE, { players: lobbyState });
        }
    });

    // Character selection
    channel.on(NetMessageType.LOBBY_CHARACTER, (data: any) => {
        const { characterId } = data;
        lobbyManager.selectCharacter(roomId, channel.id!, characterId);
        const lobbyState = lobbyManager.getLobbyState(roomId);
        channel.room?.emit(NetMessageType.LOBBY_STATE, { players: lobbyState });
    });

    // Ready toggle
    channel.on(NetMessageType.LOBBY_READY, () => {
        lobbyManager.toggleReady(roomId, channel.id!);
        const lobbyState = lobbyManager.getLobbyState(roomId);
        channel.room?.emit(NetMessageType.LOBBY_STATE, { players: lobbyState });

        // Check if match can start
        if (lobbyManager.canStartMatch(roomId)) {
            console.log('[Server] Lobby ready! Starting match...');
            const players = lobbyManager.getLobbyState(roomId);
            channel.room?.emit(NetMessageType.LOBBY_START, { players });
        }
    });

    // Handle disconnect
    channel.onDisconnect(() => {
        console.log(`[Server] Player disconnected (${channel.id})`);
        room.players.delete(channel.id!);
        room.rematchVotes.delete(channel.id!); // Clear their vote

        // Broadcast departure
        io.emit(NetMessageType.PLAYER_LEFT, { playerId: 0 }); // Legacy event
    });

    // Handle rematch vote
    channel.on(NetMessageType.REMATCH_VOTE, () => {
        console.log(`[Server] Player ${channel.id} voted for rematch`);
        room.rematchVotes.add(channel.id!);

        // Check if all players voted
        if (room.rematchVotes.size >= room.players.size && room.players.size >= 2) {
            console.log('[Server] All players voted for rematch! Starting new game.');

            // Reset game state
            const spawnPoints = [600, 1200];
            let idx = 0;
            room.players.forEach((playerState) => {
                playerState.x = spawnPoints[idx % 2];
                playerState.y = 780;
                playerState.velocityX = 0;
                playerState.velocityY = 0;
                playerState.isGrounded = true;
                playerState.isAttacking = false;
                playerState.damagePercent = 0;
                playerState.lives = 3;
                idx++;
            });
            room.frame = 0;
            room.rematchVotes.clear();

            // Broadcast rematch start
            io.emit(NetMessageType.REMATCH_START, {});
        }
    });
});

// Game loop - send state updates at 60fps
// Physics constants (matching client PhysicsConfig)
const GRAVITY = 3750;
const MAX_SPEED = 750;
const MOVE_ACCEL = 3600;
const FRICTION = 0.85;
const JUMP_FORCE = -1050;
const PLATFORM_TOP_Y = 825 - 45 / 2; // Main platform top = 825 - half height

setInterval(() => {
    const deltaSeconds = 1 / 60;

    rooms.forEach((room) => {
        room.frame++;

        // NO SERVER PHYSICS - clients are authoritative
        // Server just relays the positions received from clients

        // Build state snapshot
        const state = {
            frame: room.frame,
            confirmedInputFrame: room.frame,
            players: Array.from(room.players.values())
        };

        // Broadcast to all players in room
        io.emit(NetMessageType.STATE_UPDATE, state);
    });
}, 1000 / 60);
