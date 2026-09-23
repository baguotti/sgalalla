import Phaser from 'phaser';
import type { GameSceneInterface } from '../scenes/GameSceneInterface';

export class Hitbox {
    scene: Phaser.Scene;
    x: number;
    y: number;
    width: number;
    height: number;
    active: boolean;
    debugGraphics?: Phaser.GameObjects.Rectangle;
    private debugVisible: boolean = false;
    private readonly _boundsRect: Phaser.Geom.Rectangle = new Phaser.Geom.Rectangle(0, 0, 0, 0);

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
            if ((this.scene as GameSceneInterface).addToCameraIgnore) {
                (this.scene as GameSceneInterface).addToCameraIgnore(this.debugGraphics);
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
        }
    }

    getBounds(): Phaser.Geom.Rectangle {
        this._boundsRect.setTo(
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        return this._boundsRect;
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
