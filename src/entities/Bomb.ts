import Phaser from 'phaser';
import type { Player } from './Player'; // Type-only import to prevent circular dependency
import { DamageSystem } from '../combat/DamageSystem';

export class Bomb extends Phaser.GameObjects.Container {
    public isHeld: boolean = false;
    public isActive: boolean = false;
    public owner: Player | null = null;

    private damage: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y);
        this.scene.add.existing(this);

        this.setDepth(10);

        // Visuals
        if (this.scene.textures.exists('bomb')) {
            const sprite = this.scene.add.image(0, 0, 'bomb');
            sprite.setOrigin(0.5);
            this.add(sprite);
        } else {
            // Fallback visual if texture missing
            const circle = this.scene.add.circle(0, 0, 15, 0x333333);
            circle.setStrokeStyle(2, 0xff0000);
            this.add(circle);

            // Fuse visual
            const fuse = this.scene.add.rectangle(0, -15, 4, 8, 0x8b4513);
            this.add(fuse);
        }

        // Physics
        this.scene.matter.add.gameObject(this, {
            shape: 'circle',
            radius: 15,
            restitution: 0.6,
            frictionAir: 0.01,
            label: 'bomb'
        });

        // Collision Handling
        this.scene.matter.world.on('collisionstart', this.handleCollision, this);
    }

    public setHeld(held: boolean): void {
        this.isHeld = held;
        const body = this.body as MatterJS.BodyType;
        if (!body) return;

        if (held) {
            this.scene.matter.body.setInertia(body, Infinity); // Stop rotation
            (this.body as any).ignoreGravity = true;
            this.setSensor(true);
            this.isActive = false; // Cannot hit self while holding
            this.scene.matter.body.setVelocity(body, { x: 0, y: 0 });
        } else {
            // Restore physics properties
            (this.body as any).ignoreGravity = false;
        }
    }

    public throw(velocity: Phaser.Math.Vector2, damage: number): void {
        this.isActive = true;
        this.damage = damage;
        this.isHeld = false;

        // Reactivate physics
        (this.body as any).ignoreGravity = false;
        this.setSensor(false); // Enable collisions

        // Apply throw velocity
        const body = this.body as MatterJS.BodyType;
        this.scene.matter.body.setVelocity(body, { x: velocity.x, y: velocity.y });

        // Add spin
        this.scene.matter.body.setAngularVelocity(body, velocity.x * 0.05);
    }

    private setSensor(isSensor: boolean): void {
        const body = this.body as MatterJS.BodyType;
        if (body) {
            body.isSensor = isSensor;
        }
    }

    private handleCollision(_event: Phaser.Physics.Matter.Events.CollisionStartEvent, bodyA: MatterJS.BodyType, bodyB: MatterJS.BodyType): void {
        // Only process hits if active (thrown)
        if (!this.isActive || !this.body) return;

        // Check if collision involves this bomb
        if (bodyA !== this.body && bodyB !== this.body) return;

        const otherBody = bodyA === this.body ? bodyB : bodyA;
        const otherGameObject = otherBody.gameObject;

        // CRITICAL DECOUPLING: Duck typing check instead of 'instanceof Player'
        // We check if it looks like a Player/Fighter (has 'applyHitStun' or name is Player)
        if (otherGameObject && (otherGameObject.constructor.name === 'Player' || (otherGameObject as any).isFighter)) {

            // Check self-hit via owner reference check
            if (this.owner && otherGameObject === this.owner) {
                return; // Don't hit yourself immediately
            }

            // Apply Damage
            // We use 'as any' to bypass strict Type checks since we know it has damage methods if it passes above checks
            DamageSystem.applyDamage(otherGameObject as any, this.damage, new Phaser.Math.Vector2(0, 0));

            // Destroy bomb on impact
            this.destroy();
        }
    }

    destroy(fromScene?: boolean): void {
        if (this.scene) {
            this.scene.matter.world.off('collisionstart', this.handleCollision, this);
        }
        super.destroy(fromScene);
    }
}
