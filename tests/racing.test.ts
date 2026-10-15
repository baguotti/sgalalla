/**
 * The racer's rules: the same seed drives the same race (what a multiplayer
 * race will need), the car reaches top speed, and the grass slows it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CAR, createRace, stepRace, type RaceInput } from '../src/minigames/racing/RaceSim.ts';

const FLOOR_IT: RaceInput = { throttle: 1, brake: 0, steer: 0 };

test('the same seed and inputs drive the same race', () => {
    const a = createRace(5);
    const b = createRace(5);
    for (let i = 0; i < 1200; i++) {
        const input = { throttle: 1, brake: 0, steer: Math.sign(((i / 90) | 0) % 2 - 0.5) };
        stepRace(a, input);
        stepRace(b, input);
    }
    assert.deepEqual(JSON.stringify(a.player), JSON.stringify(b.player));
    assert.deepEqual(JSON.stringify(a.traffic), JSON.stringify(b.traffic));
});

test('flooring it on the opening straight reaches top speed in a few seconds', () => {
    const race = createRace(1);
    let steps = 0;
    while (race.player.speed < CAR.MAX_SPEED * 0.99 && steps < 60 * 15) {
        stepRace(race, FLOOR_IT);
        // Stay in lane: the test is about the engine, not the bends
        race.player.x = -0.25;
        steps++;
    }
    assert.ok(steps < 60 * 10, `took ${(steps / 60).toFixed(1)} s`);
});

test('off the road the car slows to its off-road limit', () => {
    const race = createRace(1);
    race.player.speed = CAR.MAX_SPEED;
    race.player.x = 2.8;
    // Clear the verge so nothing is hit
    for (const segment of race.track.segments) segment.things = [];
    for (let i = 0; i < 180; i++) {
        stepRace(race, FLOOR_IT);
        race.player.x = 2.8;
    }
    assert.ok(race.player.speed <= CAR.MAX_SPEED * CAR.OFF_ROAD_LIMIT + 1, `speed ${race.player.speed}`);
});

test('squeezing past a car close counts as a near miss; passing a lane over does not', () => {
    for (const [apart, expected] of [[0.42, 1], [0.6, 0]] as const) {
        const race = createRace(1);
        for (const segment of race.track.segments) segment.curve = 0;
        race.traffic.length = 1;
        // The traffic car in the second lane, the player that far to its left
        Object.assign(race.traffic[0], { z: 4000, x: -0.25, lane: 1, toLane: 1, signal: 0, speed: CAR.MAX_SPEED * 0.4 });
        Object.assign(race.player, { z: 1000, x: -0.25 - apart, speed: CAR.MAX_SPEED });
        for (let i = 0; i < 120; i++) {
            stepRace(race, FLOOR_IT);
            race.player.x = -0.25 - apart;
        }
        assert.equal(race.nearMisses, expected, `${apart} apart`);
    }
});

test('a hard bend taken flat out washes wide off the road; lifting before it keeps the car on', () => {
    const run = (entry: number, throttle: number) => {
        const race = createRace(1);
        race.traffic.length = 0;
        const segments = race.track.segments;
        const bend = segments.findIndex(s => Math.abs(s.curve) >= 6);
        const into = Math.sign(segments[bend].curve);
        Object.assign(race.player, { z: (bend - 10) * 200, x: -0.25 * into, speed: CAR.MAX_SPEED * entry });
        let wentOff = false;
        for (let i = 0; i < 240; i++) {
            // Steering to hold the lane, up to full lock
            const steer = Math.max(-1, Math.min(1, (-0.25 * into - race.player.x) * 4));
            stepRace(race, { throttle, brake: 0, steer });
            wentOff ||= race.player.offRoad;
        }
        return wentOff;
    };
    assert.equal(run(1, 1), true, 'flat out goes off');
    assert.equal(run(0.6, 0.25), false, 'lifting stays on');
});
