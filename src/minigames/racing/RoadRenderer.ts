import Phaser from 'phaser';
import { CAR } from './RaceSim';
import { heightAt, LANES, ROAD_WIDTH, SEGMENT_LENGTH, seededRandom, segmentAt, type RoadsideThing, type Segment, type Track } from './RaceTrack';

/**
 * Draws the race Outrun-style, as flat shapes on a small canvas (the scene
 * scales it up with hard pixels): a sky with clouds and mountains that slide
 * as the road bends, the road built from segments projected nearest first,
 * then everything beside it from the farthest in. Scenery and traffic are
 * coloured blocks until the art replaces them.
 */

/**
 * What one frame shows: the race placed part of the way between its last two
 * steps, so motion is smooth on screens faster than 60 Hz.
 */
export interface RaceView {
    track: Track;
    z: number;
    x: number;
    speed: number;
    /** `blink`: -1 or 1 while its indicator for that side is lit, else 0. */
    traffic: { z: number; x: number; look: number; blink: number }[];
    /** How far the sky has slid sideways with the bends (px on a 480 px wide screen). */
    skyOffset: number;
    /** 0 to 1: extra streaks while slipstreaming. */
    slipstream: number;
}

/** The pixel canvas. */
export const VIEW_WIDTH = 1920;
export const VIEW_HEIGHT = 1080;
/** Screen sizes below were set for a 480 px wide screen: this scales them. */
const PX = VIEW_WIDTH / 480;

const CAMERA_HEIGHT = 1000;
const FIELD_OF_VIEW = 100;
const CAMERA_DEPTH = 1 / Math.tan((FIELD_OF_VIEW / 2) * Math.PI / 180);
/** How far ahead of the camera the car is: a little further than the road's bottom edge, so road shows below it. */
export const PLAYER_Z = CAMERA_HEIGHT * CAMERA_DEPTH * 1.3;
const DRAW_DISTANCE = 320;
/** Haze thickness towards the horizon: light, so bends can be seen coming. */
const FOG_DENSITY = 2.2;

const PALETTE = {
    sky: [0x2458c9, 0x2f68d4, 0x3b78de, 0x4a89e6, 0x5c9bee, 0x72aef3, 0x8dc2f6, 0xa9d4f8, 0xc6e4f8],
    cloud: 0xffffff,
    cloudShade: 0xd5e3f4,
    cloudDark: 0xaec4e0,
    mountainFar: 0x8f8fc7,
    mountainFarShade: 0x7d7cb6,
    mountainNear: 0x5f9e6e,
    mountainNearShade: 0x4f8a5e,
    fog: 0xc6e4f8,
    grass: [0x49b84f, 0x44b14a],
    sand: [0xe8d49a, 0xe1ca8e],
    rumble: [0xf4f4f4, 0xd8342a],
    road: [0x6e6e78, 0x686872],
    lane: 0xf2f2f2,
};

const TRAFFIC_COLOURS = [0x2f7de1, 0xf2c230, 0xf2f2f2, 0x44b36b, 0xe0663a, 0x9d5ad6];

interface Projected {
    x: number;
    y: number;
    /** Road half-width in pixels. */
    w: number;
    scale: number;
}

interface DrawnSegment {
    segment: Segment;
    p1: Projected;
    p2: Projected;
    /** Nothing of this segment's scenery shows below this screen line (nearer road hides it). */
    clip: number;
    fog: number;
    /** Steps ahead of the camera. */
    n: number;
}

interface Cloud {
    x: number;
    y: number;
    blocks: [number, number, number, number, number][];
}

export class RoadRenderer {
    /** The far scenery and the road; then the car goes on top; then `near` on top of it. */
    readonly far: Phaser.GameObjects.Graphics;
    readonly near: Phaser.GameObjects.Graphics;
    /** How far the sky has slid sideways this frame (px), from the view. */
    private skyOffset = 0;
    /** Speed streaks gliding out from the middle. */
    private readonly streaks: { x: number; y: number; dx: number; dy: number; life: number }[] = [];
    private readonly streakRandom = seededRandom(7);
    private readonly clouds: Cloud[];
    private readonly ridges: { far: number[]; near: number[] };
    private readonly drawn: DrawnSegment[] = [];
    /** Where the road is under the car on screen, for placing it. */
    carY = VIEW_HEIGHT - 30;

