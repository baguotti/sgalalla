import Phaser from 'phaser';
import type { GameSceneInterface } from '../scenes/GameSceneInterface';
import { PhysicsConfig } from '../config/PhysicsConfig';
import type { Throwable } from './Throwable';
import { AudioManager } from '../managers/AudioManager';

// List of scrin image filenames (loaded in GameScene preload)
const SCRIN_IMAGES = [
    'scrins_00001', 'scrins_00002', 'scrins_00003', 'scrins_00004', 'scrins_00005', 'scrins_00006', 'scrins_00007', 'scrins_00008', 'scrins_00009', 'scrins_00010', 'scrins_00011', 'scrins_00012', 'scrins_00013', 'scrins_00014', 'scrins_00015', 'scrins_00016', 'scrins_00017', 'scrins_00018', 'scrins_00019', 'scrins_00020', 'scrins_00021', 'scrins_00022', 'scrins_00023', 'scrins_00024', 'scrins_00025', 'scrins_00026', 'scrins_00027', 'scrins_00028', 'scrins_00029', 'scrins_00030', 'scrins_00031', 'scrins_00032', 'scrins_00033', 'scrins_00034', 'scrins_00035', 'scrins_00036', 'scrins_00037', 'scrins_00038', 'scrins_00039', 'scrins_00040', 'scrins_00041', 'scrins_00042', 'scrins_00043', 'scrins_00044', 'scrins_00045', 'scrins_00046', 'scrins_00047', 'scrins_00048', 'scrins_00049', 'scrins_00050', 'scrins_00051', 'scrins_00052', 'scrins_00053', 'scrins_00054', 'scrins_00055', 'scrins_00056', 'scrins_00057', 'scrins_00058', 'scrins_00059', 'scrins_00060', 'scrins_00061', 'scrins_00062', 'scrins_00063', 'scrins_00064', 'scrins_00065', 'scrins_00066', 'scrins_00067', 'scrins_00068', 'scrins_00069', 'scrins_00070', 'scrins_00071', 'scrins_00072', 'scrins_00073', 'scrins_00074', 'scrins_00075', 'scrins_00076', 'scrins_00077', 'scrins_00078', 'scrins_00079', 'scrins_00080', 'scrins_00081', 'scrins_00082', 'scrins_00083', 'scrins_00084', 'scrins_00085', 'scrins_00086', 'scrins_00087', 'scrins_00088', 'scrins_00089', 'scrins_00090', 'scrins_00091', 'scrins_00092', 'scrins_00093', 'scrins_00094', 'scrins_00095', 'scrins_00096', 'scrins_00097', 'scrins_00098', 'scrins_00099', 'scrins_00100', 'scrins_00101', 'scrins_00102', 'scrins_00103', 'scrins_00104', 'scrins_00105', 'scrins_00106', 'scrins_00107', 'scrins_00108', 'scrins_00109', 'scrins_00110', 'scrins_00111', 'scrins_00112', 'scrins_00113', 'scrins_00114', 'scrins_00115', 'scrins_00116', 'scrins_00117', 'scrins_00118', 'scrins_00119', 'scrins_00120', 'scrins_00121', 'scrins_00122', 'scrins_00123', 'scrins_00124', 'scrins_00125', 'scrins_00126', 'scrins_00127', 'scrins_00128', 'scrins_00129', 'scrins_00130', 'scrins_00131', 'scrins_00132', 'scrins_00133', 'scrins_00134'
];

/**
 * Chest - A rectangular box that drops from the sky.
 * Falls with gravity, lands on platforms.
 * Damages players (25%) if it lands on them from above.
 * Players can open by attacking near it → displays a random scrin image.
 * Dimensions: 90x60
 */
export class Chest extends Phaser.Physics.Matter.Sprite implements Throwable {
    public isOpened: boolean = false;
    public canBePunched: boolean = false; // Interactability flag (false by default or during cooldown)
    public isOverlayOpen: boolean = false; // Tracks if the reward UI is currently visible
    private canClose: boolean = false; // Blocks input during reveal animation
    private hitboxVisual?: Phaser.GameObjects.Graphics;
    private isFalling: boolean = true;
    private hasHitPlayers: Set<any> = new Set(); // Track which players were already hit

