/**
 * The DERAPATE Lab's settings list: every number of the mini-game is in it
 * once, and changes copy out and paste back exactly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LOOK } from '../src/minigames/donut/DonutLook.ts';
import { DONUT, JUNCTION, PEDESTRIANS } from '../src/minigames/donut/DonutSim.ts';
import {
    ALL_GROUPS, applyDonutChanges, changeCount, donutChanges, resetDonutTuning,
} from '../src/minigames/donut/DonutTuning.ts';

test('every DERAPATE setting is in the Lab, once, with a sensible range', () => {
    const tables = { DONUT, PEDESTRIANS, JUNCTION, LOOK } as Record<string, Record<string, number>>;
    const listed = ALL_GROUPS.flatMap(group => group.settings.map(setting => `${setting.table}.${setting.key}`));
    assert.equal(new Set(listed).size, listed.length, 'nothing listed twice');
    for (const [name, table] of Object.entries(tables)) {
        for (const key of Object.keys(table)) assert.ok(listed.includes(`${name}.${key}`), `${name}.${key} is in the Lab`);
    }
    for (const setting of ALL_GROUPS.flatMap(group => group.settings)) {
        const [min, max, step] = setting.range;
        const value = tables[setting.table][setting.key];
        assert.ok(min < max && step > 0, `${setting.key} has a range`);
        assert.ok(value >= min && value <= max, `${setting.table}.${setting.key}'s default ${value} is inside ${min}..${max}`);
    }
});

test('changes copy out and paste back; reset puts the defaults back', () => {
    resetDonutTuning();
    assert.deepEqual(donutChanges(), {});
    DONUT.KICK = 3.3;
    LOOK.NOSE_IN = 80;
    JUNCTION.CROSSING_AT = 12;
    const copied = JSON.parse(JSON.stringify({ sgalallaDerapate: 1, ...donutChanges() }));
    assert.equal(changeCount(), 3);
    resetDonutTuning();
    assert.equal(changeCount(), 0);
    assert.equal(applyDonutChanges(copied), 3);
    assert.equal(DONUT.KICK, 3.3);
    assert.equal(LOOK.NOSE_IN, 80);
    assert.equal(JUNCTION.CROSSING_AT, 12);
    // Unknown names and non-numbers are skipped
    assert.equal(applyDonutChanges({ DONUT: { KICK: 'fast', NOPE: 1 }, OTHER: { X: 1 } }), 0);
    assert.equal(DONUT.KICK, 2.5);
    resetDonutTuning();
});
