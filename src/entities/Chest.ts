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
    private canClose: boolean = false; // Blocks input during reveal animation

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
        this.canClose = false; // Block input initially

        // Deterministic image selection
        const idx = imageIndex ?? (Math.abs(Math.round(this.x * 7 + this.y * 13)) % SCRIN_IMAGES.length);
        const randomKey = SCRIN_IMAGES[idx];
        const { width: sw, height: sh } = this.scene.scale;

        // Semi-transparent dark overlay
        const darkBg = this.scene.add.graphics();
        darkBg.fillStyle(0x000000, 0.85); // Darker for better focus
        darkBg.fillRect(0, 0, sw, sh);
        darkBg.setScrollFactor(0);
        darkBg.setDepth(8999);
        darkBg.setAlpha(0);

        // Fade in BG
        this.scene.tweens.add({
            targets: darkBg,
            alpha: 1,
            duration: 300,
            ease: 'Sine.easeOut'
        });

        // Valid image
        const scrinImage = this.scene.add.image(sw / 2, sh / 2, randomKey);
        scrinImage.setScrollFactor(0);
        scrinImage.setDepth(9000);

        // Scale to 85% screen height (slightly smaller for elegance)
        const targetHeight = sh * 0.85;
        const scale = targetHeight / scrinImage.height;
        scrinImage.setScale(scale); // Set base scale

        // Initial State for Animation
        scrinImage.setAlpha(0);
        scrinImage.setScale(scale * 0.6); // Start small
        scrinImage.setAngle(-5); // Slight tilt

        // Add blur (Start heavy)
        // Note: PostFX can be expensive, ensure we clean it up if needed
        const blur = scrinImage.postFX.addBlur(1, 4, 4, 2);

        // ---------------------------------------------------------
        // ANIMATION SEQUENCE: POP + FOCUS
        // ---------------------------------------------------------

        // 1. Parallel: Pop Up + Fade In + De-Blur + Straighten
        this.scene.tweens.add({
            targets: scrinImage,
            scale: scale, // Go to normal size
            angle: 0,     // Straighten out
            alpha: 1,
            duration: 800,
            ease: 'Back.easeOut', // nice punchy pop
            onComplete: () => {
                // Animation complete -> Allow closing
                this.canClose = true;

                // Start "Breathing" idle animation
                this.scene.tweens.add({
                    targets: scrinImage,
                    scale: scale * 1.02,
                    duration: 2000,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Sine.easeInOut'
                });

                // Fade in Legend NOW
                this.scene.tweens.add({
                    targets: legend,
                    alpha: 1,
                    duration: 500
                });
            }
        });

        // 2. Clear Blur (Slightly faster than pop for "Focus" effect)
        this.scene.tweens.add({
            targets: blur,
            strength: 0,
            duration: 600,
            ease: 'Expo.easeOut'
        });


        // Legend text
        const legend = this.scene.add.text(sw / 2, sh - 40, 'Press J / Ⓑ / ESC to close', {
            fontSize: '18px',
            color: '#ffffff',
            fontFamily: '"Pixeloid Sans"',
            backgroundColor: '#00000088',
            padding: { x: 16, y: 8 }
        });
        legend.setOrigin(0.5);
        legend.setScrollFactor(0);
        legend.setDepth(9001);
        legend.setAlpha(0); // Start hidden

        // Make main camera ignore these UI elements
        const gameScene = this.scene as GameSceneInterface;
        if (gameScene.cameras && gameScene.cameras.main) {
            gameScene.cameras.main.ignore([darkBg, scrinImage, legend]);
        }

        // Guard against double-close
        let closed = false;

        // Cleanup function
        const closeOverlay = () => {
            // BLOCKING: Cannot close if animation handles haven't released us
            if (!this.canClose) return;
            if (closed) return;

            closed = true;

            // Animate out
            this.scene.tweens.add({
                targets: [scrinImage, legend, darkBg],
                alpha: 0,
                duration: 200,
                ease: 'Sine.easeIn',
                onComplete: () => {
                    // Keep isOverlayOpen true for a short moment
                    this.scene.time.delayedCall(100, () => {
                        this.isOverlayOpen = false;
                        this.destroy();
                    });

                    gamepadCheck.remove();
                    this.scene.input.keyboard?.off('keydown', onKey);
                    darkBg.destroy();
                    scrinImage.destroy();
                    legend.destroy();
                }
            });
        };

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

        // Visual feedback: grey out chest and stop physics
        this.setTint(0x555555);
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
