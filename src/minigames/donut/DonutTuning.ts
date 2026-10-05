/**
 * The DERAPATE Lab's settings, in plain words, in its two tabs: LOOK (how it
 * looks and sounds: the lights, the camera, the car, the effects, the HUD, the
 * sound) and FEEL (how it plays: a short list of what changes the driving,
 * the balance and the people, in clear units). Each setting shows one or more
 * of the games' plain numbers (DONUT, PEDESTRIANS, JUNCTION, LOOK, LIGHT),
 * sometimes worked out (the seconds to the green from how fast the revs
 * climb); the rest are left out on purpose (HIDDEN) and keep their values.
 * Also the live tuning: values set straight on those objects, the defaults
 * kept to put back, only the changes saved and copied, the street lamps
 * included. Plain data (the tests check it).
 */
import { LAMPS, LIGHT, lampsAreDefault, lampsFrom, resetLamps, type LampDef } from './DonutLight';
import { LOOK } from './DonutLook';
import { DONUT, JUNCTION, PEDESTRIANS } from './DonutSim';

const TABLES = { DONUT, PEDESTRIANS, JUNCTION, LOOK, LIGHT } as const;
export type TableName = keyof typeof TABLES;

type Get = (table: TableName, key: string) => number;
type Put = (table: TableName, key: string, value: number) => void;

export interface DonutSetting {
    label: string;
    /** Shown after the value ('colour': a colour picker instead of a slider). */
    unit: string;
    hint?: string;
    /** Slider min, max, step; typed values may go past them. */
    range: readonly [number, number, number];
    /** Changing it moves the ground: the junction is drawn again. */
    redraw?: boolean;
    /** The stored numbers it shows, as `TABLE.KEY`. */
    keys: readonly string[];
    /** The value shown, from the stored numbers. */
    read(get: Get): number;
    /** Stores a value shown. */
    write(value: number, put: Put, get: Get): void;
}

export interface DonutGroup {
    title: string;
    settings: DonutSetting[];
}

type Row = [key: string, label: string, unit: string, range: readonly [number, number, number], hint?: string];

/** A group of plain settings, each one number in `table` shown as it is. */
function group(title: string, table: TableName, rows: Row[], redraw = false): DonutGroup {
    return { title, settings: rows.map(([key, label, unit, range, hint]) => plain(table, key, label, unit, range, hint, redraw)) };
}

function plain(table: TableName, key: string, label: string, unit: string, range: readonly [number, number, number], hint?: string,
    redraw = false): DonutSetting {
    return { label, unit, hint, range, redraw, keys: [`${table}.${key}`], read: get => get(table, key), write: (value, put) => put(table, key, value) };
}

/** One number shown times `factor` (km/h from m/s, % from a share). */
function scaled(table: TableName, key: string, factor: number, label: string, unit: string, range: readonly [number, number, number],
    hint: string): DonutSetting {
    return {
        label, unit, hint, range, keys: [`${table}.${key}`],
        read: get => round2(get(table, key) * factor),
        write: (value, put) => put(table, key, value / factor),
    };
}

/** How long (seconds) the white part of the bar takes to fill or empty at `key`'s rate (share of the bar a second). */
function seconds(key: 'REV_UP' | 'REV_DOWN', label: string, hint: string): DonutSetting {
    return {
        label, unit: 's', hint, range: [0.2, 6, 0.05], keys: [`DONUT.${key}`],
        read: get => round2(get('DONUT', 'GREEN_AT') / get('DONUT', key)),
        write: (value, put, get) => put('DONUT', key, get('DONUT', 'GREEN_AT') / Math.max(0.05, value)),
    };
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}

// ─── FEEL: how it plays ───

