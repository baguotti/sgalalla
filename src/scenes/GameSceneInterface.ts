import Phaser from 'phaser';
import { Player } from '../entities/Player';
import type { Chest } from '../entities/Chest';

/**
 * Shared interface for scene properties accessed by entities like Chest and Hitbox.
 * Both GameScene and OnlineGameScene implement this implicitly.
 *
 * Use this to type `this.scene` instead of casting to `any`.
 */
export interface GameSceneInterface extends Phaser.Scene {
    /** Exclude a game object from the UI camera (prevents double-rendering) */
    addToCameraIgnore(object: Phaser.GameObjects.GameObject): void;

    /** Active chests in the scene */
    chests: Phaser.GameObjects.Group | Chest[];

    /** Active walls in the scene (Unified: Geom.Rectangle for collision) */
    walls: Phaser.Geom.Rectangle[];
    effectManager?: any; // Avoiding circular dependency with EffectManager type for now, or use import type

    /** UI camera (separate from main game camera, used for HUD) */
    uiCamera: Phaser.Cameras.Scene2D.Camera | null;

    /** Unified access to players list (abstracts away Array vs Map storage) */
    getPlayers(): Player[];

    /** Get chests that are in bomb mode and available for pickup */
    getThrowableChests(): Chest[];

}
