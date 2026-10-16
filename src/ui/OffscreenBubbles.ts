import Phaser from 'phaser';
import { isInPlay } from '../../shared/FighterState';
import type { MatchState } from '../../shared/GameSim';

/** Bubble radius on screen, and how far in from the screen's edge its centre sits. */
const RADIUS = 34;
const MARGIN = 56;
/** A bubble shrinks to MIN_SCALE as its fighter gets FAR px (world) beyond the edge of the view. */
const MIN_SCALE = 0.6;
const FAR = 1200;

interface Bubble {
    container: Phaser.GameObjects.Container;
    arrow: Phaser.GameObjects.Triangle;
    mask: Phaser.GameObjects.Graphics;
}

/**
 * Brawlhalla's off-screen bubbles: a fighter in play outside the view (the
 * camera stays inside the stage's camera bounds) shows as its portrait in a
 * bubble of its colour at the screen's edge, pointing at it, smaller the
 * further away it is. Drawn in screen space, by the UI camera only.
 */
export class OffscreenBubbles {
    private readonly bubbles: Bubble[];

    /** `fighters[i]`: fighter i's character and colour. */
    constructor(scene: Phaser.Scene, fighters: readonly { character: string; color: number }[], hideFrom: Phaser.Cameras.Scene2D.Camera) {
        this.bubbles = fighters.map(({ character, color }) => {
            const ring = scene.add.circle(0, 0, RADIUS + 4, color).setStrokeStyle(3, 0x000000);
            const inside = scene.add.circle(0, 0, RADIUS, 0x1b1e27);
            const icon = `00_${character}_icon`;
            const portrait = scene.add.sprite(0, 0, character, scene.textures.get(character).has(icon) ? icon : undefined);
            portrait.setScale((RADIUS * 2.3) / (portrait.width || 64));
            // The portrait shows through a circle that follows the bubble
            const mask = scene.make.graphics({}, false).fillStyle(0xffffff).fillCircle(0, 0, RADIUS);
            portrait.setMask(mask.createGeometryMask());
            const arrow = scene.add.triangle(0, 0, 0, -10, 0, 10, 16, 0, color).setStrokeStyle(2, 0x000000);
            const container = scene.add.container(0, 0, [arrow, ring, inside, portrait]).setDepth(900).setVisible(false);
            hideFrom.ignore(container);
            return { container, arrow, mask };
        });
    }

    /** Places the bubbles for what `camera` shows now. */
    update(match: MatchState, camera: Phaser.Cameras.Scene2D.Camera): void {
        const view = camera.worldView;
        match.fighters.forEach((fighter, i) => {
            const bubble = this.bubbles[i];
            if (!bubble) return;
            const { x, y } = fighter.body;
            const outside = isInPlay(fighter) && !view.contains(x, y);
            bubble.container.setVisible(outside);
            if (!outside) return;

            // The fighter's place on screen, and the nearest point inside the margin
            const screenX = (x - view.x) * camera.zoom;
            const screenY = (y - view.y) * camera.zoom;
            const bx = Phaser.Math.Clamp(screenX, MARGIN, camera.width - MARGIN);
            const by = Phaser.Math.Clamp(screenY, MARGIN, camera.height - MARGIN);
            const beyond = Math.hypot(x - Phaser.Math.Clamp(x, view.left, view.right), y - Phaser.Math.Clamp(y, view.top, view.bottom));
            const scale = Phaser.Math.Linear(1, MIN_SCALE, Math.min(beyond / FAR, 1));

            bubble.container.setPosition(bx, by).setScale(scale);
            bubble.mask.setPosition(bx, by).setScale(scale);
            const angle = Math.atan2(screenY - by, screenX - bx);
            bubble.arrow.setPosition(Math.cos(angle) * (RADIUS + 12), Math.sin(angle) * (RADIUS + 12)).setRotation(angle);
        });
    }

    destroy(): void {
        for (const bubble of this.bubbles) {
            bubble.container.destroy();
            bubble.mask.destroy();
        }
    }
}