    // --- Bomb Mode ---
    public isBombMode: boolean = false;
    private isThrown: boolean = false;
    private bombFuseTimer: number = 0;
    public isExploded: boolean = false;
    private thrower: any = null;
    private graceTimer: number = 0;
    private bombPulseTimer: number = 0;
    private throwPowerMultiplier: number = 1;
    private armingTimer: number = 0;
    private blurEffect?: Phaser.FX.Blur;
    private timerSound: Phaser.Sound.BaseSound | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        const textureKey = 'chest_closed'; // New asset
        const width = 88; // Matches chest_closed.png

        // Removed dynamic texture generation since we now have assets

        super(scene.matter.world, x, y, textureKey);

        this.setRectangle(width, 40); // Physics height (40) < visual height (69) for ~15px sink
        this.setBounce(0.0); // No bounce for heavy feel
        this.setFriction(0.9); // High friction to stop sliding
        this.setDensity(1.0); // Very heavy (was 0.1) ~ Metal box weight
        this.setVelocityY(15); // Faster initial downward velocity
        this.setFrictionAir(0.005); // Less air resistance for faster fall

        // Origin centered for symmetric rotation (upside-down looks identical)
        this.setOrigin(0.5, 0.5);

        const gameScene = scene as GameSceneInterface;
        if (Array.isArray(gameScene.chests)) {
            // Legacy support if not using Group
            gameScene.chests.push(this);
        }

        this.setDepth(20); // Render in front of characters

        // --- Red Hitbox Visual (debug only) ---
        this.hitboxVisual = scene.add.graphics();
        this.hitboxVisual.setDepth(19);
        this.hitboxVisual.setVisible(false); // Hidden by default
        scene.events.on('update', this.updateHitboxVisual, this);

        this.setOnCollide((data: Phaser.Types.Physics.Matter.MatterCollisionData) => {
            if (this.active) {
                this.handleCollision(data);
            }
        });

