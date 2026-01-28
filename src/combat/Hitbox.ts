import Phaser from 'phaser';

export class Hitbox {
    scene: Phaser.Scene;
    x: number;
    y: number;
    width: number;
    height: number;
    active: boolean;
    debugGraphics?: Phaser.GameObjects.Rectangle;

    constructor(
        scene: Phaser.Scene,
        x: number,
        y: number,
        width: number,
        height: number
    ) {
        this.scene = scene;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = false;
    }

    activate(x: number, y: number): void {
        this.x = x;
        this.y = y;
        this.active = true;

        // Create debug visual
        if (!this.debugGraphics) {
            this.debugGraphics = this.scene.add.rectangle(
                this.x,
                this.y,
                this.width,
                this.height,
                0xff0000,
                0.3
            );
            this.debugGraphics.setStrokeStyle(2, 0xff0000);
            this.debugGraphics.setDepth(999);
        } else {
            this.debugGraphics.setPosition(this.x, this.y);
            this.debugGraphics.setVisible(true);
        }
    }

    deactivate(): void {
        this.active = false;
        if (this.debugGraphics) {
            this.debugGraphics.setVisible(false);
        }
    }

    updatePosition(x: number, y: number): void {
        this.x = x;
        this.y = y;
        if (this.debugGraphics && this.active) {
            this.debugGraphics.setPosition(x, y);
        }
    }

    getBounds(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
    }

    checkCollision(targetBounds: Phaser.Geom.Rectangle): boolean {
        if (!this.active) return false;
        return Phaser.Geom.Intersects.RectangleToRectangle(
            this.getBounds(),
            targetBounds
        );
    }

    destroy(): void {
        if (this.debugGraphics) {
            this.debugGraphics.destroy();
        }
    }
}
