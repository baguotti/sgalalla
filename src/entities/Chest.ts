import Phaser from 'phaser';
import type { GameSceneInterface } from '../scenes/GameSceneInterface';
import { PhysicsConfig } from '../config/PhysicsConfig';

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
    public canBePunched: boolean = false; // Interactability flag (false by default or during cooldown)
    public isOverlayOpen: boolean = false; // Tracks if the reward UI is currently visible
    private canClose: boolean = false; // Blocks input during reveal animation
    private hitboxVisual?: Phaser.GameObjects.Graphics;
    private isFalling: boolean = true;
    private hasHitPlayers: Set<any> = new Set(); // Track which players were already hit

    constructor(scene: Phaser.Scene, x: number, y: number) {
        const textureKey = 'chest_closed'; // New asset
        const width = 88; // Matches chest_closed.png

        // Removed dynamic texture generation since we now have assets

        super(scene.matter.world, x, y, textureKey);

        this.setRectangle(width, 40); // Physics height (40) < visual height (69) for ~15px sink
        this.setBounce(0.0); // No bounce for heavy feel
        this.setFriction(0.9); // High friction to stop sliding
        this.setFrictionAir(0.0); // No air resistance (falls faster)
        this.setDensity(1.0); // Very heavy (was 0.1) ~ Metal box weight
        this.setVelocityY(20); // Initial downward velocity

        // Origin centered for symmetric rotation (upside-down looks identical)
        this.setOrigin(0.5, 0.5);

        const gameScene = scene as GameSceneInterface;
        if (gameScene.chests) {
            gameScene.chests.push(this);
        }

        this.setDepth(20); // Render in front of characters (usually depth 0 or 1)

        // --- Red Hitbox Visual (debug only) ---
        this.hitboxVisual = scene.add.graphics();
        this.hitboxVisual.setDepth(19);
        this.hitboxVisual.setVisible(false); // Hidden by default
        scene.events.on('update', this.updateHitboxVisual, this);

        this.setOnCollide((data: Phaser.Types.Physics.Matter.MatterCollisionData) => {
            this.handleCollision(data);
        });

        scene.add.existing(this); // Ensure preUpdate is called
    }

    private updateHitboxVisual(): void {
        if (!this.hitboxVisual || !this.active) return;

        // Optimization: Don't draw if not visible
        if (!this.hitboxVisual.visible) return;

        this.hitboxVisual.clear();

        if (this.isFalling) {
            // Draw red glow hitbox
            this.hitboxVisual.fillStyle(0xff0000, 0.25);
            this.hitboxVisual.fillRect(this.x - 50, this.y - 40, 100, 80);
            this.hitboxVisual.lineStyle(2, 0xff0000, 0.8);
            this.hitboxVisual.strokeRect(this.x - 50, this.y - 40, 100, 80);
        }
    }

    private handleCollision(data: Phaser.Types.Physics.Matter.MatterCollisionData): void {
        const bodyA = data.bodyA as any;
        const bodyB = data.bodyB as any;

        // We only care about hitting static ground/walls for the camera shake
        // Player interaction is handled in preUpdate (for damage) and GameScene (for punching)

        const other = (bodyA.gameObject === this) ? bodyB :
            (bodyB.gameObject === this) ? bodyA :
                bodyB; // fallback

        if (other.isStatic) {
            // Stop falling hitbox on ground landing
            const isFirstLanding = this.isFalling;
            if (this.isFalling) this.isFalling = false;

            const body = this.body as MatterJS.BodyType;
            if (body && body.speed > PhysicsConfig.CHEST_SPEED_THRESHOLD) {
                // Full shake on first landing, much reduced on bounces
                const intensity = isFirstLanding
                    ? PhysicsConfig.CHEST_GROUND_SHAKE_INTENSITY
                    : (PhysicsConfig.CHEST_GROUND_SHAKE_INTENSITY * 0.25);
                this.scene.cameras.main.shake(PhysicsConfig.CHEST_GROUND_SHAKE_DURATION, intensity);
            }
        }
    }

    /**
     * preUpdate: Distance-based player damage while falling.
     * Player is a Container (not Matter body), so setOnCollide never fires against them.
     * This mirrors the Bomb.ts pattern for reliable collision detection.
     */
    preUpdate(time: number, delta: number): void {
        super.preUpdate(time, delta);

        // Logic 1: Falling Damage (vertical)
        if (this.isFalling && !this.isOpened) {
            const gameScene = this.scene as GameSceneInterface;
            const players = gameScene.getPlayers ? gameScene.getPlayers() : [];
            const contactRange = 60;

            for (const player of players) {
                if (this.hasHitPlayers.has(player)) continue;

                const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                if (dist < contactRange) {
                    const damage = PhysicsConfig.CHEST_DAMAGE;
                    const knockbackForce = PhysicsConfig.CHEST_KNOCKBACK_FORCE; // 2500
                    const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

                    const knockback = new Phaser.Math.Vector2(
                        Math.cos(angle) * knockbackForce,
                        Math.sin(angle) * knockbackForce
                    );

                    player.setDamage(player.damagePercent + damage);
                    player.setKnockback(knockback.x, knockback.y);
                    player.applyHitStun();
                    this.scene.cameras.main.shake(PhysicsConfig.CHEST_SHAKE_DURATION, PhysicsConfig.CHEST_SHAKE_INTENSITY);

                    this.hasHitPlayers.add(player);
                }
            }
        }

        // Logic 2: Projectile Damage (horizontal/speed based for opened chest)
        if (this.isOpened) {
            const body = this.body as MatterJS.BodyType;
            if (body.speed > PhysicsConfig.CHEST_PROJECTILE_SPEED_THRESHOLD) {
                const gameScene = this.scene as GameSceneInterface;
                const players = gameScene.getPlayers ? gameScene.getPlayers() : [];
                const contactRange = 50; // Slightly smaller for projectile

                for (const player of players) {
                    if (this.hasHitPlayers.has(player)) continue;

                    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                    if (dist < contactRange) {
                        // Apply projectile damage
                        const damage = PhysicsConfig.CHEST_PROJECTILE_DAMAGE;
                        // Use chest velocity for knockback direction
                        const velocity = new Phaser.Math.Vector2(body.velocity.x, body.velocity.y).normalize();
                        const knockbackForce = PhysicsConfig.CHEST_KNOCKBACK_FORCE * 0.8; // Slightly less than falling

                        player.setDamage(player.damagePercent + damage);
                        player.setKnockback(velocity.x * knockbackForce, velocity.y * knockbackForce);
                        player.applyHitStun();
                        this.scene.cameras.main.shake(PhysicsConfig.CHEST_SHAKE_DURATION, PhysicsConfig.CHEST_SHAKE_INTENSITY);

                        this.hasHitPlayers.add(player);
                    }
                }
            } else {
                // Reset hit list when slow enough (so it can be punched again and hit again)
                // We clear it only if it was previously populated, to save perf? 
                // Set.clear() is cheap. A simple threshold check prevents clearing every frame if unused.
                if (this.hasHitPlayers.size > 0) {
                    this.hasHitPlayers.clear();
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

        // Ground check: ensure chest is not falling
        const body = this.body as MatterJS.BodyType;
        if (Math.abs(body.velocity.y) > 0.5) {
            return;
        }

        this.isOpened = true;

        // Prevent immediate punching
        this.canBePunched = false;
        this.scene.time.delayedCall(500, () => {
            if (this.active) this.canBePunched = true;
        });

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
                        // this.destroy(); // Keep chest in world
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

        // Visual feedback: switch to open texture, keep dynamic so players can push it around
        this.setTexture('chest_open');
        this.setDensity(0.01); // Ultra-light once opened — flies far when punched
    }

    destroy(fromScene?: boolean): void {
        if (this.scene) {
            this.scene.events.off('update', this.updateHitboxVisual, this);
            const chests = (this.scene as GameSceneInterface).chests;
            if (chests) {
                const index = chests.indexOf(this);
                if (index > -1) {
                    chests.splice(index, 1);
                }
            }
        }
        if (this.hitboxVisual) {
            this.hitboxVisual.destroy();
        }
        super.destroy(fromScene);
    }
}
