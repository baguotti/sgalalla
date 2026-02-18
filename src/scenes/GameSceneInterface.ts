import Phaser from 'phaser';
import { Player } from '../entities/Player';
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

    /** Active walls in the scene (GameScene only; unused in OnlineGameScene) */
    walls?: Phaser.GameObjects.Rectangle[] | Phaser.Geom.Rectangle[];
    effectManager?: any; // Avoiding circular dependency with EffectManager type for now, or use import type

    /** Active bombs in the scene (GameScene only; unused in OnlineGameScene) */
    bombs: Phaser.GameObjects.Group | Map<number, Bomb>;

    /** Add a bomb to the scene tracker */
    addBomb(bomb: Bomb): void;

    /** Remove a bomb from the scene tracker */
    removeBomb(bomb: Bomb): void;

    /** Unified access to bombs list */
    getBombs(): Bomb[];

    /** UI camera (separate from main game camera, used for HUD) */
    uiCamera: Phaser.Cameras.Scene2D.Camera | null;

    /** Unified access to players list (abstracts away Array vs Map storage) */
    getPlayers(): Player[];


}
