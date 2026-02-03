import Phaser from 'phaser';
import { Player } from '../entities/Player';

/**
 * HUD slot for a single player - displays portrait, damage, and stocks
 */
export class PlayerHudSlot {
    private container: Phaser.GameObjects.Container;

    private portraitPixels: Phaser.GameObjects.Sprite;
    private damageText: Phaser.GameObjects.Text;
    private stocksText: Phaser.GameObjects.Text;
    private nameText: Phaser.GameObjects.Text;
    private stockIcon: Phaser.GameObjects.Arc;

    constructor(scene: Phaser.Scene, x: number, y: number, isLeft: boolean, playerName: string, color: number) {
        this.container = scene.add.container(x, y);
        this.container.setScrollFactor(0); // HUD stays fixed
        this.container.setDepth(100);

        // 1. Portrait Background (Circle)
        const bgCircle = scene.add.circle(0, 0, 50, 0x000000, 0.6);
        bgCircle.setStrokeStyle(3, color);
        this.container.add(bgCircle);

        // 2. Portrait Sprite (Masked)
        this.portraitPixels = scene.add.sprite(0, 5, 'fok', '0_Fok_Idle_000.png');
        const scale = 0.35;
        this.portraitPixels.setScale(scale);

        // Mask
        const maskShape = scene.make.graphics({ x, y }, false);
        maskShape.setScrollFactor(0); // Fix mask to screen
        maskShape.fillStyle(0xffffff);
        maskShape.fillCircle(0, 0, 48);
        const mask = maskShape.createGeometryMask();
        this.portraitPixels.setMask(mask);
        this.container.add(this.portraitPixels);

        const flip = isLeft ? 1 : -1;

        // Convert 0xRRGGBB to '#RRGGBB'
        const colorHexString = '#' + color.toString(16).padStart(6, '0');

        // 3. Name Tag
        this.nameText = scene.add.text(0, -60, playerName, {
            fontSize: '20px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: colorHexString,
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5);
        this.container.add(this.nameText);

        // 4. Damage Text (Large, overlapping bottom right of portrait for P1)
        this.damageText = scene.add.text(35 * flip, 20, '0', {
            fontSize: '48px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        this.container.add(this.damageText);

        // 5. Stocks (Bottom Left for P1, Bottom Right for P2)
        this.stockIcon = scene.add.circle(-35 * flip, 35, 12, color);
        this.stockIcon.setStrokeStyle(2, 0xffffff);
        this.container.add(this.stockIcon);

        // Stock Count
        this.stocksText = scene.add.text(-35 * flip, 35, '3', {
            fontSize: '18px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff'
        }).setOrigin(0.5);
        this.container.add(this.stocksText);
    }

    update(damage: number, stocks: number): void {
        this.damageText.setText(Math.floor(damage).toString());
        this.stocksText.setText(stocks.toString());

        // Color code damage (Gradient)
        let colorObj: Phaser.Types.Display.ColorObject;

        if (damage < 50) {
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 255, 255),
                new Phaser.Display.Color(255, 255, 80),
                50,
                damage
            );
        } else if (damage < 100) {
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 255, 80),
                new Phaser.Display.Color(255, 160, 80),
                50,
                damage - 50
            );
        } else if (damage < 150) {
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 160, 80),
                new Phaser.Display.Color(255, 80, 80),
                50,
                damage - 100
            );
        } else {
            colorObj = { r: 255, g: 80, b: 80, a: 255, color: 0 };
        }

        const colorHex = '#' +
            ((1 << 24) + (colorObj.r << 16) + (colorObj.g << 8) + colorObj.b)
                .toString(16).slice(1);

        this.damageText.setColor(colorHex);
    }

    destroy(): void {
        this.container.destroy();
    }

    public addToCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
        camera.ignore(this.container);
    }
}

// Player colors for HUD slots
const PLAYER_COLORS = [0x4fc3f7, 0xff7043, 0x81c784, 0xba68c8]; // Light Blue, Orange, Green, Purple

/**
 * MatchHUD - Manages all player HUD slots + debug display
 */
export class MatchHUD {
    private scene: Phaser.Scene;
    private slots: Map<number, PlayerHudSlot> = new Map();

    // Debug display
    private debugContainer: Phaser.GameObjects.Container;
    private pingText: Phaser.GameObjects.Text;
    private fpsText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;

