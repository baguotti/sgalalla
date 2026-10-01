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

/** The DRIVING panel. */
export const DRIVING_GROUPS: DonutGroup[] = [
    group('PEDAL AND REVS', 'DONUT', [
        ['PEDAL_TIME', 'Pedal travel', 's', [0.02, 0.5, 0.01], 'Seconds for the pedal to go all the way down or up.'],
        ['REV_UP', 'Revs climb', '/s', [0.2, 8, 0.1], 'How quickly the revs climb towards the pedal.'],
        ['REV_DOWN', 'Revs fall', '/s', [0.2, 6, 0.1], 'How quickly they fall with the pedal up.'],
        ['REV_BRAKE', 'Brake drops revs', '/s', [0, 10, 0.1], 'Extra fall while braking.'],
        ['REV_RED', 'Red line', 'share', [0.3, 1, 0.01], 'Revs past this add no speed or width, only push the tail out.'],
        ['SWEET_LOW', 'Sweet spot from', 'share', [0, 1, 0.01], 'Revs between this and the red line score more.'],
        ['SWEET_BONUS', 'Sweet spot points ×', 'times', [1, 5, 0.1]],
    ]),
    group('SPEED AND SIZE', 'DONUT', [
        ['SPEED_MIN', 'Slowest', 'm/s', [0, 30, 0.5], 'Speed with the revs at nothing.'],
        ['SPEED_MAX', 'Fastest', 'm/s', [1, 50, 0.5], 'Speed at the red line.'],
        ['SPEED_FOLLOW', 'Speed follows revs', '/s', [0.2, 12, 0.1], 'How quickly the speed catches up with the revs.'],
        ['BRAKE', 'Brake', 'm/s²', [0, 40, 0.5]],
        ['RADIUS_MIN', 'Tightest donut', 'm', [0.5, 20, 0.1], 'Radius with the revs at nothing.'],
        ['RADIUS_MAX', 'Widest donut', 'm', [1, 30, 0.1], 'Radius at the red line.'],
        ['GROW', 'Widening', 'm/s', [0.1, 25, 0.1], 'How fast the donut widens towards the revs\' size.'],
        ['SHRINK', 'Tightening', 'm/s', [0.1, 25, 0.1], 'How fast it tightens back.'],
        ['BRAKE_SHRINK', 'Brake tightening', 'm/s', [0, 25, 0.1]],
        ['CENTRE_X', 'Donut centre X', 'm', [-15, 15, 0.1], 'Where on the junction the donut circles round (across, down-right on screen).'],
        ['CENTRE_Y', 'Donut centre Y', 'm', [-15, 15, 0.1], 'The other way (down-left on screen).'],
    ]),
];

/** The BALANCE panel. */
export const BALANCE_GROUPS: DonutGroup[] = [
    group('THE PEDAL ON THE TAIL', 'DONUT', [
        ['KICK', 'Stab kick', '', [0, 10, 0.1], 'How hard a stab of the pedal pushes the tail out (at top speed).'],
        ['KICK_TIME', 'Kick lasts', 's', [0.05, 2, 0.01], 'The kick pushes over about this long: longer is a slower rise.'],
        ['BITE_SPREAD', 'Kick varies', 'share', [0, 1, 0.01], 'How differently each stab bites, either way.'],
        ['THROTTLE_PUSH', 'Revs push', '', [0, 4, 0.05], 'Steady push on the tail from the revs, at speed.'],
        ['SNAP', 'Lift pull-back', '', [0, 10, 0.1], 'Lifting pulls the tail back, more the further out it is.'],
        ['SNAP_FROM', 'Pull-back from', 'share', [0, 1, 0.01], 'Lifting only pulls it back once it\'s past this.'],
        ['OVERREV_PUSH', 'Limiter push', '', [0, 8, 0.1], 'Push on the tail at the limiter, once fully built up.'],
        ['LIMITER_BUILD', 'Limiter builds over', 's', [0.1, 10, 0.1], 'Seconds at the limiter for its push to build up fully.'],
    ]),
    group('STICK ON A FINGER', 'DONUT', [
        ['TIP', 'Tips over', '', [0, 2, 0.01], 'How much the drift tips further by itself.'],
        ['WOBBLE', 'Random wobble', '', [0, 3, 0.01], 'Random gusts on the balance (more at the limiter).'],
        ['STEER', 'Counter-steer', '', [0, 10, 0.1], 'Push of left/right at full lock.'],
        ['DAMPING', 'Settling', '', [0, 10, 0.1], 'How quickly the swing settles.'],
        ['SPIN_GRACE', 'Edge grace', 's', [0, 2, 0.01], 'Past the edge, the car spins out only after this long.'],
        ['CLEAN', 'Clean band', 'share', [0, 1, 0.01], 'Inside this band the drift is clean and scores ×1.5.'],
    ]),
    group('SPIN-OUTS AND COMBO', 'DONUT', [
        ['SPIN_SECONDS', 'Spin-out lasts', 's', [0.2, 5, 0.1]],
        ['SPIN_PENALTY', 'Spin-out costs', 'pts', [0, 2000, 10]],
        ['SPIN_SPEED_KEPT', 'Speed kept', 'share', [0, 1, 0.01], 'Share of speed and revs kept after a spin-out.'],
        ['COMBO_RADIUS', 'Combo from radius', 'm', [0, 30, 0.1], 'Only loops at least this wide build the combo.'],
        ['COMBO_STEP', 'Combo per loop', '', [0, 2, 0.05]],
        ['COMBO_MAX', 'Combo up to', '×', [1, 10, 0.25]],
    ]),
];

