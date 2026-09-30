/**
 * DERAPATE's rules: a car doing donuts round the middle of a junction while
 * people cross the road on the zebra crossings. One step of exactly 1/60 s at
 * a time, plain data with its own seeded random numbers (no Phaser, no
 * Math.random), like the other games' simulations.
 *
 * Distances are metres on the ground, the junction's centre at 0,0; angles
 * are radians. The throttle sets the size of the donut: held, the car speeds
 * up and swings wider; let go, it slows and tightens in. The drift has to be
 * balanced like a stick on a finger: it tips further by itself and the
 * throttle pushes the tail out, and left/right counter-steer; lose it and the
 * car spins out.
 */

export const STEP_S = 1 / 60;

/** The junction: half the road's width, and where the middle of each zebra crossing is from the centre. */
export const ROAD_HALF_WIDTH = 7;
export const CROSSING_AT = 10;
export const CROSSING_WIDTH = 3.2;

export const DONUT = {
    RADIUS_MIN: 2.6,
    RADIUS_MAX: 12,
    /** How fast the donut widens at full throttle, tightens with the pedal up, and tightens on the brake (metres a second). */
    GROW: 2.4,
    SHRINK: 1.2,
    BRAKE_SHRINK: 3.5,
    SPEED_MIN: 4,
    SPEED_MAX: 18,
    /** Speeding up with the throttle, slowing without it and on the brake (m/s²). */
    ACCEL: 7,
    COAST: 3,
    BRAKE: 12,

    /** Balance (slip): -1 and 1 are the edges, past them the car spins out. */
    TIP: 0.35,
    /** Random gusts that knock it about, and the push of the throttle on the tail. */
    WOBBLE: 0.8,
    THROTTLE_PUSH: 0.35,
    /** Counter-steering at full lock (gentle, so it's hard to overcorrect), and the damping that settles the swing. */
    STEER: 3,
    DAMPING: 4,
    /** Past the edge, the car spins out only after staying there this long: a quick correction saves it. */
    SPIN_GRACE: 0.35,
    /** Inside this band, the drift is "clean" and scores more. */
    CLEAN: 0.35,
    /** Loops at least this wide build the combo. */
    COMBO_RADIUS: 7,

    SPIN_SECONDS: 1.6,
    SPIN_PENALTY: 150,
    SPIN_SPEED_KEPT: 0.3,
};

export const PEDESTRIANS = {
    /** Seconds between new people, at random between these. */
    SPAWN_MIN: 0.9,
    SPAWN_MAX: 2.2,
    /** Share of them that are type 2 (a boost when hit). */
    BOOSTER_SHARE: 0.3,
    WALK_SPEED: 1.5,
    JOG_SPEED: 2.3,
    /** Car and person closer than this collide (metres). */
    HIT_DISTANCE: 2.8,
    /** Type 1: points lost, and the share of speed kept. */
    HIT_PENALTY: 500,
    HIT_SPEED_KEPT: 0.4,
    /** Type 2: points gained and extra speed (m/s). */
    BOOST_POINTS: 50,
    BOOST_SPEED: 4,
};

export type PedestrianKind = 'walker' | 'booster';

export interface Pedestrian {
    id: number;
    kind: PedestrianKind;
    /** Which crossing: 0 north, 1 east, 2 south, 3 west. */
    crossing: number;
    /** How far across the road, from -1 (one kerb) to 1 (the other), and which way they walk. */
    along: number;
    direction: number;
    speed: number;
    /** Knocked down: shown a moment longer, no longer hit. */
    hit: boolean;
    hitTimer: number;
}

export interface DonutInput {
    /** 0 to 1. */
    throttle: number;
    brake: number;
    /** -1 left to 1 right. */
    steer: number;
}

export type DonutEvent =
    | { type: 'spin' }
    | { type: 'hit'; kind: PedestrianKind; x: number; y: number; points: number }
    | { type: 'loop' };