/** The DRIVING panel: the pedal, the speed, the donut's size, and the green. */
export const DRIVING_GROUPS: DonutGroup[] = [
    {
        title: 'DRIVING', settings: [
            seconds('REV_UP', 'Seconds to the green', 'Holding the pedal from standing still, this long until the green.'),
            seconds('REV_DOWN', 'Seconds to stop', 'Off the pedal, this long from top speed to standing still.'),
            scaled('DONUT', 'SPEED_MAX', 3.6, 'Top speed', 'km/h', [10, 180, 1], 'At the top of the white and in the green (white people in a row raise it).'),
            plain('DONUT', 'RADIUS_MIN', 'Tightest donut', 'm', [0.5, 20, 0.1], 'The circle\'s radius standing still.'),
            plain('DONUT', 'RADIUS_MAX', 'Widest donut', 'm', [1, 30, 0.1], 'The circle\'s radius at top speed.'),
        ],
    },
    {
        title: 'THE GREEN', settings: [
            plain('DONUT', 'OVERHEAT_SECONDS', 'Seconds in the green', 's', [0.5, 15, 0.1], 'The pedal held in the green this long and the engine overheats (MOTORE FUSO).'),
            plain('DONUT', 'LIFT_GRACE', 'Short lift keeps it', 's', [0, 3, 0.05], 'Letting go for less than this keeps you in the green (the engine cools meanwhile).'),
        ],
    },
];

/** The BALANCE panel: the steering wheel. */
export const BALANCE_GROUPS: DonutGroup[] = [
    {
        title: 'BALANCE', settings: [
            plain('DONUT', 'DRIFT', 'Wheel wanders', '', [0, 4, 0.05], 'How much the balance (the steering wheel) drifts by itself; 0 never.'),
            plain('DONUT', 'GREEN_DRIFT', 'Wanders in the green ×', 'times', [0, 6, 0.1], 'In the green it drifts this many times more.'),
            plain('DONUT', 'STEER', 'Steering strength', '', [0, 30, 0.1], 'How hard left and right push it back, at top speed (weaker slower).'),
            plain('DONUT', 'EDGE_GRACE', 'Seconds at the edge', 's', [0, 3, 0.05], 'In the green, the wheel turned all the way this long is a testacoda.'),
        ],
    },
];

/** The PEOPLE AND POINTS panel. */
export const PEOPLE_GROUPS: DonutGroup[] = [
    {
        title: 'PEOPLE', settings: [
            {
                label: 'A person about every', unit: 's', hint: 'How often someone steps out (give or take a third).', range: [0.3, 15, 0.1],
                keys: ['PEDESTRIANS.SPAWN_MIN', 'PEDESTRIANS.SPAWN_MAX'],
                read: get => round2((get('PEDESTRIANS', 'SPAWN_MIN') + get('PEDESTRIANS', 'SPAWN_MAX')) / 2),
                write: (value, put) => {
                    put('PEDESTRIANS', 'SPAWN_MIN', (value * 2) / 3);
                    put('PEDESTRIANS', 'SPAWN_MAX', (value * 4) / 3);
                },
            },
            scaled('PEDESTRIANS', 'BOOSTER_SHARE', 100, 'White people', '%', [0, 100, 1], 'Share of people who give a boost; the rest are blue.'),
            scaled('PEDESTRIANS', 'BOOST_SPEED', 100, 'Boost burst', '%', [0, 100, 1], 'A white person\'s burst of speed, above the top speed.'),
            scaled('DONUT', 'SPEED_BONUS_MAX', 100, 'Combo raises top speed', '%', [0, 200, 1], 'White people in a row raise the top speed, by up to this much.'),
        ],
    },
    {
        title: 'POINTS', settings: [
            plain('PEDESTRIANS', 'BOOST_POINTS', 'White person gives', 'pts', [0, 1000, 5]),
            plain('PEDESTRIANS', 'HIT_PENALTY', 'Blue person costs', 'pts', [0, 3000, 10], 'A blue hit also ends the combo and the green.'),
            plain('DONUT', 'SPIN_PENALTY', 'Testacoda costs', 'pts', [0, 3000, 10]),
            plain('DONUT', 'OVERHEAT_PENALTY', 'Overheating costs', 'pts', [0, 3000, 10]),
        ],
    },
];

