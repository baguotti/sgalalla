/**
 * DERAPATE's rules: a car doing donuts round the middle of a junction while
 * people cross the road on the zebra crossings. One step of exactly 1/60 s at
 * a time, plain data with its own seeded random numbers (no Phaser, no
 * Math.random), like the other games' simulations.
 *
 * Distances are metres on the ground, the junction's centre at 0,0; angles
 * are radians. The steering is light: the balance drifts by itself, more the
 * faster the car goes (and more in the green), left/right nudge it back, a
 * gentle pull brings it home, and keeping it in the middle scores a little
 * more. In the white it stops at the edges and nothing is lost; in the green,
 * staying at an edge a moment too long is a testacoda on the spot. The rev
 * bar has
 * two parts: the white, 90% of it, and the green. Pedal down, the revs climb
 * steadily through the white; pedal up, they fall and the car rolls to a stop.
 * The car's speed follows the revs and the donut's width follows the speed.
 * Off the pedal the donut heads back towards the middle at once. Reaching the
 * green locks the speed at the top; keep the pedal down to stay there, but
 * the engine heats up while it's down (the green fills): held about 3 s it
 * overheats and stalls, and the car coasts back to the middle to start again.
 * Lifting cools the engine; a lift shorter than a moment keeps the green,
 * longer and the revs drop back into the white.
 */

export const STEP_S = 1 / 60;

/**
 * The junction: half the road's width, where the middle of each zebra crossing
 * is from the centre, and how wide the crossings are. (The Lab changes these
 * and every number below live: they're plain objects on purpose.)
 */
export const JUNCTION = {
    ROAD_HALF_WIDTH: 10.2,
    CROSSING_AT: 12.8,
    CROSSING_WIDTH: 4.4,
};

export const DONUT = {
    /** Where on the junction the donut circles round (metres from its centre). */
    CENTRE_X: 0,
    CENTRE_Y: 0,

    /** Revs (0 to 1) climbing with the pedal down and falling with it up (share of the bar a second). */
    REV_UP: 0.6,
    REV_DOWN: 0.6,
    /** Where the green starts: the white is the bar below it. */
    GREEN_AT: 0.9,

    /** The car's speed at the top of the white (and in the green), and how quickly it follows the revs (share a second). */
    SPEED_MAX: 18,
    SPEED_FOLLOW: 6,
    /** The donut's width: tightest standing still, widest at top speed (radius, metres), and how fast it changes (m/s). */
    RADIUS_MIN: 2.6,
    RADIUS_MAX: 12,
    GROW: 2.8,
    SHRINK: 6,

    /** In the green: seconds of pedal down to overheat, seconds of pedal up to cool fully, and a lift shorter than this keeps the green. */
    OVERHEAT_SECONDS: 3.5,
    COOL_SECONDS: 1,
    LIFT_GRACE: 0.5,
    /** Points in the green count this many times. */
    GREEN_BONUS: 2,

    /** Overheating stalls the engine and costs this many points; the car coasts back to the middle. */
    OVERHEAT_PENALTY: 300,
    /** Off the pedal the donut tightens towards the middle at least this fast (m/s), even in the green. */
    RETURN: 3,

    /**
     * The balance (-1 to 1): a slow random drift (stronger in the green), the
     * steering's push, the settling, and a gentle pull back to the middle. It
     * stops at the edges: nothing is lost there. Inside the clean band the
     * points count a little more.
     */
    DRIFT: 1.8,
    GREEN_DRIFT: 3.8,
    /** The steering's push at top speed, and the share of it standing still (it grows with the speed). */
    STEER: 12,
    STEER_SLOW: 0.15,
    DAMPING: 4,
    CENTRING: 0.8,
    CLEAN: 0.35,
    CLEAN_BONUS: 1.25,
    /** In the green only: at the edge (|balance| at least EDGE) for EDGE_GRACE seconds is a testacoda, costing SPIN_PENALTY. */
    EDGE: 0.97,
    EDGE_GRACE: 0.5,
    SPIN_PENALTY: 300,
    /** The testacoda: how long it spins on the spot, and the share of the white's revs kept after it. */
    SPIN_SECONDS: 1.6,
    SPIN_REVS_KEPT: 0.4,
    /** The balance pushes the car out (or in) of its circle by up to this much (metres): losing control. */
    SLIP_SHIFT: 1.5,

    /** Loops at least this wide build the combo, by this much a loop, up to this much. */
    COMBO_RADIUS: 7,
    COMBO_STEP: 0.25,
    COMBO_MAX: 5,
};

