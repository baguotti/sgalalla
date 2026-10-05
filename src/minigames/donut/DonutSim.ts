/**
 * DERAPATE's rules: a car doing donuts round the middle of a junction while
 * people cross the road on the zebra crossings. One step of exactly 1/60 s at
 * a time, plain data with its own seeded random numbers (no Phaser, no
 * Math.random), like the other games' simulations.
 *
 * Distances are metres on the ground, the junction's centre at 0,0; angles are
 * radians.
 *
 * The rev bar has two parts: the white (90% of it) and the green. Pedal down,
 * the revs climb steadily through the white; pedal up, they fall and the car
 * rolls to a stop. The speed follows the revs, the donut's width follows the
 * speed, and off the pedal the donut heads back towards the middle at once.
 * Reaching the green locks the speed at the top: keep the pedal down to stay
 * there, but the engine heats up while it's down (the green fills). Held about
 * 3.5 s it overheats and stalls, and the car coasts back to the middle to start
 * again. Lifting cools the engine; a lift shorter than a moment keeps the
 * green, a longer one drops back into the white.
 *
 * The balance (the steering) drifts by itself, more the faster the car goes
 * and more in the green; left/right nudge it back, a gentle pull brings it
 * home, and keeping it in the middle scores a little more. In the white it
 * stops at the edges and nothing is lost; in the green, staying at an edge a
 * moment too long is a testacoda on the spot.
 *
 * People: white ones give points, a burst of speed and build the combo (which
 * raises the top speed); blue ones cost points and knock the car out of the
 * green.
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
    /**
     * White people hit in a row (the combo) raise that top speed, with
     * diminishing returns so it stays in check: +SPEED_BONUS_MAX at most
     * (approached, never reached), +63% of it after SPEED_BONUS_SCALE in a row.
     * At 0.5 and 8: 3 in a row +15%, 5 +23%, 10 +36%. A blue hit, overheating
     * or a testacoda ends the run.
     */
    SPEED_BONUS_MAX: 0.5,
    SPEED_BONUS_SCALE: 8,
    SPEED_FOLLOW: 6,
    /** The donut's width: tightest standing still, widest at top speed (radius, metres), and how fast it changes (m/s). */
    RADIUS_MIN: 2.6,
    RADIUS_MAX: 12,
    GROW: 2.8,
    SHRINK: 6,
    /** Off the pedal the donut tightens towards the middle at least this fast (m/s), even in the green. */
    RETURN: 3,

    /** In the green: seconds of pedal down to overheat, seconds of pedal up to cool fully, and a lift shorter than this keeps the green. */
    OVERHEAT_SECONDS: 3.5,
    COOL_SECONDS: 1,
    LIFT_GRACE: 0.5,
    /** Points in the green count this many times. */
    GREEN_BONUS: 2,
    /** Overheating stalls the engine and costs this many points; the car coasts back to the middle. */
    OVERHEAT_PENALTY: 300,

    /**
     * The balance (-1 to 1): a slow random drift (stronger in the green), the
     * steering's push (at top speed, and the share of it standing still: it
     * grows with the speed), the settling, and a gentle pull back to the
     * middle. Inside the clean band the points count a little more.
     */
    DRIFT: 1.8,
    GREEN_DRIFT: 3.8,
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

    /** The combo multiplier: each white person hit in a row adds this much to it, up to this much. */
    COMBO_STEP: 0.25,
    COMBO_MAX: 5,
};

export const PEDESTRIANS = {
    /** Seconds between new people, at random between these, and at most this many on a crossing at once. */
    SPAWN_MIN: 2.5,
    SPAWN_MAX: 5,
    PER_CROSSING: 1,
    /** Share of them that are white (a boost when hit); the rest are blue. */
    BOOSTER_SHARE: 0.91,
    /** How far up the pavement people appear before walking to their crossing (metres), so you see them coming. */
    APPROACH: 14,
    WALK_SPEED: 1.5,
    JOG_SPEED: 2.3,
    /** Car and person closer than this collide (metres). */
    HIT_DISTANCE: 2.8,
    /** Blue: points lost, and the share of the revs kept (it knocks you out of the green). */
    HIT_PENALTY: 500,
    HIT_REVS_KEPT: 0.4,
    /**
     * White: points gained, extra revs (share of the bar), and a burst of speed
     * above the top (BOOST_SPEED of the base top speed at its peak): it climbs
     * straight to the peak in BOOST_RISE seconds, holds a moment, drops away
     * and eases out over BOOST_FALL seconds (a cosine), back to the speed the
     * car should be at.
     */
    BOOST_POINTS: 50,
    BOOST_REVS: 0.1,
    BOOST_SPEED: 0.3,
    BOOST_RISE: 0.25,
    BOOST_FALL: 1.5,
};

/** Blue people ('walker') cost you; white ones ('booster') give a boost. */
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
    /** Metres still to walk along the pavement before reaching the crossing (they come in from further up the road). */
    approach: number;
}

