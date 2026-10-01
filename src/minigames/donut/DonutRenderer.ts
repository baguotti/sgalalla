import Phaser from 'phaser';
import { LOOK } from './DonutLook';
import { DONUT, JUNCTION, pedestrianPosition, type DonutState, type Pedestrian } from './DonutSim';

/**
 * Draws DERAPATE from a fixed isometric camera, all in plain blocks until the
 * art comes: the junction (roads, zebra crossings, pavements, corner blocks),
 * the tyre marks the donuts leave, the car and the people, nearer things over
 * farther ones.
 */

/** Isometric: across the screen and down it per metre of ground (the camera's scale is LOOK.SCALE). */
const isoX = () => LOOK.SCALE * 0.866;
const isoY = () => LOOK.SCALE * 0.5;
/** How far the road runs out from the centre (off screen). */
const ROAD_REACH = 70;

const COLOURS = {
    pavement: 0xb8b1a4,
    pavementLine: 0xa39c8f,
    road: 0x3d3f45,
    kerb: 0xd8d2c6,
    lane: 0xe8e2cf,
    zebra: 0xf1eee6,
    marks: 0x16161a,
    ring: 0xffffff,
    building: [0xcdbfa6, 0xbfae92, 0xd6c9b3],
    car: 0xc23b30,
    cabin: 0x2c3140,
    walker: 0xd9534f,
    booster: 0x3fbf7f,
    shadow: 0x000000,
};

/** A point on the ground (or `z` metres above it) on screen. */
export function iso(x: number, y: number, z = 0): { x: number; y: number } {
    return { x: LOOK.CENTRE_X + (x - y) * isoX(), y: LOOK.CENTRE_Y + (x + y) * isoY() - z * LOOK.SCALE };
}

/** What a frame shows: the car placed between its last two steps. */
export interface DonutView {
    state: DonutState;
    x: number;
    y: number;
    radius: number;
    /** Which way the car's nose points. */
    heading: number;
}

export class DonutRenderer {
    readonly graphics: Phaser.GameObjects.Graphics;
    /** The ground and everything fixed on it, drawn once (again when the Lab moves it). */
    private readonly ground: Phaser.GameObjects.Graphics;
    /** Recent car positions: the tyre marks. */
    private readonly marks: { x: number; y: number; strength: number }[] = [];

    constructor(scene: Phaser.Scene) {
        this.ground = scene.add.graphics();
        drawJunction(this.ground);
        this.graphics = scene.add.graphics();
    }

    /** Called each step with the car's position: the tyre marks follow it, darker the harder the wheels spin (0 to 1). */
    addMark(x: number, y: number, strength = 1): void {
        this.marks.push({ x, y, strength });
        while (this.marks.length > Math.max(2, LOOK.MARK_TRAIL)) this.marks.shift();
    }

    /** The junction again, after the Lab changed its size or the camera. */
    redrawGround(): void {
        drawJunction(this.ground.clear());
    }

    /** A fresh start: no rubber on the road. */
    clearMarks(): void {
        this.marks.length = 0;
    }

    draw(view: DonutView): void {
        const g = this.graphics.clear();

        // Rubber on the road: the donuts so far, the oldest faintest
        for (let i = 1; i < this.marks.length; i++) {
            const a = this.marks[i - 1];
            const b = this.marks[i];
            if (Math.hypot(a.x - b.x, a.y - b.y) > 2) continue;
            const from = iso(a.x, a.y);
            const to = iso(b.x, b.y);
            const alpha = LOOK.MARK_DARKNESS * (0.18 + 0.82 * (i / this.marks.length)) * b.strength;
            g.lineStyle(LOOK.MARK_WIDTH, COLOURS.marks, Math.min(1, alpha)).lineBetween(from.x, from.y, to.x, to.y);
        }

        // Where the donut runs now, faintly
        g.lineStyle(2, COLOURS.ring, LOOK.RING);
        g.beginPath();
        for (let i = 0; i <= 64; i++) {
            const angle = (i / 64) * Math.PI * 2;
            const p = iso(DONUT.CENTRE_X + Math.cos(angle) * view.radius, DONUT.CENTRE_Y + Math.sin(angle) * view.radius);
            if (i === 0) g.moveTo(p.x, p.y);
            else g.lineTo(p.x, p.y);
        }
        g.strokePath();

        // The car and the people, farthest first
        const things: { depth: number; draw: () => void }[] = [
            { depth: view.x + view.y, draw: () => drawCar(g, view.x, view.y, view.heading) },
            ...view.state.pedestrians.map(p => {
                const at = pedestrianPosition(p);
                return { depth: at.x + at.y, draw: () => drawPedestrian(g, p, at.x, at.y) };
            }),
        ];
        things.sort((a, b) => a.depth - b.depth);
        for (const thing of things) thing.draw();
    }