export const PEDESTRIANS = {
    /** Seconds between new people, at random between these, and at most this many on a crossing at once. */
    SPAWN_MIN: 2.5,
    SPAWN_MAX: 5,
    PER_CROSSING: 1,
    /** Share of them that are type 2 (a boost when hit). */
    BOOSTER_SHARE: 0.91,
    WALK_SPEED: 1.5,
    JOG_SPEED: 2.3,
    /** Car and person closer than this collide (metres). */
    HIT_DISTANCE: 2.8,
    /** Type 1: points lost, and the share of the revs kept (it knocks you out of the green). */
    HIT_PENALTY: 500,
    HIT_REVS_KEPT: 0.4,
    /** Type 2: points gained and extra revs (share of the bar). */
    BOOST_POINTS: 50,
    BOOST_REVS: 0.1,
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
    /** The pedal, 0 to 1. */
    throttle: number;
    /** -1 left to 1 right (none: 0). */
    steer?: number;
}

export type DonutEvent =
    | { type: 'hit'; kind: PedestrianKind; x: number; y: number; points: number }
    | { type: 'loop' }
    /** Reaching the green, and leaving it (a long lift or a red hit). */
    | { type: 'lock' }
    | { type: 'unlock' }
    /** Held too long in the green: back to the start, testacoda on the spot. */
    | { type: 'overheat' }
    /** At the edge of the balance too long in the green: the same. */
    | { type: 'spin' };

export interface DonutState {
    /** Where the car is round the centre, how far out, and how fast it goes. */
    angle: number;
    radius: number;
    speed: number;
    /** The rev bar, 0 to 1: the white below GREEN_AT; in the green it shows the engine's heat. */
    revs: number;
    /** The engine's heat in the green, 0 to 1 (1 overheats). */
    heat: number;
    /** In the green (the speed locked at the top). */
    locked: boolean;
    /** Seconds with the pedal up. */
    lifted: number;
    /** Seconds of testacoda left. */
    spinning: number;
    /** The engine stalled after overheating: coasting back to the middle, the pedal dead until the revs run out. */
    stalled: boolean;
    /** The balance, -1 to 1 (0 is the middle), how fast it's moving, and the slow random drift on it. */
    slip: number;
    slipSpeed: number;
    gust: number;
    /** Seconds at the edge of the balance in the green. */
    overEdge: number;
    score: number;
    /** Multiplier built up by wide loops, reset by a red hit or overheating. */
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
        angle: 0, radius: DONUT.RADIUS_MIN, speed: 0, revs: 0, heat: 0, locked: false, lifted: 0, spinning: 0, stalled: false, slip: 0, slipSpeed: 0, gust: 0, overEdge: 0,
        score: 0, combo: 1, loopProgress: 0, pedestrians: [], nextSpawn: 1.5, nextId: 1, steps: 0, rng: (seed * 2654435761) >>> 0,
    };
}

/** How far along the white the revs are (1 at the green and in it). */
export function whiteShare(state: DonutState): number {
    return Math.min(1, state.revs / DONUT.GREEN_AT);
}

/** Where the car is on the ground. */
export function carPosition(state: DonutState): { x: number; y: number } {
    const r = drawnRadius(state.radius, state.slip);
    return { x: DONUT.CENTRE_X + Math.cos(state.angle) * r, y: DONUT.CENTRE_Y + Math.sin(state.angle) * r };
}

