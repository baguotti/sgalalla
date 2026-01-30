import Phaser from 'phaser';

export class PlayerHUD {
    private container: Phaser.GameObjects.Container;

    private portraitPixels: Phaser.GameObjects.Sprite;
    private damageText: Phaser.GameObjects.Text;
    private stocksText: Phaser.GameObjects.Text;
    private nameText: Phaser.GameObjects.Text;
    private stockIcon: Phaser.GameObjects.Arc;

    constructor(scene: Phaser.Scene, x: number, y: number, isP1: boolean, playerName: string) {
        this.container = scene.add.container(x, y);
        this.container.setScrollFactor(0); // HUD stays fixed
        this.container.setDepth(100);

        // 1. Portrait Background (Circle)
        const bgCircle = scene.add.circle(0, 0, 50, 0x000000, 0.6);
        bgCircle.setStrokeStyle(3, isP1 ? 0x3388ff : 0x00ff00);
        this.container.add(bgCircle);

        // 2. Portrait Sprite (Masked)
        // Use a frame from the atlas or just a raw sprite.
        // For now, scaling down the idle sprite to fit in circle.
        this.portraitPixels = scene.add.sprite(0, 5, 'alchemist_idle_0');
        // Fit within 80x80 area (circle diam 100)
        // Sprite is 900x900 natively!
        // We want it roughly 80x80. Scale = 80/900 = 0.09.
        // Wait, sprite is 256x256 now. Scale = 80/256 = 0.3.
        const scale = 0.35;
        this.portraitPixels.setScale(scale);

        // Mask
        const maskShape = scene.make.graphics({ x, y }, false);
        maskShape.fillStyle(0xffffff);
        maskShape.fillCircle(0, 0, 48);
        const mask = maskShape.createGeometryMask();
        this.portraitPixels.setMask(mask);
        this.container.add(this.portraitPixels);

        const flip = isP1 ? 1 : -1;

        // 3. Name Tag
        this.nameText = scene.add.text(0, -60, playerName, {
            fontSize: '20px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            color: '#ffffff',
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
        this.stockIcon = scene.add.circle(-35 * flip, 35, 12, isP1 ? 0x3388ff : 0x00ff00);
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
        if (damage < 50) {
            this.damageText.setColor('#ffffff'); // White
        } else if (damage < 100) {
            this.damageText.setColor('#ffff00'); // Yellow
        } else if (damage < 150) {
            this.damageText.setColor('#ff8800'); // Orange
        } else {
            this.damageText.setColor('#ff0000'); // Red
        }
    }

    destroy(): void {
        this.container.destroy();
    }

    public addToCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
        camera.ignore(this.container);
    }
}