    destroy(): void {
        this.ground.destroy();
        this.graphics.destroy();
    }
}

// ─── The junction ───

function drawJunction(g: Phaser.GameObjects.Graphics): void {
    const H = JUNCTION.ROAD_HALF_WIDTH;
    const { CROSSING_AT, CROSSING_WIDTH } = JUNCTION;
    const R = ROAD_REACH;
    g.fillStyle(COLOURS.pavement).fillRect(0, 0, 1920, 1080);
    // Paving lines, so the ground reads as a surface
    for (let i = -R; i <= R; i += 4) {
        line(g, COLOURS.pavementLine, 1, i, -R, i, R);
        line(g, COLOURS.pavementLine, 1, -R, i, R, i);
    }

    // Kerbs, then the two roads crossing
    groundRect(g, COLOURS.kerb, -R, -H - 0.4, R, H + 0.4);
    groundRect(g, COLOURS.kerb, -H - 0.4, -R, H + 0.4, R);
    groundRect(g, COLOURS.road, -R, -H, R, H);
    groundRect(g, COLOURS.road, -H, -R, H, R);

    // Dashed centre lines, beyond the crossings
    const clear = CROSSING_AT + CROSSING_WIDTH / 2 + 1.5;
    for (let d = clear; d < R; d += 4) {
        for (const side of [-1, 1]) {
            groundRect(g, COLOURS.lane, side * d, -0.12, side * (d + 2), 0.12);
            groundRect(g, COLOURS.lane, -0.12, side * d, 0.12, side * (d + 2));
        }
    }

    // Zebra crossings on the four arms: stripes along the road, across its width
    const half = CROSSING_WIDTH / 2;
    for (let s = -H + 0.4; s < H - 0.4; s += 1.4) {
        groundRect(g, COLOURS.zebra, s, -CROSSING_AT - half, s + 0.8, -CROSSING_AT + half);
        groundRect(g, COLOURS.zebra, s, CROSSING_AT - half, s + 0.8, CROSSING_AT + half);
        groundRect(g, COLOURS.zebra, -CROSSING_AT - half, s, -CROSSING_AT + half, s + 0.8);
        groundRect(g, COLOURS.zebra, CROSSING_AT - half, s, CROSSING_AT + half, s + 0.8);
    }

    // Blocks of buildings on the far corners, farthest first; the near corner stays open
    const blocks: [number, number, number, number, number][] = [
        [-40, -40, -H - 5, -H - 5, 8],
        [H + 5, -38, 34, -H - 5, 6],
        [-36, H + 5, -H - 5, 32, 5],
    ];
    blocks.forEach(([x1, y1, x2, y2, h], i) => box(g, COLOURS.building[i % COLOURS.building.length], x1, y1, x2, y2, 0, h));
}

/** A flat rectangle on the ground, x1..x2 by y1..y2. */
function groundRect(g: Phaser.GameObjects.Graphics, colour: number, x1: number, y1: number, x2: number, y2: number, z = 0): void {
    const points = [iso(x1, y1, z), iso(x2, y1, z), iso(x2, y2, z), iso(x1, y2, z)];
    g.fillStyle(colour).fillPoints(points, true);
}

function line(g: Phaser.GameObjects.Graphics, colour: number, width: number, x1: number, y1: number, x2: number, y2: number): void {
    const a = iso(x1, y1);
    const b = iso(x2, y2);
    g.lineStyle(width, colour, 0.5).lineBetween(a.x, a.y, b.x, b.y);
}

/** An axis-aligned box: the two sides facing the camera, then the top. */
function box(g: Phaser.GameObjects.Graphics, colour: number, x1: number, y1: number, x2: number, y2: number, z1: number, z2: number): void {
    g.fillStyle(shade(colour, 0.78)).fillPoints([iso(x2, y1, z1), iso(x2, y2, z1), iso(x2, y2, z2), iso(x2, y1, z2)], true);
    g.fillStyle(shade(colour, 0.9)).fillPoints([iso(x1, y2, z1), iso(x2, y2, z1), iso(x2, y2, z2), iso(x1, y2, z2)], true);
    g.fillStyle(colour).fillPoints([iso(x1, y1, z2), iso(x2, y1, z2), iso(x2, y2, z2), iso(x1, y2, z2)], true);
}

// ─── The car and the people ───