    constructor(scene: Phaser.Scene) {
        this.far = scene.make.graphics({}, false);
        this.near = scene.make.graphics({}, false);
        const random = seededRandom(99);
        this.clouds = Array.from({ length: 7 }, (_, i) => makeCloud(random, i));
        this.ridges = { far: ridge(random, 64, 26 * PX, 44 * PX), near: ridge(random, 48, 10 * PX, 26 * PX) };
    }

    /** One frame, `deltaS` seconds after the last; `shake` offsets everything by whole pixels. */
    draw(view: RaceView, shake: { x: number; y: number }, deltaS: number): void {
        const player = view;
        const track = view.track;
        const share = player.speed / CAR.MAX_SPEED;
        this.skyOffset = view.skyOffset * PX;

        const g = this.far;
        const n = this.near;
        g.clear();
        n.clear();

        const playerY = heightAt(track, player.z);
        const cameraZ = player.z - PLAYER_Z;
        const cameraY = playerY + CAMERA_HEIGHT;
        const horizonLift = Math.max(-18 * PX, Math.min(18 * PX, (playerY - heightAt(track, player.z + SEGMENT_LENGTH * 20)) * 0.004 * PX));
        this.drawSky(g, shake, horizonLift);
        this.projectRoad(view, cameraZ, cameraY, shake);
        this.drawRoad(g);

        // Scenery and traffic, farthest first; what's nearer than the car goes over it
        const carAhead = Math.floor(PLAYER_Z / SEGMENT_LENGTH);
        for (let i = this.drawn.length - 1; i >= 0; i--) {
            const drawn = this.drawn[i];
            const target = drawn.n <= carAhead ? n : g;
            for (const thing of drawn.segment.things) drawThing(target, drawn, thing);
            for (const other of view.traffic) {
                if (segmentAt(track, other.z) === drawn.segment) drawTraffic(target, drawn, other);
            }
        }

        this.carY = VIEW_HEIGHT / 2 + (CAMERA_DEPTH / PLAYER_Z) * CAMERA_HEIGHT * VIEW_HEIGHT / 2 + shake.y;
        this.drawStreaks(n, Math.max(0, (share - 0.7) / 0.3) + view.slipstream, deltaS);
    }

    /** Streaks spawn near the edges at speed and glide outwards from the middle, fading. */
    private drawStreaks(g: Phaser.GameObjects.Graphics, amount: number, deltaS: number): void {
        const random = this.streakRandom;
        const wanted = amount * 40 * deltaS;
        for (let i = 0; i < Math.floor(wanted) + (random() < wanted % 1 ? 1 : 0); i++) {
            const left = random() < 0.5;
            const x = left ? (20 + random() * 90) * PX : VIEW_WIDTH - (20 + random() * 90) * PX;
            const y = VIEW_HEIGHT * (0.5 + random() * 0.4);
            const dx = x - VIEW_WIDTH / 2;
            const dy = y - VIEW_HEIGHT * 0.45;
            const d = Math.hypot(dx, dy);
            this.streaks.push({ x, y, dx: dx / d, dy: dy / d, life: 1 });
        }
        for (const s of this.streaks) {
            const length = (10 + 22 * (1 - s.life)) * PX;
            const fromX = s.x, fromY = s.y;
            s.x += s.dx * 420 * PX * deltaS;
            s.y += s.dy * 420 * PX * deltaS;
            s.life -= deltaS * 3.5;
            if (s.life <= 0) continue;
            g.lineStyle(PX / 2, 0xffffff, 0.45 * s.life)
                .lineBetween(Math.round(fromX), Math.round(fromY), Math.round(fromX + s.dx * length), Math.round(fromY + s.dy * length));
        }
        let alive = 0;
        for (const s of this.streaks) if (s.life > 0) this.streaks[alive++] = s;
        this.streaks.length = alive;
    }

    destroy(): void {
        this.far.destroy();
        this.near.destroy();
    }

    // ─── Sky ───