// ─── LOOK: how it looks and sounds ───

/** The LIGHTS panel's settings (its lamps have their own editor). */
export const LIGHT_GROUPS: DonutGroup[] = [
    group('AMBIENT', 'LIGHT', [
        ['AMBIENT_GROUND', 'Road and buildings', 'share', [0, 1.5, 0.01], 'How bright they are where no light reaches (1: as drawn).'],
        ['AMBIENT_CAR', 'Car', 'share', [0, 1.5, 0.01]],
        ['AMBIENT_PEOPLE', 'People and smoke', 'share', [0, 1.5, 0.01]],
        ['AMBIENT_COLOUR', 'Colour', 'colour', [0, 0xffffff, 1], 'The sky\'s light: dusk blue.'],
    ]),
    group('LAMPS AND RIM', 'LIGHT', [
        ['LAMPS', 'All lamps', 'times', [0, 3, 0.05], 'Every street lamp\'s strength.'],
        ['HAZE', 'Glow in the air', 'times', [0, 3, 0.05], 'Round every lamp\'s head, on top of each lamp\'s own glow.'],
        ['RIM_WIDTH', 'Car rim width', 'px', [0, 4, 0.1], 'The light on the car\'s edges facing a lamp (pixels of the renders; 0 none).'],
        ['RIM', 'Car rim strength', 'times', [0, 4, 0.05]],
    ]),
    group('CAR LIGHTS', 'LIGHT', [
        ['HEADLIGHTS', 'Headlights', 'times', [0, 3, 0.05], 'Two cones of light ahead of the car.'],
        ['HEADLIGHT_REACH', 'Headlights reach', 'm', [0, 40, 0.5]],
        ['HEADLIGHT_SPREAD', 'Headlights spread', '°', [1, 80, 1], 'How wide each cone opens, either side of straight ahead.'],
        ['HEADLIGHT_COLOUR', 'Headlights colour', 'colour', [0, 0xffffff, 1]],
        ['TAILLIGHTS', 'Tail lights', 'times', [0, 3, 0.05], 'A red glow behind the car.'],
        ['TAILLIGHT_REACH', 'Tail lights reach', 'm', [0, 15, 0.5]],
        ['TAILLIGHT_COLOUR', 'Tail lights colour', 'colour', [0, 0xffffff, 1]],
    ]),
    group('FLAME AND FLASHES', 'LIGHT', [
        ['FLAME_LIGHT', 'Exhaust flame light', 'times', [0, 4, 0.05], 'The backfire lights what\'s round it while it burns.'],
        ['FLAME_LIGHT_REACH', 'Flame light reach', 'm', [0, 20, 0.5]],
        ['BOOST_FLASH', 'Boost flash', 'times', [0, 4, 0.05], 'A burst of light where a white person is hit.'],
        ['BOOST_FLASH_REACH', 'Boost flash reach', 'm', [0, 30, 0.5]],
        ['BOOST_FLASH_MS', 'Boost flash lasts', 'ms', [0, 2000, 10]],
        ['HIT_FLASH', 'Blue hit flash', 'times', [0, 4, 0.05]],
        ['HIT_FLASH_REACH', 'Blue hit flash reach', 'm', [0, 30, 0.5]],
        ['HIT_FLASH_MS', 'Blue hit flash lasts', 'ms', [0, 2000, 10]],
    ]),
];

