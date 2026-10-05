/**
 * DERAPATE's light maths: a light fades to nothing at its reach, a cone
 * lights only ahead, colours are lit and capped, lamps read back from JSON
 * safely, the isometric falloff measures ground distance from screen
 * offsets, and the times of day each set the same settings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUND_FALLOFF, isoX, isoY } from '../src/minigames/donut/DonutIso.ts';
import {
    LIGHT, MAX_LAMPS, NEW_LAMP, TIMES_OF_DAY, TIME_PRESETS, applyTimeOfDay, coneShare, currentTimeOfDay, falloff, lampsFrom, litColour,
} from '../src/minigames/donut/DonutLight.ts';
import { LOOK } from '../src/minigames/donut/DonutLook.ts';

test('a light is full at itself, fades (squared) and is gone at its reach', () => {
    assert.equal(falloff(0, 10), 1);
    assert.equal(falloff(5, 10), 0.25);
    assert.equal(falloff(10, 10), 0);
    assert.equal(falloff(30, 10), 0);
    assert.equal(falloff(1, 0), 0);
});

test('a colour lit by a light: each channel scaled and capped at full', () => {
    assert.equal(litColour(0x808080, [1, 1, 1]), 0x808080);
    assert.equal(litColour(0x808080, [0.5, 0.5, 0.5]), 0x404040);
    assert.equal(litColour(0x808080, [4, 1, 0]), 0xff8000);
});

test('lamps from JSON keep only well-typed values, at most MAX_LAMPS', () => {
    assert.equal(lampsFrom('nope'), null);
    const lamps = lampsFrom([{ x: 2, y: 'up', reach: Infinity, post: false }, null, ...Array(9).fill({})])!;
    assert.equal(lamps.length, MAX_LAMPS);
    assert.equal(lamps[0].x, 2);
    assert.equal(lamps[0].y, 0);
    assert.equal(lamps[0].reach, NEW_LAMP.reach);
    assert.equal(lamps[0].post, false);
    assert.deepEqual(lamps[1], { ...NEW_LAMP, x: 0, y: 0 });
});

test('the ground falloff turns a screen offset into ground metres times the zoom, whichever way', () => {
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-3, 2]]) {
        const sx = (dx - dy) * isoX();
        const sy = (dx + dy) * isoY();
        const measured = Math.hypot(sx * GROUND_FALLOFF.x, sy * GROUND_FALLOFF.y) / LOOK.SCALE;
        assert.ok(Math.abs(measured - Math.hypot(dx, dy)) < 1e-3, `(${dx}, ${dy}) m measured ${measured.toFixed(4)}`);
    }
});

test('a cone lights straight ahead fully, fades towards its edge, and nothing behind', () => {
    const inner = Math.cos((10 * Math.PI) / 180);
    const outer = Math.cos((20 * Math.PI) / 180);
    assert.equal(coneShare(5, 0, 1, 0, inner, outer), 1);
    const at15 = coneShare(Math.cos((15 * Math.PI) / 180), Math.sin((15 * Math.PI) / 180), 1, 0, inner, outer);
    assert.ok(at15 > 0.3 && at15 < 0.7, `half way out: ${at15.toFixed(2)}`);
    assert.equal(coneShare(0, 5, 1, 0, inner, outer), 0);
    assert.equal(coneShare(-5, 0, 1, 0, inner, outer), 0);
});

test('every time of day sets the same settings; the blue hour is the defaults; setting one is recognised', () => {
    const keys = Object.keys(TIME_PRESETS.blueHour).sort();
    for (const time of TIMES_OF_DAY) assert.deepEqual(Object.keys(TIME_PRESETS[time]).sort(), keys, `${time} sets the same settings`);
    const saved = { ...LIGHT };
    assert.equal(currentTimeOfDay(), 'blueHour', 'the defaults are the blue hour');
    applyTimeOfDay('daylight');
    assert.equal(currentTimeOfDay(), 'daylight');
    assert.equal(LIGHT.LAMPS, 0, 'no lamps by day');
    LIGHT.EXPOSURE += 0.1;
    assert.equal(currentTimeOfDay(), null, 'tweaked: none of them');
    Object.assign(LIGHT, saved);
});