    private drawSky(g: Phaser.GameObjects.Graphics, shake: { x: number; y: number }, lift: number): void {
        const horizon = VIEW_HEIGHT / 2 + lift + shake.y;
        // Flat bands of colour, like a 16-bit gradient
        const bands = PALETTE.sky;
        const bandHeight = Math.ceil((horizon + 20) / bands.length);
        bands.forEach((colour, i) => g.fillStyle(colour).fillRect(0, i * bandHeight, VIEW_WIDTH, bandHeight + 1));

        // Clouds drift slowly on their own and slide with the bends
        for (const cloud of this.clouds) {
            const x = wrap(cloud.x + this.skyOffset * 0.25 + shake.x, VIEW_WIDTH + 200 * PX) - 100 * PX;
            for (const [bx, by, bw, bh, shade] of cloud.blocks) {
                g.fillStyle(shade === 0 ? PALETTE.cloud : shade === 1 ? PALETTE.cloudShade : PALETTE.cloudDark)
                    .fillRect(Math.round(x + bx), Math.round(cloud.y + by + lift * 0.3), bw, bh);
            }
        }

        // Two mountain ranges, the nearer sliding faster
        drawRidge(g, this.ridges.far, horizon, this.skyOffset * 0.5 + shake.x, PALETTE.mountainFar, PALETTE.mountainFarShade);
        drawRidge(g, this.ridges.near, horizon, this.skyOffset * 0.9 + shake.x, PALETTE.mountainNear, PALETTE.mountainNearShade);
        g.fillStyle(PALETTE.grass[0]).fillRect(0, Math.round(horizon), VIEW_WIDTH, VIEW_HEIGHT);
    }

    // ─── Road ───

    /** Projects the segments ahead, nearest first, keeping the ones not hidden behind a hill. */
    private projectRoad(view: RaceView, cameraZ: number, cameraY: number, shake: { x: number; y: number }): void {
        const track = view.track;
        const segments = track.segments;
        const base = segmentAt(track, cameraZ);
        const baseShare = ((((cameraZ % track.length) + track.length) % track.length) - base.z) / SEGMENT_LENGTH;
        const cameraX = view.x * ROAD_WIDTH;
        let maxY = VIEW_HEIGHT;
        let x = 0;
        let dx = -(base.curve * baseShare);
        this.drawn.length = 0;

        for (let n = 0; n < DRAW_DISTANCE; n++) {
            const segment = segments[(base.index + n) % segments.length];
            const looped = segment.index < base.index;
            const z = cameraZ - (looped ? track.length : 0);
            const p1 = project(0, segment.y1, segment.z, cameraX - x, cameraY, z, shake);
            const p2 = project(0, segment.y2, segment.z + SEGMENT_LENGTH, cameraX - x - dx, cameraY, z, shake);
            x += dx;
            dx += segment.curve;
            if (!p1 || !p2 || p2.y >= p1.y || p2.y >= maxY) continue;
            const distance = n / DRAW_DISTANCE;
            this.drawn.push({ segment, p1, p2, clip: maxY, fog: 1 - 1 / Math.exp(distance * distance * FOG_DENSITY), n });
            maxY = p2.y;
        }
    }

    /** Farthest first, so each nearer segment covers the pixel of overlap. */
    private drawRoad(g: Phaser.GameObjects.Graphics): void {
        for (let i = this.drawn.length - 1; i >= 0; i--) {
            const { segment, p1, p2, fog } = this.drawn[i];
            const alt = segment.dark ? 1 : 0;
            const shade = (colour: number) => mix(colour, PALETTE.fog, fog);
            const top = Math.round(p2.y);
            const bottom = Math.round(p1.y);
            g.fillStyle(shade(PALETTE.grass[alt])).fillRect(0, top, VIEW_WIDTH, bottom - top + 1);

            // Sand verge, rumble strips, road
            quad(g, shade(PALETTE.sand[alt]), p1.x, p1.y, p1.w * 1.22, p2.x, p2.y, p2.w * 1.22);
            quad(g, shade(PALETTE.rumble[alt]), p1.x, p1.y, p1.w * 1.08, p2.x, p2.y, p2.w * 1.08);
            quad(g, shade(PALETTE.road[alt]), p1.x, p1.y, p1.w, p2.x, p2.y, p2.w);

            // Dashed lane lines
            if (!segment.dark) {
                const lane1 = (p1.w * 2) / LANES;
                const lane2 = (p2.w * 2) / LANES;
                const line1 = Math.max(1, p1.w / 40);
                const line2 = Math.max(1, p2.w / 40);
                for (let lane = 1; lane < LANES; lane++) {
                    quad(g, shade(PALETTE.lane), p1.x - p1.w + lane1 * lane, p1.y, line1, p2.x - p2.w + lane2 * lane, p2.y, line2);
                }
            }
        }
    }
}

