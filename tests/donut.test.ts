/**
 * DERAPATE's rules: the throttle sizes the donut, each stab of the pedal kicks
 * the tail out and each lift brings it back, the drift has to be balanced or
 * the car spins out, blipping in rhythm beats holding flat out, and the two
 * kinds of people crossing do what they should when hit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONUT, PEDESTRIANS, carPosition, createDonut, inSweetSpot, stepDonut, type DonutEvent, type DonutState } from '../src/minigames/donut/DonutSim.ts';

/** Counter-steers against the slip like a steady driver. */
const balance = (s: DonutState) => Math.max(-1, Math.min(1, s.slip * 2.2 + s.slipSpeed * 0.6));

test('holding the throttle widens the donut and speeds it up; letting go tightens it', () => {
    const s = createDonut(1);
    s.nextSpawn = Infinity;
    for (let i = 0; i < 300; i++) stepDonut(s, { throttle: 1, brake: 0, steer: balance(s) });
    assert.equal(s.radius, DONUT.RADIUS_MAX);
    assert.ok(s.speed > DONUT.SPEED_MAX * 0.95, `speed ${s.speed}`);
    for (let i = 0; i < 600; i++) stepDonut(s, { throttle: 0, brake: 0, steer: balance(s) });
    assert.ok(s.radius < DONUT.RADIUS_MIN + 0.01, `tightened to ${s.radius}`);
});

test('left alone the drift tips over and the car spins out; balanced, it holds', () => {
    const alone = createDonut(2);
    const events: DonutEvent[] = [];
    for (let i = 0; i < 1800 && !events.some(e => e.type === 'spin'); i++) stepDonut(alone, { throttle: 0.5, brake: 0, steer: 0 }, events);
    assert.ok(events.some(e => e.type === 'spin'), 'spun out within 30 s');

    const held = createDonut(2);
    const heldEvents: DonutEvent[] = [];
    for (let i = 0; i < 3600; i++) stepDonut(held, { throttle: i % 240 < 150 ? 1 : 0, brake: 0, steer: balance(held) }, heldEvents);
    assert.ok(!heldEvents.some(e => e.type === 'spin'), 'a minute without a spin-out');
});

test('the pedal pushes the tail out gradually, harder at speed; lifting stops the push', () => {
    const run = (speed: number, liftAt: number) => {
        const s = createDonut(4);
        s.nextSpawn = Infinity;
        s.speed = speed;
        s.revs = 0.6;
        const slips: number[] = [];
        for (let i = 0; i < 90; i++) {
            stepDonut(s, { throttle: i < liftAt ? 1 : 0, brake: 0, steer: 0 });
            slips.push(s.slip);
        }
        return slips;
    };
    const fast = run(DONUT.SPEED_MAX, 90);
    const slow = run(DONUT.SPEED_MIN, 90);
    const lifted = run(DONUT.SPEED_MAX, 30);
    assert.ok(fast[14] < 0.3, `not all at once: ${fast[14].toFixed(2)} after a quarter second`);
    assert.ok(fast[59] > 0.6, `held for a second at top speed, the tail goes well out (${fast[59].toFixed(2)})`);
    assert.ok(slow[29] < fast[29] * 0.8, `slower, a gentler push (${slow[29].toFixed(2)} vs ${fast[29].toFixed(2)})`);
    assert.ok(lifted[89] < fast[89] - 0.3, `lifting stops it going further (${lifted[89].toFixed(2)} vs held ${fast[89].toFixed(2)})`);
});

test('blipping in rhythm keeps the revs in the sweet spot and beats holding flat out, which spins', () => {
    const drive = (pedal: (i: number) => number, steer: (s: DonutState) => number) => {
        const s = createDonut(5);
        s.nextSpawn = Infinity;
        let spins = 0;
        let sweet = 0;
        for (let i = 0; i < 3600; i++) {
            for (const e of stepDonut(s, { throttle: pedal(i), brake: 0, steer: steer(s) })) if (e.type === 'spin') spins++;
            if (inSweetSpot(s)) sweet++;
        }
        return { spins, sweet: sweet / 3600, score: s.score };
    };
    const blips = (i: number) => (i % 30 < 18 ? 1 : 0);
    const rhythm = drive(blips, balance);
    const flat = drive(() => 1, balance);
    assert.equal(rhythm.spins, 0, 'blipping, balanced, holds a minute');
    assert.ok(rhythm.sweet > 0.8, `in the sweet spot ${Math.round(rhythm.sweet * 100)}% of the time`);
    assert.ok(flat.spins > 0, 'flat out, the limiter spins it even balanced');
    assert.ok(rhythm.score > flat.score * 2, `blipping ${Math.round(rhythm.score)} vs flat out ${Math.round(flat.score)}`);
    assert.ok(drive(blips, () => 0).spins > 0, 'blipping without steering spins');
});

test('hitting a red walker costs points and speed; a green one gives a boost', () => {
    for (const kind of ['walker', 'booster'] as const) {
        const s = createDonut(3);
        s.score = 1000;
        s.speed = 12;
        s.nextSpawn = Infinity;
        // Someone standing in the middle of the north crossing, and the car right there
        s.pedestrians.push({ id: 1, kind, crossing: 0, along: 0, direction: 1, speed: 0, hit: false, hitTimer: 0 });
        const events: DonutEvent[] = [];
        s.radius = 10;
        s.angle = -Math.PI / 2;
        assert.ok(Math.abs(carPosition(s).y + 10) < 0.01, 'the car is on the crossing');
        stepDonut(s, { throttle: 0, brake: 0, steer: 0 }, events);
        const hit = events.find(e => e.type === 'hit');
        assert.ok(hit && hit.type === 'hit' && hit.kind === kind, `${kind} was hit`);
        if (kind === 'walker') {
            assert.equal(s.score < 1000 - PEDESTRIANS.HIT_PENALTY + 50, true);
            assert.ok(s.speed < 12 * PEDESTRIANS.HIT_SPEED_KEPT + 0.5, `slowed to ${s.speed}`);
        } else {
            assert.ok(s.score >= 1000 + PEDESTRIANS.BOOST_POINTS, `score ${s.score}`);
            assert.ok(s.speed > 12, `boosted to ${s.speed}`);
        }
    }
});
