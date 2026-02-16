import Phaser from 'phaser';
import { Player } from '../entities/Player';

// Smash Ultimate Style Colors
export const SMASH_COLORS = [
    0xE63946, // P1 Red
    0x4361EE, // P2 Blue
    0xFF006E, // P3 Pink
    0x06D6A0, // P4 Green
    0xFF9F1C, // P5 Orange
    0x2EC4B6  // P6 Cyan
];

/**
 * HUD slot for a single player - Refined V2
 * Visuals: Rounded box with stroke, transparent inside.
 * Layout: [Stocks] [Portrait] [Damage] [Name]
 */
/**
 * HUD slot for a single player - Diamond Style
 * Visuals: Diamond portrait, big damage text, gradient name tag.
 * Layout: [Diamond Portrait] [Big Damage %]
 *         [       ] [Name Tag]
 *         [       ] [Stocks]
 */
export class PlayerHudSlot {
    private container: Phaser.GameObjects.Container;
    private bigDamageText: Phaser.GameObjects.Text;
    private percentText: Phaser.GameObjects.Text;
    private nameText: Phaser.GameObjects.Text;
    private stocksText: Phaser.GameObjects.Text;
    private portraitContainer: Phaser.GameObjects.Container;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        width: number,
        height: number,
        _playerName: string,
        playerIndex: number,
        character: string,
        isRightSide: boolean = false
    ) {
        this.container = scene.add.container(x, y);
        this.container.setScrollFactor(0);
        this.container.setDepth(101);

        const colorObj = Phaser.Display.Color.ValueToColor(SMASH_COLORS[playerIndex % SMASH_COLORS.length]);
        const color = colorObj.color;
        const colorHex = '#' + color.toString(16).padStart(6, '0');

        // Darker color for top of gradient
        const darkerColorObj = new Phaser.Display.Color(colorObj.red, colorObj.green, colorObj.blue);
        darkerColorObj.darken(30); // Darken by 30%
        const darkerColor = darkerColorObj.color;

        // --- Layout Constants ---
        const diamondSize = 90;
        const portraitOffset = -50;
        const damageX = portraitOffset + (diamondSize / 2) + 35; // Moved 20px right (was +15)
        const damageY = -15;

        // --- 1. Name Tag (Background Layer - Behind Diamond) ---
        // Moved significantly left to tuck start behind diamond
        // User requested +30px, then +35px, then +20px more.
        // Start was -50. -50 + 30 = -20. -20 + 35 = +15. +15 + 20 = +35.
        const nameX = portraitOffset + 38; // +3px more right (Total +38)
        const nameY = 35; // -5px up (was 40)
        const nameW = 180;
        const nameH = 24;

        // Gradient Background
        const nameBg = scene.add.graphics();
        nameBg.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.8, 0, 0.8, 0);
        nameBg.fillRect(0, -nameH / 2, nameW, nameH);
        nameBg.x = nameX - 20; // Moved 20px left as requested (bg only)
        nameBg.y = nameY;
        this.container.add(nameBg);

        // Name Text
        let charName = character.split('_')[0].toUpperCase();
        if (charName === 'FOK') charName = 'FOK';
        this.nameText = scene.add.text(nameX + 10, nameY, `P${playerIndex + 1} • ${charName}`, {
            fontSize: '16px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: colorHex,
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0, 0.5);
        this.container.add(this.nameText);


        // --- 2. Diamond Shadow (Middle Layer) ---
        const shadowGraphics = scene.add.graphics();
        shadowGraphics.fillStyle(0x000000, 1); // Hard black shadow
        shadowGraphics.fillRect(-diamondSize / 2, -diamondSize / 2, diamondSize, diamondSize);
        shadowGraphics.rotation = Phaser.Math.DegToRad(45);
        shadowGraphics.x = portraitOffset + 5; // Offset X
        shadowGraphics.y = 5; // Offset Y
        this.container.add(shadowGraphics);


        // --- 3. Diamond Portrait (Front Layer) ---
        this.portraitContainer = scene.add.container(portraitOffset, 0);

        // A. Diamond Gradient Fill
        const fillGraphics = scene.add.graphics();
        fillGraphics.fillGradientStyle(darkerColor, color, color, color, 1, 1, 1, 1);
        fillGraphics.fillRect(-diamondSize / 2, -diamondSize / 2, diamondSize, diamondSize);
        fillGraphics.rotation = Phaser.Math.DegToRad(45);
        this.portraitContainer.add(fillGraphics);

        // B. Portrait Mask
        const maskGraphics = scene.make.graphics({ x: x + portraitOffset, y: y }, false);
        maskGraphics.fillStyle(0xffffff);
        maskGraphics.fillRect(-diamondSize / 2, -diamondSize / 2, diamondSize, diamondSize);
        maskGraphics.rotation = Phaser.Math.DegToRad(45);
        const mask = maskGraphics.createGeometryMask();

        // C. Portrait Sprite
        let texture = character;
        let frame: string | undefined = undefined;

        // Standardized Icon Retrieval for Fok and Sgu
        // Standardized Icon Retrieval for Fok and Sgu
        if (['fok', 'sgu', 'sga', 'pe', 'nock', 'greg'].includes(character.toLowerCase())) {
            texture = character.toLowerCase(); // Texture key is 'fok', 'sgu'
            frame = `00_${character.toLowerCase()}_icon`;
        } else {
            // Fallback for legacy/other characters
            texture = character;
            frame = `${character}_Idle_000.png`;
        }

        const portrait = scene.add.sprite(0, 0, texture, frame);

        // User requested -5% smaller (1.35 -> 1.28)
        const targetSize = diamondSize * 1.15;
        const scale = targetSize / (portrait.width || 64);
        portrait.setScale(scale);

        portrait.y = 10; // Push down

        portrait.setMask(mask);
        this.portraitContainer.add(portrait);

        // D. Border
        const borderGraphics = scene.add.graphics();
        borderGraphics.lineStyle(6, color, 1);
        borderGraphics.strokeRect(-diamondSize / 2, -diamondSize / 2, diamondSize, diamondSize);
        borderGraphics.rotation = Phaser.Math.DegToRad(45);
        this.portraitContainer.add(borderGraphics);

        this.container.add(this.portraitContainer);


        // --- 4. Big Damage % ---
        // Bigger Font (60px), Lower Aligned, Hard Shadow
        this.bigDamageText = scene.add.text(damageX, damageY, '0', {
            fontSize: '60px', // Bigger
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold', // Removed italic
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0, 0.5);
        // Hard Drop Shadow
        this.bigDamageText.setShadow(4, 4, '#000000', 0, true, true);

        this.percentText = scene.add.text(damageX, damageY + 12, '%', {
            fontSize: '30px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0.5);
        this.percentText.setShadow(3, 3, '#000000', 0, true, true);

        this.container.add(this.bigDamageText);
        this.container.add(this.percentText);


        // --- 5. Stocks (Under Name Tag, Split Colors) ---
        // "Move hearts and lives under name tag"
        // "Hearts right colors but X number white"
        const stockX = nameX + 10 - 28; // +7px right (was -43)
        const stockY = nameY + 25;

        // Heart Icon (Player Color)
        const heartIcon = scene.add.text(stockX, stockY, '♥', {
            fontSize: '18px',
            fontFamily: '"Pixeloid Sans"',
            color: colorHex,
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0.5);
        heartIcon.setShadow(2, 2, '#000000', 0, true, true);
        this.container.add(heartIcon);

        // Stocks Text (White)
        this.stocksText = scene.add.text(stockX + 22, stockY, 'x 3', {
            fontSize: '18px',
            fontFamily: '"Pixeloid Sans"',
            fontStyle: 'bold',
            color: '#ffffff', // White
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0, 0.5);
        this.stocksText.setShadow(2, 2, '#000000', 0, true, true);

        this.container.add(this.stocksText);

        void width; void height; void isRightSide;
    }

    update(damage: number, stocks: number): void {
        const d = Math.floor(damage);
        this.bigDamageText.setText(`${d}`);
        this.stocksText.setText(`x ${stocks}`);

        // Update Position of % symbol to follow number
        const width = this.bigDamageText.width;
        this.percentText.x = this.bigDamageText.x + width + 2;

        // Color Grading for Damage
        if (damage < 50) {
            this.bigDamageText.setColor('#ffffff');
        } else if (damage < 100) {
            this.bigDamageText.setColor('#ffdd44'); // Yellowish
        } else {
            this.bigDamageText.setColor('#ff4444'); // Red
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

        // Dynamic spacing: Use total player count from scene data if available, or default to 4 (growing if needed)
        // GameScene stores playerData array.
        let totalSlots = 4;
        const scene: any = this.scene;
        if (scene.playerData && Array.isArray(scene.playerData)) {
            totalSlots = Math.max(scene.playerData.length, 4);
        }

        const segment = width / totalSlots;
        const slotIndex = playerId; // 0-based index

        const x = (slotIndex * segment) + (segment / 2);

        // Vertical position: Bottom
        const y = height - 90; // Raise to accommodate Diamond height and Stocks below

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