// ─── Projection and shapes ───

function project(wx: number, wy: number, wz: number, cameraX: number, cameraY: number, cameraZ: number, shake: { x: number; y: number }): Projected | null {
    const z = wz - cameraZ;
    if (z <= CAMERA_DEPTH) return null;
    const scale = CAMERA_DEPTH / z;
    return {
        x: Math.round(VIEW_WIDTH / 2 + scale * (wx - cameraX) * VIEW_WIDTH / 2 + shake.x),
        y: Math.round(VIEW_HEIGHT / 2 - scale * (wy - cameraY) * VIEW_HEIGHT / 2 + shake.y),
        w: Math.round(scale * ROAD_WIDTH * VIEW_WIDTH / 2),
        scale,
    };
}

/**
 * A trapezoid between two screen lines, centred on x1 and x2, half-widths w1 and w2.
 * Its far edge reaches a pixel further, so rounding leaves no gaps between segments.
 */
function quad(g: Phaser.GameObjects.Graphics, colour: number, x1: number, y1: number, w1: number, x2: number, y2: number, w2: number): void {
    y2 -= 1;
    g.fillStyle(colour);
    g.fillTriangle(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2);
    g.fillTriangle(x1 - w1, y1, x2 + w2, y2, x2 - w2, y2);
}

/** A block in world units standing on the road at `drawn`'s near edge, `offset` across it, cut off below `clip`. */
function block(g: Phaser.GameObjects.Graphics, drawn: DrawnSegment, offset: number, colour: number,
    width: number, height: number, lift = 0, shift = 0): void {
    const p = drawn.p1;
    const pixels = p.scale * VIEW_WIDTH / 2;
    const w = Math.max(1, Math.round(width * pixels));
    const h = Math.max(1, Math.round(height * pixels));
    const x = Math.round(p.x + offset * p.w + shift * pixels - w / 2);
    const bottom = Math.round(p.y - lift * pixels);
    const top = bottom - h;
    const visibleBottom = Math.min(bottom, drawn.clip);
    if (visibleBottom <= top || x > VIEW_WIDTH || x + w < 0) return;
    g.fillStyle(mix(colour, PALETTE.fog, drawn.fog)).fillRect(x, top, w, visibleBottom - top);
}

/** Placeholder scenery: palms, bend arrows, rocks, bushes and billboards, as blocks. */
function drawThing(g: Phaser.GameObjects.Graphics, drawn: DrawnSegment, thing: RoadsideThing): void {
    const o = thing.offset;
    switch (thing.kind) {
        case 'palm': {
            // Leaning trunk in three pieces, a crown of fronds
            const lean = o < 0 ? 1 : -1;
            block(g, drawn, o, 0x7a4f2a, 70, 520, 0, 0);
            block(g, drawn, o, 0x86582f, 64, 520, 500, lean * 40);
            block(g, drawn, o, 0x916135, 58, 480, 1000, lean * 90);
            block(g, drawn, o, 0x1f7a33, 900, 150, 1380, lean * 110);
            block(g, drawn, o, 0x2f9e44, 640, 170, 1470, lean * 110);
            block(g, drawn, o, 0x3fb857, 300, 130, 1560, lean * 110);
            break;
        }
        case 'sign': {
            block(g, drawn, o, 0x444444, 40, 420);
            block(g, drawn, o, 0xf2c230, 420, 300, 330);
            block(g, drawn, o, 0x202020, 220, 70, 440, 0);
            break;
        }
        case 'rock':
            block(g, drawn, o, 0x8c8480, 520, 260);
            block(g, drawn, o, 0xa39b96, 360, 120, 200);
            break;
        case 'bush':
            block(g, drawn, o, 0x2d8a3c, 460, 200);
            block(g, drawn, o, 0x3aa34a, 320, 120, 160);
            break;
        case 'billboard': {
            block(g, drawn, o, 0x555555, 60, 700, 0, -600);
            block(g, drawn, o, 0x555555, 60, 700, 0, 600);
            block(g, drawn, o, 0xe84a8a, 1800, 720, 650);
            block(g, drawn, o, 0x4fd6e8, 1800, 160, 1210);
            block(g, drawn, o, 0xffffff, 1100, 110, 850);
            break;
        }
    }
}