/**
 * A box turned to `heading`: its corners on the ground at `x`,`y`, the sides
 * facing the camera drawn, then the top.
 */
function turnedBox(g: Phaser.GameObjects.Graphics, colour: number, x: number, y: number, heading: number,
    length: number, width: number, z1: number, z2: number, shift = 0): void {
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    const corner = (along: number, across: number) => ({ x: x + (along + shift) * c - across * s, y: y + (along + shift) * s + across * c });
    const corners = [corner(length / 2, width / 2), corner(length / 2, -width / 2), corner(-length / 2, -width / 2), corner(-length / 2, width / 2)];
    // A side faces the camera when its outward normal points towards +x +y (down the screen)
    for (let i = 0; i < 4; i++) {
        const a = corners[i];
        const b = corners[(i + 1) % 4];
        const nx = b.y - a.y;
        const ny = -(b.x - a.x);
        if (nx + ny <= 0) continue;
        const light = 0.72 + 0.2 * (nx / Math.hypot(nx, ny) + 1) / 2;
        g.fillStyle(shade(colour, light)).fillPoints([iso(a.x, a.y, z1), iso(b.x, b.y, z1), iso(b.x, b.y, z2), iso(a.x, a.y, z2)], true);
    }
    g.fillStyle(colour).fillPoints(corners.map(p => iso(p.x, p.y, z2)), true);
}

function drawCar(g: Phaser.GameObjects.Graphics, x: number, y: number, heading: number): void {
    // Shadow, body, cabin set back, and headlights on the nose so the heading reads
    const k = LOOK.CAR_SIZE;
    const shadow = iso(x, y);
    g.fillStyle(COLOURS.shadow, 0.28).fillEllipse(shadow.x, shadow.y, 5.2 * k * isoX(), 5.2 * k * isoY());
    turnedBox(g, COLOURS.car, x, y, heading, 4.4 * k, 1.9 * k, 0.25 * k, 1.0 * k);
    turnedBox(g, COLOURS.cabin, x, y, heading, 2.1 * k, 1.65 * k, 1.0 * k, 1.55 * k, -0.35 * k);
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    for (const side of [-0.6 * k, 0.6 * k]) {
        const lx = x + 2.2 * k * c - side * s;
        const ly = y + 2.2 * k * s + side * c;
        const p = iso(lx, ly, 0.75 * k);
        g.fillStyle(0xfff3b0).fillCircle(p.x, p.y, 3.5 * k);
    }
}

function drawPedestrian(g: Phaser.GameObjects.Graphics, p: Pedestrian, x: number, y: number): void {
    const colour = p.kind === 'walker' ? COLOURS.walker : COLOURS.booster;
    const at = iso(x, y);
    g.fillStyle(COLOURS.shadow, 0.25).fillEllipse(at.x, at.y, 1.2 * isoX(), 1.2 * isoY());
    if (p.hit) {
        // Knocked flat, fading
        const fade = Math.max(0, p.hitTimer / 0.8);
        g.fillStyle(colour, fade).fillPoints([iso(x - 0.9, y - 0.3, 0.2), iso(x + 0.9, y - 0.3, 0.2), iso(x + 0.9, y + 0.3, 0.2), iso(x - 0.9, y + 0.3, 0.2)], true);
        return;
    }
    box(g, colour, x - 0.3, y - 0.3, x + 0.3, y + 0.3, 0, 1.4);
    box(g, 0xf2d3b3, x - 0.22, y - 0.22, x + 0.22, y + 0.22, 1.4, 1.8);
}

function shade(colour: number, amount: number): number {
    const r = Math.round(((colour >> 16) & 255) * amount);
    const gr = Math.round(((colour >> 8) & 255) * amount);
    const b = Math.round((colour & 255) * amount);
    return (Math.min(255, r) << 16) | (Math.min(255, gr) << 8) | Math.min(255, b);
}

/**
 * The drawn heading: along the circle, nose swung in by the drift; the balance
 * (`slip`, between steps) swings it, so every stab and lift of the pedal shows
 * at once; wheelspin swings the tail out a little more; a spin-out spins it.
 */
export function carHeading(state: DonutState, angle: number, slip = state.slip): number {
    const degrees = Math.PI / 180;
    const drift = (LOOK.NOSE_IN + slip * LOOK.SLIP_SWING + state.revs * LOOK.REV_SWING) * degrees;
    const spin = state.spinning > 0 ? (DONUT.SPIN_SECONDS - state.spinning) * LOOK.SPIN_TURN * degrees : 0;
    return angle + Math.PI / 2 + drift + spin;
}
