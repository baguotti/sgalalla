/**
 * DERAPATE's rules: a car doing donuts round the middle of a junction while
 * people cross the road on the zebra crossings. One step of exactly 1/60 s at
 * a time, plain data with its own seeded random numbers (no Phaser, no
 * Math.random), like the other games' simulations.
 *
 * Distances are metres on the ground, the junction's centre at 0,0; angles
 * are radians. The pedal snaps down and up in a moment and the revs follow it
 * fast: revs make the car faster and the donut wider, and drop when the pedal
 * comes up. Every stab of the pedal kicks the tail out (harder the faster the
 * car goes), every lift snaps it back the other way. The drift has to be
 * balanced like a stick on a finger: it tips further by itself, and left/right
 * counter-steer; lose it and the car spins out. Blipping the pedal in rhythm
 * keeps the revs in the sweet spot, which scores double; flat out, the engine
 * hits the red line and pushes the tail out harder and harder.
 */

export const STEP_S = 1 / 60;

/**
 * The junction: half the road's width, where the middle of each zebra crossing
 * is from the centre, and how wide the crossings are. (The Lab changes these
 * and every number below live: they're plain objects on purpose.)
 */
export const JUNCTION = {
    ROAD_HALF_WIDTH: 7,
    CROSSING_AT: 10,
    CROSSING_WIDTH: 3.2,
};

export const DONUT = {
    /** Where on the junction the donut circles round (metres from its centre). */
    CENTRE_X: 0,
    CENTRE_Y: 0,
    RADIUS_MIN: 2.6,
    RADIUS_MAX: 12,
    /** How fast the donut widens towards the revs' size, tightens back, and tightens on the brake (metres a second). */
    GROW: 7,
    SHRINK: 4,
    BRAKE_SHRINK: 5,
    SPEED_MIN: 4,
    SPEED_MAX: 18,
    /** How quickly the speed follows the revs (share a second), and the brake's slowing (m/s²). */
    SPEED_FOLLOW: 3,
    BRAKE: 12,

    /** Seconds for the pedal to go all the way down or up. */
    PEDAL_TIME: 0.1,
    /** Revs (0 to 1) climbing towards the pedal and falling when it's up, share a second; the brake drops them faster. */
    REV_UP: 2.5,
    REV_DOWN: 1.5,
    REV_BRAKE: 3,
    /** The red line: revs past it add no speed or width, only push the tail out. Between the sweet spot's start and it, points count double. */
    REV_RED: 0.88,
    SWEET_LOW: 0.55,
    SWEET_BONUS: 2,
    /** A stab of the pedal kicks the tail out, a lift snaps it back, more the further out it is (balance speed, full pedal travel, at top speed). */
    KICK: 2.5,
    /** The kick isn't instant: it pushes the tail out over about this long (seconds), so the balance has time to be caught. Lifting ends it. */
    KICK_TIME: 0.5,
    SNAP: 2,
    /** Lifting only brings the tail back once it's at least this far out: below it, keeping it straight is the steering's job. */
    SNAP_FROM: 0.6,
    /** How much each stab's kick varies, either way (share). */
    BITE_SPREAD: 0.35,
    /** The push on the tail at the limiter, building up over this many seconds there: more than steering can hold. */
    OVERREV_PUSH: 3.5,
    LIMITER_BUILD: 4,

    /** Balance (slip): -1 and 1 are the edges, past them the car spins out. */
    TIP: 0.35,
    /** A light random wobble (more at the limiter), and the steady push of the revs on the tail. */
    WOBBLE: 0.3,
    THROTTLE_PUSH: 0.6,
    /** Counter-steering at full lock (gentle, so it's hard to overcorrect), and the damping that settles the swing. */
    STEER: 3,
    DAMPING: 4,
    /** Past the edge, the car spins out only after staying there this long: a quick correction saves it. */
    SPIN_GRACE: 0.35,
    /** Inside this band, the drift is "clean" and scores more. */
    CLEAN: 0.35,
    /** Loops at least this wide build the combo, by this much a loop, up to this much. */
    COMBO_RADIUS: 7,
    COMBO_STEP: 0.25,
    COMBO_MAX: 5,

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
    /** The pedal (0 to 1, a moment behind the key) and the engine's revs (0 to 1, the red line at REV_RED). */
    pedal: number;
    revs: number;
    /** How hard the tyres bit on this stab of the pedal (around 1). */
    bite: number;
    /** What's left of the stab's push on the tail (fading over KICK_TIME). */
    kick: number;
    /** Seconds spent bouncing off the limiter (eases off quickly once the revs drop). */
    limiter: number;
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
        angle: 0, radius: 5, speed: DONUT.SPEED_MIN, pedal: 0, revs: 0, bite: 0, kick: 0, limiter: 0, slip: 0, slipSpeed: 0, gust: 0, spinning: 0, overEdge: 0,
        score: 0, combo: 1, loopProgress: 0, pedestrians: [], nextSpawn: 1.5, nextId: 1, steps: 0, rng: (seed * 2654435761) >>> 0,
    };
}