/** A placeholder car: shadow, body, cabin, rear lights. Placed between its segment's edges, so it moves smoothly. */
function drawTraffic(g: Phaser.GameObjects.Graphics, segmentDrawn: DrawnSegment, car: RaceView['traffic'][number]): void {
    const { p1, p2, segment } = segmentDrawn;
    const t = Math.max(0, Math.min(1, (car.z - segment.z) / SEGMENT_LENGTH));
    const drawn: DrawnSegment = {
        ...segmentDrawn,
        p1: { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t, w: p1.w + (p2.w - p1.w) * t, scale: p1.scale + (p2.scale - p1.scale) * t },
    };
    const colour = TRAFFIC_COLOURS[car.look % TRAFFIC_COLOURS.length];
    const width = CAR.WIDTH * ROAD_WIDTH;
    const x = car.x;
    block(g, drawn, x, 0x2a2a30, width * 1.05, 40);
    block(g, drawn, x, darken(colour), width, 160, 30);
    block(g, drawn, x, colour, width * 0.96, 140, 150);
    block(g, drawn, x, 0x28324a, width * 0.62, 110, 290);
    block(g, drawn, x, 0xff3b30, width * 0.16, 50, 190, -width * 0.36);
    block(g, drawn, x, 0xff3b30, width * 0.16, 50, 190, width * 0.36);
    // About to change lane: the indicator on that side flashes
    if (car.blink !== 0) block(g, drawn, x, 0xffa21f, width * 0.14, 60, 250, car.blink * width * 0.46);
}

// ─── Backdrop shapes ───

function makeCloud(random: () => number, i: number): Cloud {
    const blocks: Cloud['blocks'] = [];
    const size = 0.7 + random() * 0.8;
    const puffs = 4 + Math.floor(random() * 4);
    let px = 0;
    for (let p = 0; p < puffs; p++) {
        const w = Math.round((22 + random() * 26) * size * PX);
        const h = Math.round((12 + random() * 16) * size * PX);
        const y = Math.round(-h + random() * 6 * PX);
        blocks.push([px, y + 4 * PX, w, 6 * PX, 2]);
        blocks.push([px, y, w, h, 1]);
        blocks.push([px + 3 * PX, y - 2 * PX, w - 8 * PX, h - 6 * PX, 0]);
        px += Math.round(w * (0.55 + random() * 0.25));
    }
    return { x: (i * 110 + random() * 60) * PX, y: (22 + random() * 55) * PX, blocks };
}

/** A mountain range's heights, one per 8 px, repeating. */
function ridge(random: () => number, count: number, low: number, high: number): number[] {
    const heights: number[] = [];
    let h = (low + high) / 2;
    for (let i = 0; i < count; i++) {
        h = Math.max(low, Math.min(high, h + (random() - 0.5) * (high - low) * 0.7));
        heights.push(Math.round(h));
    }
    return heights;
}

function drawRidge(g: Phaser.GameObjects.Graphics, heights: number[], horizon: number, offset: number, colour: number, shade: number): void {
    const step = 8 * PX;
    const span = heights.length * step;
    const start = -wrap(offset, span);
    for (let x = start - step; x < VIEW_WIDTH + step; x += step) {
        const i = Math.floor(wrap(x - start, span) / step);
        const h = heights[i];
        const next = heights[(i + 1) % heights.length];
        g.fillStyle(colour);
        g.fillTriangle(x, horizon, x, horizon - h, x + step, horizon - next);
        g.fillTriangle(x, horizon, x + step, horizon - next, x + step, horizon);
        // Shade on the downhill faces
        if (next < h) g.fillStyle(shade).fillTriangle(x + step * 0.5, horizon, x + step, horizon - next, x + step, horizon);
    }
}

// ─── Colour ───

function mix(a: number, b: number, t: number): number {
    if (t <= 0) return a;
    const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
    const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
    return (Math.round(ar + (br - ar) * t) << 16) | (Math.round(ag + (bg - ag) * t) << 8) | Math.round(ab + (bb - ab) * t);
}

function darken(colour: number): number {
    return mix(colour, 0x000000, 0.35);
}

function wrap(value: number, span: number): number {
    return ((value % span) + span) % span;
}
