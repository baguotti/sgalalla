import { LOOK } from './DonutLook';

/**
 * DERAPATE's fixed isometric camera: ground metres (x down-right on screen, y
 * down-left, z up) to the screen's pixels, and back. LOOK.SCALE is pixels per
 * metre, LOOK.CENTRE_X/Y where the junction's centre is. Plain maths, no
 * Phaser: the drawing, the lighting and the Lab's handles share it.
 */

export interface Point {
    x: number;
    y: number;
}

/** Across the screen and down it per metre of ground. */
export const isoX = () => LOOK.SCALE * 0.866;
export const isoY = () => LOOK.SCALE * 0.5;

export function screenX(x: number, y: number): number {
    return LOOK.CENTRE_X + (x - y) * isoX();
}

export function screenY(x: number, y: number, z = 0): number {
    return LOOK.CENTRE_Y + (x + y) * isoY() - z * LOOK.SCALE;
}

/** A point on the ground (or `z` metres above it) on screen. */
export function iso(x: number, y: number, z = 0): Point {
    return { x: screenX(x, y), y: screenY(x, y, z) };
}

/** How far on the ground (metres) a move of `dx`, `dy` screen pixels goes, for dragging things on the junction. */
export function groundMove(dx: number, dy: number): Point {
    const across = dx / isoX();
    const down = dy / isoY();
    return { x: (across + down) / 2, y: (down - across) / 2 };
}

/**
 * Screen distances scaled by these (x, then y) are ground distances times
 * LOOK.SCALE: a circle on the ground is an ellipse on screen, wider than tall.
 */
export const GROUND_FALLOFF = { x: Math.sqrt(2 / 3), y: Math.SQRT2 } as const;