        // Start disabled for pooling
        this.setActive(false);
        this.setVisible(false);
        if (this.world) {
            this.scene.matter.world.remove(this.body as MatterJS.BodyType);
        }
    }

    public enable(x: number, y: number): void {
        this.setPosition(x, y);
        this.setActive(true);
        this.setVisible(true);

        // Reset state
        this.isOpened = false;
        this.canBePunched = false;
        this.isOverlayOpen = false;
        this.canClose = false;
        this.isFalling = true;
        this.hasHitPlayers.clear();
        this.setTexture('chest_closed');
        this.setDensity(1.0);

        // Reset bomb mode
        this.isBombMode = false;
        this.isThrown = false;
        this.bombFuseTimer = 0;
        this.isExploded = false;
        this.thrower = null;
        this.graceTimer = 0;
        this.bombPulseTimer = 0;
        this.throwPowerMultiplier = 1;
        this.armingTimer = 0;
        this.clearTint();
        this.setDisplayOrigin(this.width / 2, this.height / 2); // Reset shake
        if (this.blurEffect) this.blurEffect.strength = 0;

        // Re-enable physics
        if (this.body) {
            this.scene.matter.world.add(this.body as MatterJS.BodyType);
            this.setVelocity(0, 15); // Faster initial downward velocity
            this.setFrictionAir(0.005);
            this.setAngularVelocity(0);
            this.setIgnoreGravity(false);
            this.setSensor(false);
        }
    }

    public disable(): void {
        this.setActive(false);
        this.setVisible(false);

        // Remove from physics world
        if (this.body && this.world) {
            this.scene.matter.world.remove(this.body as MatterJS.BodyType);
        }
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
            if (this.isFalling) {
                this.isFalling = false;
            }

            const body = this.body as MatterJS.BodyType;
            if (body && body.speed > PhysicsConfig.CHEST_SPEED_THRESHOLD) {
                AudioManager.getInstance().playSFX('sfx_chest_drop', { volume: 0.6 });
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
        if (!this.active) return;

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

        // Logic 2: Bomb Mode (replaces old projectile damage when in bomb mode)
        if (this.isBombMode) {
            // Grace timer
            if (this.graceTimer > 0) {
                this.graceTimer -= delta;
            }
            // Arming timer
            if (this.armingTimer > 0) {
                this.armingTimer -= delta;
            }

            // Fuse timer always ticks down in bomb mode
            if (!this.isExploded) {
                this.bombFuseTimer -= delta;
                if (this.bombFuseTimer <= 0) {
                    this.explode();
                    return;
                }
            }

            // --- Visual Escalation ---
            // Max fuse is 4000ms. Progress goes from 0 to 1 as timer counts down to 0.
            const fuseProgress = Math.max(0, 1 - (this.bombFuseTimer / 4000));

            // 1. Pulse gets faster and brighter
            this.bombPulseTimer += delta;
            const pulseSpeed = 0.008 + (fuseProgress * 0.03);
            const pulse = Math.sin(this.bombPulseTimer * pulseSpeed) * 0.3 + 0.7;
            const r = Math.floor(255 * pulse);
            // More red, less green/blue as it gets closer to explosion
            const gb = Math.floor(60 * (1 - fuseProgress));
            this.setTint(Phaser.Display.Color.GetColor(r, gb, Math.floor(gb / 2)));

            // 2. Escalating Shake (Jitter display origin)
            // Starts at 0, ramps up to +/- 8 pixels in the final moments
            const maxShake = 8 * fuseProgress;
            // Only shake significantly in the last half of the fuse
            const activeShake = fuseProgress > 0.5 ? maxShake : 0;
            if (activeShake > 0) {
                this.setDisplayOrigin(
                    this.width / 2 + (Math.random() - 0.5) * activeShake * 2,
                    this.height / 2 + (Math.random() - 0.5) * activeShake * 2
                );
            } else {
                this.setDisplayOrigin(this.width / 2, this.height / 2);
            }

            // 3. Escalating Motion Blur
            if (this.blurEffect) {
                // Starts blurring in the last 1.6 seconds (progress > 0.6)
                this.blurEffect.strength = fuseProgress > 0.6 ? (fuseProgress - 0.6) * 5 : 0;
            }

            // Flight collision checking
            if (this.isThrown && !this.isExploded) {
                // Skip player hit checks if still arming
                if (this.armingTimer > 0) return;

                // Check contact with players while in flight
                const gameScene = this.scene as GameSceneInterface;
                const players = gameScene.getPlayers ? gameScene.getPlayers() : [];
                for (const player of players) {
                    if (this.graceTimer > 0 && player === this.thrower) continue;
                    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                    if (dist < 60) {
                        // Contact explosion (no catch mechanic for online compatibility)
                        this.explode();
                        return;
                    }
                }
            }
        } else if (this.isOpened) {
            // Legacy projectile damage (pre-bomb mode, only active before scrin is closed)
            const body = this.body as MatterJS.BodyType;
            if (body.speed > PhysicsConfig.CHEST_PROJECTILE_SPEED_THRESHOLD) {
                const gameScene = this.scene as GameSceneInterface;
                const players = gameScene.getPlayers ? gameScene.getPlayers() : [];
                const contactRange = 50;

                for (const player of players) {
                    if (this.hasHitPlayers.has(player)) continue;

                    const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
                    if (dist < contactRange) {
                        const damage = PhysicsConfig.CHEST_PROJECTILE_DAMAGE;
                        const velocity = new Phaser.Math.Vector2(body.velocity.x, body.velocity.y).normalize();
                        const knockbackForce = PhysicsConfig.CHEST_KNOCKBACK_FORCE * 0.8;

                        player.setDamage(player.damagePercent + damage);
                        player.setKnockback(velocity.x * knockbackForce, velocity.y * knockbackForce);
                        player.applyHitStun();
                        this.scene.cameras.main.shake(PhysicsConfig.CHEST_SHAKE_DURATION, PhysicsConfig.CHEST_SHAKE_INTENSITY);

                        this.hasHitPlayers.add(player);
                    }
                }
            } else {
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
    public open(imageIndex?: number): number | undefined {
        if (this.isOpened) return undefined;

        // Ground check: ensure chest is not falling
        const body = this.body as MatterJS.BodyType;
        if (Math.abs(body.velocity.y) > 0.5) {
            return undefined;
        }

        this.isOpened = true;
        AudioManager.getInstance().playSFX('sfx_chest_open', { volume: 0.8 });

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

        // SFX: Reveal card
        AudioManager.getInstance().playSFX('sfx_chest_reveal', { volume: 0.8 });

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
        this._forceCloseCallback = () => {
            // BLOCKING: Cannot close if animation handles haven't released us
            if (!this.canClose) return;
            if (closed) return;

            closed = true;

            // Optional: Tell server if we initiated this close locally
            // (If this gets called by remote event, it's fine, it will short-circuit on the other end)
            // But realistically, only emit if we're OnlineGameScene. We can do that by checking the NetworkManager
            // Or simply importing it. But since Chest is an entity, it's safer to just emit a generic event or let GameScene handle it.
            // Let's emit a local scene event that OnlineGameScene can listen to.
            this.scene.events.emit('chest_close_local', this);

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
                        // BOMB MODE: Activate after scrin is dismissed
                        this.activateBombMode();
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
                            if (this._forceCloseCallback) this._forceCloseCallback();
                            return;
                        }
                    }
                }
            }
        });

        // Key listener (J or ESC to close)
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'j' || event.key === 'J' || event.key === 'Escape') {
                if (this._forceCloseCallback) this._forceCloseCallback();
            }
        };
        this.scene.input.keyboard?.on('keydown', onKey);

        // Visual feedback: switch to open texture, keep dynamic so players can push it around
        this.setTexture('chest_open');
        this.setDensity(0.01); // Ultra-light once opened — flies far when punched

        return idx; // Return the randomly chosen index to sync to NetworkManager
    }

    private _forceCloseCallback?: () => void;

    public forceCloseOverlay(): void {
        if (this._forceCloseCallback) {
            this._forceCloseCallback();
        }
    }

    // ==========================================
    // BOMB MODE
    // ==========================================

    private activateBombMode(): void {
        this.isBombMode = true;
        this.canBePunched = false; // Can't kick anymore
        this.hasHitPlayers.clear();
        this.setDensity(0.1); // Moderate weight for throwing
        this.bombFuseTimer = 4000; // 4 second fuse starts immediately
        this.armingTimer = 0;
        this.setTexture('chest_dynamite');

        // Add postFX blur if available (Phaser 3.60+)
        if (this.postFX) {
            this.blurEffect = this.postFX.addBlur(0, 0, 0, 1, 0xffffff, 4);
        }

        // Start ticking sound
        try {
            this.timerSound = this.scene.sound.add('sfx_chest_timer', { loop: true, volume: 0.6 });
            this.timerSound.play();
        } catch (e) {
            console.warn('Timer sound not found');
        }
    }

    public onThrown(thrower: any, power: number): void {
        this.isThrown = true;
        // Don't reset bombFuseTimer here anymore! Keep it ticking down.
        this.thrower = thrower;
        this.graceTimer = 200; // 200ms self-hit prevention

        this.throwPowerMultiplier = power;
        this.armingTimer = 150; // ~9 frames of arming time where it passes through players

        this.setBounce(0.5); // Brawlhalla bounciness

        const body = this.body as MatterJS.BodyType;
        this.setAngularVelocity(body.velocity.x > 0 ? 0.3 * power : -0.3 * power); // Tumbling
    }

    public explode(): void {
        if (this.isExploded) return;
        this.isExploded = true;

        // Emit event for network sync
        this.scene.events.emit('bomb_explode', this.x, this.y);

        if (this.timerSound) {
            this.timerSound.stop();
            this.timerSound.destroy();
            this.timerSound = null;
        }

        AudioManager.getInstance().playSFX('sfx_chest_explode', { volume: 0.8 });

        const gameScene = this.scene as GameSceneInterface;
        const blastRadius = 120;
        const explosionDamage = 30 * this.throwPowerMultiplier;
        const baseKnockback = 3000 * this.throwPowerMultiplier;

        // Explosion visual
        if (gameScene.effectManager) {
            gameScene.effectManager.spawnExplosion(this.x, this.y, 100, 0xff4400);
        }

        // Damage nearby players
        const players = gameScene.getPlayers ? gameScene.getPlayers() : [];
        for (const player of players) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            if (dist < blastRadius) {
                const angle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);

                // Variable force based on target's damage percent
                const finalKnockback = baseKnockback * (1 + (player.damagePercent / 100));

                const knockback = new Phaser.Math.Vector2(
                    Math.cos(angle) * finalKnockback,
                    Math.sin(angle) * finalKnockback
                );

                player.setDamage(player.damagePercent + explosionDamage);
                player.setKnockback(knockback.x, knockback.y);
                player.applyHitStun();
            }
        }

        // Camera shake
        this.scene.cameras.main.shake(300, 0.015);

        // Disable chest
        this.disable();
    }

    destroy(fromScene?: boolean): void {
        if (this.timerSound) {
            this.timerSound.stop();
            this.timerSound.destroy();
            this.timerSound = null;
        }

        if (this.scene) {
            this.scene.events.off('update', this.updateHitboxVisual, this);
            const gameScene = this.scene as GameSceneInterface;
            if (Array.isArray(gameScene.chests)) {
                const index = gameScene.chests.indexOf(this);
                if (index > -1) {
                    gameScene.chests.splice(index, 1);
                }
            }
        }
        if (this.hitboxVisual) {
            this.hitboxVisual.destroy();
        }
        super.destroy(fromScene);
    }
}
