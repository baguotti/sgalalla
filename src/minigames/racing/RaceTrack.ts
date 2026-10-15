/**
 * The racer's highway: a loop of short road segments, each with its curve
 * (how far the road bends while crossing it), its height (hills) and what
 * stands beside it. Plain data, built the same way from the same seed on
 * every machine (no Math.random, no sin/cos), so a multiplayer race could
 * share it later.
 */

/** Road units: the road is ROAD_WIDTH either side of its centre line. */
export const SEGMENT_LENGTH = 200;
export const ROAD_WIDTH = 1600;
export const LANES = 4;
/** Segments per rumble-strip colour. */
export const RUMBLE_LENGTH = 5;

export type ScenerySprite = 'palm' | 'sign' | 'rock' | 'bush' | 'billboard';

/** Something beside the road; `offset` is across the road in road half-widths (±1 = the edges). */
export interface RoadsideThing {
    kind: ScenerySprite;
    offset: number;
}

export interface Segment {
    index: number;
    /** World z of the segment's near edge; the far edge is z + SEGMENT_LENGTH. */
    z: number;
    /** Heights of the near and far edges. */
    y1: number;
    y2: number;
    curve: number;
    /** Every other RUMBLE_LENGTH segments: the stripes alternate. */
    dark: boolean;
    things: RoadsideThing[];
}

export interface Track {
    segments: Segment[];
    length: number;
}

/** How hard a curve bends, per segment. */
const CURVE = { none: 0, easy: 2, medium: 4, hard: 6 };
/** Hill heights, in road units. */
const HILL = { none: 0, low: 1200, medium: 2600, high: 4200 };

/** A little random-number generator that gives the same numbers from the same seed anywhere. */
export function seededRandom(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Smooth 0 → 1 → 0 easing without trig: in, then out. */
function easeInOut(a: number, b: number, t: number): number {
    const s = t * t * (3 - 2 * t);
    return a + (b - a) * s;
}

export function buildTrack(seed = 1): Track {
    const random = seededRandom(seed);
    const segments: Segment[] = [];
    let height = 0;

    const add = (curve: number, y: number) => {
        const n = segments.length;
        segments.push({
            index: n, z: n * SEGMENT_LENGTH, y1: height, y2: y, curve,
            dark: Math.floor(n / RUMBLE_LENGTH) % 2 === 1, things: [],
        });
        height = y;
    };

    /** A stretch: `enter` segments easing into the curve and hill, `hold` at them, `leave` easing out. */
    const road = (enter: number, hold: number, leave: number, curve: number, hill: number) => {
        const start = height;
        const end = start + hill;
        const total = enter + hold + leave;
        for (let i = 0; i < enter; i++) add(easeInOut(0, curve, i / enter), easeInOut(start, end, (i + 1) / total));
        for (let i = 0; i < hold; i++) add(curve, easeInOut(start, end, (enter + i + 1) / total));
        for (let i = 0; i < leave; i++) add(easeInOut(curve, 0, i / leave), easeInOut(start, end, (enter + hold + i + 1) / total));
    };

    // A long run-up, then a random mix of bends and hills, and back down to where it started.
    // Bends ease in over as long as they last, so they can be read coming; sharp bends
    // stay off big hills, so none starts hidden behind a crest
    road(0, 80, 0, CURVE.none, HILL.none);
    const bends = [CURVE.easy, CURVE.medium, CURVE.hard, CURVE.easy, CURVE.medium];
    const gentleHills = [HILL.none, HILL.low, -HILL.low];
    const bigHills = [HILL.medium, HILL.high, -HILL.medium];
    for (let i = 0; i < 26; i++) {
        const side = random() < 0.5 ? -1 : 1;
        const bend = random() < 0.2 ? 0 : bends[Math.floor(random() * bends.length)] * side;
        const hills = Math.abs(bend) >= CURVE.medium ? gentleHills : [...gentleHills, ...bigHills];
        const hill = hills[Math.floor(random() * hills.length)];
        const length = 30 + 2 * Math.floor(random() * 25);
        road(length, length, Math.round(length * 0.75), bend, hill);
        // Straights between bends to open up and floor it
        if (random() < 0.5) road(0, 30 + Math.floor(random() * 40), 0, 0, 0);
    }
    road(40, 40, 40, 0, -height);

    placeScenery(segments, random);
    return { segments, length: segments.length * SEGMENT_LENGTH };
}

/** Warning arrows start this many segments before a medium or hard bend. */
const SIGN_LEAD = 45;

/** Palms in rows along both sides, signs on the bends, and a few rocks, bushes and billboards. */
function placeScenery(segments: Segment[], random: () => number): void {
    for (const segment of segments) {
        const n = segment.index;
        // Palms every few segments, close enough to whizz by
        if (n % 6 === 0) {
            segment.things.push({ kind: 'palm', offset: -1.3 - random() * 0.35 });
            segment.things.push({ kind: 'palm', offset: 1.3 + random() * 0.35 });
        }
        // A second, looser row further out
        if (n % 17 === 3) segment.things.push({ kind: 'palm', offset: (random() < 0.5 ? -1 : 1) * (2.2 + random() * 1.5) });
        if (n % 13 === 7) segment.things.push({ kind: random() < 0.5 ? 'bush' : 'rock', offset: (random() < 0.5 ? -1 : 1) * (1.6 + random() * 2) });
        // Arrows on the outside of a bend, from well before it starts
        const coming = segments[(n + SIGN_LEAD) % segments.length].curve;
        const bend = Math.abs(segment.curve) >= CURVE.medium ? segment.curve : Math.abs(coming) >= CURVE.medium ? coming : 0;
        if (bend !== 0 && n % 5 === 0) {
            segment.things.push({ kind: 'sign', offset: bend > 0 ? -1.28 : 1.28 });
        }
        if (n % 150 === 75) segment.things.push({ kind: 'billboard', offset: random() < 0.5 ? -1.6 : 1.6 });
    }
}

/** The segment at world `z`, wrapping round the loop. */
export function segmentAt(track: Track, z: number): Segment {
    const wrapped = ((z % track.length) + track.length) % track.length;
    return track.segments[Math.floor(wrapped / SEGMENT_LENGTH)];
}

/** The road's height at world `z`, between its segment's edges. */
export function heightAt(track: Track, z: number): number {
    const segment = segmentAt(track, z);
    const along = (((z % track.length) + track.length) % track.length - segment.z) / SEGMENT_LENGTH;
    return segment.y1 + (segment.y2 - segment.y1) * along;
}
