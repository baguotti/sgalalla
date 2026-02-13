import Phaser from 'phaser';

// List of scrin image filenames (loaded in GameScene preload)
const SCRIN_IMAGES = [
    'scrin_001', 'scrin_002', 'scrin_003', 'scrin_004', 'scrin_005',
    'scrin_006', 'scrin_007', 'scrin_008', 'scrin_009', 'scrin_0010',
    'scrin_0011', 'scrin_0012', 'scrin_0013', 'scrin_0014', 'scrin_0015',
    'scrin_0016', 'scrin_0017', 'scrin_0018', 'scrin_0019', 'scrin_0020',
    'scrin_0021', 'scrin_0022', 'scrin_0023', 'scrin_0024', 'scrin_0025',
    'scrin_0026', 'scrin_0027', 'scrin_0028', 'scrin_0029', 'scrin_0030',
    'scrin_0031'
];

/**
 * Chest - A rectangular box that drops from the sky.
 * Falls with gravity, lands on platforms.
 * Damages players (15%) if it lands on them from above.
 * Players can open by attacking near it → displays a random scrin image.
 * Dimensions: 90x60
 */
export class Chest extends Phaser.Physics.Matter.Sprite {
    public isOpened: boolean = false;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        const textureKey = 'chest_rect_v1';
        const width = 90;
        const height = 60;

        if (!scene.textures.exists(textureKey)) {
            const graphics = scene.make.graphics({ x: 0, y: 0 });
            graphics.fillStyle(0x8B4513, 1); // Saddle Brown
            graphics.fillRect(0, 0, width, height);
            graphics.lineStyle(4, 0x5C2D06, 1);
            graphics.strokeRect(0, 0, width, height);

            // Gold lock detail
            graphics.fillStyle(0xFFD700, 1);
            graphics.fillRect((width / 2) - 5, (height / 2) - 5, 10, 10);

            graphics.generateTexture(textureKey, width, height);
            graphics.destroy();
        }

        super(scene.matter.world, x, y, textureKey);

        this.setRectangle(width, height);
        this.setBounce(0.3);
        this.setFriction(0.5);
        this.setDensity(0.04);

        scene.add.existing(this);

        const gameScene = scene as any;
        if (gameScene.chests) {
            gameScene.chests.push(this);
        }

        this.setDepth(-10);

        this.setOnCollide((data: Phaser.Types.Physics.Matter.MatterCollisionData) => {
            this.handleCollision(data);
        });
    }

    private handleCollision(data: Phaser.Types.Physics.Matter.MatterCollisionData): void {
        if (this.isOpened) return;

        const bodyA = data.bodyA as any;
        const bodyB = data.bodyB as any;
        const otherBody = (bodyA === this.body) ? bodyB : bodyA;
        const gameObject = otherBody.gameObject;

        if (!gameObject || !gameObject.constructor) return;

        if ((gameObject as any).damagePercent !== undefined) {
            const player = gameObject as any;

            // Only hurt if chest is above the player (falling on them)
            if (this.y < player.y - 30) {
                const damage = 15;
                const knockbackForce = 15;

                const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
                const knockback = new Phaser.Math.Vector2(
                    Math.cos(angle) * knockbackForce,
                    Math.sin(angle) * knockbackForce
                );

                if (player.setDamage && player.setKnockback) {
                    player.setDamage(player.damagePercent + damage);
                    player.setKnockback(knockback.x, knockback.y);
                    player.applyHitStun();
                    this.scene.cameras.main.shake(100, 0.005);
                }
            }
        }
    }

    /**
     * Open the chest: display a scrin image as a UI overlay.
     * Image is derived deterministically from chest position to stay synced online.
     * Optionally accepts an explicit imageIndex for server-driven sync.
     */
    public open(imageIndex?: number): void {
        if (this.isOpened) return;
        this.isOpened = true;

        // Deterministic image selection: use spawn X as seed so both clients pick the same image
        const idx = imageIndex ?? (Math.abs(Math.round(this.x * 7 + this.y * 13)) % SCRIN_IMAGES.length);
        const randomKey = SCRIN_IMAGES[idx];
        const { width: sw, height: sh } = this.scene.scale;

        // Semi-transparent dark overlay behind the image
        const darkBg = this.scene.add.graphics();
        darkBg.fillStyle(0x000000, 0.7);
        darkBg.fillRect(0, 0, sw, sh);
        darkBg.setScrollFactor(0);
        darkBg.setDepth(8999);

        // Display scrin image centered on screen
        const scrinImage = this.scene.add.image(sw / 2, sh / 2, randomKey);
        scrinImage.setScrollFactor(0);
        scrinImage.setDepth(9000);

        // Scale to fit (max 60% of screen)
        const maxW = sw * 0.6;
        const maxH = sh * 0.6;
        const scaleX = maxW / scrinImage.width;
        const scaleY = maxH / scrinImage.height;
        scrinImage.setScale(Math.min(scaleX, scaleY));

        // Legend text: "Press J / Ⓑ to close"
        const legend = this.scene.add.text(sw / 2, sh - 40, 'Press J / Ⓑ to close', {
            fontSize: '20px',
            color: '#ffffff',
            fontFamily: '"Pixeloid Sans"',
            backgroundColor: '#00000088',
            padding: { x: 12, y: 6 }
        });
        legend.setOrigin(0.5);
        legend.setScrollFactor(0);
        legend.setDepth(9001);

        // Make main camera ignore these UI elements (prevents double rendering)
        const gameScene = this.scene as any;
        if (gameScene.cameras && gameScene.cameras.main) {
            gameScene.cameras.main.ignore([darkBg, scrinImage, legend]);
        }

        // Guard against double-close
        let closed = false;

        // Gamepad B button polling
        const gamepadCheck = this.scene.time.addEvent({
            delay: 50,
            loop: true,
            callback: () => {
                if (closed) return;
                const pads = this.scene.input.gamepad?.gamepads;
                if (pads) {
                    for (const pad of pads) {
                        if (pad && pad.B) {
                            closeOverlay();
                            return;
                        }
                    }
                }
            }
        });

        // Key listener (J to close)
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'j' || event.key === 'J') {
                closeOverlay();
            }
        };
        this.scene.input.keyboard?.on('keydown', onKey);

        // Cleanup function — removes ALL listeners and timers
        const closeOverlay = () => {
            if (closed) return;
            closed = true;
            gamepadCheck.remove();
            this.scene.input.keyboard?.off('keydown', onKey);
            darkBg.destroy();
            scrinImage.destroy();
            legend.destroy();
            this.destroy();
        };

        // Visual feedback: grey out chest and stop physics
        this.setTint(0x888888);
        this.setStatic(true);
    }

    destroy(fromScene?: boolean): void {
        if (this.scene) {
            const chests = (this.scene as any).chests as Chest[];
            if (chests) {
                const index = chests.indexOf(this);
                if (index > -1) {
                    chests.splice(index, 1);
                }
            }
        }
        super.destroy(fromScene);
    }
}