/** The CAMERA panel: the camera's picture, where it looks, and the shakes. */
export const CAMERA_GROUPS: DonutGroup[] = [
    group('BLOOM', 'LIGHT', [
        ['BLOOM_THRESHOLD', 'Bloom from', 'share', [0, 1, 0.01], 'Brighter than this glows.'],
        ['BLOOM_STRENGTH', 'Bloom strength', 'times', [0, 3, 0.05]],
        ['BLOOM_SPREAD', 'Bloom spread', 'times', [0.5, 4, 0.1]],
    ]),
    group('GRADING', 'LIGHT', [
        ['EXPOSURE', 'Exposure', 'times', [0.3, 2, 0.01], 'Overall brightness.'],
        ['TEMPERATURE', 'Temperature', '', [-1, 1, 0.01], 'Warm (+) or cold (−).'],
        ['SATURATION', 'Saturation', 'times', [0, 2, 0.01]],
        ['CONTRAST', 'Contrast', 'times', [0.5, 1.5, 0.01]],
        ['VIGNETTE', 'Vignette', 'share', [0, 1, 0.01], 'Darker corners.'],
    ]),
    group('LENS', 'LIGHT', [
        ['TILT_SHIFT', 'Tilt-shift', 'share', [0, 1, 0.01], 'The miniature look: blur above and below a sharp band.'],
        ['TILT_FOCUS', 'Sharp band at', 'share', [0, 1, 0.01], 'Its height on screen: 0 bottom, 1 top.'],
        ['TILT_BAND', 'Sharp band width', 'share', [0, 1, 0.01]],
        ['GRAIN', 'Film grain', 'share', [0, 0.3, 0.005]],
        ['GRAIN_SIZE', 'Grain size', 'px', [1, 4, 0.1]],
        ['ABERRATION', 'Colour fringes', 'share', [0, 1, 0.01], 'Red and blue pulled apart toward the edges.'],
        ['CRT', 'CRT screen', 'share', [0, 1, 0.01], 'Scanlines and phosphor stripes (0 off).'],
        ['CRT_LINE_SIZE', 'CRT line spacing', 'px', [2, 6, 0.5]],
        ['CRT_MASK', 'CRT stripes', 'share', [0, 1, 0.01]],
    ]),
    group('VIEW', 'LOOK', [
        ['SCALE', 'Zoom', 'px/m', [10, 100, 1], 'Pixels per metre of ground.'],
        ['CENTRE_X', 'Junction on screen X', 'px', [0, 1920, 1]],
        ['CENTRE_Y', 'Junction on screen Y', 'px', [0, 1080, 1]],
    ], true),
    group('SHAKES', 'LOOK', [
        ['HIT_SHAKE', 'Blue hit shake', 'share', [0, 0.05, 0.001], 'A hard jolt, as a share of the screen (a testacoda and an overheat too).'],
        ['HIT_SHAKE_MS', 'Blue hit shake lasts', 'ms', [0, 1500, 10]],
        ['BOOST_SHAKE', 'Boost rumble', 'share', [0, 0.05, 0.001]],
        ['BOOST_SHAKE_MS', 'Boost rumble lasts', 'ms', [0, 1500, 10]],
        ['BOOST_ZOOM', 'Boost zoom punch', 'share', [0, 0.3, 0.005], 'Extra zoom for a moment.'],
        ['BOOST_ZOOM_MS', 'Boost zoom lasts', 'ms', [0, 1500, 10], 'There and back.'],
        ['STAB_SHAKE', 'Pedal stab shake', 'share', [0, 0.02, 0.0005], 'A fresh stab of the pedal at speed (0 off).'],
        ['STAB_FROM', 'Stab shake from speed', 'share', [0, 1, 0.01]],
    ]),
];

