import Phaser from 'phaser';

export class Hitbox {
    scene: Phaser.Scene;
    x: number;
    y: number;
    width: number;
    height: number;
    active: boolean;
    debugGraphics?: Phaser.GameObjects.Rectangle;
    private debugVisible: boolean = false;

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

    setDebug(visible: boolean): void {
        this.debugVisible = visible;
        if (this.debugGraphics) {
            // Only show if active AND debug is enabled
            this.debugGraphics.setVisible(this.active && visible);
        }
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

            // Exclude from UI camera if scene supports it
            if ((this.scene as any).addToCameraIgnore) {
                (this.scene as any).addToCameraIgnore(this.debugGraphics);
            }
        }

        this.debugGraphics.setPosition(this.x, this.y);
        this.debugGraphics.setVisible(this.debugVisible);
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

    setSize(width: number, height: number): void {
        this.width = width;
        this.height = height;

        if (this.debugGraphics) {
            this.debugGraphics.setSize(width, height);
            // Updating size of rectangle geometry might not center it correctly if origin isn't handled
            // But rectangle primitive usually draws from x,y minus origin.
            // setSize updates the display size.
            // Let's ensure visuals align.
            // Actually, simply destroying and recreating debug graphics might be safer if size changes often?
            // Or setSize is fine.
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