/** The car's distance from the centre: its circle, pushed out or in by the balance. */
export function drawnRadius(radius: number, slip: number): number {
    return Math.max(0.5, radius + slip * DONUT.SLIP_SHIFT);
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
    // Spinning, or the engine stalled after overheating: the pedal does nothing
    const pedal = spinning || state.stalled ? 0 : Math.max(0, Math.min(1, input.throttle));
    state.lifted = pedal > 0 ? 0 : state.lifted + dt;

    // ─── The rev bar ───
    if (spinning) {
        state.spinning = Math.max(0, state.spinning - dt);
    } else if (state.locked) {
        if (pedal > 0) {
            // Pedal down in the green: the engine heats up
            state.heat += (pedal * dt) / DONUT.OVERHEAT_SECONDS;
        } else {
            state.heat -= dt / DONUT.COOL_SECONDS;
            // Off the pedal too long: back into the white
            if (state.lifted >= DONUT.LIFT_GRACE) unlock(state, events, DONUT.GREEN_AT - 0.01);
        }
        state.heat = Math.max(0, state.heat);
        if (state.heat >= 1) overheat(state, events);
    } else {
        state.revs += pedal > 0 ? DONUT.REV_UP * pedal * dt : -DONUT.REV_DOWN * dt;
        state.revs = Math.max(0, state.revs);
        state.heat = Math.max(0, state.heat - dt / DONUT.COOL_SECONDS);
        // Stalled: the car coasts back to the middle; once the revs are gone it can start again
        if (state.stalled && state.revs === 0) state.stalled = false;
        if (state.revs >= DONUT.GREEN_AT) {
            state.locked = true;
            events.push({ type: 'lock' });
        }
    }
    // In the green the bar shows the heat: full is overheating
    if (state.locked) state.revs = DONUT.GREEN_AT + (1 - DONUT.GREEN_AT) * Math.min(1, state.heat);

    // ─── Speed follows the revs, the donut's width follows the speed ───
    const speedTarget = state.spinning > 0 ? 0 : DONUT.SPEED_MAX * whiteShare(state);
    state.speed += (speedTarget - state.speed) * Math.min(1, DONUT.SPEED_FOLLOW * dt);
    if (Math.abs(speedTarget - state.speed) < 0.01) state.speed = speedTarget;
    // (spinning, the car stays where it is: a testacoda on the spot)
    if (state.spinning === 0) {
        const radiusTarget = DONUT.RADIUS_MIN + (DONUT.RADIUS_MAX - DONUT.RADIUS_MIN) * Math.min(1, state.speed / DONUT.SPEED_MAX);
        if (pedal === 0) {
            // Off the pedal it heads back towards the middle straight away, even in the green
            const following = state.radius > radiusTarget ? Math.max(radiusTarget, state.radius - DONUT.SHRINK * dt) : state.radius;
            state.radius = Math.max(DONUT.RADIUS_MIN, Math.min(following, state.radius - DONUT.RETURN * dt));
        } else if (state.radius < radiusTarget) {
            state.radius = Math.min(radiusTarget, state.radius + DONUT.GROW * dt);
        } else {
            state.radius = Math.max(radiusTarget, state.radius - DONUT.SHRINK * dt);
        }
    }

    // ─── Round and round ───
    const turned = (state.speed / Math.max(0.5, state.radius)) * dt;
    state.angle = (state.angle + turned) % (Math.PI * 2);
    state.loopProgress += turned;
    if (state.loopProgress >= Math.PI * 2) {
        state.loopProgress -= Math.PI * 2;
        // Only wide loops build the combo: tight safe circles don't
        if (state.radius >= DONUT.COMBO_RADIUS) {
            state.combo = Math.min(DONUT.COMBO_MAX, state.combo + DONUT.COMBO_STEP);
            events.push({ type: 'loop' });
        }
    }

    stepBalance(state, state.spinning > 0 ? 0 : input.steer ?? 0, events);

    // ─── Points: wider and faster donuts score much more, the green and a clean balance more still ───
    if (state.spinning === 0) {
        const width = state.radius / DONUT.RADIUS_MAX;
        const clean = Math.abs(state.slip) < DONUT.CLEAN ? DONUT.CLEAN_BONUS : 1;
        state.score += state.speed * width * width * 4 * (state.locked ? DONUT.GREEN_BONUS : 1) * clean * state.combo * dt;
    }

    stepPedestrians(state, events);
    state.steps++;
    return events;
}

/**
 * The balance: drifts while the car moves (more the faster it goes), nudged by
 * the steering, pulled gently home, stopped at the edges; in the green,
 * staying at an edge too long is a testacoda.
 */
