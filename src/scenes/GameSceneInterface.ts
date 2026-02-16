import Phaser from 'phaser';
import type { Chest } from '../entities/Chest';
import type { Bomb } from '../entities/Bomb';

/**
 * Shared interface for scene properties accessed by entities like Chest, Hitbox, and Bomb.
 * Both GameScene and OnlineGameScene implement this implicitly.
 *
 * Use this to type `this.scene` instead of casting to `any`.
 */
export interface GameSceneInterface extends Phaser.Scene {
    /** Exclude a game object from the UI camera (prevents double-rendering) */
    addToCameraIgnore(object: Phaser.GameObjects.GameObject): void;

    /** Active chests in the scene */
    chests: Chest[];

    /** Active bombs in the scene (GameScene only; unused in OnlineGameScene) */
    bombs: Bomb[];

    /** UI camera (separate from main game camera, used for HUD) */
    uiCamera: Phaser.Cameras.Scene2D.Camera | null;
}