/** The CAR panel. */
export const CAR_GROUPS: DonutGroup[] = [
    group('CAR', 'LOOK', [
        ['CAR_SIZE', 'Car size ×', 'times', [0.5, 4, 0.05], 'Drawn this much bigger than life.'],
        ['CAR_SPRITE_SCALE', 'Sprite size ×', 'times', [0.3, 3, 0.01], 'On top of the car size.'],
        ['CAR_SPRITE_Y', 'Sprite down', 'px', [-80, 80, 1], 'Nudges the sprite up or down on its shadow, to sit it on the ground.'],
        ['CAR_SHADOW', 'Car shadow', 'share', [0, 1, 0.01]],
        ['NOSE_IN', 'Nose into the circle', '°', [0, 150, 1], '0 points along the circle, 90 at the centre.'],
        ['SLIP_SWING', 'Balance swing', '°', [0, 90, 1], 'How far the balance rocks the nose, at the edge.'],
        ['REV_SWING', 'Revs swing', '°', [0, 60, 1], 'Extra tail out at full revs.'],
        ['SPIN_TURN', 'Testacoda whirl', '°/s', [0, 1500, 10]],
    ]),
    group('SUSPENSION', 'LOOK', [
        ['SUSP_LEAN', 'Cornering', 'px', [0, 10, 0.1], 'How much lower the body sits, loaded, at full cornering.'],
        ['SUSP_SQUAT', 'Speeding up', 'px', [0, 10, 0.1], 'How far it lifts speeding up (dips slowing).'],
        ['SUSP_BUMP', 'Bump', 'px', [0, 20, 0.5], 'How hard hitting someone (or a testacoda) bounces it.'],
        ['SUSP_RUMBLE', 'Rumble', 'px', [0, 3, 0.05], 'Shaking at speed.'],
        ['SUSP_TRAVEL', 'Travel', 'px', [0, 15, 0.5], 'The most the body moves up or down over the wheels.'],
        ['SUSP_FREQ', 'Bounce', '/s', [0.2, 10, 0.1], 'The springs\' bounces a second (lower is softer).'],
        ['SUSP_DAMP', 'Damping', 'share', [0, 1.5, 0.01], '0 bounces on and on, 1 settles without overshooting.'],
    ]),
    group('TINTS (THE REVS ON THE CAR)', 'LOOK', [
        ['TINT_WHITE', 'White tint', 'share', [0, 1, 0.01], 'Opacity of the white over the black car, at the top of the white.'],
        ['TINT_GREEN', 'Green tint', 'share', [0, 1, 0.01], 'Opacity of the green, in the green.'],
        ['TINT_HOT', 'Orange tint', 'share', [0, 1, 0.01], 'Opacity of the orange as the engine heats.'],
        ['TINT_RED', 'Red tint', 'share', [0, 1, 0.01], 'Opacity of the red flashes just before overheating.'],
        ['TINT_STALL', 'Stall tint', 'share', [0, 1, 0.01], 'Opacity of the dull red while stalled.'],
        ['GREEN_FLASH', 'Green arrival flash', 'share', [0, 1, 0.01], 'How white the car flashes on reaching the green.'],
        ['HOT_FLASH', 'Overheat flashing', '/s', [0, 20, 0.5], 'Red flashes a second just before overheating (faster as it gets hotter).'],
    ]),
    group('BACKFIRE FLAME', 'LOOK', [
        ['BACKFIRE_FROM', 'Backfire from revs', 'share', [0, 1, 0.01], 'Lifting off with the revs at least this high pops flame from the exhaust (also on reaching the green).'],
        ['BACKFIRE_SIZE', 'Backfire size', 'times', [0, 3, 0.05]],
        ['BACKFIRE_MS', 'Backfire lasts', 'ms', [0, 1000, 10], '0 turns backfires off.'],
    ]),
];

