/**
 * Sgalalla Game Server
 * WebSocket server using Socket.io for reliable multiplayer
 */

import { Server } from 'socket.io';

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
    // Character Selection
    CHARACTER_SELECT: 'character_select',
    CHARACTER_CONFIRM: 'character_confirm',
    SELECTION_START: 'selection_start',
    SELECTION_TICK: 'selection_tick'
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
    character: string; // 'fok' or 'fok_alt'
    isConfirmed?: boolean;
}

type RoomPhase = 'WAITING' | 'SELECTING' | 'PLAYING';

interface GameRoom {
    players: Map<string, PlayerState>;
    frame: number;
    rematchVotes: Set<string>;
    phase: RoomPhase;
    selectionTimer: ReturnType<typeof setInterval> | null;
    selectionCountdown: number;
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

import http from 'http';

const PORT = Number(process.env.PORT) || 3000;
const rooms: Map<string, GameRoom> = new Map();

// Create standard HTTP server to handle binding to 0.0.0.0 correctly
const httpServer = http.createServer((req, res) => {
    // Log every request to debug connectivity
    console.log(`[HTTP] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);

    // Basic health check response to prevent hanging
    if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Socket.io Game Server is Running! 🎮\n');
    }
});

// Create Socket.io server (WebSockets instead of WebRTC)
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// IDLE TIMEOUT LOGIC (Scale to Zero)
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let totalConnectedPlayers = 0;

function checkIdleStatus() {
    if (totalConnectedPlayers === 0) {
        if (!idleTimer) {
            console.log(`[Server] No players connected. Starting idle timer (${IDLE_TIMEOUT_MS / 1000}s)...`);
            idleTimer = setTimeout(() => {
                console.log('[Server] Idle timeout reached. Shutting down for cost savings.');
                process.exit(0);
            }, IDLE_TIMEOUT_MS);
        }
    } else {
        if (idleTimer) {
            console.log('[Server] Player connected. Cancelling idle timer.');
            clearTimeout(idleTimer);
            idleTimer = null;
        }
    }
}

// Initial check
checkIdleStatus();

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Geckos.io server running on 0.0.0.0:${PORT}`);
});

io.on('connection', (socket) => {
    totalConnectedPlayers++;
    checkIdleStatus();
    const roomId = 'default'; // Single room for now

    // Create room if needed
    if (!rooms.has(roomId)) {
        rooms.set(roomId, {
            players: new Map(),
            frame: 0,
            rematchVotes: new Set(),
            phase: 'WAITING',
            selectionTimer: null,
            selectionCountdown: 10
        });
    }
    const room = rooms.get(roomId)!;

    // Enforce 1v1 limit (Max 2 players)
    if (room.players.size >= 2) {
        console.log(`[Server] Connection rejected: Room ${roomId} is full (2/2 players).`);
        socket.emit('error', 'Room is full (1v1 only). Please try again later.');
        socket.disconnect();
        totalConnectedPlayers--; // Revert count since they are booted
        return;
    }

    // Find lowest available player ID
    const existingIds = new Set<number>();
    room.players.forEach(p => existingIds.add(p.playerId));

    let playerId = 0;
    while (existingIds.has(playerId)) {
        playerId++;
    }

    console.log(`[Server] Player ${playerId} connected (${socket.id})`);

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
        animationKey: '',
        damagePercent: 0,
        lives: 3,
        character: 'fok' // Default character
    };

    room.players.set(socket.id!, playerState);

    // Notify player of their ID and current phase
    socket.emit(NetMessageType.PLAYER_JOINED, {
        playerId,
        phase: room.phase,
        countdown: room.selectionCountdown
    });

    // Check if we should start selection phase (2 players present)
    if (room.players.size === 2 && room.phase === 'WAITING') {
        room.phase = 'SELECTING';
        room.selectionCountdown = 10;

        console.log('[Server] 2 players connected - starting selection phase');

        // Broadcast selection start to all players
        io.emit(NetMessageType.SELECTION_START, { countdown: 10 });

        // Start countdown timer
        room.selectionTimer = setInterval(() => {
            room.selectionCountdown--;

            if (room.selectionCountdown > 0) {
                io.emit(NetMessageType.SELECTION_TICK, { countdown: room.selectionCountdown });
            } else {
                // Time's up - start the game
                if (room.selectionTimer) {
                    clearInterval(room.selectionTimer);
                    room.selectionTimer = null;
                }
                room.phase = 'PLAYING';

                // Collect final character selections
                const playerCharacters: { playerId: number; character: string }[] = [];
                room.players.forEach((p) => {
                    playerCharacters.push({ playerId: p.playerId, character: p.character });
                });

                console.log('[Server] Selection complete - starting game', playerCharacters);
                io.emit(NetMessageType.GAME_START, { players: playerCharacters });
            }
        }, 1000);
    }

    // Handle character selection during SELECTING phase
    socket.on(NetMessageType.CHARACTER_SELECT, (data: any) => {
        const player = room.players.get(socket.id!);
        if (!player) return;
        if (room.phase !== 'SELECTING') return;
        if (!data?.character) return;
        if (player.isConfirmed) return; // Can't change after confirming

        player.character = data.character;
        console.log(`[Server] Player ${player.playerId} selected character: ${data.character}`);

        // Relay to other players
        io.emit(NetMessageType.CHARACTER_SELECT, {
            playerId: player.playerId,
            character: data.character
        });
    });

    // Handle character confirmation
    socket.on(NetMessageType.CHARACTER_CONFIRM, () => {
        const player = room.players.get(socket.id!);
        if (!player || room.phase !== 'SELECTING') return;
        if (player.isConfirmed) return;

        player.isConfirmed = true;
        console.log(`[Server] Player ${player.playerId} confirmed selection`);

        // Broadcast confirmation
        io.emit(NetMessageType.CHARACTER_CONFIRM, { playerId: player.playerId });

        // Check if ALL players are confirmed
        let allConfirmed = true;
        let playerCount = 0;
        room.players.forEach(p => {
            if (!p.isConfirmed) allConfirmed = false;
            playerCount++;
        });

        // Only auto-start if we have 2 players and both confirmed
        if (playerCount === 2 && allConfirmed) {
            console.log('[Server] All players confirmed - starting game immediately');

            // Clear timer
            if (room.selectionTimer) {
                clearInterval(room.selectionTimer);
                room.selectionTimer = null;
            }

            room.phase = 'PLAYING';
            room.frame = 0;

            const startPayload = Array.from(room.players.values()).map(p => ({
                playerId: p.playerId,
                character: p.character
            }));

            io.emit(NetMessageType.GAME_START, { players: startPayload });
        }
    });

    // Handle input from client (legacy - still accept inputs but don't use for physics)
    socket.on(NetMessageType.INPUT, (data: any) => {
        const player = room.players.get(socket.id!);
        if (!player) return;
        // Input received - we no longer simulate based on this
        // Client is authoritative and will send position updates
    });

    // Handle position update from client (client-authoritative, binary encoded)
    socket.on('position_update', (data: any) => {
        const player = room.players.get(socket.id!);
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
    socket.on(NetMessageType.PING, () => {
        socket.emit(NetMessageType.PONG, {});
    });

    // Relay attack events to all clients
    socket.on('attack_start', (data: any) => {
        io.emit('attack_start', data);
    });

    // Relay hit events to all clients
    socket.on('hit_event', (data: any) => {
        io.emit('hit_event', data);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        console.log(`[Server] Player ${playerId} disconnected`);
        room.players.delete(socket.id!);
        room.rematchVotes.delete(socket.id!);

        // Broadcast departure
        io.emit(NetMessageType.PLAYER_LEFT, { playerId });

        // If room is now empty, reset it
        if (room.players.size === 0) {
            console.log('[Server] Room empty - resetting state');
            if (room.selectionTimer) {
                clearInterval(room.selectionTimer);
                room.selectionTimer = null;
            }
            room.phase = 'WAITING';
            room.selectionCountdown = 10;
            room.frame = 0;
        }
        // If only 1 player left during selection, cancel selection
        else if (room.players.size === 1 && room.phase === 'SELECTING') {
            console.log('[Server] Only 1 player left during selection - reverting to WAITING');
            if (room.selectionTimer) {
                clearInterval(room.selectionTimer);
                room.selectionTimer = null;
            }
            room.phase = 'WAITING';
            room.selectionCountdown = 10;
        }
    });

    // Handle rematch vote
    socket.on(NetMessageType.REMATCH_VOTE, () => {
        console.log(`[Server] Player ${playerId} voted for rematch`);
        room.rematchVotes.add(socket.id!);

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

    socket.on('disconnect', () => {
        console.log(`[Server] Player ${playerId} disconnected (${socket.id})`);
        room.players.delete(socket.id!);
        totalConnectedPlayers = Math.max(0, totalConnectedPlayers - 1);
        checkIdleStatus();
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
