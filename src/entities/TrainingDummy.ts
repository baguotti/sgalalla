import Phaser from 'phaser';
import { PhysicsConfig } from '../config/PhysicsConfig';
import { Fighter } from './Fighter';

/**
 * A stationary training dummy for testing combat mechanics.
 * Can be hit, takes damage, shows knockback, but respawns after falling.
 */
export class TrainingDummy extends Fighter {
    private bodyRect: Phaser.GameObjects.Rectangle;
    private faceGraphics: Phaser.GameObjects.Graphics;

    // Combat properties inherited from Fighter
    // public velocity: Phaser.Math.Vector2;
    // public damagePercent: number = 0;
    // public isInvincible: boolean = false;
    // public isGrounded: boolean = true;
    // public isHitStunned: boolean = false;
    // private hitStunTimer: number = 0;


    // Spawn position
    private spawnX: number;
    private spawnY: number;

    // Damage display
    private damageText: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);

        this.spawnX = x;
        this.spawnY = y;

        // Create dummy body (slightly different color from player)
        this.bodyRect = scene.add.rectangle(
            0,
            0,
            PhysicsConfig.PLAYER_WIDTH,
            PhysicsConfig.PLAYER_HEIGHT,
            0xe67e22 // Orange dummy
        );
        this.add(this.bodyRect);

        // Create simple face
        this.faceGraphics = scene.add.graphics();
        this.faceGraphics.fillStyle(0x000000);
        // Eyes
        this.faceGraphics.fillCircle(-8, -10, 4);
        this.faceGraphics.fillCircle(8, -10, 4);
        // Mouth (straight line = neutral)
        this.faceGraphics.fillRect(-10, 5, 20, 3);
        this.add(this.faceGraphics);

        // Create damage text
        this.damageText = scene.add.text(0, -45, '0%', {
            fontSize: '18px',
            color: '#ffffff',
            fontFamily: 'Arial',
            stroke: '#000000',
            strokeThickness: 4,
        });
        this.damageText.setOrigin(0.5);
        this.add(this.damageText);

        this.add(this.damageText);

        // Physics initialized in Fighter constructor
        this.isGrounded = true;

        scene.add.existing(this);
    }

    update(delta: number): void {
        const deltaSeconds = delta / 1000;

        // Base physics (Timer, Gravity)
        this.updatePhysics(delta);

        // Visual update state
        if (!this.isHitStunned) {
            this.bodyRect.setFillStyle(0xe67e22);
        }

        // Note: Gravity is applied in super.updatePhysics()

        // Apply friction - less when in hitstun (to allow knockback travel)
        if (this.isHitStunned) {
            this.velocity.x *= 0.98; // Very light air friction during knockback
        } else {
            this.velocity.x *= 0.85; // Normal ground friction
        }

        // Update position
        this.x += this.velocity.x * deltaSeconds;
        this.y += this.velocity.y * deltaSeconds;

        // Update damage display
        this.damageText.setText(`${Math.floor(this.damagePercent)}%`);

        // Color based on damage
        if (this.damagePercent < 50) {
            this.damageText.setColor('#ffffff');
        } else if (this.damagePercent < 100) {
            this.damageText.setColor('#ffff00');
        } else if (this.damagePercent < 150) {
            this.damageText.setColor('#ff8800');
        } else {
            this.damageText.setColor('#ff0000');
        }

        // Respawn if fallen off screen
        if (this.y > 700) {
            this.respawn();
        }

        // Reset grounded state (will be set true by collision if on ground)
        this.isGrounded = false;
    }

    protected onHitStun(): void {
        this.bodyRect.setFillStyle(0xffffff); // Flash white
    }

    // setKnockback handled by Fighter

    respawn(): void {
        this.x = this.spawnX;
        this.y = this.spawnY;
        this.velocity.set(0, 0);
        this.damagePercent = 0;
        this.isHitStunned = false;
        this.bodyRect.setFillStyle(0xe67e22);
    }

    checkPlatformCollision(platform: Phaser.GameObjects.Rectangle, _isSoft: boolean = false): void {
        const dummyBounds = this.getBounds();
        const platformBounds = platform.getBounds();

        if (this.velocity.y <= 0) return;

        if (Phaser.Geom.Intersects.RectangleToRectangle(dummyBounds, platformBounds)) {
            const dummyBottom = dummyBounds.bottom;
            const platformTop = platformBounds.top;

            if (dummyBottom - this.velocity.y * (1 / 60) <= platformTop + 5) {
                this.y = platformTop - PhysicsConfig.PLAYER_HEIGHT / 2;
                this.velocity.y = 0;
                this.isGrounded = true;
            }
        }
    }

    getBounds(): Phaser.Geom.Rectangle {
        return new Phaser.Geom.Rectangle(
            this.x - PhysicsConfig.PLAYER_WIDTH / 2,
            this.y - PhysicsConfig.PLAYER_HEIGHT / 2,
            PhysicsConfig.PLAYER_WIDTH,
            PhysicsConfig.PLAYER_HEIGHT
        );
    }

    checkWallCollision(leftBound: number, rightBound: number): void {
        const dummyBounds = this.getBounds();

        if (dummyBounds.left <= leftBound) {
            this.x = leftBound + PhysicsConfig.PLAYER_WIDTH / 2;
            this.velocity.x = 0; // Stop horizontal movement on wall collision
        }
        else if (dummyBounds.right >= rightBound) {
            this.x = rightBound - PhysicsConfig.PLAYER_WIDTH / 2;
            this.velocity.x = 0; // Stop horizontal movement on wall collision
        }
    }
    public addToCameraIgnore(camera: Phaser.Cameras.Scene2D.Camera): void {
        camera.ignore(this);
        if (this.damageText) {
            camera.ignore(this.damageText);
        }
    }
}
