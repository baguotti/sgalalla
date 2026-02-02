export interface Rect {
    id?: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export class RectUtils {
    static overlaps(a: Rect, b: Rect): boolean {
        // AABB Collision
        // Assuming x/y are center? Phaser rects usually distinct. 
        // Let's assume x/y are Top-Left for standard Rects, or center?
        // Phaser Sprites are Center by default. Phaser Geom.Rectangle is x,y (top-left).
        // Let's explicitly demand top/left/right/bottom to be safe or use simple math.

        // Let's assume x,y are Top-Left to match standard AABB.
        // But Player position is likely Bottom-Center or Center.
        // We will need helper to get Bounds from an Entity.

        return (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );
    }

    // Check overlap if we provide bounds directly (left, right, top, bottom)
    static overlapsBounds(a: { left: number, right: number, top: number, bottom: number }, b: { left: number, right: number, top: number, bottom: number }): boolean {
        return (
            a.left < b.right &&
            a.right > b.left &&
            a.top < b.bottom &&
            a.bottom > b.top
        );
    }
}
