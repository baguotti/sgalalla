/**
 * The racer's rules: the player's car and the traffic on the highway, one
 * step of exactly 1/60 s at a time. Plain data like the fighting game's
 * simulation (no Phaser, no Math.random, no exp/sin/cos), so a multiplayer
 * race can run it on every machine later. Distances are road units; across
 * the road, 0 is the centre line and ±1 the edges.
 */
import { buildTrack, LANES, segmentAt, SEGMENT_LENGTH, seededRandom, type ScenerySprite, type Track } from './RaceTrack';

export const STEP_S = 1 / 60;

const TOP = SEGMENT_LENGTH * 64;

/** Tuning for the car's feel. Speeds are road units per second; shares are per step. */
export const CAR = {
    MAX_SPEED: TOP,
    /** Acceleration from a standstill; it fades towards top speed like climbing through the gears. */
    ACCEL: TOP / 3.4,
    /** Share of the acceleration left at top speed. */
    ACCEL_AT_TOP: 0.14,
    BRAKE: TOP * 1.3,
    /** Slowing with the pedal up (engine braking), and a little air drag on top at speed. */
    COAST: TOP / 6,
    DRAG: TOP / 40,

    /** Sideways speed at full lock (half-widths a second), before speed sensitivity. */
    LATERAL: 2.6,
    /** Steering is quick at low speed and heavy flat out: the share of LATERAL left at top speed. */
    LATERAL_AT_TOP: 0.5,
    /** Share of the gap to the wanted sideways speed closed each step: on the road, and on the grass. */
    GRIP: 0.12,
    GRIP_OFF_ROAD: 0.04,
    /** Braking hard at speed uses up grip: at full brake and top speed, this share of it is gone, so the car runs wide. */
    BRAKE_GRIP_LOSS: 0.55,
    /** The wheel follows the stick this share per step, and comes back to centre a little faster. */
    STEER_IN: 0.16,
    STEER_OUT: 0.24,
    /**
     * How hard bends push the car outwards (half-widths a second per unit of curve, at top speed):
     * easy bends go flat out, medium ones need a lift, hard ones the brakes.
     */
    CENTRIFUGAL: 0.5,
    /**
     * Taking a bend faster than the tyres can hold: they slide, losing up to this share of their
     * steering bite, and scrub off speed (share of top speed a second at a full slide).
     */
    SLIDE_STEER_LOSS: 0.4,
    SLIDE_SCRUB: 0.2,
    /** …and wash out wide: extra outward push at a full slide, as a share of the bend's pull. */
    SLIDE_WASH: 0.8,
    /** Turning always costs a little speed: share of top speed a second at full lock, flat out. */
    TURN_SCRUB: 0.06,

    /** Off the road: drags down to this share of top speed. */
    OFF_ROAD_LIMIT: 0.3,
    OFF_ROAD_DRAG: TOP * 1.3,
    MAX_X: 3,
    /** The car's width across the road (half-widths), for collisions. */
    WIDTH: 0.36,
    /** A glancing hit on something beside the road costs this share of the speed and bounces the car off; a square hit leaves CRASH_SPEED. */
    GLANCE_LOSS: 0.45,
    CRASH_SPEED: 0.06,

    /** Slipstream: tucked in behind a car this far ahead (road units), it builds up this share per step… */
    SLIPSTREAM_RANGE: SEGMENT_LENGTH * 22,
    SLIPSTREAM_BUILD: 1 / 60,
    SLIPSTREAM_FADE: 1 / 90,
    /** …and at full, top speed rises by this share. */
    SLIPSTREAM_BONUS: 0.1,
    /** Passing a car closer than this (half-widths between the cars' sides) is a near miss. */
    NEAR_MISS_GAP: 0.1,
};


const TRAFFIC_COUNT = 42;
/** A traffic car signals this many steps before changing lane, then moves over at this speed (half-widths a second). */
const SIGNAL_STEPS = 75;
const LANE_CHANGE_SPEED = 0.7;
/** Chance each step that a traffic car decides to change lane. */
const LANE_CHANGE_CHANCE = 1 / 650;
/** Lane centres across the road. */
export const LANE_CENTRES = Array.from({ length: LANES }, (_, i) => -1 + (2 * i + 1) / LANES);

/** Solid width of each roadside thing (half-widths); 0 is drive-through. */
const SOLID: Record<ScenerySprite, number> = { palm: 0.12, sign: 0.14, rock: 0.3, bush: 0, billboard: 0.7 };
/** A traffic car's length (road units). */
const CAR_LENGTH = SEGMENT_LENGTH * 0.8;

export interface RaceInput {
    /** 0 to 1: analogue triggers give in-between. */
    throttle: number;
    brake: number;
    /** -1 left to 1 right. */
    steer: number;
}

