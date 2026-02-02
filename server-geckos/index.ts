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

    // Handle input from client
    channel.on(NetMessageType.INPUT, (data: any) => {
        const player = room.players.get(channel.id!);
        if (!player) return;

        const input = data?.input;
        if (input) {
            // Simple velocity updates based on input
            player.velocityX = input.moveX * 750; // MAX_SPEED
            if (input.jump && player.isGrounded) {
                player.velocityY = -1050; // JUMP_FORCE
                player.isGrounded = false;
            }
        }
    });

    // Handle ping
    channel.on(NetMessageType.PING, () => {
        channel.emit(NetMessageType.PONG, {});
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

        room.players.forEach((player) => {
            // Apply gravity
            if (!player.isGrounded) {
                player.velocityY += GRAVITY * deltaSeconds;
            }

            // Apply friction when no horizontal input
            if (Math.abs(player.velocityX) > 0) {
                player.velocityX *= FRICTION;
                if (Math.abs(player.velocityX) < 1) player.velocityX = 0;
            }

            // Update position
            player.x += player.velocityX * deltaSeconds;
            player.y += player.velocityY * deltaSeconds;

            // Ground collision (main platform at Y=825)
            const playerBottom = player.y + 42; // Half player height (85/2)
            if (playerBottom >= PLATFORM_TOP_Y && player.velocityY >= 0) {
                player.y = PLATFORM_TOP_Y - 42;
                player.velocityY = 0;
                player.isGrounded = true;
            } else if (player.y < PLATFORM_TOP_Y - 42) {
                player.isGrounded = false;
            }

            // Clamp horizontal position to walls
            if (player.x < 172) player.x = 172;
            if (player.x > 1747) player.x = 1747;
        });

        // Build state snapshot
        const state = {
            frame: room.frame,
            confirmedInputFrame: room.frame, // Server has processed all inputs up to this frame
            players: Array.from(room.players.values())
        };

        // Broadcast to all players in room
        io.emit(NetMessageType.STATE_UPDATE, state);
    });
}, 1000 / 60);