/** The EFFECTS panel: smoke, tyre marks, the ring, and the junction's layout. */
export const EFFECTS_GROUPS: DonutGroup[] = [
    group('SMOKE', 'LOOK', [
        ['SMOKE', 'Tyre smoke', '/s', [0, 800, 1], 'Smoke cubes a second from the rear tyres at full wheelspin; 0 turns it off.'],
        ['SMOKE_SIZE', 'Smoke size ×', 'times', [0.2, 4, 0.05]],
        ['SMOKE_LIFE', 'Smoke lasts', 's', [0.2, 5, 0.1]],
        ['SMOKE_RISE', 'Smoke rises', 'm/s', [0, 4, 0.05]],
        ['SMOKE_OPACITY', 'Smoke thickness', 'share', [0, 1, 0.01]],
        ['REAR_AXLE', 'Rear axle behind centre', 'm', [0, 3, 0.01], 'Where the rear tyres are (before car size): the marks and smoke come from there.'],
        ['HALF_TRACK', 'Rear tyres apart (half)', 'm', [0, 2, 0.01]],
    ]),
    group('TYRE MARKS', 'LOOK', [
        ['MARK_WIDTH', 'Width', 'm', [0.05, 1, 0.01], 'Before car size.'],
        ['MARK_DARKNESS', 'Darkness', 'share', [0, 1, 0.01], 'A fresh strip; laps over it build up darker.'],
        ['MARK_FADE', 'Fading', 'share', [0, 0.5, 0.005], 'Share that fades a second (0 never).'],
        ['RING', 'Donut ring', 'share', [0, 1, 0.01], 'Opacity of the faint ring where the donut runs.'],
    ]),
    group('JUNCTION', 'JUNCTION', [
        ['ROAD_HALF_WIDTH', 'Road half width', 'm', [3, 15, 0.1]],
        ['CROSSING_AT', 'Crossings at', 'm', [4, 30, 0.1], 'How far the middle of each zebra crossing is from the centre (where people cross).'],
        ['CROSSING_WIDTH', 'Crossing width', 'm', [1, 8, 0.1]],
    ], true),
];

/** The HUD panel. */
export const HUD_GROUPS: DonutGroup[] = [
    group('WHEEL AND REV BAR', 'LOOK', [
        ['WHEEL_X', 'Wheel across', 'px', [0, 1920, 1], 'Where the steering wheel\'s centre is across the screen.'],
        ['WHEEL_Y', 'Wheel down', 'px', [600, 1800, 1], 'Its centre down the screen: past 1080 it\'s below the bottom edge, so only the top shows.'],
        ['WHEEL_SCALE', 'Wheel size', 'times', [0.1, 2, 0.01]],
        ['WHEEL_TURN', 'Wheel turn at the edge', '°', [0, 360, 1], 'The wheel shows the balance: this far round with it at the edge.'],
        ['WHEEL_EASE', 'Wheel follows', '/s', [1, 40, 0.5], 'How quickly the wheel follows the balance.'],
        ['REV_BAR_X', 'Rev bar across', 'px', [0, 1920, 1]],
        ['REV_BAR_Y', 'Rev bar bottom', 'px', [100, 1080, 1]],
        ['REV_BAR_HEIGHT', 'Rev bar height', 'px', [40, 900, 1]],
        ['REV_BAR_WIDTH', 'Rev bar width', 'px', [6, 120, 1]],
    ]),
];

/** The SOUND panel. */
export const SOUND_GROUPS: DonutGroup[] = [
    group('SOUND', 'LOOK', [
        ['ENGINE_VOLUME', 'Engine', 'share', [0, 1.5, 0.01], 'On top of the SFX volume in Settings.'],
        ['ENGINE_PITCH', 'Engine pitch climb', 'share', [0, 1.5, 0.01], 'How much higher the engine sounds at the top of the white (0.75 at rest, plus this).'],
        ['SCREECH_VOLUME', 'Tyre screech', 'share', [0, 2, 0.01]],
        ['HOT_VOLUME', 'Motore caldo crackle', 'share', [0, 1.5, 0.01], 'The straight-pipe crackle near overheating, rising in pitch.'],
        ['HISS_VOLUME', 'Overheat hiss', 'share', [0, 1.5, 0.01], 'Over the engine dying when it overheats.'],
        ['FLAME_VOLUME', 'Flame pops', 'share', [0, 1.5, 0.01], 'The pops and blow-off with the exhaust flame.'],
        ['REV_VOLUME', 'Rev on a stab', 'share', [0, 1.5, 0.01], 'The vroom on a fresh stab of the pedal.'],
        ['REV_CHANCE', 'Rev chance', 'share', [0, 1, 0.01], 'How often a fresh stab gets a rev.'],
        ['REV_GAP', 'Revs at least apart', 's', [0, 10, 0.1]],
        ['EFFECTS_VOLUME', 'Effects', 'share', [0, 1.5, 0.01], 'Boost, hits, pops, blow-off, overheating, testacoda.'],
        ['MUSIC_VOLUME', 'Soundtrack', 'share', [0, 1.5, 0.01], 'DERAPATE\'s song (on top of the music volume in Settings).'],
    ]),
];