export interface PlayerCar {
    z: number;
    x: number;
    /** Sideways speed, half-widths a second. */
    vx: number;
    speed: number;
    /** The wheel, easing towards the input. */
    steer: number;
    offRoad: boolean;
    /** 0 to 1: how much slipstream is built up. */
    slipstream: number;
    /** 0 to 1: how far past their grip the tyres are in a bend. */
    sliding: number;
}

export interface TrafficCar {
    z: number;
    x: number;
    speed: number;
    /** Picks its placeholder colour. */
    look: number;
    /** Just ahead of the player last step: if it's just behind now, the player passed it. */
    close: boolean;
    /** Its lane (index into LANE_CENTRES); while signalling, the lane it's about to move to and the steps left. */
    lane: number;
    toLane: number;
    signal: number;
}

export type RaceEvent =

    | { type: 'crash' }
    | { type: 'glance'; side: number }
    | { type: 'bump' }
    | { type: 'nearMiss'; x: number }
    | { type: 'offRoad'; on: boolean };

export interface RaceState {
    track: Track;
    player: PlayerCar;
    traffic: TrafficCar[];
    /** Steps since the start. */
    steps: number;
    /** Road units driven. */
    distance: number;
    /** Points: distance at speed, plus near misses. */
    score: number;
    nearMisses: number;
    /** The race's own random numbers (traffic lane changes), kept in its data so every machine draws the same ones. */
    rng: number;
}

export function createRace(seed = 1): RaceState {
    const track = buildTrack(seed);
    const random = seededRandom(seed * 7919 + 1);
    const traffic: TrafficCar[] = [];
    for (let i = 0; i < TRAFFIC_COUNT; i++) {
        const lane = Math.floor(random() * LANES);
        traffic.push({
            // Spread along the loop, clear of the start
            z: (0.05 + 0.95 * (i + random() * 0.6) / TRAFFIC_COUNT) * track.length,
            x: LANE_CENTRES[lane],
            speed: TOP * (0.3 + random() * 0.28),
            look: Math.floor(random() * 6),
            close: false,
            lane, toLane: lane, signal: 0,
        });
    }
    return {
        track,
        player: { z: 0, x: LANE_CENTRES[1], vx: 0, speed: 0, steer: 0, offRoad: false, slipstream: 0, sliding: 0 },
        traffic,
        steps: 0,
        distance: 0,
        score: 0,
        nearMisses: 0,
        rng: (seed * 2654435761) >>> 0,
    };
}

export function stepRace(race: RaceState, input: RaceInput, events: RaceEvent[] = []): RaceEvent[] {
    const car = race.player;
    const track = race.track;
    const top = TOP * (1 + CAR.SLIPSTREAM_BONUS * car.slipstream);
    const share = car.speed / TOP;

    // ─── Pedals ───
    if (input.throttle > 0) {
        const pull = 1 - (1 - CAR.ACCEL_AT_TOP) * Math.min(1, share * share);
        car.speed += CAR.ACCEL * pull * input.throttle * STEP_S;
    } else {
        car.speed -= CAR.COAST * STEP_S;
    }
    if (input.brake > 0) car.speed -= CAR.BRAKE * input.brake * STEP_S;
    car.speed -= CAR.DRAG * share * share * STEP_S;
    if (car.speed > top) car.speed += (top - car.speed) * 0.05;

    // ─── Steering: the wheel eases towards the stick, sideways speed follows it through the tyres' grip ───
    const towards = Math.abs(input.steer) > Math.abs(car.steer) ? CAR.STEER_IN : CAR.STEER_OUT;
    car.steer += (input.steer - car.steer) * towards;
    const responsive = Math.min(1, share * 2.5) * (1 - (1 - CAR.LATERAL_AT_TOP) * share);
    const segment = segmentAt(track, car.z);
    // What the bend asks of the tyres, against what they can give: past it, they slide
    const capacity = CAR.LATERAL * responsive;
    const pull = segment.curve * CAR.CENTRIFUGAL * share * share;
    const slide = capacity > 0 ? Math.max(0, Math.min(1, (Math.abs(pull) - capacity) / capacity)) : 0;
    car.sliding = slide;
    const wanted = car.steer * capacity * (1 - CAR.SLIDE_STEER_LOSS * slide) - pull * (1 + CAR.SLIDE_WASH * slide);
    car.speed -= TOP * (CAR.SLIDE_SCRUB * slide + CAR.TURN_SCRUB * Math.abs(car.steer) * share) * STEP_S;
    const grip = (car.offRoad ? CAR.GRIP_OFF_ROAD : CAR.GRIP) * (1 - CAR.BRAKE_GRIP_LOSS * input.brake * Math.min(1, share));
    car.vx += (wanted - car.vx) * grip;
    car.x += car.vx * STEP_S;

    // ─── The grass ───
    const offRoad = Math.abs(car.x) > 1;
    if (offRoad !== car.offRoad) {
        car.offRoad = offRoad;
        events.push({ type: 'offRoad', on: offRoad });
    }
    if (offRoad && car.speed > TOP * CAR.OFF_ROAD_LIMIT) car.speed -= CAR.OFF_ROAD_DRAG * STEP_S;
    if (Math.abs(car.x) > CAR.MAX_X) {
        car.x = Math.sign(car.x) * CAR.MAX_X;
        car.vx = 0;
    }

    // ─── Roadside things: a glancing hit bounces off, a square one stops the car ───
    if (offRoad) {
        for (const thing of segment.things) {
            const solid = SOLID[thing.kind];
            const reach = (CAR.WIDTH + solid) / 2;
            const apart = car.x - thing.offset;
            if (solid === 0 || Math.abs(apart) >= reach) continue;
            const overlap = 1 - Math.abs(apart) / reach;
            const side = apart < 0 ? -1 : 1;
            if (overlap < 0.3) {
                car.speed *= 1 - CAR.GLANCE_LOSS;
                car.x = thing.offset + side * reach;
                car.vx = side * 1.2;
                events.push({ type: 'glance', side });
            } else {
                car.speed = Math.min(car.speed, TOP * CAR.CRASH_SPEED);
                car.x = thing.offset + side * reach;
                car.vx = 0;
                events.push({ type: 'crash' });
            }
            break;
        }
    }

    car.speed = Math.max(0, car.speed);
    stepTraffic(race, events);

    const moved = car.speed * STEP_S;
    car.z = (car.z + moved) % track.length;
    race.distance += moved;
    race.score += moved * share * 0.01;
    race.steps++;
    return events;
}

