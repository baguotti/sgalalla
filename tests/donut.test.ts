/**
 * DERAPATE's rules: the white part of the rev bar fills steadily with the
 * pedal and empties without it, the donut's width follows the speed, the
 * green holds the speed but heats the engine until it overheats (it stalls
 * and coasts back to the middle), the balance is forgiving but a moment at
 * its edge in the green is a testacoda, white people in a row raise the top
 * speed and give a burst, blue ones cost; and the same seed and controls
 * always play out the same.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONUT, PEDESTRIANS, boostShape, carPosition, createDonut, stepDonut, topSpeed, type DonutEvent, type DonutInput } from '../src/minigames/donut/DonutSim.ts';

const steps = (s: ReturnType<typeof createDonut>, n: number, input: DonutInput, events: DonutEvent[] = []) => {
    for (let i = 0; i < n; i++) stepDonut(s, input, events);
    return events;
};
/** Steps from standing to the green with the pedal down, and a little more to settle at top speed. */
const toGreen = () => Math.ceil((DONUT.GREEN_AT / DONUT.REV_UP) * 60);
const intoGreen = () => toGreen() + 20;
const fresh = (seed: number) => {
    const s = createDonut(seed);
    s.nextSpawn = Infinity;
    return s;
};

test('without the pedal the car stands still', () => {
    const s = fresh(1);
    const start = carPosition(s);
    steps(s, 300, { throttle: 0 });
    const end = carPosition(s);
    assert.equal(s.speed, 0);
    assert.ok(Math.hypot(end.x - start.x, end.y - start.y) < 1e-9, 'it hasn\'t moved');
});

test('the pedal fills the white steadily, about 1.5 s to the green; the donut widens with the speed', () => {
    const s = fresh(2);
    assert.ok(Math.abs(toGreen() / 60 - 1.5) < 0.05, `${(toGreen() / 60).toFixed(2)} s to the green`);
    const half = Math.floor(toGreen() / 2);
    steps(s, half, { throttle: 1 });
    assert.ok(Math.abs(s.revs - (DONUT.REV_UP * half) / 60) < 0.01, `half way: revs ${s.revs.toFixed(2)}`);
    assert.ok(!s.locked);
    const halfRadius = s.radius;
    const events = steps(s, toGreen() - half + 1, { throttle: 1 });
    assert.ok(s.locked && events.some(e => e.type === 'lock'), 'in the green');
    assert.ok(s.radius > halfRadius + 2, `wider at speed: ${halfRadius.toFixed(1)} → ${s.radius.toFixed(1)} m`);
});

test('letting go in the white empties the bar and the car rolls to a stop', () => {
    const s = fresh(3);
    steps(s, Math.floor(toGreen() * 0.8), { throttle: 1 });
    assert.ok(!s.locked && s.speed > 10, `speed ${s.speed.toFixed(1)}`);
    steps(s, 150, { throttle: 0 });
    assert.equal(s.revs, 0);
    assert.ok(s.speed < 0.05, `stopped (${s.speed.toFixed(2)})`);
    assert.ok(s.radius < DONUT.RADIUS_MIN + 0.1, `tight again (${s.radius.toFixed(2)})`);
});

test('in the green the speed holds; held about 3 s the engine overheats and stalls: the car coasts back to the middle', () => {
    const s = fresh(4);
    steps(s, intoGreen(), { throttle: 1 });
    assert.ok(s.locked);
    const events: DonutEvent[] = [];
    let held = 0;
    let before = 0;
    while (!events.some(e => e.type === 'overheat') && held < 600) {
        before = s.score;
        stepDonut(s, { throttle: 1, steer: Math.abs(s.slip) > 0.25 ? Math.sign(s.slip) : 0 }, events);
        held++;
        if (held > 30 && !events.some(e => e.type === 'overheat')) assert.ok(Math.abs(s.speed - DONUT.SPEED_MAX) < 0.01, `speed held in the green (${s.speed.toFixed(2)})`);
    }
    // (it reached the green about 20 steps before)
    assert.ok(Math.abs((held + 20) / 60 - DONUT.OVERHEAT_SECONDS) < 0.1, `overheated ${((held + 20) / 60).toFixed(2)} s into the green`);
    assert.ok(Math.abs(s.score - (before - DONUT.OVERHEAT_PENALTY)) < 5, `lost the penalty (${before.toFixed(0)} → ${s.score.toFixed(0)})`);
    assert.ok(s.stalled && s.spinning === 0 && !s.locked, 'stalled, no testacoda');
    // Coasting home smoothly, the pedal dead: no jumps
    let radius = s.radius;
    for (let i = 0; i < 60 * 3 && s.stalled; i++) {
        stepDonut(s, { throttle: 1 });
        assert.ok(s.radius <= radius + 1e-9 && radius - s.radius < 0.2, 'tightening smoothly');
        radius = s.radius;
    }
    assert.ok(!s.stalled, 'ready again within 3 s');
    assert.ok(s.radius < DONUT.RADIUS_MIN + 1.5, `back near the middle (${s.radius.toFixed(1)} m)`);
    steps(s, 30, { throttle: 1 });
    assert.ok(s.revs > 0 && s.speed > 0, 'building up again');
});

