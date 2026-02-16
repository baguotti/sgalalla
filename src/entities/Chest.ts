import Phaser from 'phaser';
import type { GameSceneInterface } from '../scenes/GameSceneInterface';
import { PhysicsConfig } from '../config/PhysicsConfig';
import { Player } from './Player';

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
 * Damages players (25%) if it lands on them from above.
 * Players can open by attacking near it → displays a random scrin image.
 * Dimensions: 90x60
 */
export class Chest extends Phaser.Physics.Matter.Sprite {
    public isOpened: boolean = false;
    public isOverlayOpen: boolean = false; // Tracks if the reward UI is currently visible

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
        this.setBounce(0.0); // No bounce for heavy feel
        this.setFriction(0.9); // High friction to stop sliding
        this.setFrictionAir(0.0); // No air resistance (falls faster)
        this.setDensity(1.0); // Very heavy (was 0.1) ~ Metal box weight
        this.setVelocityY(20); // Initial downward velocity

        scene.add.existing(this);

        const gameScene = scene as GameSceneInterface;
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

        let player: Player | null = null;

        for (const b of [bodyA, bodyB]) {
            const go = b.gameObject;

            if (go && go !== this) {
                // Check if it is a Player instance
                if (go instanceof Player) {
                    player = go;
                    break;
                }
                // Check parent container
                if (go.parentContainer && go.parentContainer instanceof Player) {
                    player = go.parentContainer;
                    break;
                }
            }
        }

        // If no player found, check for ground/static impact
        if (!player) {
            const other = (bodyA.gameObject === this) ? bodyB :
                (bodyB.gameObject === this) ? bodyA :
                    bodyB; // fallback
            if (other.isStatic) {
                const body = this.body as MatterJS.BodyType;
                if (body && body.speed > PhysicsConfig.CHEST_SPEED_THRESHOLD) {
                    this.scene.cameras.main.shake(PhysicsConfig.CHEST_GROUND_SHAKE_DURATION, PhysicsConfig.CHEST_GROUND_SHAKE_INTENSITY);
                }
            }
            return;
        }

        // Player found — apply damage and massive knockback
        const damage = PhysicsConfig.CHEST_DAMAGE;
        const knockbackForce = PhysicsConfig.CHEST_KNOCKBACK_FORCE;

        const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
        const knockback = new Phaser.Math.Vector2(
            Math.cos(angle) * knockbackForce,
            Math.sin(angle) * knockbackForce
        );

        player.setDamage(player.damagePercent + damage);
        player.setKnockback(knockback.x, knockback.y);
        player.applyHitStun();
        this.scene.cameras.main.shake(PhysicsConfig.CHEST_SHAKE_DURATION, PhysicsConfig.CHEST_SHAKE_INTENSITY);
    }

    /**
     * Open the chest: display a scrin image as a UI overlay.
     * Image is derived deterministically from chest position to stay synced online.
     * Optionally accepts an explicit imageIndex for server-driven sync.
     */
    public open(imageIndex?: number): void {
        if (this.isOpened) return;

        // Ground check: ensure chest is not falling
        const body = this.body as MatterJS.BodyType;
        if (Math.abs(body.velocity.y) > 0.5) {
            return;
        }

        this.isOpened = true;
        this.isOverlayOpen = true;

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

        // Valid image
        const scrinImage = this.scene.add.image(sw / 2, sh / 2, randomKey);
        scrinImage.setScrollFactor(0);
        scrinImage.setDepth(9000);
        scrinImage.setAlpha(0); // Start invisible

        // Scale to 90% screen height
        const targetHeight = sh * 0.9;
        const scale = targetHeight / scrinImage.height;
        scrinImage.setScale(scale);

        // Initial State
        scrinImage.setAlpha(1); // Visible but slightly blurred
        scrinImage.setScale(scale * 0.8); // Start slightly smaller

        // Add light blur (Reduced from 6 to 2)
        const blur = scrinImage.postFX.addBlur(1, 2, 2, 1);

        // Animation Sequence using Chain
        this.scene.tweens.chain({
            tweens: [
                // 1. Shake and Anticipation (Blur stays on)
                {
                    targets: scrinImage,
                    angle: { from: -2, to: 2 },
                    duration: 40,
                    yoyo: true,
                    repeat: 10, // ~400ms of shaking (faster)
                    onStart: () => {
                        // Pulse size slightly
                        this.scene.tweens.add({
                            targets: scrinImage,
                            scale: scale * 0.9,
                            duration: 400,
                            ease: 'Sine.easeInOut'
                        });
                    }
                },
                // 2. Reveal (Blur clears rapidly, Scale pops up)
                {
                    targets: blur,
                    strength: 0,
                    duration: 300, // Faster clear
                    ease: 'Sine.easeOut',
                    offset: '-=100', // Overlap slightly
                    onStart: () => {
                        // Pop up sync with blur clear
                        this.scene.tweens.add({
                            targets: scrinImage,
                            scale: { from: scale * 0.9, to: scale * 1.05 },
                            angle: 0,
                            duration: 250, // Fast pop
                            ease: 'Back.easeOut'
                        });
                    }
                },
                // 3. Settle (Scale back to normal)
                {
                    targets: scrinImage,
                    scale: scale,
                    duration: 150, // Quick settle
                    ease: 'Sine.easeOut',
                    delay: 100
                }
            ]
        });

        // Legend text: "Press J / Ⓑ / ESC to close"
        const legend = this.scene.add.text(sw / 2, sh - 30, 'Press J / Ⓑ / ESC to close', {
            fontSize: '20px',
            color: '#ffffff',
            fontFamily: '"Pixeloid Sans"',
            backgroundColor: '#00000088',
            padding: { x: 12, y: 6 }
        });
        legend.setOrigin(0.5);
        legend.setScrollFactor(0);
        legend.setDepth(9001);
        legend.setAlpha(0);

        // Fade in legend with image
        this.scene.tweens.add({
            targets: legend,
            alpha: 1,
            duration: 500,
            delay: 300
        });

        // Make main camera ignore these UI elements (prevents double rendering)
        const gameScene = this.scene as GameSceneInterface;
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

        // Key listener (J or ESC to close)
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'j' || event.key === 'J' || event.key === 'Escape') {
                closeOverlay();
            }
        };
        this.scene.input.keyboard?.on('keydown', onKey);

        // Cleanup function — removes ALL listeners and timers
        const closeOverlay = () => {
            if (closed) return;
            closed = true;

            // Keep isOverlayOpen true for a short moment to prevent GameScene from processing the same ESC press
            this.scene.time.delayedCall(100, () => {
                this.isOverlayOpen = false;
                this.destroy(); // Destroy AFTER the delay
            });

            gamepadCheck.remove();
            this.scene.input.keyboard?.off('keydown', onKey);
            darkBg.destroy();
            scrinImage.destroy();
            legend.destroy();
        };

        // Visual feedback: grey out chest and stop physics
        this.setTint(0x888888);
        this.setStatic(true);
    }

    destroy(fromScene?: boolean): void {
        if (this.scene) {
            const chests = (this.scene as GameSceneInterface).chests;
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