/** Revs between the sweet spot's start and the red line: points count double. */
export function inSweetSpot(state: DonutState): boolean {
    return state.revs >= DONUT.SWEET_LOW && state.revs <= DONUT.REV_RED;
}

/** Where the car is on the ground. */
export function carPosition(state: DonutState): { x: number; y: number } {
    return { x: DONUT.CENTRE_X + Math.cos(state.angle) * state.radius, y: DONUT.CENTRE_Y + Math.sin(state.angle) * state.radius };
}

/** Where a person is on the ground. */
export function pedestrianPosition(p: Pedestrian): { x: number; y: number } {
    const across = p.along * (JUNCTION.ROAD_HALF_WIDTH + 1);
    const at = JUNCTION.CROSSING_AT;
    switch (p.crossing) {
        case 0: return { x: across, y: -at };
        case 1: return { x: at, y: across };
        case 2: return { x: across, y: at };
        default: return { x: -at, y: across };
    }
}

export function stepDonut(state: DonutState, input: DonutInput, events: DonutEvent[] = []): DonutEvent[] {
    const dt = STEP_S;
    const spinning = state.spinning > 0;
    const throttle = spinning ? 0 : input.throttle;
    const brake = spinning ? 0 : input.brake;
    const steer = spinning ? 0 : input.steer;

    // ─── The pedal snaps down and up; the revs follow it ───
    const pedalBefore = state.pedal;
    const travel = dt / DONUT.PEDAL_TIME;
    state.pedal = throttle > state.pedal ? Math.min(throttle, state.pedal + travel) : Math.max(throttle, state.pedal - travel);
    const pressed = state.pedal - pedalBefore;
    const revRate = state.pedal > state.revs ? DONUT.REV_UP : DONUT.REV_DOWN + DONUT.REV_BRAKE * brake;
    state.revs += (state.pedal - state.revs) * Math.min(1, revRate * dt);
    /** How much the revs drive the car (full at the red line), and how far past it the engine is. */
    const drive = Math.min(1, state.revs / DONUT.REV_RED);
    const overRev = Math.max(0, (state.revs - DONUT.REV_RED) / (1 - DONUT.REV_RED));
    state.limiter = overRev > 0.3 ? state.limiter + dt : Math.max(0, state.limiter - 2 * dt);

    // ─── The revs set the donut: speed and size, quickly ───
    const speedTarget = spinning ? DONUT.SPEED_MIN * 0.3 : DONUT.SPEED_MIN + (DONUT.SPEED_MAX - DONUT.SPEED_MIN) * drive;
    // Above it (after a boost) it eases back down the same way
    state.speed += (speedTarget - state.speed) * Math.min(1, DONUT.SPEED_FOLLOW * dt);
    state.speed -= DONUT.BRAKE * brake * dt;
    state.speed = Math.max(DONUT.SPEED_MIN * (spinning ? 0.3 : 1), state.speed);

    const radiusTarget = DONUT.RADIUS_MIN + (DONUT.RADIUS_MAX - DONUT.RADIUS_MIN) * drive;
    if (state.radius < radiusTarget) state.radius = Math.min(radiusTarget, state.radius + DONUT.GROW * dt);
    else state.radius = Math.max(radiusTarget, state.radius - DONUT.SHRINK * dt);
    state.radius -= DONUT.BRAKE_SHRINK * brake * dt;
    state.radius = Math.max(DONUT.RADIUS_MIN, Math.min(DONUT.RADIUS_MAX, state.radius));

    // ─── Round and round ───
    const turned = (state.speed / state.radius) * dt;
    state.angle = (state.angle + turned) % (Math.PI * 2);
    state.loopProgress += turned;
    if (state.loopProgress >= Math.PI * 2) {
        state.loopProgress -= Math.PI * 2;
        // Only wide loops build the combo: tight safe circles don't
        if (!spinning && state.radius >= DONUT.COMBO_RADIUS) {
            state.combo = Math.min(DONUT.COMBO_MAX, state.combo + DONUT.COMBO_STEP);
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
        // The gust wanders slowly, harder the faster the car goes and at the limiter
        state.gust += (random(state) * 2 - 1) * 3 * dt;
        state.gust *= 1 - 0.6 * dt;
        state.gust = Math.max(-1, Math.min(1, state.gust));
        const share = state.speed / DONUT.SPEED_MAX;
        // A stab of the pedal kicks the tail out, a lift snaps it back: harder the faster the car goes
        const punch = 0.4 + share;
        // (the tyres bite differently every time; the further out the tail is when the grip comes back, the harder it swings back, past the middle)
        if (pressed > 0) {
            if (pedalBefore === 0 || state.bite === 0) state.bite = 1 - DONUT.BITE_SPREAD + random(state) * 2 * DONUT.BITE_SPREAD;
            state.kick += (DONUT.KICK * state.bite * pressed * punch) / DONUT.KICK_TIME;
        } else if (pressed < 0) {
            state.kick = 0;
            state.slipSpeed += DONUT.SNAP * pressed * punch * Math.max(0, state.slip - DONUT.SNAP_FROM);
        }
        const kick = state.kick;
        state.kick *= 1 - Math.min(1, dt / DONUT.KICK_TIME);
        const push = state.slip * DONUT.TIP + state.gust * DONUT.WOBBLE * (0.4 + share + overRev * 2)
            + kick + drive * DONUT.THROTTLE_PUSH * share + overRev * DONUT.OVERREV_PUSH * Math.min(1, state.limiter / DONUT.LIMITER_BUILD)
            - steer * DONUT.STEER - state.slipSpeed * DONUT.DAMPING;
        state.slipSpeed += push * dt;
        state.slip += state.slipSpeed * dt;
        // Held past the edge a moment too long: spin-out
        state.overEdge = Math.abs(state.slip) > 1 ? state.overEdge + dt : 0;
        if (state.overEdge >= DONUT.SPIN_GRACE) {
            state.overEdge = 0;
            state.spinning = DONUT.SPIN_SECONDS;
            state.speed *= DONUT.SPIN_SPEED_KEPT;
            state.revs *= DONUT.SPIN_SPEED_KEPT;
            state.kick = 0;
            state.score = Math.max(0, state.score - DONUT.SPIN_PENALTY);
            state.combo = 1;
            events.push({ type: 'spin' });
        }
    }

    // ─── Points: wider and faster donuts score much more, clean ones and revs in the sweet spot more still ───
    if (!spinning) {
        const clean = Math.abs(state.slip) < DONUT.CLEAN ? 1.5 : 1;
        const sweet = inSweetSpot(state) ? DONUT.SWEET_BONUS : 1;
        const width = state.radius / DONUT.RADIUS_MAX;
        state.score += state.speed * width * width * 4 * clean * sweet * state.combo * dt;
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
    const width = JUNCTION.ROAD_HALF_WIDTH + 1;
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
