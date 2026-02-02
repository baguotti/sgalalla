import Phaser from 'phaser';

export class PlayerHUD {
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
        // Use a frame from the atlas or just a raw sprite.
        // For now, scaling down the idle sprite to fit in circle.
        this.portraitPixels = scene.add.sprite(0, 5, 'fok_idle_0'); // Updated to fok
        // Fit within 80x80 area (circle diam 100)
        // Sprite is 256x256 now. Scale = 80/256 = 0.3.
        const scale = 0.35;
        this.portraitPixels.setScale(scale);

        // Mask
        const maskShape = scene.make.graphics({ x, y }, false);
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
        // Icon
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

        // Color code damage
        // Color code damage (Gradient)
        let colorObj: Phaser.Types.Display.ColorObject;

        if (damage < 50) {
            // White to Vivid Yellow (0-50)
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 255, 255),
                new Phaser.Display.Color(255, 255, 80), // Vivid Yellow
                50,
                damage
            );
        } else if (damage < 100) {
            // Vivid Yellow to Vivid Orange (50-100)
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 255, 80),
                new Phaser.Display.Color(255, 160, 80), // Vivid Orange
                50,
                damage - 50
            );
        } else if (damage < 150) {
            // Vivid Orange to Vivid Red (100-150)
            colorObj = Phaser.Display.Color.Interpolate.ColorWithColor(
                new Phaser.Display.Color(255, 160, 80),
                new Phaser.Display.Color(255, 80, 80), // Vivid Red
                50,
                damage - 100
            );
        } else {
            // Cap at Vivid Red
            colorObj = { r: 255, g: 80, b: 80, a: 255 };
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
