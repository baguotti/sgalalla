import Phaser from 'phaser';
import NetworkManager from '../network/NetworkManager';

export type CharacterType = 'fok';

/**
 * Unified Lobby Player - supports both local and online modes
 */
export interface LobbyPlayer {
    slotIndex: number;           // 0-3 (P1-P4)
    socketId?: string;           // Online: unique socket ID
    deviceId: string;            // Local: 'keyboard' or 'gamepad-{index}'
    characterId: CharacterType;  // Selected character
    isReady: boolean;            // Ready status
    inputType: 'KEYBOARD' | 'GAMEPAD';
    gamepadIndex: number | null;
}

/**
 * Legacy interface for GameScene compatibility
 */
export interface PlayerSelection {
    playerId: number;
    joined: boolean;
    ready: boolean;
    input: {
        type: 'KEYBOARD' | 'GAMEPAD';
        gamepadIndex: number | null;
    };
    character: CharacterType;
    isAI?: boolean;
    isTrainingDummy?: boolean;
}

export class LobbyScene extends Phaser.Scene {
    // Core State
    private mode: 'local' | 'online' = 'local';
    private players: Map<number, LobbyPlayer> = new Map();
    private readonly MIN_PLAYERS = 2;
    private readonly MAX_PLAYERS = 4;

    // Character Data
    private readonly characters: CharacterType[] = ['fok'];
    private readonly charLabels: string[] = ['Fok'];

    // UI Elements
    private slotContainers: Phaser.GameObjects.Container[] = [];
    private instructionText!: Phaser.GameObjects.Text;

    // Network (online mode)
    private networkManager: NetworkManager | null = null;

    // Input Management
    private keys!: {
        enter: Phaser.Input.Keyboard.Key;
        escape: Phaser.Input.Keyboard.Key;
    };
    private registeredDevices: Set<string> = new Set(); // Track joined devices
    private lastInputTime: Map<string, number> = new Map(); // Debounce per device

    constructor() {
        super({ key: 'LobbyScene' });
    }

    init(data?: { mode?: 'local' | 'online' }): void {
        this.mode = data?.mode || 'local';

        // Reset state
        this.players.clear();
        this.registeredDevices.clear();
        this.lastInputTime.clear();
    }

