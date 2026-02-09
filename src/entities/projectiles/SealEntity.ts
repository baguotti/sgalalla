import Phaser from 'phaser';

export class SealEntity extends Phaser.Physics.Matter.Sprite {
    private loops: number = 0;
    private maxLoops: number = 3;
    private owner: any = null;
    private damageDealt: Set<any> = new Set();
    private direction: number = 1;
    private moveSpeed: number = 12; // Adjusted for substantial speed
    private debugGraphics: Phaser.GameObjects.Graphics | null = null;

    constructor(scene: Phaser.Scene, x: number, y: number, direction: number, owner: any) {
        super(scene.matter.world, x, y, 'fok_v3', 'Fok_v3_Side Sig_Seal000');

        this.owner = owner;
        this.direction = direction;

        scene.add.existing(this);

        // Register to scene to be updated
        const gameScene = scene as any;
        if (gameScene.seals) {
            gameScene.seals.push(this);
        }

        // Physics body setup
        // It should be a sensor so it doesn't push players physically but detects overlap
        const bodyRadius = 40;
        this.setBody({
            type: 'circle',
            radius: bodyRadius
        }, {
            isSensor: true, // Pass through objects
            ignoreGravity: true
        });

        this.setDensity(0.001);
        this.setFriction(0);
        this.setFrictionAir(0);

        // Animation
        this.play('fok_v3_seal');
        this.on('animationcomplete', this.handleAnimationComplete, this);

        // Flip if facing left
        this.setFlipX(direction === -1);

        // Initial Velocity
        // We set it in update or here. Since friction air is 0, setting once is enough.
        // However, Matter (config) position updates are robust.
        this.setVelocityX(this.moveSpeed * direction);

        this.setDepth(this.owner.depth + 1); // In front of owner

        // Debug Graphics
        this.debugGraphics = scene.add.graphics();
        this.debugGraphics.setDepth(this.depth + 1);

        // Sync with scene debug state
        const isDebug = gameScene.debugVisible || false;
        this.debugGraphics.setVisible(isDebug);

        // Hide visuals (as requested) - REVERTED per user request
        this.setVisible(true);

        // Ignore UI Camera (Fix duplicate)
        if (gameScene.uiCamera) {
            gameScene.uiCamera.ignore(this);
            gameScene.uiCamera.ignore(this.debugGraphics);
        }
    }

    public setDebug(visible: boolean): void {
        if (this.debugGraphics) {
            this.debugGraphics.setVisible(visible);
        }
    }

    private handleAnimationComplete(animation: Phaser.Animations.Animation) {
        if (animation.key === 'fok_v3_seal') {
            this.loops++;
            if (this.loops >= this.maxLoops) {
                this.destroy();
            } else {
                this.play('fok_v3_seal'); // Replay
            }
        }
    }

    preUpdate(time: number, delta: number) {
        super.preUpdate(time, delta);

        // Ensure constant velocity just in case
        this.setVelocityX(this.moveSpeed * this.direction);
        this.setVelocityY(0);

        // Draw Debug Hitbox (only if visible)
        if (this.debugGraphics && this.debugGraphics.visible) {
            this.debugGraphics.clear();
            this.debugGraphics.fillStyle(0xff0000, 0.5); // Red, 50% opacity
            this.debugGraphics.fillCircle(this.x, this.y, 40); // Radius 40 matches body
        }

        // Collision Logic (Manually checking overlap for control)
        this.checkCollisions();
    }

    private checkCollisions() {
        const gameScene = this.scene as any;
        const players = gameScene.players || [];

        const hitRadius = 50; // Hitbox radius

        players.forEach((player: any) => {
            if (player === this.owner) return; // Don't hit owner
            if (this.damageDealt.has(player)) return; // Already hit this player? 

            const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);

            // Allow checking against player body bounds if possible, but distance is cheap/easy
            if (dist < hitRadius + 20) {
                this.hitPlayer(player);
            }
        });
    }

    private hitPlayer(target: any) {
        this.damageDealt.add(target);

        // Damage calculation (Base)
        const damage = 10;

        const knockbackValue = 15;

        // Calculate knockback away from seal movement direction
        const knockbackData = {
            x: this.direction * knockbackValue,
            y: -10
        };

        if (target.takeDamage) {
            if (target.setDamage && target.setKnockback) {
                target.setDamage(target.damagePercent + damage);
                target.setKnockback(knockbackData.x, knockbackData.y);
                target.applyHitStun();
            }
        }
    }

    destroy(fromScene?: boolean): void {
        const gameScene = this.scene as any;
        if (gameScene.seals) {
            const index = gameScene.seals.indexOf(this);
            if (index > -1) {
                gameScene.seals.splice(index, 1);
            }
        }
        if (this.debugGraphics) {
            this.debugGraphics.destroy();
        }
        super.destroy(fromScene);
    }
}
