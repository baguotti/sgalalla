/**
 * Every DERAPATE setting the Lab can change, in plain words, grouped by topic
 * with its range, and the live tuning itself: values set straight on the
 * games' plain objects (DONUT, PEDESTRIANS, JUNCTION, LOOK), the defaults
 * kept to put back, only the changes saved and copied. Plain data (a test
 * checks every setting is listed).
 */
import { LOOK } from './DonutLook';
import { DONUT, JUNCTION, PEDESTRIANS } from './DonutSim';

const TABLES = { DONUT, PEDESTRIANS, JUNCTION, LOOK } as const;
export type TableName = keyof typeof TABLES;

export interface DonutSetting {
    table: TableName;
    key: string;
    label: string;
    unit: string;
    hint?: string;
    /** Slider min, max, step; typed values may go past them. */
    range: readonly [number, number, number];
    /** Changing it moves the ground: the junction is drawn again. */
    redraw?: boolean;
}

export interface DonutGroup {
    title: string;
    settings: DonutSetting[];
}

type Row = [key: string, label: string, unit: string, range: readonly [number, number, number], hint?: string];

function group(title: string, table: TableName, rows: Row[], redraw = false): DonutGroup {
    return { title, settings: rows.map(([key, label, unit, range, hint]) => ({ table, key, label, unit, range, hint, redraw })) };
}

/** The DRIVING panel: the white part of the bar, speed and size. */
export const DRIVING_GROUPS: DonutGroup[] = [
    group('THE WHITE (ACCELERATING)', 'DONUT', [
        ['REV_UP', 'Revs climb', '/s', [0.02, 2, 0.01], 'Share of the bar a second with the pedal down: 0.6 is about 1.5 s to the green.'],
        ['REV_DOWN', 'Revs fall', '/s', [0.02, 3, 0.01], 'Share of the bar a second with the pedal up.'],
        ['GREEN_AT', 'Green starts at', 'share', [0.3, 0.99, 0.01], 'The white is the bar below this.'],
    ]),
    group('SPEED AND SIZE', 'DONUT', [
        ['SPEED_MAX', 'Top speed', 'm/s', [1, 50, 0.5], 'Speed at the top of the white and in the green.'],
        ['SPEED_BONUS_MAX', 'Combo raises top speed by', 'share', [0, 2, 0.01], 'At most (approached with diminishing returns) for white people hit in a row.'],
        ['SPEED_BONUS_SCALE', 'In a row to get most of it', 'count', [1, 50, 1], 'After this many whites in a row the top speed has gained 63% of the most it can.'],
        ['SPEED_FOLLOW', 'Speed follows revs', '/s', [0.5, 20, 0.1], 'How quickly the speed catches up with the revs.'],
        ['RADIUS_MIN', 'Tightest donut', 'm', [0.5, 20, 0.1], 'Radius standing still.'],
        ['RADIUS_MAX', 'Widest donut', 'm', [1, 30, 0.1], 'Radius at top speed.'],
        ['GROW', 'Widening', 'm/s', [0.1, 25, 0.1], 'How fast the donut widens with the speed.'],
        ['RETURN', 'Back to the middle', 'm/s', [0, 15, 0.1], 'Off the pedal the donut tightens at least this fast, even in the green.'],
        ['SHRINK', 'Tightening', 'm/s', [0.1, 25, 0.1], 'How fast it tightens back.'],
        ['CENTRE_X', 'Donut centre X', 'm', [-15, 15, 0.1], 'Where on the junction the donut circles round (across, down-right on screen).'],
        ['CENTRE_Y', 'Donut centre Y', 'm', [-15, 15, 0.1], 'The other way (down-left on screen).'],
    ]),
];

