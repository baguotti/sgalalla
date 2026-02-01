import Phaser from 'phaser';

export class Bomb extends Phaser.Physics.Matter.Sprite {
    constructor(scene: Phaser.Scene, x: number, y: number) {
        // Create a temporary texture if it doesn't exist
        const textureKey = 'bomb_v5';
        const radius = 15;
        const diameter = radius * 2;

        if (!scene.textures.exists(textureKey)) {
            const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
            graphics.fillStyle(0x444444, 1); // Dark Grey
            graphics.fillCircle(radius, radius, radius);
            graphics.generateTexture(textureKey, diameter, diameter);
        }

        super(scene.matter.world, x, y, textureKey);

        this.setCircle(radius);
        this.setBounce(0.5);
        this.setFriction(0.005);
        this.setDensity(0.01);

        scene.add.existing(this);

        // Register to scene (casted because we added 'bombs' recently)
        const gameScene = scene as any;
        if (gameScene.bombs) {
            gameScene.bombs.push(this);
        }

        console.log(`Bomb spawned at ${x}, ${y}`);
        this.setDepth(100); // Ensure it's in front
    }

    destroy(fromScene?: boolean): void {
        super.destroy(fromScene);
        // Remove from scene list
        const bombs = (this.scene as any).bombs as Bomb[];
        if (bombs) {
            const index = bombs.indexOf(this);
            if (index > -1) {
                bombs.splice(index, 1);
            }
        }
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);
        if (this.scene.game.loop.frame % 60 === 0) {
            console.log(`Bomb pos: ${this.x.toFixed(0)}, ${this.y.toFixed(0)}`);
        }
    }
}