function stepBalance(state: DonutState, steer: number, events: DonutEvent[]): void {
    const dt = STEP_S;
    state.gust += (random(state) * 2 - 1) * 3 * dt;
    state.gust *= 1 - 0.6 * dt;
    state.gust = Math.max(-1, Math.min(1, state.gust));
    const moving = Math.min(1, state.speed / DONUT.SPEED_MAX);
    const drift = state.gust * DONUT.DRIFT * moving * (state.locked ? DONUT.GREEN_DRIFT : 1);
    // Standing still or spinning, it settles back to the middle
    const centring = state.spinning > 0 || moving === 0 ? DONUT.CENTRING * 4 : DONUT.CENTRING;
    // The steering bites harder the faster the car goes
    const steering = DONUT.STEER * (DONUT.STEER_SLOW + (1 - DONUT.STEER_SLOW) * moving);
    state.slipSpeed += (drift - steer * steering - state.slip * centring - state.slipSpeed * DONUT.DAMPING) * dt;
    state.slip += state.slipSpeed * dt;
    if (Math.abs(state.slip) > 1) {
        state.slip = Math.sign(state.slip);
        if (state.slipSpeed * state.slip > 0) state.slipSpeed = 0;
    }
    state.overEdge = state.locked && Math.abs(state.slip) >= DONUT.EDGE ? state.overEdge + dt : 0;
    if (state.overEdge >= DONUT.EDGE_GRACE) spinOut(state, events);
}

/** Out of the green: the revs back to `revs` (in the white), to be built up again. */
function unlock(state: DonutState, events: DonutEvent[], revs: number): void {
    if (!state.locked) return;
    state.locked = false;
    state.revs = Math.min(revs, DONUT.GREEN_AT - 0.01);
    events.push({ type: 'unlock' });
}

/**
 * The engine gives out: it stalls, the pedal does nothing and the car coasts
 * back to the middle (the revs and the speed run down, the donut tightens),
 * then it can start again. Points lost, combo gone.
 */
function overheat(state: DonutState, events: DonutEvent[]): void {
    state.locked = false;
    state.stalled = true;
    state.revs = DONUT.GREEN_AT - 0.01;
    state.heat = 0;
    state.score = Math.max(0, state.score - DONUT.OVERHEAT_PENALTY);
    state.combo = 1;
    events.push({ type: 'overheat' });
}

/** Losing the balance in the green: a testacoda on the spot (the car stays where it is), most of the revs lost, points lost. */
function spinOut(state: DonutState, events: DonutEvent[]): void {
    state.locked = false;
    state.revs = DONUT.GREEN_AT * DONUT.SPIN_REVS_KEPT;
    state.heat = 0;
    state.speed = 0;
    state.spinning = DONUT.SPIN_SECONDS;
    state.overEdge = 0;
    state.score = Math.max(0, state.score - DONUT.SPIN_PENALTY);
    state.combo = 1;
    events.push({ type: 'spin' });
}

/** People step onto a free crossing now and then and walk across; the car knocks into them. */
function stepPedestrians(state: DonutState, events: DonutEvent[]): void {
    state.nextSpawn -= STEP_S;
    if (state.nextSpawn <= 0) {
        state.nextSpawn = PEDESTRIANS.SPAWN_MIN + random(state) * (PEDESTRIANS.SPAWN_MAX - PEDESTRIANS.SPAWN_MIN);
        // Only onto a crossing with room (people knocked down don't count)
        const free = [0, 1, 2, 3].filter(c => state.pedestrians.filter(p => !p.hit && p.crossing === c).length < PEDESTRIANS.PER_CROSSING);
        if (free.length > 0) {
            const crossing = free[Math.floor(random(state) * free.length)];
            const booster = random(state) < PEDESTRIANS.BOOSTER_SHARE;
            const direction = random(state) < 0.5 ? -1 : 1;
            state.pedestrians.push({
                id: state.nextId++, kind: booster ? 'booster' : 'walker', crossing,
                along: -direction, direction, speed: booster ? PEDESTRIANS.JOG_SPEED : PEDESTRIANS.WALK_SPEED, hit: false, hitTimer: 0,
            });
        }
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
        // Standing still or spinning on the spot, the car hits no one
        if (state.spinning > 0 || state.speed < 0.5 || Math.hypot(at.x - car.x, at.y - car.y) > PEDESTRIANS.HIT_DISTANCE) continue;
        p.hit = true;
        p.hitTimer = 0.8;
        if (p.kind === 'walker') {
            state.score = Math.max(0, state.score - PEDESTRIANS.HIT_PENALTY);
            state.combo = 1;
            unlock(state, events, state.revs);
            state.revs *= PEDESTRIANS.HIT_REVS_KEPT;
            events.push({ type: 'hit', kind: 'walker', x: at.x, y: at.y, points: -PEDESTRIANS.HIT_PENALTY });
        } else {
            state.score += PEDESTRIANS.BOOST_POINTS;
            if (!state.locked) state.revs = Math.min(DONUT.GREEN_AT, state.revs + PEDESTRIANS.BOOST_REVS);
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