/** The STEERING panel. */
export const STEERING_GROUPS: DonutGroup[] = [
    group('BALANCE', 'DONUT', [
        ['DRIFT', 'Drift', '', [0, 4, 0.05], 'How much the balance wanders by itself while moving.'],
        ['GREEN_DRIFT', 'Drift in the green ×', 'times', [0, 6, 0.1]],
        ['STEER', 'Steering', '', [0, 30, 0.1], 'Push of left/right on the balance, at top speed.'],
        ['STEER_SLOW', 'Steering when slow', 'share', [0, 1, 0.01], 'Share of the steering standing still: it grows with the speed.'],
        ['DAMPING', 'Settling', '', [0, 10, 0.1], 'How quickly a swing settles.'],
        ['CENTRING', 'Pull to the middle', '', [0, 5, 0.05], 'A gentle pull back to the middle (forgiving).'],
        ['CLEAN', 'Clean band', 'share', [0, 1, 0.01], 'Inside this band points count a little more.'],
        ['CLEAN_BONUS', 'Clean points ×', 'times', [1, 3, 0.05]],
        ['EDGE', 'Edge from', 'share', [0.5, 1, 0.01], 'In the green, the balance past this counts as at the edge.'],
        ['EDGE_GRACE', 'Edge grace', 's', [0, 3, 0.05], 'In the green, at the edge this long is a testacoda.'],
        ['SPIN_PENALTY', 'Testacoda costs', 'pts', [0, 3000, 10]],
        ['SPIN_SECONDS', 'Testacoda lasts', 's', [0.2, 5, 0.1], 'Spinning on the spot this long.'],
        ['SPIN_REVS_KEPT', 'Revs kept after', 'share', [0, 1, 0.01], 'Share of the white kept after a testacoda.'],
        ['SLIP_SHIFT', 'Balance moves the car', 'm', [0, 5, 0.1], 'The balance pushes the car out of (or into) its circle by up to this much.'],
    ]),
];

/** The GREEN AND HEAT panel. */
export const GREEN_GROUPS: DonutGroup[] = [
    group('THE GREEN', 'DONUT', [
        ['OVERHEAT_SECONDS', 'Overheats after', 's', [0.5, 15, 0.1], 'Seconds of pedal down in the green before the engine gives out.'],
        ['COOL_SECONDS', 'Cools in', 's', [0.1, 10, 0.1], 'Seconds of pedal up to cool the engine fully.'],
        ['LIFT_GRACE', 'Lift grace', 's', [0, 3, 0.05], 'A lift shorter than this keeps the green; longer drops back into the white.'],
        ['GREEN_BONUS', 'Green points ×', 'times', [1, 5, 0.1]],
    ]),
    group('OVERHEATING AND COMBO', 'DONUT', [
        ['OVERHEAT_PENALTY', 'Overheating costs', 'pts', [0, 3000, 10], 'Overheating stalls the engine: the car coasts back to the middle.'],
        ['COMBO_STEP', 'Combo per white', '', [0, 2, 0.05], 'Each white person hit in a row adds this much to the combo multiplier.'],
        ['COMBO_MAX', 'Combo up to', '×', [1, 10, 0.25]],
    ]),
];