export interface DonutState {
    /** Where the car is round the centre, how far out, and how fast it goes. */
    angle: number;
    radius: number;
    speed: number;
    /** Balance: 0 is perfectly held, ±1 the edge. */
    slip: number;
    slipSpeed: number;
    /** A slowly wandering push on the balance. */
    gust: number;
    /** Seconds of spin-out left. */
    spinning: number;
    /** Seconds spent past the edge of the balance so far. */
    overEdge: number;
    score: number;
    /** Multiplier built up by clean loops, reset by a hit or a spin. */
    combo: number;
    /** Angle driven since the last full loop. */
    loopProgress: number;
    pedestrians: Pedestrian[];
    nextSpawn: number;
    nextId: number;
    steps: number;
    rng: number;
}

export function createDonut(seed = 1): DonutState {
    return {
        angle: 0, radius: 5, speed: DONUT.SPEED_MIN, slip: 0, slipSpeed: 0, gust: 0, spinning: 0, overEdge: 0,
        score: 0, combo: 1, loopProgress: 0, pedestrians: [], nextSpawn: 1.5, nextId: 1, steps: 0, rng: (seed * 2654435761) >>> 0,
    };
}

/** Where the car is on the ground. */
export function carPosition(state: DonutState): { x: number; y: number } {
    return { x: Math.cos(state.angle) * state.radius, y: Math.sin(state.angle) * state.radius };
}

/** Where a person is on the ground. */
export function pedestrianPosition(p: Pedestrian): { x: number; y: number } {
    const across = p.along * (ROAD_HALF_WIDTH + 1);
    switch (p.crossing) {
        case 0: return { x: across, y: -CROSSING_AT };
        case 1: return { x: CROSSING_AT, y: across };
        case 2: return { x: across, y: CROSSING_AT };
        default: return { x: -CROSSING_AT, y: across };
    }
}

export function stepDonut(state: DonutState, input: DonutInput, events: DonutEvent[] = []): DonutEvent[] {
    const dt = STEP_S;
    const spinning = state.spinning > 0;
    const throttle = spinning ? 0 : input.throttle;
    const brake = spinning ? 0 : input.brake;
    const steer = spinning ? 0 : input.steer;

    // ─── The throttle sets the donut: speed and size ───
    if (throttle > 0) state.speed += DONUT.ACCEL * throttle * dt;
    else state.speed -= DONUT.COAST * dt;
    state.speed -= DONUT.BRAKE * brake * dt;
    // Past top speed (after a boost), it eases back down
    if (state.speed > DONUT.SPEED_MAX) state.speed -= (state.speed - DONUT.SPEED_MAX) * 1.5 * dt;
    state.speed = Math.max(DONUT.SPEED_MIN * (spinning ? 0.3 : 1), state.speed);

    const grow = throttle > 0 ? DONUT.GROW * throttle : -DONUT.SHRINK;
    state.radius += (grow - DONUT.BRAKE_SHRINK * brake) * dt;
    state.radius = Math.max(DONUT.RADIUS_MIN, Math.min(DONUT.RADIUS_MAX, state.radius));

    // ─── Round and round ───
    const turned = (state.speed / state.radius) * dt;
    state.angle = (state.angle + turned) % (Math.PI * 2);
    state.loopProgress += turned;
    if (state.loopProgress >= Math.PI * 2) {
        state.loopProgress -= Math.PI * 2;
        // Only wide loops build the combo: tight safe circles don't
        if (!spinning && state.radius >= DONUT.COMBO_RADIUS) {
            state.combo = Math.min(5, state.combo + 0.25);
            events.push({ type: 'loop' });
        }
    }

    // ─── Balance ───
    if (spinning) {
        state.spinning = Math.max(0, state.spinning - dt);
        if (state.spinning === 0) {
            state.slip = 0;
            state.slipSpeed = 0;
        }
    } else {
        // The gust wanders slowly, harder the faster the car goes
        state.gust += (random(state) * 2 - 1) * 3 * dt;
        state.gust *= 1 - 0.6 * dt;
        state.gust = Math.max(-1, Math.min(1, state.gust));
        const share = state.speed / DONUT.SPEED_MAX;
        const push = state.slip * DONUT.TIP + state.gust * DONUT.WOBBLE * (0.4 + share) + throttle * DONUT.THROTTLE_PUSH * share
            - steer * DONUT.STEER - state.slipSpeed * DONUT.DAMPING;
        state.slipSpeed += push * dt;
        state.slip += state.slipSpeed * dt;
        // Held past the edge a moment too long: spin-out
        state.overEdge = Math.abs(state.slip) > 1 ? state.overEdge + dt : 0;
        if (state.overEdge >= DONUT.SPIN_GRACE) {
            state.overEdge = 0;
            state.spinning = DONUT.SPIN_SECONDS;
            state.speed *= DONUT.SPIN_SPEED_KEPT;
            state.score = Math.max(0, state.score - DONUT.SPIN_PENALTY);
            state.combo = 1;
            events.push({ type: 'spin' });
        }
    }

    // ─── Points: wider and faster donuts score much more, clean ones more still ───
    if (!spinning) {
        const clean = Math.abs(state.slip) < DONUT.CLEAN ? 1.5 : 1;
        const width = state.radius / DONUT.RADIUS_MAX;
        state.score += state.speed * width * width * 4 * clean * state.combo * dt;
    }

    stepPedestrians(state, events);
    state.steps++;
    return events;
}

