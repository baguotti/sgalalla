/**
 * Sgalalla Game Server
 * WebRTC server using Geckos.io for low-latency multiplayer
 */

import geckos, { iceServers } from '@geckos.io/server';

// Network message types (mirrored from client)
const NetMessageType = {
    INPUT: 'input',
    STATE_UPDATE: 'state_update',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    GAME_START: 'game_start',
    PING: 'ping',
    PONG: 'pong'
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
    damagePercent: number;
}

interface GameRoom {
    players: Map<string, PlayerState>;
    frame: number;
}

const PORT = 9208;
const rooms: Map<string, GameRoom> = new Map();
let nextPlayerId = 0;

// Create Geckos.io server (v3 API - no separate HTTP server needed)
const io = geckos({
    iceServers: iceServers,
    cors: { origin: '*', allowAuthorization: true }
});

io.listen(PORT);
console.log(`[Server] Geckos.io server running on port ${PORT}`);

io.onConnection((channel) => {
    const playerId = nextPlayerId++;
    const roomId = 'default'; // Single room for now

    console.log(`[Server] Player ${playerId} connected (${channel.id})`);

    // Create room if needed
    if (!rooms.has(roomId)) {
        rooms.set(roomId, { players: new Map(), frame: 0 });
    }

    const room = rooms.get(roomId)!;

    // Initialize player state (spawn on main platform at y=780)
    // Platform spans x=285 to x=1635 (center=960, width=1350)
    // Use fixed spawn points, alternating based on playerId
    const spawnPoints = [600, 1200]; // Both well within platform
    const spawnX = spawnPoints[playerId % 2];
    const playerState: PlayerState = {
        playerId,
        x: spawnX,
        y: 780,
        velocityX: 0,
        velocityY: 0,
        facingDirection: playerId % 2 === 0 ? 1 : -1,
        isGrounded: true,
        isAttacking: false,
        damagePercent: 0
    };

    room.players.set(channel.id!, playerState);

    // Notify player of their ID
    channel.emit(NetMessageType.PLAYER_JOINED, { playerId });

    // Handle input from client (legacy - still accept inputs but don't use for physics)
    channel.on(NetMessageType.INPUT, (data: any) => {
        const player = room.players.get(channel.id!);
        if (!player) return;
        // Input received - we no longer simulate based on this
        // Client is authoritative and will send position updates
    });

    // Handle position update from client (client-authoritative)
    channel.on('position_update', (data: any) => {
        const player = room.players.get(channel.id!);
        if (!player) return;

        // Directly update player position from client
        if (data) {
            player.x = data.x ?? player.x;
            player.y = data.y ?? player.y;
            player.velocityX = data.velocityX ?? player.velocityX;
            player.velocityY = data.velocityY ?? player.velocityY;
            player.facingDirection = data.facingDirection ?? player.facingDirection;
            player.isGrounded = data.isGrounded ?? player.isGrounded;
            player.isAttacking = data.isAttacking ?? player.isAttacking;
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

    // Handle disconnect
    channel.onDisconnect(() => {
        console.log(`[Server] Player ${playerId} disconnected`);
        room.players.delete(channel.id!);

        // Broadcast departure
        io.emit(NetMessageType.PLAYER_LEFT, { playerId });
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
