import Phaser from 'phaser';

/**
 * Phones and tablets: whether the game is on a touch screen, and full screen
 * on a tap (browsers only allow it from a tap). Desktops with a mouse are
 * left as they are.
 */

/** A touch screen without a mouse: a phone or tablet. */
export function isPhone(scene: Phaser.Scene): boolean {
    return scene.sys.game.device.input.touch && window.matchMedia('(pointer: coarse)').matches;
}

/** On a phone, full screen (call it from a tap); elsewhere nothing. */
export function enterFullscreenOnPhone(scene: Phaser.Scene): void {
    if (!isPhone(scene) || scene.scale.isFullscreen) return;
    try {
        scene.scale.startFullscreen();
    } catch {
        // Not allowed here (some browsers, iOS Safari): the game still fits the screen
    }
}