test('off the pedal the donut starts tightening at once, even in the green', () => {
    const s = fresh(12);
    steps(s, intoGreen() + 30, { throttle: 1, steer: 0 });
    assert.ok(s.locked);
    const wide = s.radius;
    steps(s, 12, { throttle: 0 });
    assert.ok(s.locked, 'still in the green (a short lift)');
    assert.ok(s.radius < wide - 0.4, `tightening: ${wide.toFixed(1)} → ${s.radius.toFixed(1)} m`);
});

test('in the green a short lift cools the engine and keeps the green; a long one drops back into the white', () => {
    const s = fresh(5);
    steps(s, intoGreen(), { throttle: 1 });
    steps(s, 90, { throttle: 1 });
    const hot = s.heat;
    steps(s, 24, { throttle: 0 });
    assert.ok(s.locked, 'a 0.4 s lift keeps the green');
    assert.ok(s.heat < hot - 0.3, `cooled from ${hot.toFixed(2)} to ${s.heat.toFixed(2)}`);
    // Pressing in a rhythm (1 s down, 0.4 s up) never overheats
    const events: DonutEvent[] = [];
    for (let i = 0; i < 60 * 60; i++) stepDonut(s, { throttle: i % 84 < 60 ? 1 : 0 }, events);
    assert.ok(s.locked && !events.some(e => e.type === 'overheat'), 'a minute in the green');
    const unlocked = steps(s, 40, { throttle: 0 });
    assert.ok(!s.locked && unlocked.some(e => e.type === 'unlock'), 'a long lift leaves the green');
});

test('hitting a blue walker costs points and knocks you out of the green; a white one gives a boost', () => {
    for (const kind of ['walker', 'booster'] as const) {
        const s = fresh(6);
        steps(s, intoGreen(), { throttle: 1 });
        assert.ok(s.locked);
        s.score = 1000;
        // Someone standing in the middle of the north crossing, and the car right there
        s.pedestrians.push({ id: 1, kind, crossing: 0, along: 0, direction: 1, speed: 0, hit: false, hitTimer: 0, approach: 0 });
        s.radius = 10;
        s.slip = 0;
        s.angle = -Math.PI / 2;
        assert.ok(Math.abs(carPosition(s).y + 10) < 0.01, 'the car is on the crossing');
        const events = steps(s, 1, { throttle: 1 });
        const hit = events.find(e => e.type === 'hit');
        assert.ok(hit && hit.type === 'hit' && hit.kind === kind, `${kind} was hit`);
        if (kind === 'walker') {
            assert.ok(s.score <= 1000 - PEDESTRIANS.HIT_PENALTY + 50, `score ${s.score}`);
            assert.ok(!s.locked && s.revs < DONUT.GREEN_AT * PEDESTRIANS.HIT_REVS_KEPT + 0.01, `revs ${s.revs.toFixed(2)}`);
        } else {
            assert.ok(s.score >= 1000 + PEDESTRIANS.BOOST_POINTS, `score ${s.score}`);
            assert.ok(s.locked, 'still in the green');
        }
    }
});

test('the same seed and the same controls play out exactly the same', () => {
    const play = (seed: number) => {
        const s = createDonut(seed);
        const events: DonutEvent[] = [];
        for (let i = 0; i < 60 * 120; i++) stepDonut(s, { throttle: i % 84 < 60 ? 1 : 0, steer: Math.sin(i / 40) }, events);
        return JSON.stringify({ s, events });
    };
    assert.equal(play(21), play(21));
    assert.notEqual(play(21), play(22), 'another seed, another game');
});

test('the people knocked down or across are cleared away: the crowd never builds up', () => {
    const s = createDonut(16);
    let most = 0;
    let hits = 0;
    for (let i = 0; i < 60 * 600; i++) {
        const events: DonutEvent[] = [];
        stepDonut(s, { throttle: i % 84 < 60 ? 1 : 0, steer: Math.abs(s.slip) > 0.25 ? Math.sign(s.slip) : 0 }, events);
        hits += events.filter(e => e.type === 'hit').length;
        most = Math.max(most, s.pedestrians.length);
    }
    assert.ok(hits > 0, 'some were hit');
    assert.ok(most <= 8, `at most ${most} people about at once in ten minutes`);
});

