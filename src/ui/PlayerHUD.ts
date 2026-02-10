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
        // Rounded box with stroke and transparent inside
        const bgGraphics = scene.add.graphics();

        // Fill: Semi-transparent black 
        bgGraphics.fillStyle(0x000000, 0.4);
        bgGraphics.fillRoundedRect(-width / 2, -height / 2, width, height, 16);

        // Stroke: Player Color, thick
        bgGraphics.lineStyle(4, color, 1);
        bgGraphics.strokeRoundedRect(-width / 2, -height / 2, width, height, 16);

        this.container.add(bgGraphics);

        // --- Layout Calculation ---
        // Basic element spacing
        const stockX = -width / 2 + 30;
        const portraitX = -30;
        const damageX = 40;

        // Mirror multiplier: 1 for left, -1 for right
        const sideMult = isRightSide ? -1 : 1;

        // --- 2. Stocks (Left / Right) ---
        // If right side, we move it to the right end
        const finalStockX = isRightSide ? (width / 2 - 30) : stockX;

        const stockContainer = scene.add.container(finalStockX, 0);

        // Heart Icon (Text for now)
        this.stockIcon = scene.add.text(0, -8, '♥', {
            fontSize: '24px',
            color: Phaser.Display.Color.IntegerToColor(color).rgba,
        }).setOrigin(0.5);
        stockContainer.add(this.stockIcon);

        this.stocksText = scene.add.text(0, 15, '3', {
            fontSize: '18px',
            fontFamily: '"Silkscreen"',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        stockContainer.add(this.stocksText);

        this.container.add(stockContainer);

        // --- 3. Portrait (Center-Left / Center-Right) ---
        let texture = character;
        let frame: string | undefined = undefined;

        // Use specific icon if available
        if (scene.textures.exists('fok_icon') && character.includes('fok')) {
            texture = 'fok_icon';
        } else {
            // Fallback
            texture = character.startsWith('fok') ? 'fok' : character;
            frame = character === 'fok_v3' ? '0_Fok_v3_Idle_000.png' : '0_Fok_Idle_000.png';
        }

        const finalPortraitX = portraitX * sideMult;
        this.portraitSprite = scene.add.sprite(finalPortraitX, 0, texture, frame);

        // Flip if on right side
        if (isRightSide) {
            this.portraitSprite.setFlipX(true);
        }

        // Scale portrait to fit height
        // Target size approx 60x60 within the box
        const targetSize = height - 10;
        this.portraitSprite.setScale(1);
        const scale = targetSize / (this.portraitSprite.width || 256);
        this.portraitSprite.setScale(scale);

        // Mask for portrait (Rounded Square)
        const maskShape = scene.make.graphics({ x, y }, false);
        maskShape.fillStyle(0xffffff);
        // Mask position also needs mirroring
        maskShape.fillRoundedRect(finalPortraitX - targetSize / 2, -targetSize / 2, targetSize, targetSize, 8);
        const mask = maskShape.createGeometryMask();
        this.portraitSprite.setMask(mask);

        this.container.add(this.portraitSprite);

        // --- 4. Damage (Center-Right / Center-Left) ---
        const finalDamageX = damageX * sideMult;
        this.damageText = scene.add.text(finalDamageX, -8, '0%', {
            fontSize: '40px',
            fontFamily: '"Silkscreen"',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5);
        this.container.add(this.damageText);

        // --- 5. Name (Below Damage / Bottom Right) ---
        this.nameText = scene.add.text(finalDamageX, 22, playerName, {
            fontSize: '14px',
            fontFamily: '"Silkscreen"',
            fontStyle: 'bold',
            color: '#cccccc'
        }).setOrigin(0.5);
        this.container.add(this.nameText);
    }

    update(damage: number, stocks: number): void {
        const d = Math.floor(damage);
        this.damageText.setText(`${d}%`);
        this.stocksText.setText(stocks.toString());

        // Color grading
        let colorObj: Phaser.Types.Display.ColorObject;
        if (damage < 30) colorObj = { r: 255, g: 255, b: 255, a: 255, color: 0 };
        else if (damage < 60) colorObj = { r: 255, g: 255, b: 0, a: 255, color: 0 };
        else if (damage < 100) colorObj = { r: 255, g: 165, b: 0, a: 255, color: 0 };
        else if (damage < 150) colorObj = { r: 255, g: 0, b: 0, a: 255, color: 0 };
        else colorObj = { r: 139, g: 0, b: 0, a: 255, color: 0 };

        const colorHex = '#' + ((1 << 24) + (colorObj.r << 16) + (colorObj.g << 8) + colorObj.b).toString(16).slice(1);
        this.damageText.setColor(colorHex);
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
        const barHeight = 100;
        const padding = 120;

        let x = padding + 50;

        if (playerId === 1) { // P2
            x = width - padding - 50;
        } else if (playerId === 2) {
            x = padding * 2.5;
        } else if (playerId === 3) {
            x = width - (padding * 2.5);
        }

        // Vertical position: Centered in bottom bar area (but bar is gone)
        const y = height - barHeight + 20;

        let display = playerName;
        if (isLocalPlayer) {
            display = `${playerName} (You)`;
        }

        const isRightSide = x > width / 2;

        const slot = new PlayerHudSlot(
            this.scene,
            x,
            y,
            240, // Wider for layout
            80,  // Height
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