/** The PEOPLE AND ROAD panel. */
export const WORLD_GROUPS: DonutGroup[] = [
    group('PEOPLE', 'PEDESTRIANS', [
        ['SPAWN_MIN', 'New person every (min)', 's', [0.1, 10, 0.1]],
        ['SPAWN_MAX', 'New person every (max)', 's', [0.1, 10, 0.1]],
        ['PER_CROSSING', 'People per crossing', 'count', [1, 6, 1], 'At most this many on a crossing at once.'],
        ['BOOSTER_SHARE', 'White share', 'share', [0, 1, 0.01], 'Share of people that give a boost (white; the rest are blue).'],
        ['WALK_SPEED', 'Blue walk speed', 'm/s', [0, 6, 0.1]],
        ['JOG_SPEED', 'White jog speed', 'm/s', [0, 6, 0.1]],
        ['HIT_DISTANCE', 'Hit distance', 'm', [0.5, 6, 0.1], 'Car and person closer than this collide.'],
        ['HIT_PENALTY', 'Blue costs', 'pts', [0, 3000, 10], 'A blue hit also ends the combo.'],
        ['HIT_REVS_KEPT', 'Blue: revs kept', 'share', [0, 1, 0.01], 'A blue hit knocks you out of the green and keeps this share of the revs.'],
        ['BOOST_POINTS', 'White gives', 'pts', [0, 1000, 5]],
        ['BOOST_SPEED', 'White burst', 'share', [0, 1, 0.01], 'Peak of the burst of speed above the top (share of the base top speed).'],
        ['BOOST_RISE', 'Burst climbs in', 's', [0.02, 2, 0.01], 'Straight up to the peak in this long.'],
        ['BOOST_FALL', 'Burst falls in', 's', [0.1, 6, 0.1], 'Then down and easing out over this long.'],
        ['BOOST_REVS', 'White revs', 'share', [0, 0.5, 0.01], 'Extra revs (share of the bar) from a white person.'],
    ]),
    group('JUNCTION', 'JUNCTION', [
        ['ROAD_HALF_WIDTH', 'Road half width', 'm', [3, 15, 0.1]],
        ['CROSSING_AT', 'Crossings at', 'm', [4, 30, 0.1], 'How far the middle of each zebra crossing is from the centre.'],
        ['CROSSING_WIDTH', 'Crossing width', 'm', [1, 8, 0.1]],
    ], true),
];

/** The CAR AND CAMERA panel. */
export const LOOK_GROUPS: DonutGroup[] = [
    group('CAR', 'LOOK', [
        ['CAR_SIZE', 'Car size ×', 'times', [0.5, 4, 0.05], 'Drawn this much bigger than life.'],
        ['NOSE_IN', 'Nose into the circle', '°', [0, 150, 1], '0 points along the circle, 90 at the centre.'],
        ['SLIP_SWING', 'Balance swing', '°', [0, 90, 1], 'How far the balance rocks the nose, at the edge.'],
        ['REV_SWING', 'Revs swing', '°', [0, 60, 1], 'Extra tail out at full revs.'],
        ['SPIN_TURN', 'Testacoda whirl', '°/s', [0, 1500, 10]],
        ['BACKFIRE_FROM', 'Backfire from revs', 'share', [0, 1, 0.01], 'Lifting off with the revs at least this high pops flame from the exhaust (also on reaching the green).'],
        ['BACKFIRE_SIZE', 'Backfire size', 'times', [0, 3, 0.05]],
        ['BACKFIRE_MS', 'Backfire lasts', 'ms', [0, 1000, 10], '0 turns backfires off.'],
        ['MARK_WIDTH', 'Tyre mark width', 'px', [1, 20, 1]],
        ['MARK_DARKNESS', 'Tyre mark darkness', 'share', [0, 1, 0.01]],
        ['MARK_TRAIL', 'Tyre marks last', 'steps', [10, 3000, 10]],
        ['RING', 'Donut ring', 'share', [0, 1, 0.01], 'Opacity of the faint ring where the donut runs.'],
    ]),
    group('CAR TINTS (THE REVS ON THE CAR)', 'LOOK', [
        ['TINT_WHITE', 'White tint', 'share', [0, 1, 0.01], 'Opacity of the white over the black car, at the top of the white.'],
        ['TINT_GREEN', 'Green tint', 'share', [0, 1, 0.01], 'Opacity of the green, in the green.'],
        ['TINT_HOT', 'Orange tint', 'share', [0, 1, 0.01], 'Opacity of the orange as the engine heats.'],
        ['TINT_RED', 'Red tint', 'share', [0, 1, 0.01], 'Opacity of the red flashes just before overheating.'],
        ['TINT_STALL', 'Stall tint', 'share', [0, 1, 0.01], 'Opacity of the dull red while stalled.'],
        ['GREEN_FLASH', 'Green arrival flash', 'share', [0, 1, 0.01], 'How white the car flashes on reaching the green.'],
        ['HOT_FLASH', 'Overheat flashing', '/s', [0, 20, 0.5], 'Red flashes a second just before overheating (faster as it gets hotter).'],
    ]),
    group('CAMERA', 'LOOK', [
        ['SCALE', 'Zoom', 'px/m', [10, 100, 1], 'Pixels per metre of ground.'],
        ['CENTRE_X', 'Junction on screen X', 'px', [0, 1920, 1]],
        ['CENTRE_Y', 'Junction on screen Y', 'px', [0, 1080, 1]],
    ], true),
    group('SHAKES', 'LOOK', [
        ['HIT_SHAKE', 'Blue hit shake', 'share', [0, 0.05, 0.001], 'A hard jolt, as a share of the screen.'],
        ['HIT_SHAKE_MS', 'Blue hit shake lasts', 'ms', [0, 1500, 10]],
        ['BOOST_SHAKE', 'Boost rumble', 'share', [0, 0.05, 0.001]],
        ['BOOST_SHAKE_MS', 'Boost rumble lasts', 'ms', [0, 1500, 10]],
        ['BOOST_ZOOM', 'Boost zoom punch', 'share', [0, 0.3, 0.005], 'Extra zoom for a moment.'],
        ['BOOST_ZOOM_MS', 'Boost zoom lasts', 'ms', [0, 1500, 10], 'There and back.'],
        ['STAB_SHAKE', 'Pedal stab shake', 'share', [0, 0.02, 0.0005], '0 is off.'],
        ['STAB_FROM', 'Stab shake from speed', 'share', [0, 1, 0.01]],
    ]),
];