        // Create debug display in top-center
        const { width } = scene.cameras.main;
        this.debugContainer = scene.add.container(width / 2, 20);
        this.debugContainer.setScrollFactor(0);
        this.debugContainer.setDepth(100);

        // Background
        const bg = scene.add.rectangle(0, 0, 100, 50, 0x000000, 0.6);
        bg.setStrokeStyle(1, 0x444444);
        this.debugContainer.add(bg);

        // Ping text
        this.pingText = scene.add.text(-40, -12, 'PING: --', {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#00ff00'
        });
        this.debugContainer.add(this.pingText);

        // FPS text
        this.fpsText = scene.add.text(-40, 4, 'FPS: --', {
            fontSize: '12px',
            fontFamily: 'monospace',
            color: '#ffff00'
        });
        this.debugContainer.add(this.fpsText);
    }

    private ignoredCameras: Phaser.Cameras.Scene2D.Camera[] = [];

    /**
     * Add a player's HUD slot to the display
     */
    addPlayer(playerId: number, playerName: string, isLocalPlayer: boolean): void {
        if (this.slots.has(playerId)) return;

        // Calculate position based on slot index
        const slotIndex = this.slots.size;
        const positions = this.getSlotPositions();
        const pos = positions[slotIndex % positions.length];

        const color = PLAYER_COLORS[slotIndex % PLAYER_COLORS.length];
        const displayName = isLocalPlayer ? `${playerName} (You)` : playerName;

        const slot = new PlayerHudSlot(
            this.scene,
            pos.x,
            pos.y,
            pos.isLeft,
            displayName,
            color
        );

        // Apply any existing camera ignores
        this.ignoredCameras.forEach(cam => slot.addToCameraIgnore(cam));

        this.slots.set(playerId, slot);
    }

    // ... getSlotPositions ...

    /**
     * Exclude all HUD elements from a specific camera
     * Also tracks this camera to exclude future slots
     */
    public addToCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
        if (!this.ignoredCameras.includes(camera)) {
            this.ignoredCameras.push(camera);
        }
        camera.ignore(this.debugContainer);
        this.slots.forEach(slot => slot.addToCameraIgnore(camera));
    }

    /**
     * Get HUD slot positions for up to 4 players
     */
    private getSlotPositions(): { x: number, y: number, isLeft: boolean }[] {
        const { width, height } = this.scene.cameras.main;
        return [
            { x: 100, y: 80, isLeft: true },       // Top-left (P1)
            { x: width - 100, y: 80, isLeft: false }, // Top-right (P2)
            { x: 100, y: height - 80, isLeft: true }, // Bottom-left (P3)
            { x: width - 100, y: height - 80, isLeft: false } // Bottom-right (P4)
        ];
    }

    /**
     * Update all player HUD slots
     */
    updatePlayers(players: Map<number, Player>): void {
        players.forEach((player, id) => {
            const slot = this.slots.get(id);
            if (slot) {
                slot.update(player.damagePercent, player.lives);
            }
        });
    }

    /**
     * Update debug display with network stats
     */
    updateDebug(ping: number, fps: number): void {
        // Color ping based on quality
        let pingColor = '#00ff00'; // Green (<50ms)
        if (ping > 100) pingColor = '#ff0000'; // Red (>100ms)
        else if (ping > 50) pingColor = '#ffff00'; // Yellow (50-100ms)

        this.pingText.setText(`PING: ${ping}ms`);
        this.pingText.setColor(pingColor);

        // Color FPS based on performance
        let fpsColor = '#00ff00'; // Green (>50fps)
        if (fps < 30) fpsColor = '#ff0000'; // Red (<30fps)
        else if (fps < 50) fpsColor = '#ffff00'; // Yellow (30-50fps)

        this.fpsText.setText(`FPS: ${Math.round(fps)}`);
        this.fpsText.setColor(fpsColor);
    }

    /**
     * Remove a player's HUD slot
     */
    removePlayer(playerId: number): void {
        const slot = this.slots.get(playerId);
        if (slot) {
            slot.destroy();
            this.slots.delete(playerId);
        }
    }

    destroy(): void {
        this.slots.forEach(slot => slot.destroy());
        this.debugContainer.destroy();
    }


}


// Re-export PlayerHudSlot as PlayerHUD for backwards compatibility with GameScene
export { PlayerHudSlot as PlayerHUD };