test('at most one person on each crossing', () => {
    const s = createDonut(7);
    let most = 0;
    for (let i = 0; i < 60 * 120; i++) {
        stepDonut(s, { throttle: i % 300 < 200 ? 1 : 0 });
        for (let c = 0; c < 4; c++) most = Math.max(most, s.pedestrians.filter(p => !p.hit && p.crossing === c).length);
    }
    assert.equal(most, 1);
});

test('the steering: forgiving, keeping it clean scores a little more; left alone in the green it ends in a testacoda', () => {
    const drive = (steer: (s: ReturnType<typeof createDonut>) => number) => {
        const s = fresh(8);
        const events: DonutEvent[] = [];
        let clean = 0;
        for (let i = 0; i < 3600; i++) {
            stepDonut(s, { throttle: i % 84 < 60 ? 1 : 0, steer: steer(s) }, events);
            if (Math.abs(s.slip) < DONUT.CLEAN) clean++;
            assert.ok(Math.abs(s.slip) <= 1, 'the balance stops at the edges');
        }
        return { clean: clean / 3600, score: s.score, spins: events.filter(e => e.type === 'spin').length };
    };
    const alone = drive(() => 0);
    const tapping = drive(s => (Math.abs(s.slip) > 0.25 ? Math.sign(s.slip) : 0));
    const seen: number[] = [];
    const late = drive(s => {
        seen.push(s.slip);
        const then = seen.length > 18 ? seen[seen.length - 18] : 0;
        return Math.abs(then) > 0.6 ? Math.sign(then) : 0;
    });
    assert.ok(alone.spins > 0, `left alone: ${alone.spins} testacoda in a minute`);
    assert.equal(tapping.spins, 0, 'steering a little: none');
    assert.ok(late.spins <= 1, `steering late and lazily: ${late.spins}`);
    assert.ok(tapping.clean > 0.9 && tapping.clean > alone.clean + 0.2, `clean ${Math.round(alone.clean * 100)}% alone, ${Math.round(tapping.clean * 100)}% steering`);
    assert.ok(tapping.score > alone.score, `${Math.round(alone.score)} → ${Math.round(tapping.score)}`);
});

test('at the edge in the white nothing happens; in the green, a moment there is a testacoda on the spot', () => {
    const white = fresh(10);
    const whiteEvents: DonutEvent[] = [];
    for (let i = 0; i < 60; i++) {
        white.slip = 1;
        stepDonut(white, { throttle: 1 }, whiteEvents);
    }
    assert.ok(!white.locked && !whiteEvents.some(e => e.type === 'spin'), 'a second at the edge in the white: nothing');
    const green = fresh(11);
    steps(green, intoGreen(), { throttle: 1 });
    assert.ok(green.locked);
    const events: DonutEvent[] = [];
    let n = 0;
    // Settle at full width first (steering a little so the balance stays clear of the edge)
    for (let i = 0; i < 150; i++) stepDonut(green, { throttle: i % 84 < 60 ? 1 : 0, steer: Math.abs(green.slip) > 0.25 ? Math.sign(green.slip) : 0 });
    const wide = green.radius;
    while (!events.some(e => e.type === 'spin') && n < 120) {
        green.slip = 1;
        green.slipSpeed = 0;
        stepDonut(green, { throttle: 1 }, events);
        n++;
    }
    assert.ok(Math.abs(n / 60 - DONUT.EDGE_GRACE) < 0.05, `testacoda after ${(n / 60).toFixed(2)} s at the edge`);
    assert.ok(green.spinning > 0 && green.speed === 0 && !green.locked, 'spinning, stopped, out of the green');
    const at = green.radius;
    assert.ok(Math.abs(at - wide) < 0.5, `where it was (${wide.toFixed(1)} → ${at.toFixed(1)} m)`);
    steps(green, Math.ceil(DONUT.SPIN_SECONDS * 60) - 1, { throttle: 1 });
    assert.ok(green.spinning > 0 && green.radius === at, 'spinning on the spot');
    steps(green, 2, { throttle: 1 });
    assert.equal(green.spinning, 0);
});

test('standing still the balance settles back to the middle', () => {
    const s = fresh(9);
    s.slip = 0.8;
    steps(s, 180, { throttle: 0, steer: 0 });
    assert.ok(Math.abs(s.slip) < 0.05, `balance ${s.slip.toFixed(3)}`);
});