/** People step onto a crossing now and then and walk across; the car knocks into them. */
function stepPedestrians(state: DonutState, events: DonutEvent[]): void {
    state.nextSpawn -= STEP_S;
    if (state.nextSpawn <= 0) {
        state.nextSpawn = PEDESTRIANS.SPAWN_MIN + random(state) * (PEDESTRIANS.SPAWN_MAX - PEDESTRIANS.SPAWN_MIN);
        const booster = random(state) < PEDESTRIANS.BOOSTER_SHARE;
        const direction = random(state) < 0.5 ? -1 : 1;
        state.pedestrians.push({
            id: state.nextId++, kind: booster ? 'booster' : 'walker', crossing: Math.floor(random(state) * 4),
            along: -direction, direction, speed: booster ? PEDESTRIANS.JOG_SPEED : PEDESTRIANS.WALK_SPEED, hit: false, hitTimer: 0,
        });
    }

    const car = carPosition(state);
    const width = ROAD_HALF_WIDTH + 1;
    for (const p of state.pedestrians) {
        if (p.hit) {
            p.hitTimer -= STEP_S;
            continue;
        }
        p.along += (p.direction * p.speed * STEP_S) / width;
        const at = pedestrianPosition(p);
        if (state.spinning > 0 || Math.hypot(at.x - car.x, at.y - car.y) > PEDESTRIANS.HIT_DISTANCE) continue;
        p.hit = true;
        p.hitTimer = 0.8;
        if (p.kind === 'walker') {
            state.score = Math.max(0, state.score - PEDESTRIANS.HIT_PENALTY);
            state.speed *= PEDESTRIANS.HIT_SPEED_KEPT;
            state.combo = 1;
            events.push({ type: 'hit', kind: 'walker', x: at.x, y: at.y, points: -PEDESTRIANS.HIT_PENALTY });
        } else {
            state.score += PEDESTRIANS.BOOST_POINTS;
            state.speed += PEDESTRIANS.BOOST_SPEED;
            events.push({ type: 'hit', kind: 'booster', x: at.x, y: at.y, points: PEDESTRIANS.BOOST_POINTS });
        }
    }
    // Gone once across, or once knocked down and shown
    state.pedestrians = state.pedestrians.filter(p => (p.hit ? p.hitTimer > 0 : Math.abs(p.along) <= 1.05));
}

/** The game's next random number, 0 to 1, from its own state. */
function random(state: DonutState): number {
    state.rng = (state.rng + 0x6d2b79f5) >>> 0;
    let t = state.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
