import Phaser from 'phaser';
import type { EffectManager } from '../effects/EffectManager';

/**
 * What a Player needs from the scene that draws it. GameScene implements it.
 */
export interface GameSceneInterface extends Phaser.Scene {
    /** Pooled ghost sprites and other effects */
    effectManager: EffectManager;

    /** UI camera (separate from the zoomed game camera); world objects must be ignored by it */
    uiCamera: Phaser.Cameras.Scene2D.Camera | null;
}