export const LOOK_TAB_GROUPS: DonutGroup[] = [...LIGHT_GROUPS, ...CAMERA_GROUPS, ...CAR_GROUPS, ...EFFECTS_GROUPS, ...HUD_GROUPS, ...SOUND_GROUPS];
export const FEEL_TAB_GROUPS: DonutGroup[] = [...DRIVING_GROUPS, ...BALANCE_GROUPS, ...PEOPLE_GROUPS];
export const ALL_GROUPS: DonutGroup[] = [...LOOK_TAB_GROUPS, ...FEEL_TAB_GROUPS];

const FINE_TUNING = 'fine-tuning: the FEEL settings shown cover it';
const SCORING = 'scoring detail';
/**
 * Numbers the Lab leaves out on purpose, and why. They keep their values in
 * the code; saved or pasted changes to them are skipped.
 */
export const HIDDEN: Readonly<Record<string, string>> = {
    'DONUT.CENTRE_X': 'the donut circles the junction\'s centre',
    'DONUT.CENTRE_Y': 'the donut circles the junction\'s centre',
    'DONUT.GREEN_AT': 'where the bar turns green; the seconds to the green and to stop cover it',
    'DONUT.SPEED_BONUS_SCALE': FINE_TUNING,
    'DONUT.SPEED_FOLLOW': FINE_TUNING,
    'DONUT.GROW': FINE_TUNING,
    'DONUT.SHRINK': FINE_TUNING,
    'DONUT.RETURN': FINE_TUNING,
    'DONUT.COOL_SECONDS': FINE_TUNING,
    'DONUT.GREEN_BONUS': SCORING,
    'DONUT.STEER_SLOW': FINE_TUNING,
    'DONUT.DAMPING': FINE_TUNING,
    'DONUT.CENTRING': FINE_TUNING,
    'DONUT.CLEAN': SCORING,
    'DONUT.CLEAN_BONUS': SCORING,
    'DONUT.EDGE': FINE_TUNING,
    'DONUT.SPIN_SECONDS': FINE_TUNING,
    'DONUT.SPIN_REVS_KEPT': FINE_TUNING,
    'DONUT.SLIP_SHIFT': FINE_TUNING,
    'DONUT.COMBO_STEP': SCORING,
    'DONUT.COMBO_MAX': SCORING,
    'PEDESTRIANS.PER_CROSSING': FINE_TUNING,
    'PEDESTRIANS.APPROACH': FINE_TUNING,
    'PEDESTRIANS.WALK_SPEED': FINE_TUNING,
    'PEDESTRIANS.JOG_SPEED': FINE_TUNING,
    'PEDESTRIANS.HIT_DISTANCE': FINE_TUNING,
    'PEDESTRIANS.HIT_REVS_KEPT': FINE_TUNING,
    'PEDESTRIANS.BOOST_REVS': FINE_TUNING,
    'PEDESTRIANS.BOOST_RISE': FINE_TUNING,
    'PEDESTRIANS.BOOST_FALL': FINE_TUNING,
};

// ─── The live tuning ───