    create(): void {
        const { width, height } = this.scale;

        // Background
        this.add.rectangle(0, 0, width, height, 0x1a1a2e).setOrigin(0);

        // Title
        const titleText = this.mode === 'online' ? 'ONLINE LOBBY' : 'LOCAL LOBBY';
        this.add.text(width / 2, 60, titleText, {
            fontSize: '48px',
            color: '#ffffff',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        // Instructions
        this.instructionText = this.add.text(width / 2, height - 50,
            'Press [ENTER] or [GAMEPAD START] to Join  |  [SPACE/A] to Ready', {
            fontSize: '20px',
            color: '#8ab4f8'
        }).setOrigin(0.5);

        // Pulse animation
        this.tweens.add({
            targets: this.instructionText,
            alpha: 0.5,
            duration: 800,
            yoyo: true,
            repeat: -1
        });

        // Create slot UI (4 slots)
        this.createSlotUI();

        // Setup input
        this.keys = {
            enter: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
            escape: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
        };

        // ESC to return to menu
        this.keys.escape.on('down', () => {
            if (this.networkManager) {
                this.networkManager.disconnect();
            }
            this.scene.start('MainMenuScene');
        });

        // Online mode: Connect to server and setup callbacks
        if (this.mode === 'online') {
            this.setupOnlineMode();
        }
    }

    /**
     * Setup network connection and callbacks for online mode
     */
    private setupOnlineMode(): void {
        this.networkManager = NetworkManager.getInstance();

        // Connect to server
        this.networkManager.connect(9208);

        // Handle connection
        this.networkManager.onConnected(() => {
            console.log('[LobbyScene] Connected to server');
            // Auto-join lobby
            this.networkManager!.sendLobbyJoin();
        });

        // Handle lobby state updates
        this.networkManager.onLobbyState((players: any[]) => {
            console.log('[LobbyScene] Received lobby state:', players);
            this.syncLobbyState(players);
        });

        // Handle match start
        this.networkManager.onLobbyStart((players: any[]) => {
            console.log('[LobbyScene] Match starting!', players);
            // Convert to legacy PlayerSelection format
            const playerData = players.map(p => ({
                playerId: p.slotIndex,
                joined: true,
                ready: true,
                input: { type: 'KEYBOARD' as const, gamepadIndex: null },
                character: p.characterId,
                isAI: false
            }));
            this.scene.start('OnlineGameScene', { playerData });
        });

        // Handle disconnect
        this.networkManager.onDisconnect(() => {
            console.log('[LobbyScene] Disconnected from server');
            this.scene.start('MainMenuScene');
        });
    }

    /**
     * Sync local lobby state from server update (online mode)
     */
    private syncLobbyState(serverPlayers: any[]): void {
        // Clear and rebuild local state
        this.players.clear();
        this.registeredDevices.clear();

        serverPlayers.forEach((serverPlayer: any) => {
            const player: LobbyPlayer = {
                slotIndex: serverPlayer.slotIndex,
                socketId: serverPlayer.socketId,
                deviceId: serverPlayer.socketId, // Use socketId as deviceId for online
                characterId: serverPlayer.characterId,
                isReady: serverPlayer.isReady,
                inputType: 'KEYBOARD', // Online players use keyboard by default
                gamepadIndex: null
            };
            this.players.set(player.slotIndex, player);
            this.registeredDevices.add(player.deviceId);
            this.updateSlotUI(player.slotIndex);
        });

        // Update empty slots
        for (let i = 0; i < this.MAX_PLAYERS; i++) {
            if (!this.players.has(i)) {
                this.updateSlotUI(i);
            }
        }
    }

    update(time: number): void {
        if (this.mode === 'local') {
            // Local mode: Handle registration inputs (ENTER/START to join)
            this.handleRegistrationInput(time);

            // Handle per-player inputs (character selection, ready)
            this.handlePlayerInputs(time);

            // Check for match start
            this.checkMatchStart();
        } else {
            // Online mode: Only handle inputs for the local player assigned by server
            this.handleOnlinePlayerInput(time);
        }
    }

    /**
     * Handle inputs for the local player in online mode
     * (character selection and ready toggle only, no registration)
     */
    private handleOnlinePlayerInput(time: number): void {
        // Find the local player (first player in our map, assigned by server)
        if (this.players.size === 0) return;

        const localPlayer = this.players.values().next().value as LobbyPlayer;
        if (!localPlayer) return;

        // Handle keyboard input for local player
        const leftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        const rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
        const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

        const lastTime = this.lastInputTime.get('online-local') || 0;
        const debounce = 200;

        // Character selection
        if (Phaser.Input.Keyboard.JustDown(leftKey) && time - lastTime > debounce) {
            this.cycleCharacter(localPlayer, -1);
            this.lastInputTime.set('online-local', time);
        }
        if (Phaser.Input.Keyboard.JustDown(rightKey) && time - lastTime > debounce) {
            this.cycleCharacter(localPlayer, 1);
            this.lastInputTime.set('online-local', time);
        }

        // Ready toggle
        if (Phaser.Input.Keyboard.JustDown(spaceKey) && time - lastTime > debounce) {
            this.toggleReady(localPlayer);
            this.lastInputTime.set('online-local', time);
        }
    }

    /**
     * Listen for ENTER or GAMEPAD START to register new players
     */
    private handleRegistrationInput(time: number): void {
        // Keyboard ENTER
        if (Phaser.Input.Keyboard.JustDown(this.keys.enter)) {
            const deviceId = 'keyboard';
            if (!this.registeredDevices.has(deviceId) && this.canRegisterPlayer()) {
                this.registerPlayer(deviceId, 'KEYBOARD', null);
            }
        }

        // Gamepad START (button 9)
        const gamepads = this.input.gamepad?.gamepads || [];
        for (const gp of gamepads) {
            if (!gp) continue;

            const deviceId = `gamepad-${gp.index}`;
            const startButton = gp.buttons[9]; // START button

            if (startButton?.pressed && !this.registeredDevices.has(deviceId) && this.canRegisterPlayer()) {
                // Debounce
                const lastTime = this.lastInputTime.get(deviceId) || 0;
                if (time - lastTime > 300) {
                    this.registerPlayer(deviceId, 'GAMEPAD', gp.index);
                    this.lastInputTime.set(deviceId, time);
                }
            }
        }
    }

    /**
     * Handle character selection and ready toggle for joined players
     */
    private handlePlayerInputs(time: number): void {
        this.players.forEach((player) => {
            if (player.inputType === 'KEYBOARD') {
                this.handleKeyboardPlayer(player, time);
            } else {
                this.handleGamepadPlayer(player, time);
            }
        });
    }

    private handleKeyboardPlayer(player: LobbyPlayer, time: number): void {
        const deviceId = player.deviceId;
        const lastTime = this.lastInputTime.get(deviceId) || 0;
        const debounce = 200;

        // Character selection (Arrow keys)
        const leftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
        const rightKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);

        if (Phaser.Input.Keyboard.JustDown(leftKey) && time - lastTime > debounce) {
            this.cycleCharacter(player, -1);
            this.lastInputTime.set(deviceId, time);
        }
        if (Phaser.Input.Keyboard.JustDown(rightKey) && time - lastTime > debounce) {
            this.cycleCharacter(player, 1);
            this.lastInputTime.set(deviceId, time);
        }

        // Ready toggle (SPACE)
        const spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        if (Phaser.Input.Keyboard.JustDown(spaceKey) && time - lastTime > debounce) {
            this.toggleReady(player);
            this.lastInputTime.set(deviceId, time);
        }
    }

    private handleGamepadPlayer(player: LobbyPlayer, time: number): void {
        const gp = this.input.gamepad?.gamepads[player.gamepadIndex!];
        if (!gp) return;

        const deviceId = player.deviceId;
        const lastTime = this.lastInputTime.get(deviceId) || 0;
        const debounce = 200;

        // Character selection (D-pad or left stick)
        const leftPressed = gp.left || gp.leftStick.x < -0.5;
        const rightPressed = gp.right || gp.leftStick.x > 0.5;

        if (leftPressed && time - lastTime > debounce) {
            this.cycleCharacter(player, -1);
            this.lastInputTime.set(deviceId, time);
        }
        if (rightPressed && time - lastTime > debounce) {
            this.cycleCharacter(player, 1);
            this.lastInputTime.set(deviceId, time);
        }

        // Ready toggle (A button - button 0)
        const aButton = gp.buttons[0];
        if (aButton?.pressed && time - lastTime > debounce) {
            this.toggleReady(player);
            this.lastInputTime.set(deviceId, time);
        }
    }

    /**
     * Register a new player to the lobby
     */
    private registerPlayer(deviceId: string, inputType: 'KEYBOARD' | 'GAMEPAD', gamepadIndex: number | null): void {
        const slotIndex = this.findAvailableSlot();
        if (slotIndex === -1) return;

        const player: LobbyPlayer = {
            slotIndex,
            deviceId,
            characterId: 'fok',
            isReady: false,
            inputType,
            gamepadIndex
        };

        this.players.set(slotIndex, player);
        this.registeredDevices.add(deviceId);
        this.updateSlotUI(slotIndex);

        // Emit event for online mode
        if (this.mode === 'online') {
            this.events.emit('player_joined', player);
        }
    }

    private canRegisterPlayer(): boolean {
        return this.players.size < this.MAX_PLAYERS;
    }

    private findAvailableSlot(): number {
        for (let i = 0; i < this.MAX_PLAYERS; i++) {
            if (!this.players.has(i)) return i;
        }
        return -1;
    }

    private cycleCharacter(player: LobbyPlayer, direction: number): void {
        const currentIndex = this.characters.indexOf(player.characterId);
        const newIndex = (currentIndex + direction + this.characters.length) % this.characters.length;
        player.characterId = this.characters[newIndex];
        this.updateSlotUI(player.slotIndex);

        // Send to server in online mode
        if (this.mode === 'online' && this.networkManager) {
            this.networkManager.sendLobbyCharacter(player.characterId);
        }
    }

    private toggleReady(player: LobbyPlayer): void {
        player.isReady = !player.isReady;
        this.updateSlotUI(player.slotIndex);

        // Send to server in online mode
        if (this.mode === 'online' && this.networkManager) {
            this.networkManager.sendLobbyReady(player.isReady);
        }
    }

    /**
     * Check if match can start (min 2 players, all ready)
     */
    private checkMatchStart(): void {
        const playerCount = this.players.size;
        if (playerCount < this.MIN_PLAYERS) return;

        const allReady = Array.from(this.players.values()).every(p => p.isReady);
        if (allReady) {
            this.startMatch();
        }
    }

    private startMatch(): void {
        // Convert to legacy PlayerSelection format for GameScene
        const playerData: PlayerSelection[] = Array.from(this.players.values()).map(p => ({
            playerId: p.slotIndex,
            joined: true,
            ready: true,
            input: {
                type: p.inputType,
                gamepadIndex: p.gamepadIndex
            },
            character: p.characterId,
            isAI: false
        }));

        // Launch game
        if (this.mode === 'online') {
            this.events.emit('match_start', playerData);
            // Server will handle transition
        } else {
            this.scene.start('GameScene', { playerData });
        }
    }

    /**
     * Create UI for 4 player slots
     */
    private createSlotUI(): void {
        const { width, height } = this.scale;
        const slotWidth = 250;
        const slotHeight = 350;
        const spacing = 30;
        const startX = (width - (slotWidth * 4 + spacing * 3)) / 2;
        const startY = height / 2 - 50;

        for (let i = 0; i < 4; i++) {
            const x = startX + i * (slotWidth + spacing);
            const container = this.add.container(x, startY);

            // Slot background
            const bg = this.add.rectangle(0, 0, slotWidth, slotHeight, 0x2a2a3e, 0.8);
            bg.setStrokeStyle(2, 0x4a4a5e);

            // Player label
            const label = this.add.text(0, -slotHeight / 2 + 30, `P${i + 1}`, {
                fontSize: '32px',
                color: '#ffffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            // Status text
            const status = this.add.text(0, 0, 'Press ENTER/START\nto Join', {
                fontSize: '20px',
                color: '#8ab4f8',
                align: 'center'
            }).setOrigin(0.5);

            container.add([bg, label, status]);
            this.slotContainers.push(container);
        }
    }

    /**
     * Update slot UI based on player state
     */
    private updateSlotUI(slotIndex: number): void {
        const container = this.slotContainers[slotIndex];
        const player = this.players.get(slotIndex);

        // Clear existing content (keep bg and label)
        while (container.length > 2) {
            container.remove(container.list[2], true);
        }

        if (!player) {
            // Empty slot
            const status = this.add.text(0, 0, 'Press ENTER/START\nto Join', {
                fontSize: '20px',
                color: '#8ab4f8',
                align: 'center'
            }).setOrigin(0.5);
            container.add(status);
        } else {
            // Joined player
            const charLabel = this.charLabels[this.characters.indexOf(player.characterId)];
            const charText = this.add.text(0, -50, charLabel, {
                fontSize: '28px',
                color: '#ffffff'
            }).setOrigin(0.5);

            const deviceText = this.add.text(0, 20,
                player.inputType === 'KEYBOARD' ? 'Keyboard' : `Gamepad ${player.gamepadIndex}`, {
                fontSize: '16px',
                color: '#aaaaaa'
            }).setOrigin(0.5);

            const readyText = this.add.text(0, 80,
                player.isReady ? '✓ READY' : 'Not Ready', {
                fontSize: '24px',
                color: player.isReady ? '#4ade80' : '#8ab4f8',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            container.add([charText, deviceText, readyText]);

            // Update border color
            const bg = container.list[0] as Phaser.GameObjects.Rectangle;
            bg.setStrokeStyle(3, player.isReady ? 0x4ade80 : 0x8ab4f8);
        }
    }
}