export const ALL_GROUPS: DonutGroup[] = [...DRIVING_GROUPS, ...GREEN_GROUPS, ...STEERING_GROUPS, ...WORLD_GROUPS, ...LOOK_GROUPS];

/** What differs from the defaults, by table: what's saved and what "Copy changes" gives. */
export type DonutChanges = Partial<Record<TableName, Record<string, number>>>;

const tables = TABLES as unknown as Record<TableName, Record<string, number>>;
const DEFAULTS: Record<TableName, Record<string, number>> =
    Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, { ...table }])) as Record<TableName, Record<string, number>>;

export function settingValue(setting: DonutSetting): number {
    return tables[setting.table][setting.key];
}

export function setSetting(setting: DonutSetting, value: number): void {
    tables[setting.table][setting.key] = value;
}

export function settingDefault(setting: DonutSetting): number {
    return DEFAULTS[setting.table][setting.key];
}

/** Only what differs from the defaults. */
export function donutChanges(): DonutChanges {
    const changes: DonutChanges = {};
    for (const name of Object.keys(tables) as TableName[]) {
        for (const [key, value] of Object.entries(tables[name])) {
            if (value === DEFAULTS[name][key]) continue;
            (changes[name] ??= {})[key] = value;
        }
    }
    return changes;
}

/** Every value. */
export function allDonutSettings(): DonutChanges {
    return Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, { ...table }])) as DonutChanges;
}

/** Everything back to the defaults. */
export function resetDonutTuning(): void {
    for (const name of Object.keys(tables) as TableName[]) Object.assign(tables[name], DEFAULTS[name]);
}

/**
 * The defaults with `changes` on top (unknown names and non-numbers skipped).
 * Returns how many values it set.
 */
export function applyDonutChanges(changes: unknown): number {
    resetDonutTuning();
    if (!changes || typeof changes !== 'object') return 0;
    let applied = 0;
    for (const [name, values] of Object.entries(changes as Record<string, unknown>)) {
        if (!(name in tables) || !values || typeof values !== 'object') continue;
        const table = tables[name as TableName];
        for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
            if (!(key in table) || typeof value !== 'number' || !Number.isFinite(value)) continue;
            table[key] = value;
            applied++;
        }
    }
    return applied;
}

/** How many values differ from the defaults. */
export function changeCount(groups: DonutGroup[] = ALL_GROUPS): number {
    return groups.reduce((count, g) => count + g.settings.filter(s => settingValue(s) !== settingDefault(s)).length, 0);
}