/** What differs from the defaults, by table, and the lamps if they've changed: what's saved and what "Copy changes" gives. */
export type DonutChanges = Partial<Record<TableName, Record<string, number>>> & { LAMPS?: LampDef[] };

const tables = TABLES as unknown as Record<TableName, Record<string, number>>;
const DEFAULTS: Record<TableName, Record<string, number>> =
    Object.fromEntries(Object.entries(tables).map(([name, table]) => [name, { ...table }])) as Record<TableName, Record<string, number>>;
/** The numbers some setting shows: only these are saved, pasted and copied. */
const TUNABLE = new Set(ALL_GROUPS.flatMap(g => g.settings.flatMap(s => s.keys)));

const live: Get = (table, key) => tables[table][key];
const defaults: Get = (table, key) => DEFAULTS[table][key];
const store: Put = (table, key, value) => {
    tables[table][key] = value;
};

export function settingValue(setting: DonutSetting): number {
    return setting.read(live);
}

export function setSetting(setting: DonutSetting, value: number): void {
    setting.write(value, store, live);
}

export function settingDefault(setting: DonutSetting): number {
    return setting.read(defaults);
}

/** The numbers a setting shows back to their defaults, exactly (a worked-out value written back could be off by a rounding). */
export function resetSetting(setting: DonutSetting): void {
    for (const id of setting.keys) {
        const [table, key] = id.split('.') as [TableName, string];
        tables[table][key] = DEFAULTS[table][key];
    }
}

/** Whether any of the numbers a setting shows differs from its default. */
export function settingChanged(setting: DonutSetting): boolean {
    return setting.keys.some(id => {
        const [table, key] = id.split('.') as [TableName, string];
        return tables[table][key] !== DEFAULTS[table][key];
    });
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
    if (!lampsAreDefault()) changes.LAMPS = LAMPS.map(lamp => ({ ...lamp }));
    return changes;
}

/** Every value the Lab shows, and the lamps. */
export function allDonutSettings(): DonutChanges {
    const all: DonutChanges = {};
    for (const name of Object.keys(tables) as TableName[]) {
        for (const [key, value] of Object.entries(tables[name])) {
            if (TUNABLE.has(`${name}.${key}`)) (all[name] ??= {})[key] = value;
        }
    }
    all.LAMPS = LAMPS.map(lamp => ({ ...lamp }));
    return all;
}

/** Everything back to the defaults, the lamps too. */
export function resetDonutTuning(): void {
    for (const name of Object.keys(tables) as TableName[]) Object.assign(tables[name], DEFAULTS[name]);
    resetLamps();
}

/**
 * The defaults with `changes` on top: only numbers the Lab shows (unknown or
 * hidden names and non-numbers skipped), and the lamps if given. Returns how
 * many values it set (a lamp list counts as one).
 */
export function applyDonutChanges(changes: unknown): number {
    resetDonutTuning();
    if (!changes || typeof changes !== 'object') return 0;
    let applied = 0;
    for (const [name, values] of Object.entries(changes as Record<string, unknown>)) {
        if (name === 'LAMPS') {
            const lamps = lampsFrom(values);
            if (lamps) {
                LAMPS.splice(0, LAMPS.length, ...lamps);
                applied++;
            }
            continue;
        }
        if (!(name in tables) || !values || typeof values !== 'object') continue;
        const table = tables[name as TableName];
        for (const [key, value] of Object.entries(values as Record<string, unknown>)) {
            if (!TUNABLE.has(`${name}.${key}`) || typeof value !== 'number' || !Number.isFinite(value)) continue;
            table[key] = value;
            applied++;
        }
    }
    return applied;
}

/** How many settings in `groups` differ from the defaults. */
export function changeCount(groups: DonutGroup[] = ALL_GROUPS): number {
    let count = 0;
    for (const g of groups) for (const setting of g.settings) if (settingChanged(setting)) count++;
    return count;
}
