/**
 * DERAPATE's rules: the throttle sizes the donut, the drift has to be
 * balanced or the car spins out, and the two kinds of people crossing do what
 * they should when hit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DONUT, PEDESTRIANS, carPosition, createDonut, stepDonut, type DonutEvent, type DonutState } from '../src/minigames/donut/DonutSim.ts';

/** Counter-steers against the slip like a steady driver. */
const balance = (s: DonutState) => Math.max(-1, Math.min(1, s.slip * 2.2 + s.slipSpeed * 0.6));

test('holding the throttle widens the donut and speeds it up; letting go tightens it', () => {
    const s = createDonut(1);
    s.nextSpawn = Infinity;
    for (let i = 0; i < 300; i++) stepDonut(s, { throttle: 1, brake: 0, steer: balance(s) });
    assert.equal(s.radius, DONUT.RADIUS_MAX);
    assert.ok(s.speed > DONUT.SPEED_MAX * 0.95, `speed ${s.speed}`);
    for (let i = 0; i < 600; i++) stepDonut(s, { throttle: 0, brake: 0, steer: balance(s) });
    assert.equal(s.radius, DONUT.RADIUS_MIN);
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