/**
 * Traffic drives on in its lane. Running into the back of a car slows the
 * player to its speed; tucking in behind one builds slipstream; passing one
 * close is a near miss.
 */
function stepTraffic(race: RaceState, events: RaceEvent[]): void {
    const car = race.player;
    const length = race.track.length;
    let drafting = false;
    for (const other of race.traffic) {
        other.z = (other.z + other.speed * STEP_S) % length;
        changeLanes(race, other);
        const gap = ahead(other.z, car.z, length);
        const apart = Math.abs(car.x - other.x);

        // Rear-ending it
        if (gap < CAR_LENGTH && car.speed > other.speed && apart < CAR.WIDTH * 0.9) {
            car.speed = other.speed * 0.6;
            car.z = (other.z - CAR_LENGTH + length) % length;
            car.vx += (car.x < other.x ? -1 : 1) * 1.0;
            events.push({ type: 'bump' });
            continue;
        }
        if (gap < CAR.SLIPSTREAM_RANGE && gap > CAR_LENGTH && apart < CAR.WIDTH * 0.5 && car.speed > TOP * 0.5) drafting = true;

        // Just ahead last step and just behind now: passed, and close enough to count
        if (other.close && gap > length - CAR_LENGTH * 4 && apart - CAR.WIDTH < CAR.NEAR_MISS_GAP && car.speed > TOP * 0.5) {
            race.nearMisses++;
            race.score += 250;
            events.push({ type: 'nearMiss', x: other.x });
        }
        other.close = gap < CAR_LENGTH * 3;
    }
    car.slipstream = drafting
        ? Math.min(1, car.slipstream + CAR.SLIPSTREAM_BUILD)
        : Math.max(0, car.slipstream - CAR.SLIPSTREAM_FADE);
}

/**
 * Now and then a traffic car signals, and after a moment moves over a lane,
 * if nothing's alongside there.
 */
function changeLanes(race: RaceState, car: TrafficCar): void {
    if (car.signal > 0) {
        car.signal--;
        if (car.signal === 0) car.lane = car.toLane;
    } else if (car.lane === car.toLane && random(race) < LANE_CHANGE_CHANCE) {
        const lane = car.lane + (random(race) < 0.5 ? -1 : 1);
        const length = race.track.length;
        const free = lane >= 0 && lane < LANES && !race.traffic.some(other => other !== car &&
            (other.lane === lane || other.toLane === lane) && Math.abs(ahead(other.z, car.z, length) - length / 2) > length / 2 - CAR_LENGTH * 4);
        if (free) {
            car.toLane = lane;
            car.signal = SIGNAL_STEPS;
        }
    }
    const target = LANE_CENTRES[car.lane];
    const move = LANE_CHANGE_SPEED * STEP_S;
    car.x = Math.abs(target - car.x) <= move ? target : car.x + Math.sign(target - car.x) * move;
}

/** The race's next random number, 0 to 1, from its own state. */
function random(race: RaceState): number {
    race.rng = (race.rng + 0x6d2b79f5) >>> 0;
    let t = race.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** How far `z` is ahead of `from`, round the loop. */
function ahead(z: number, from: number, length: number): number {
    return ((z - from) % length + length) % length;
}
