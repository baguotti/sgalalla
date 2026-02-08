/**
 * Sgalalla Game Server
 * UDP server using Geckos.io (WebRTC DataChannels) for low-latency multiplayer
 */

import geckos, { GeckosServer, ServerChannel } from '@geckos.io/server';
import http from 'http';

// Network message types (mirrored from client)
const NetMessageType = {
    INPUT: 'input',
    STATE_UPDATE: 'state_update',
    POSITION_UPDATE: 'position_update',
    ATTACK_START: 'attack_start',
    HIT_EVENT: 'hit_event',
    PLAYER_JOINED: 'player_joined',
    PLAYER_LEFT: 'player_left',
    GAME_START: 'game_start',
    PING: 'ping',
    PONG: 'pong',
    INPUT_ACK: 'input_ack',
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
    character: string;
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

// Animation key enum for binary decoding
const ANIMATION_KEYS = [
    '', 'idle', 'run', 'jump', 'fall', 'attack_light', 'attack_heavy',
    'attack_up', 'hurt', 'slide', 'dash', 'block', 'charge',
];

function decodeBinaryPlayerState(buffer: ArrayBuffer): Partial<PlayerState> | null {
    if (buffer.byteLength !== 15) return null;
    const view = new DataView(buffer);
    return {
        x: view.getInt16(0, true),
        y: view.getInt16(2, true),
        velocityX: view.getInt16(4, true),
        velocityY: view.getInt16(6, true),
        facingDirection: view.getInt8(8) >= 0 ? 1 : -1,
        isGrounded: (view.getUint8(9) & 0x01) === 1,
        isAttacking: (view.getUint8(9) & 0x02) === 2,
        animationKey: ANIMATION_KEYS[view.getUint8(10)] || '',
        damagePercent: view.getUint16(11, true),
        lives: view.getUint8(13),
    };
}

const PORT = Number(process.env.PORT) || 9208; // Geckos default port
const rooms: Map<string, GameRoom> = new Map();

// Store channel -> playerId mapping
const channelPlayerMap: Map<string, number> = new Map();

// Create HTTP server for health checks
const httpServer = http.createServer((req, res) => {
    console.log(`[HTTP] ${req.method} ${req.url} from ${req.socket.remoteAddress}`);
    if (req.url === '/' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Geckos.io Game Server is Running! 🎮\n');
    }
});

// Create Geckos.io server (UDP via WebRTC)
// Create Geckos.io server (UDP via WebRTC)
const io: GeckosServer = geckos({
    cors: { origin: '*' },
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
});

// Attach to HTTP server
io.addServer(httpServer);

// IDLE TIMEOUT LOGIC
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
let idleTimer: ReturnType<typeof setTimeout> | null = null;
let totalConnectedPlayers = 0;

function checkIdleStatus() {
    if (totalConnectedPlayers === 0) {
        if (!idleTimer) {
            console.log(`[Server] No players connected. Starting idle timer (${IDLE_TIMEOUT_MS / 1000}s)...`);
            idleTimer = setTimeout(() => {
                console.log('[Server] Idle timeout reached. Shutting down.');
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

checkIdleStatus();

httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Geckos.io UDP server running on 0.0.0.0:${PORT}`);
});

// Helper to emit to all channels in room
function emitToRoom(event: string, data: any) {
    io.emit(event, data);
}

io.onConnection((channel: ServerChannel) => {
    totalConnectedPlayers++;
    checkIdleStatus();

    const channelId = channel.id!;
    const roomId = 'default';

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

    // Enforce 1v1 limit
    if (room.players.size >= 2) {
        console.log(`[Server] Connection rejected: Room full (2/2 players).`);
        channel.emit('error', 'Room is full (1v1 only).');
        channel.close();
        totalConnectedPlayers--;
        return;
    }

    // Find lowest available player ID
    const existingIds = new Set<number>();
    room.players.forEach(p => existingIds.add(p.playerId));
    let playerId = 0;
    while (existingIds.has(playerId)) playerId++;

    channelPlayerMap.set(channelId, playerId);
    console.log(`[Server] Player ${playerId} connected (${channelId})`);

    // Initialize player state
    const spawnPoints = [600, 1200];
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
        character: 'fok_v3'
    };

    room.players.set(channelId, playerState);

    // Notify player of their ID
    channel.emit(NetMessageType.PLAYER_JOINED, {
        playerId,
        phase: room.phase,
        countdown: room.selectionCountdown
    });

    // Start selection phase when 2 players present
    if (room.players.size === 2 && room.phase === 'WAITING') {
        room.phase = 'SELECTING';
        room.selectionCountdown = 10;
        console.log('[Server] 2 players connected - starting selection phase');
        emitToRoom(NetMessageType.SELECTION_START, { countdown: 10 });

        room.selectionTimer = setInterval(() => {
            room.selectionCountdown--;
            if (room.selectionCountdown > 0) {
                emitToRoom(NetMessageType.SELECTION_TICK, { countdown: room.selectionCountdown });
            } else {
                if (room.selectionTimer) {
                    clearInterval(room.selectionTimer);
                    room.selectionTimer = null;
                }
                room.phase = 'PLAYING';
                const playerCharacters = Array.from(room.players.values()).map(p => ({
                    playerId: p.playerId,
                    character: p.character
                }));
                console.log('[Server] Selection complete - starting game', playerCharacters);
                emitToRoom(NetMessageType.GAME_START, { players: playerCharacters });
            }
        }, 1000);
    }

    // Character selection
    channel.on(NetMessageType.CHARACTER_SELECT, (data: any) => {
        const player = room.players.get(channelId);
        if (!player || room.phase !== 'SELECTING' || !data?.character || player.isConfirmed) return;
        player.character = data.character;
        console.log(`[Server] Player ${player.playerId} selected: ${data.character}`);
        emitToRoom(NetMessageType.CHARACTER_SELECT, { playerId: player.playerId, character: data.character });
    });

    // Character confirmation
    channel.on(NetMessageType.CHARACTER_CONFIRM, () => {
        const player = room.players.get(channelId);
        if (!player || room.phase !== 'SELECTING' || player.isConfirmed) return;
        player.isConfirmed = true;
        console.log(`[Server] Player ${player.playerId} confirmed`);
        emitToRoom(NetMessageType.CHARACTER_CONFIRM, { playerId: player.playerId });

        // Check if all confirmed
        let allConfirmed = true;
        room.players.forEach(p => { if (!p.isConfirmed) allConfirmed = false; });

        if (room.players.size === 2 && allConfirmed) {
            console.log('[Server] All confirmed - starting game');
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
            emitToRoom(NetMessageType.GAME_START, { players: startPayload });
        }
    });

    // Position update (client-authoritative)
    channel.on(NetMessageType.POSITION_UPDATE, (data: any) => {
        const player = room.players.get(channelId);
        if (!player) return;

        let decoded: Partial<PlayerState> | null = null;
        if (data instanceof Uint8Array) {
            decoded = decodeBinaryPlayerState(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer);
        } else if (data instanceof ArrayBuffer) {
            decoded = decodeBinaryPlayerState(data);
        }

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

    // Ping
    channel.on(NetMessageType.PING, () => {
        channel.emit(NetMessageType.PONG, {});
    });

    // Attack relay
    channel.on(NetMessageType.ATTACK_START, (data: any) => {
        emitToRoom(NetMessageType.ATTACK_START, data);
    });

    // Hit relay
    channel.on(NetMessageType.HIT_EVENT, (data: any) => {
        emitToRoom(NetMessageType.HIT_EVENT, data);
    });

    // Rematch vote
    channel.on(NetMessageType.REMATCH_VOTE, () => {
        console.log(`[Server] Player ${playerId} voted for rematch`);
        room.rematchVotes.add(channelId);

        if (room.rematchVotes.size >= room.players.size && room.players.size >= 2) {
            console.log('[Server] All voted - rematching');
            const spawnPoints = [600, 1200];
            let idx = 0;
            room.players.forEach((p) => {
                p.x = spawnPoints[idx % 2];
                p.y = 780;
                p.velocityX = 0;
                p.velocityY = 0;
                p.isGrounded = true;
                p.isAttacking = false;
                p.damagePercent = 0;
                p.lives = 3;
                idx++;
            });
            room.frame = 0;
            room.rematchVotes.clear();
            emitToRoom(NetMessageType.REMATCH_START, {});
        }
    });

    // Disconnect
    channel.onDisconnect(() => {
        console.log(`[Server] Player ${playerId} disconnected (${channelId})`);
        room.players.delete(channelId);
        room.rematchVotes.delete(channelId);
        channelPlayerMap.delete(channelId);
        totalConnectedPlayers = Math.max(0, totalConnectedPlayers - 1);
        checkIdleStatus();

        emitToRoom(NetMessageType.PLAYER_LEFT, { playerId });

        if (room.players.size === 0) {
            console.log('[Server] Room empty - resetting');
            if (room.selectionTimer) {
                clearInterval(room.selectionTimer);
                room.selectionTimer = null;
            }
            room.phase = 'WAITING';
            room.selectionCountdown = 10;
            room.frame = 0;
        } else if (room.players.size === 1 && room.phase === 'SELECTING') {
            console.log('[Server] Only 1 player left - reverting to WAITING');
            if (room.selectionTimer) {
                clearInterval(room.selectionTimer);
                room.selectionTimer = null;
            }
            room.phase = 'WAITING';
            room.selectionCountdown = 10;
        }
    });
});

// Game loop - 60Hz state broadcast for smoother gameplay
setInterval(() => {
    rooms.forEach((room) => {
        if (room.phase !== 'PLAYING') return;
        room.frame++;

        const state = {
            frame: room.frame,
            confirmedInputFrame: room.frame,
            players: Array.from(room.players.values())
        };

        emitToRoom(NetMessageType.STATE_UPDATE, state);
    });
}, 1000 / 60); // 60Hz = ~16.67ms
