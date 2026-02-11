import Phaser from 'phaser';
import { Player } from '../entities/Player';

// Smash Ultimate Style Colors
const SMASH_COLORS = [
    0xE63946, // P1 Red
    0x4361EE, // P2 Blue
    0xFF006E, // P3 Pink
    0x06D6A0  // P4 Green
];

/**
 * HUD slot for a single player - Refined V2
 * Visuals: Rounded box with stroke, transparent inside.
 * Layout: [Stocks] [Portrait] [Damage] [Name]
 */
export class PlayerHudSlot {
    private container: Phaser.GameObjects.Container;
    private damageText: Phaser.GameObjects.Text;
    private stocksText: Phaser.GameObjects.Text;
    private nameText: Phaser.GameObjects.Text;
    private portraitSprite: Phaser.GameObjects.Sprite;
    private stockIcon: Phaser.GameObjects.Text;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        width: number,
        height: number,
        playerName: string,
        playerIndex: number,
        character: string,
        isRightSide: boolean = false // New param
    ) {
        this.container = scene.add.container(x, y);
        this.container.setScrollFactor(0);
        this.container.setDepth(101);

        const color = SMASH_COLORS[playerIndex % SMASH_COLORS.length];

        // --- 1. Background Box ---
        // Rounded Rectangle again
        // Longer to accommodate triple digit %

        const mainW = width + 80; // Significantly longer (was +40)
        const mainH = height - 10; // ~70

        const bgGraphics = scene.add.graphics();

        // Fill: Black (Rounded)
        bgGraphics.fillStyle(0x000000, 0.9);
        bgGraphics.fillRoundedRect(-mainW / 2, -mainH / 2, mainW, mainH, 16);

        // Stroke: Player Color, thick (Rounded)
        bgGraphics.lineStyle(4, color, 1);
        bgGraphics.strokeRoundedRect(-mainW / 2, -mainH / 2, mainW, mainH, 16);

        this.container.add(bgGraphics);

        // --- Layout Calculation ---
        const halfW = mainW / 2;
        // Ignore mirroring: Always standard layout
        // Layout: [Stocks] [Portrait] -- [Damage] -- [Lip/P1]

        // --- 2. Stocks (Far Left) ---
        const stockOffset = -halfW + 35; // Slightly more padding

        const stockContainer = scene.add.container(stockOffset, 0);

        // Heart Icon
        this.stockIcon = scene.add.text(0, -12, '♥', {
            fontSize: '18px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        stockContainer.add(this.stockIcon);

        // Stock Number
        this.stocksText = scene.add.text(0, 12, '3', {
            fontSize: '20px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        stockContainer.add(this.stocksText);

        this.container.add(stockContainer);

        // --- 3. Portrait (Left-Center) ---
        const portraitOffset = -halfW + 70; // Moved further left to clear damage % space

        let texture = character;
        let frame: string | undefined = undefined;

        if (scene.textures.exists('fok_icon') && character.includes('fok')) {
            texture = 'fok_icon';
        } else {
            texture = character.startsWith('fok') ? 'fok' : character;
            frame = character === 'fok_v3' ? '0_Fok_v3_Idle_000.png' : '0_Fok_Idle_000.png';
        }

        this.portraitSprite = scene.add.sprite(portraitOffset, 0, texture, frame);

        // Masked Rounded Square
        const portraitSize = mainH - 12;
        const scale = portraitSize / (this.portraitSprite.width || 256);
        this.portraitSprite.setScale(scale);

        // Mask (Rounded)
        const maskShape = scene.make.graphics({ x, y }, false);
        maskShape.fillStyle(0xffffff);
        maskShape.fillRoundedRect(portraitOffset - portraitSize / 2, -portraitSize / 2, portraitSize, portraitSize, 12);
        const mask = maskShape.createGeometryMask();
        this.portraitSprite.setMask(mask);

        // Portrait Border (Rounded)
        const portraitBorder = scene.add.graphics();
        portraitBorder.lineStyle(2, 0x000000, 1);
        portraitBorder.strokeRoundedRect(portraitOffset - portraitSize / 2, -portraitSize / 2, portraitSize, portraitSize, 12);
        this.container.add(this.portraitSprite);
        this.container.add(portraitBorder);

        // --- 4. Labels (Far Right - The "Lip") ---
        const tabX = halfW - 30; // Right edge
        const lipY = -mainH / 2 + 2; // Top edge offset

        const labelContainer = scene.add.container(tabX, lipY);

        // Convert color for hex string
        const colorHex = '#' + color.toString(16).padStart(6, '0');

        // Draw Lip Background (Rounded Rectangle sticking up/in)
        const lipW = 34;
        const lipH = 20;
        const lipGraphics = scene.add.graphics();
        lipGraphics.fillStyle(color, 1);
        // Rounded lip
        lipGraphics.fillRoundedRect(-lipW / 2, -2, lipW, lipH, 6);

        // P# Text
        this.nameText = scene.add.text(0, 6, `P${playerIndex + 1}`, {
            fontSize: '12px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#000000',
        }).setOrigin(0.5);

        labelContainer.add(lipGraphics);
        labelContainer.add(this.nameText);
        this.container.add(labelContainer);

        // Device Icon "D" (Below Lip)
        const deviceText = scene.add.text(tabX, mainH / 2 - 12, 'D', {
            fontSize: '12px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#888888',
        }).setOrigin(0.5);
        this.container.add(deviceText);

        // --- 5. Damage % (Central - shifted right) ---
        // Move more to the right to accommodate triple digits and clear portrait
        // Center is 0. Portrait ends around -60. Lip starts around +100.
        // Let's move center to +20 or +30.

        this.damageText = scene.add.text(25, 0, '0%', {
            fontSize: '48px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: colorHex,
            strokeThickness: 0
        }).setOrigin(0.5);
        this.damageText.setShadow(2, 2, '#000000', 2, true, true); // Soft shadow for rounded style

        if (this.damageText) {
            this.container.add(this.damageText);
        }

        // Remove unused vars
        void isRightSide;
    }

    update(damage: number, stocks: number): void {
        const d = Math.floor(damage);
        this.damageText.setText(`${d}%`);
        this.stocksText.setText(stocks.toString());

        // Keep damage text white
        // Apply Scaling Effect for high damage?
        if (damage > 100) {
            this.damageText.setScale(1.1);
        } else {
            this.damageText.setScale(1.0);
        }
    }

    destroy(): void {
        this.container.destroy();
    }

    public addToCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
        camera.ignore(this.container);
    }
}

/**
 * MatchHUD - Manages all player HUD slots
 */
export class MatchHUD {
    private scene: Phaser.Scene;
    private slots: Map<number, PlayerHudSlot> = new Map();

    // Debug display
    // private debugContainer: Phaser.GameObjects.Container;
    // private pingText: Phaser.GameObjects.Text;
    // private fpsText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Debug display removed (Moved to DebugOverlay)
    }

    private ignoredCameras: Phaser.Cameras.Scene2D.Camera[] = [];

    /**
     * Add a player's HUD slot to the display
     */
    addPlayer(playerId: number, playerName: string, isLocalPlayer: boolean, character: string = 'fok'): void {
        if (this.slots.has(playerId)) return;

        const { width, height } = this.scene.cameras.main;

        // Even spacing 4 players
        // 4 slots spread across width
        // Centers: 1/8, 3/8, 5/8, 7/8
        const segment = width / 4;

        // Map Player ID 0-3 to slots (Assuming max 4)
        // Adjust ID if necessary (players might be 1-based or gap-filled)
        // Assuming consecutive IDs 0,1,2,3 for simplicity in this logic
        const slotIndex = playerId % 4; // Simple mapping

        const x = (slotIndex * segment) + (segment / 2);

        // Vertical position: Bottom
        const y = height - 60; // Slightly raised

        let display = playerName;
        if (isLocalPlayer) {
            // display = `${playerName}`; // Keep names simple for HUD
        }

        const isRightSide = x > width / 2; // Kept for logic if needed, but mirroring disabled

        const slot = new PlayerHudSlot(
            this.scene,
            x,
            y,
            240, // Base width
            80,  // Base height
            display,
            playerId,
            character,
            isRightSide
        );

        this.ignoredCameras.forEach(cam => slot.addToCameraIgnore(cam));
        this.slots.set(playerId, slot);
    }

    public addToCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
        if (!this.ignoredCameras.includes(camera)) {
            this.ignoredCameras.push(camera);
        }
        // camera.ignore(this.debugContainer);
        this.slots.forEach(slot => slot.addToCameraIgnore(camera));
    }

    updatePlayers(players: Map<number, Player>): void {
        players.forEach((player, id) => {
            const slot = this.slots.get(id);
            if (slot) {
                slot.update(player.damagePercent, player.lives);
            }
        });
    }


    removePlayer(playerId: number): void {
        const slot = this.slots.get(playerId);
        if (slot) {
            slot.destroy();
            this.slots.delete(playerId);
        }
    }

    destroy(): void {
        this.slots.forEach(slot => slot.destroy());
        // this.debugContainer.destroy();
    }
}

export { PlayerHudSlot as PlayerHUD };