test('the steering reacts quicker the faster the car goes', () => {
    const response = (share: number) => {
        const s = fresh(13);
        s.revs = DONUT.GREEN_AT * share * 0.99;
        s.speed = DONUT.SPEED_MAX * share * 0.99;
        s.radius = 8;
        s.gust = 0;
        stepDonut(s, { throttle: 0.001, steer: 1 });
        return -s.slipSpeed;
    };
    assert.ok(response(1) > response(0.5) * 1.4 && response(0.5) > response(0.1), `${response(0.1).toFixed(3)} < ${response(0.5).toFixed(3)} < ${response(1).toFixed(3)}`);
});

test('white people in a row build the combo and raise the top speed, with diminishing returns; a blue hit ends the run', () => {
    const s = fresh(14);
    const base = topSpeed(s);
    assert.equal(base, DONUT.SPEED_MAX);
    const gains: number[] = [];
    for (let n = 1; n <= 40; n++) {
        const before = topSpeed(s);
        s.streak = n;
        gains.push(topSpeed(s) - before);
    }
    assert.ok(gains.every((gain, i) => i === 0 || gain < gains[i - 1]), 'each one in a row adds a little less');
    assert.ok(topSpeed(s) < DONUT.SPEED_MAX * (1 + DONUT.SPEED_BONUS_MAX), 'never past the cap');
    s.streak = 5;
    assert.ok(Math.abs(topSpeed(s) / base - 1.23) < 0.02, `5 in a row: +${Math.round((topSpeed(s) / base - 1) * 100)}%`);

    const car = fresh(15);
    steps(car, intoGreen(), { throttle: 1, steer: 0 });
    const hit = (kind: 'walker' | 'booster') => {
        car.slip = 0;
        car.heat = 0;
        car.pedestrians.push({ id: car.nextId++, kind, crossing: 0, along: 0, direction: 1, speed: 0, hit: false, hitTimer: 0, approach: 0 });
        car.radius = 10;
        car.angle = -Math.PI / 2;
        steps(car, 1, { throttle: 1 });
    };
    hit('booster');
    hit('booster');
    hit('booster');
    assert.equal(car.streak, 3);
    assert.equal(car.combo, 1 + 3 * DONUT.COMBO_STEP);
    hit('walker');
    assert.equal(car.streak, 0);
    assert.equal(car.combo, 1);
    assert.equal(topSpeed(car), DONUT.SPEED_MAX);
});

test('a white person\'s burst climbs straight to its peak, holds, drops away and eases back to the speed the car should be at', () => {
    assert.equal(boostShape(-1), 0);
    const rise = PEDESTRIANS.BOOST_RISE;
    const fall = PEDESTRIANS.BOOST_FALL;
    assert.ok(Math.abs(boostShape(rise / 2) - 0.5) < 1e-9, 'a straight climb');
    assert.ok(Math.abs(boostShape(rise) - 1) < 1e-9, 'the peak');
    assert.ok(boostShape(rise + fall * 0.1) > 0.97, 'holds a moment at the top');
    const middle = boostShape(rise + fall * 0.45) - boostShape(rise + fall * 0.55);
    const end = boostShape(rise + fall * 0.85) - boostShape(rise + fall * 0.95);
    assert.ok(middle > end * 2, 'drops fastest in the middle, eases out at the end');
    assert.equal(boostShape(rise + fall), 0);

    // On the car: in the green, a white person: past the top, then back to it
    const car = fresh(15);
    steps(car, intoGreen(), { throttle: 1, steer: 0 });
    car.slip = 0;
    car.heat = 0;
    car.pedestrians.push({ id: 1, kind: 'booster', crossing: 0, along: 0, direction: 1, speed: 0, hit: false, hitTimer: 0, approach: 0 });
    car.radius = 10;
    car.angle = -Math.PI / 2;
    steps(car, 1, { throttle: 1 });
    steps(car, Math.round(rise * 60), { throttle: 1 });
    assert.ok(car.speed > topSpeed(car) + DONUT.SPEED_MAX * PEDESTRIANS.BOOST_SPEED * 0.9, `at the peak: ${car.speed.toFixed(1)} over a top of ${topSpeed(car).toFixed(1)}`);
    for (let i = 0; i < Math.ceil(fall * 60) + 5; i++) stepDonut(car, { throttle: 1, steer: Math.abs(car.slip) > 0.25 ? Math.sign(car.slip) : 0 });
    assert.ok(car.boost === 0 && Math.abs(car.speed - topSpeed(car)) < 0.2, `back to the top (${car.speed.toFixed(1)} of ${topSpeed(car).toFixed(1)})`);
});