/** The PEOPLE AND ROAD panel. */
export const WORLD_GROUPS: DonutGroup[] = [
    group('PEOPLE', 'PEDESTRIANS', [
        ['SPAWN_MIN', 'New person every (min)', 's', [0.1, 10, 0.1]],
        ['SPAWN_MAX', 'New person every (max)', 's', [0.1, 10, 0.1]],
        ['BOOSTER_SHARE', 'Green share', 'share', [0, 1, 0.01], 'Share of people that give a boost.'],
        ['WALK_SPEED', 'Red walk speed', 'm/s', [0, 6, 0.1]],
        ['JOG_SPEED', 'Green jog speed', 'm/s', [0, 6, 0.1]],
        ['HIT_DISTANCE', 'Hit distance', 'm', [0.5, 6, 0.1], 'Car and person closer than this collide.'],
        ['HIT_PENALTY', 'Red costs', 'pts', [0, 3000, 10]],
        ['HIT_SPEED_KEPT', 'Red: speed kept', 'share', [0, 1, 0.01]],
        ['BOOST_POINTS', 'Green gives', 'pts', [0, 1000, 5]],
        ['BOOST_SPEED', 'Green boost', 'm/s', [0, 20, 0.1]],
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
        ['SLIP_SWING', 'Balance swing', '°', [0, 90, 1], 'How far the balance swings the nose, at the edge.'],
        ['REV_SWING', 'Revs swing', '°', [0, 60, 1], 'Extra tail out at full revs.'],
        ['SPIN_TURN', 'Spin-out whirl', '°/s', [0, 1500, 10]],
        ['MARK_WIDTH', 'Tyre mark width', 'px', [1, 20, 1]],
        ['MARK_DARKNESS', 'Tyre mark darkness', 'share', [0, 1, 0.01]],
        ['MARK_TRAIL', 'Tyre marks last', 'steps', [10, 3000, 10]],
        ['RING', 'Donut ring', 'share', [0, 1, 0.01], 'Opacity of the faint ring where the donut runs.'],
    ]),
    group('CAMERA', 'LOOK', [
        ['SCALE', 'Zoom', 'px/m', [10, 100, 1], 'Pixels per metre of ground.'],
        ['CENTRE_X', 'Junction on screen X', 'px', [0, 1920, 1]],
        ['CENTRE_Y', 'Junction on screen Y', 'px', [0, 1080, 1]],
    ], true),
    group('SHAKES', 'LOOK', [
        ['HIT_SHAKE', 'Red hit shake', 'share', [0, 0.05, 0.001], 'A hard jolt, as a share of the screen.'],
        ['HIT_SHAKE_MS', 'Red hit shake lasts', 'ms', [0, 1500, 10]],
        ['BOOST_SHAKE', 'Boost rumble', 'share', [0, 0.05, 0.001]],
        ['BOOST_SHAKE_MS', 'Boost rumble lasts', 'ms', [0, 1500, 10]],
        ['BOOST_ZOOM', 'Boost zoom punch', 'share', [0, 0.3, 0.005], 'Extra zoom for a moment.'],
        ['BOOST_ZOOM_MS', 'Boost zoom lasts', 'ms', [0, 1500, 10], 'There and back.'],
        ['STAB_SHAKE', 'Pedal stab shake', 'share', [0, 0.02, 0.0005], '0 is off.'],
        ['STAB_FROM', 'Stab shake from speed', 'share', [0, 1, 0.01]],
    ]),
];

export const ALL_GROUPS: DonutGroup[] = [...DRIVING_GROUPS, ...BALANCE_GROUPS, ...WORLD_GROUPS, ...LOOK_GROUPS];

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
