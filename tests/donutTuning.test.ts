/**
 * The DERAPATE Lab's settings: every number of the mini-game is shown once or
 * left out on purpose, the worked-out ones (seconds, km/h, %) go both ways,
 * and changes (the street lamps included) copy out and paste back exactly.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LAMPS, LAMPS, LIGHT } from '../src/minigames/donut/DonutLight.ts';
import { LOOK } from '../src/minigames/donut/DonutLook.ts';
import { DONUT, JUNCTION, PEDESTRIANS } from '../src/minigames/donut/DonutSim.ts';
import {
    ALL_GROUPS, FEEL_TAB_GROUPS, HIDDEN, applyDonutChanges, changeCount, donutChanges, resetDonutTuning, resetSetting, setSetting,
    settingChanged, settingDefault, settingValue,
} from '../src/minigames/donut/DonutTuning.ts';

const TABLES = { DONUT, PEDESTRIANS, JUNCTION, LOOK, LIGHT } as Record<string, Record<string, number>>;
const settings = ALL_GROUPS.flatMap(group => group.settings);
const find = (label: string) => settings.find(setting => setting.label === label)!;

test('every DERAPATE number is in the Lab once, or left out on purpose; every range holds its default', () => {
    const shown = settings.flatMap(setting => setting.keys);
    assert.equal(new Set(shown).size, shown.length, 'nothing shown twice');
    for (const [name, table] of Object.entries(TABLES)) {
        for (const key of Object.keys(table)) {
            const id = `${name}.${key}`;
            assert.ok(shown.includes(id) !== id in HIDDEN, `${id} is either shown or hidden on purpose (not both)`);
        }
    }
    for (const id of Object.keys(HIDDEN)) {
        const [name, key] = id.split('.');
        assert.ok(key in (TABLES[name] ?? {}), `hidden ${id} exists`);
    }
    for (const setting of settings) {
        const [min, max, step] = setting.range;
        const value = settingDefault(setting);
        assert.ok(min < max && step > 0, `${setting.label} has a range`);
        assert.ok(value >= min && value <= max, `${setting.label}'s default ${value} is inside ${min}..${max}`);
    }
    const feel = FEEL_TAB_GROUPS.flatMap(group => group.settings).length;
    assert.ok(feel <= 20, `the FEEL tab is short (${feel} settings)`);
});

test('the worked-out FEEL settings show clear units and write back what they show', () => {
    resetDonutTuning();
    assert.equal(settingValue(find('Seconds to the green')), 1.5);
    assert.equal(settingValue(find('Top speed')), 64.8);
    assert.equal(settingValue(find('A person about every')), 3.75);
    assert.equal(settingValue(find('White people')), 91);
    setSetting(find('Seconds to the green'), 3);
    assert.ok(Math.abs(DONUT.REV_UP - DONUT.GREEN_AT / 3) < 1e-12, 'twice as long: the revs climb half as fast');
    setSetting(find('Top speed'), 90);
    assert.ok(Math.abs(DONUT.SPEED_MAX - 25) < 1e-12, '90 km/h is 25 m/s');
    setSetting(find('A person about every'), 6);
    assert.ok(Math.abs(PEDESTRIANS.SPAWN_MIN - 4) < 1e-12 && Math.abs(PEDESTRIANS.SPAWN_MAX - 8) < 1e-12, 'give or take a third');
    assert.ok(settingChanged(find('A person about every')));
    resetSetting(find('A person about every'));
    assert.ok(!settingChanged(find('A person about every')), 'reset exactly');
    resetDonutTuning();
});

test('changes copy out and paste back, the lamps too; hidden and unknown numbers are skipped; reset puts the defaults back', () => {
    resetDonutTuning();
    assert.deepEqual(donutChanges(), {});
    DONUT.REV_UP = 0.45;
    LOOK.NOSE_IN = 80;
    LIGHT.EXPOSURE = 1.3;
    LAMPS[0].x = 3;
    LAMPS.pop();
    const copied = JSON.parse(JSON.stringify({ sgalallaDerapate: 1, ...donutChanges() }));
    assert.equal(changeCount(), 3);
    resetDonutTuning();
    assert.equal(changeCount(), 0);
    assert.deepEqual(LAMPS, DEFAULT_LAMPS);
    assert.equal(applyDonutChanges(copied), 4);
    assert.equal(DONUT.REV_UP, 0.45);
    assert.equal(LOOK.NOSE_IN, 80);
    assert.equal(LIGHT.EXPOSURE, 1.3);
    assert.equal(LAMPS.length, DEFAULT_LAMPS.length - 1);
    assert.equal(LAMPS[0].x, 3);
    // Unknown names, hidden numbers and non-numbers are skipped
    assert.equal(applyDonutChanges({ DONUT: { REV_UP: 'fast', NOPE: 1, GREEN_AT: 0.5 }, OTHER: { X: 1 } }), 0);
    assert.equal(DONUT.REV_UP, 0.6);
    assert.equal(DONUT.GREEN_AT, 0.9);
    resetDonutTuning();
});