export interface DonutInput {
    /** The pedal, 0 to 1. */
    throttle: number;
    /** -1 left to 1 right (none: 0). */
    steer?: number;
}

export type DonutEvent =
    | { type: 'hit'; kind: PedestrianKind; x: number; y: number; points: number }
    /** Reaching the green, and leaving it (a long lift or a blue hit). */
    | { type: 'lock' }
    | { type: 'unlock' }
    /** Held too long in the green: the engine stalls and the car coasts back to the middle. */
    | { type: 'overheat' }
    /** At the edge of the balance too long in the green: a testacoda on the spot. */
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
    /** White people hit in a row (they build the combo and raise the top speed), the burst of speed from the last one (m/s), and seconds since it (-1: none). */
    streak: number;
    boost: number;
    boostTime: number;
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
    /** The multiplier on points, built up by white people hit in a row. */
    combo: number;
    pedestrians: Pedestrian[];
    nextSpawn: number;
    nextId: number;
    steps: number;
    rng: number;
}

export function createDonut(seed = 1): DonutState {
    return {
        angle: 0, radius: DONUT.RADIUS_MIN, speed: 0, revs: 0, heat: 0, locked: false, lifted: 0,
        streak: 0, boost: 0, boostTime: -1, spinning: 0, stalled: false,
        slip: 0, slipSpeed: 0, gust: 0, overEdge: 0,
        score: 0, combo: 1, pedestrians: [], nextSpawn: 1.5, nextId: 1, steps: 0, rng: (seed * 2654435761) >>> 0,
    };
}

