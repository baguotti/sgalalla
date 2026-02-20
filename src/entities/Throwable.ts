import Phaser from 'phaser';

/**
 * Throwable - Interface for items that can be picked up and thrown by players.
 * Both Bomb and Chest (in bomb mode) implement this.
 */
export interface Throwable extends Phaser.Physics.Matter.Sprite {
    /** Called when the item is thrown by a player. Starts fuse timer and sets thrower reference. */
    onThrown(thrower: any, power: number): void;

    /** Trigger explosion: visual effect, camera shake, knockback to nearby players. */
    explode(): void;
}
