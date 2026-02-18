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
    // private stocksText: Phaser.GameObjects.Text; // Removed
    private heartContainer: Phaser.GameObjects.Container;
    private portraitContainer: Phaser.GameObjects.Container;
    private scene: Phaser.Scene;
    private colorHex: string; // Store for hearts

    // Shake State
    private lastDamage: number = 0;
    private lastStocks: number = -1; // Force initial render
    private portraitBaseX: number = 0;
    private portraitBaseY: number = 0;

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
        this.scene = scene;
        this.container = scene.add.container(x, y);
        this.container.setScrollFactor(0);
        this.container.setDepth(101);

        const colorObj = Phaser.Display.Color.ValueToColor(SMASH_COLORS[playerIndex % SMASH_COLORS.length]);
        const color = colorObj.color;
        const colorHex = '#' + color.toString(16).padStart(6, '0');
        this.colorHex = colorHex;

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


        // --- 3. Diamond Portrait (Front Layer) ---
        this.portraitBaseX = portraitOffset;
        this.portraitBaseY = 0;
        this.portraitContainer = scene.add.container(portraitOffset, 0);

        // --- 2. Diamond Shadow (Now inside portraitContainer for shared shake) ---
        const shadowGraphics = scene.add.graphics();
        shadowGraphics.fillStyle(0x000000, 1); // Hard black shadow
        shadowGraphics.fillRect(-diamondSize / 2, -diamondSize / 2, diamondSize, diamondSize);
        shadowGraphics.rotation = Phaser.Math.DegToRad(45);
        shadowGraphics.x = 5; // Offset X relative to container (was portraitOffset + 5)
        shadowGraphics.y = 5; // Offset Y relative to container
        this.portraitContainer.add(shadowGraphics);

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
        if (['fok', 'sgu', 'sga', 'nock', 'greg'].includes(character.toLowerCase())) {
            texture = character.toLowerCase(); // Texture key is 'fok', 'sgu'
            frame = `00_${character.toLowerCase()}_icon`;
        } else if (character.toLowerCase() === 'pe') {
            // Pe does not have an icon in the atlas yet, use idle frame
            texture = 'pe';
            frame = 'pe_idle_000';
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


        this.container.add(this.bigDamageText);
        this.container.add(this.percentText);


        // --- 5. Stocks (Under Name Tag) ---
        // Visual Hearts logic
        // We'll manage hearts in update() to ensure they match live stock count
        // Create a container for hearts to easily clear/rebuild
        this.heartContainer = scene.add.container(nameX - 15, nameY + 25);
        this.container.add(this.heartContainer);

        // Initial render will happen in first update() call

        void width; void height; void isRightSide;
    }

    update(damage: number, stocks: number): void {
        const d = Math.floor(damage);
        this.bigDamageText.setText(`${d}`);

        // Update Position of % symbol to follow number
        const width = this.bigDamageText.width;
        this.percentText.x = this.bigDamageText.x + width + 2;

        // Stocks Update (Only redraw if changed)
        if (stocks !== this.lastStocks) {
            this.updateHearts(stocks);
            this.lastStocks = stocks;
        }

        // Color Grading for Damage
        if (damage < 50) {
            this.bigDamageText.setColor('#ffffff');
        } else if (damage < 100) {
            this.bigDamageText.setColor('#ffdd44'); // Yellowish
        } else {
            this.bigDamageText.setColor('#ff4444'); // Red
        }

        // Shake detection
        if (damage > this.lastDamage) {
            const diff = damage - this.lastDamage;
            // Higher damage = more shake
            // Signatures do ~15-20 damage. Light attacks ~4-8.
            // Shake intensity: 2px base, +1px per 10 damage?
            let intensity = 2;
            if (diff > 12) intensity = 5; // Heavy hit

            this.shake(intensity);
        }
        this.lastDamage = damage;
    }

    private updateHearts(stocks: number): void {
        this.heartContainer.removeAll(true); // Clear existing

        const spacing = 22; // Horizontal spacing

        // Get player color for hearts
        const colorHex = this.colorHex || '#ffffff'; // Fallback logic needed or store color

        // Limit visual hearts to prevent overflow? (e.g. max 5)
        // For now, draw all.
        for (let i = 0; i < stocks; i++) {
            const heart = this.scene.add.text(i * spacing, 0, '♥', {
                fontSize: '20px',
                fontFamily: '"Pixeloid Sans"',
                color: this.colorHex,
                stroke: '#000000',
                strokeThickness: 3
            }).setOrigin(0, 0.5);
            heart.setShadow(2, 2, '#000000', 0, true, true);
            this.heartContainer.add(heart);
        }
    }

    private shake(intensity: number): void {
        // Subtle Y-axis shake only
        // Check if tween already active? If so, maybe stop it and do new one if stronger?
        if (this.scene.tweens.isTweening(this.portraitContainer)) {
            this.scene.tweens.killTweensOf(this.portraitContainer);
            this.portraitContainer.setPosition(this.portraitBaseX, this.portraitBaseY);
        }

        this.scene.tweens.add({
            targets: this.portraitContainer,
            y: { from: this.portraitBaseY, to: this.portraitBaseY + intensity },
            duration: 50, // Fast
            yoyo: true,
            repeat: 3, // 3 shakes
            ease: 'Sine.easeInOut',
            onComplete: () => {
                this.portraitContainer.setPosition(this.portraitBaseX, this.portraitBaseY);
            }
        });
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