/** The top speed now: the base, raised by the white people hit in a row (with diminishing returns). */
export function topSpeed(state: DonutState): number {
    const bonus = DONUT.SPEED_BONUS_MAX * (1 - Math.exp(-state.streak / Math.max(0.01, DONUT.SPEED_BONUS_SCALE)));
    return DONUT.SPEED_MAX * (1 + bonus);
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
    // Still on the pavement: further out along the road, away from the centre
    const at = JUNCTION.CROSSING_AT + p.approach;
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
    const pedal = spinning || state.stalled ? 0 : clamp(input.throttle, 0, 1);
    state.lifted = pedal > 0 ? 0 : state.lifted + dt;

    stepRevs(state, pedal, spinning, events);
    stepSpeed(state, pedal);

    // ─── Round and round ───
    state.angle = (state.angle + (state.speed / Math.max(0.5, state.radius)) * dt) % (Math.PI * 2);

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

/** The rev bar: the white filling and emptying with the pedal; in the green, the engine heating and cooling. */
function stepRevs(state: DonutState, pedal: number, spinning: boolean, events: DonutEvent[]): void {
    const dt = STEP_S;
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
        state.revs = Math.max(0, state.revs + (pedal > 0 ? DONUT.REV_UP * pedal * dt : -DONUT.REV_DOWN * dt));
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
}

/** The speed follows the revs (a white person's burst riding on top), and the donut's width follows the speed. */
function stepSpeed(state: DonutState, pedal: number): void {
    const dt = STEP_S;
    const spinning = state.spinning > 0;
    let cruise = state.speed - state.boost;
    const target = spinning ? 0 : topSpeed(state) * whiteShare(state);
    cruise += (target - cruise) * Math.min(1, DONUT.SPEED_FOLLOW * dt);
    if (Math.abs(target - cruise) < 0.01) cruise = target;
    if (state.boostTime >= 0) state.boostTime += dt;
    state.boost = spinning ? 0 : DONUT.SPEED_MAX * PEDESTRIANS.BOOST_SPEED * boostShape(state.boostTime);
    if (state.boost === 0) state.boostTime = -1;
    state.speed = Math.max(0, cruise) + state.boost;

    // Spinning, the car stays where it is: a testacoda on the spot
    if (spinning) return;
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

/**
 * The balance: drifts while the car moves (more the faster it goes), nudged by
 * the steering, pulled gently home, stopped at the edges; in the green,
 * staying at an edge too long is a testacoda.
 */
function stepBalance(state: DonutState, steer: number, events: DonutEvent[]): void {
    const dt = STEP_S;
    state.gust = clamp((state.gust + (random(state) * 2 - 1) * 3 * dt) * (1 - 0.6 * dt), -1, 1);
    // Past the base top speed (the combo) it keeps getting livelier, up to half as much again
    const moving = Math.min(1.5, state.speed / DONUT.SPEED_MAX);
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

/**
 * The burst's shape, 0 to 1, `t` seconds after hitting a white person (-1:
 * none): straight up to the peak, then a cosine down (holding a moment at the
 * top, dropping, easing out at the bottom).
 */
export function boostShape(t: number): number {
    if (t < 0) return 0;
    const rise = Math.max(0.01, PEDESTRIANS.BOOST_RISE);
    if (t < rise) return t / rise;
    const u = (t - rise) / Math.max(0.05, PEDESTRIANS.BOOST_FALL);
    return u >= 1 ? 0 : 0.5 * (1 + Math.cos(Math.PI * u));
}

/** The run of white people ends: no combo, back to the base top speed. */
function endStreak(state: DonutState): void {
    state.streak = 0;
    state.combo = 1;
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
    endStreak(state);
    events.push({ type: 'overheat' });
}

/** Losing the balance in the green: a testacoda on the spot (the car stays where it is), most of the revs lost, points lost. */
function spinOut(state: DonutState, events: DonutEvent[]): void {
    state.locked = false;
    state.revs = DONUT.GREEN_AT * DONUT.SPIN_REVS_KEPT;
    state.heat = 0;
    state.speed = 0;
    state.boost = 0;
    state.boostTime = -1;
    state.spinning = DONUT.SPIN_SECONDS;
    state.overEdge = 0;
    state.score = Math.max(0, state.score - DONUT.SPIN_PENALTY);
    endStreak(state);
    events.push({ type: 'spin' });
}

/** People step onto a free crossing now and then and walk across; the car knocks into them. */
function stepPedestrians(state: DonutState, events: DonutEvent[]): void {
    state.nextSpawn -= STEP_S;
    if (state.nextSpawn <= 0) {
        state.nextSpawn = PEDESTRIANS.SPAWN_MIN + random(state) * (PEDESTRIANS.SPAWN_MAX - PEDESTRIANS.SPAWN_MIN);
        spawnPedestrian(state);
    }

    const car = carPosition(state);
    const width = JUNCTION.ROAD_HALF_WIDTH + 1;
    // Everyone moves; those gone (across, or knocked down and shown) are dropped in place, keeping the order
    let kept = 0;
    for (const p of state.pedestrians) {
        if (p.hit) {
            p.hitTimer -= STEP_S;
        } else {
            // Up the pavement first, then across
            if (p.approach > 0) p.approach = Math.max(0, p.approach - p.speed * STEP_S);
            else p.along += (p.direction * p.speed * STEP_S) / width;
            // Standing still or spinning on the spot, the car hits no one
            if (state.spinning === 0 && state.speed >= 0.5) {
                const at = pedestrianPosition(p);
                if (Math.hypot(at.x - car.x, at.y - car.y) <= PEDESTRIANS.HIT_DISTANCE) knockDown(state, p, at, events);
            }
        }
        if (p.hit ? p.hitTimer > 0 : Math.abs(p.along) <= 1.05) state.pedestrians[kept++] = p;
    }
    state.pedestrians.length = kept;
}

/** Someone onto a crossing with room (people knocked down don't count), white or blue, from either kerb. */
function spawnPedestrian(state: DonutState): void {
    const onCrossing = [0, 0, 0, 0];
    for (const p of state.pedestrians) if (!p.hit) onCrossing[p.crossing]++;
    const free = [0, 1, 2, 3].filter(c => onCrossing[c] < PEDESTRIANS.PER_CROSSING);
    if (free.length === 0) return;
    const crossing = free[Math.floor(random(state) * free.length)];
    const booster = random(state) < PEDESTRIANS.BOOSTER_SHARE;
    const direction = random(state) < 0.5 ? -1 : 1;
    state.pedestrians.push({
        id: state.nextId++, kind: booster ? 'booster' : 'walker', crossing,
        along: -direction, direction, speed: booster ? PEDESTRIANS.JOG_SPEED : PEDESTRIANS.WALK_SPEED,
        hit: false, hitTimer: 0, approach: PEDESTRIANS.APPROACH,
    });
}

/** The car hits someone: blue costs points and the green, white gives points, revs, a burst and the combo. */
function knockDown(state: DonutState, p: Pedestrian, at: { x: number; y: number }, events: DonutEvent[]): void {
    p.hit = true;
    p.hitTimer = 0.8;
    if (p.kind === 'walker') {
        state.score = Math.max(0, state.score - PEDESTRIANS.HIT_PENALTY);
        endStreak(state);
        unlock(state, events, state.revs);
        state.revs *= PEDESTRIANS.HIT_REVS_KEPT;
        events.push({ type: 'hit', kind: 'walker', x: at.x, y: at.y, points: -PEDESTRIANS.HIT_PENALTY });
    } else {
        state.score += PEDESTRIANS.BOOST_POINTS;
        state.streak++;
        state.combo = Math.min(DONUT.COMBO_MAX, 1 + state.streak * DONUT.COMBO_STEP);
        state.boostTime = 0;
        if (!state.locked) state.revs = Math.min(DONUT.GREEN_AT, state.revs + PEDESTRIANS.BOOST_REVS);
        events.push({ type: 'hit', kind: 'booster', x: at.x, y: at.y, points: PEDESTRIANS.BOOST_POINTS });
    }
}

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

/** The game's next random number, 0 to 1, from its own state. */
function random(state: DonutState): number {
    state.rng = (state.rng + 0x6d2b79f5) >>> 0;
    let t = state.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
