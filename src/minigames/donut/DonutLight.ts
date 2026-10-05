/**
 * How DERAPATE is lit, like the fighting game's Studio Lab look: dusk over the
 * junction, street lamps on the corners, the car's own lights, flashes, and
 * the camera's grading and lens. Drawing only: the rules never read it. Plain
 * data and maths, no Phaser, so the Lab can tune it live and the tests can
 * check it; DonutLighting puts it on screen.
 */

export const LIGHT = {
    /**
     * The light where no lamp reaches (0 black, 1 the colours as drawn): on the
     * road and buildings, on the car, on the people and the smoke; and its colour.
     */
    AMBIENT_GROUND: 0.5,
    AMBIENT_CAR: 0.75,
    AMBIENT_PEOPLE: 0.6,
    AMBIENT_COLOUR: 0x9aa4e6,
    /** Every street lamp's strength, and the glow in the air round them. */
    LAMPS: 1,
    HAZE: 1,
    /** Rim light on the car's edges facing a light: width (pixels of the renders) and strength. */
    RIM_WIDTH: 2.5,
    RIM: 1.6,
    /** Headlights: two cones of light ahead of the car (strength, how far they reach in metres, how wide each spreads in degrees either side), and their colour. */
    HEADLIGHTS: 0.9,
    HEADLIGHT_REACH: 14,
    HEADLIGHT_SPREAD: 22,
    HEADLIGHT_COLOUR: 0xfff0cc,
    /** Tail lights: a red glow behind it (strength, reach), and its colour. */
    TAILLIGHTS: 0.7,
    TAILLIGHT_REACH: 4,
    TAILLIGHT_COLOUR: 0xff3020,
    /** The exhaust flame lights things round it while it burns (strength, reach). */
    FLAME_LIGHT: 1.6,
    FLAME_LIGHT_REACH: 7,
    /** Flashes where someone's hit: a white person's boost, a blue one (strength, reach, how long in ms). */
    BOOST_FLASH: 1.4,
    BOOST_FLASH_REACH: 10,
    BOOST_FLASH_MS: 450,
    HIT_FLASH: 1.6,
    HIT_FLASH_REACH: 9,
    HIT_FLASH_MS: 350,
    /** Bloom: the brightness it starts at, its strength and its spread. */
    BLOOM_THRESHOLD: 0.55,
    BLOOM_STRENGTH: 0.35,
    BLOOM_SPREAD: 1.6,
    /** Grading: overall brightness, warm (+) or cold (−), colour, contrast, darker corners. */
    EXPOSURE: 1,
    TEMPERATURE: 0,
    SATURATION: 0.9,
    CONTRAST: 1.05,
    VIGNETTE: 0.35,
    /** Film grain (amount, grain size in pixels) and colour fringes toward the edges. */
    GRAIN: 0.03,
    GRAIN_SIZE: 1.2,
    ABERRATION: 0.1,
    /** Tilt-shift, the miniature look: blur above and below a sharp band (amount, the band's height on screen 0 bottom to 1 top, its width). */
    TILT_SHIFT: 0.35,
    TILT_FOCUS: 0.56,
    TILT_BAND: 0.4,
    /** CRT screen: strength (0 off), scanline spacing in pixels, the red-green-blue stripes. */
    CRT: 0,
    CRT_LINE_SIZE: 2,
    CRT_MASK: 1,
};

// ─── Times of day ───

/** The times of day, in the order they come round. */
export const TIMES_OF_DAY = ['dawn', 'daylight', 'sunset', 'blueHour', 'night'] as const;
export type TimeOfDay = typeof TIMES_OF_DAY[number];
export const TIME_NAMES: Record<TimeOfDay, string> = { dawn: 'Dawn', daylight: 'Daylight', sunset: 'Sunset', blueHour: 'Blue hour', night: 'Night' };

/** What a time of day sets: the same settings for each, so one can later fade into the next. */
type TimeLight = Pick<typeof LIGHT, 'AMBIENT_GROUND' | 'AMBIENT_CAR' | 'AMBIENT_PEOPLE' | 'AMBIENT_COLOUR' | 'LAMPS' | 'HAZE' | 'HEADLIGHTS'
    | 'TAILLIGHTS' | 'RIM' | 'BLOOM_THRESHOLD' | 'BLOOM_STRENGTH' | 'EXPOSURE' | 'TEMPERATURE' | 'SATURATION' | 'CONTRAST' | 'VIGNETTE'>;

/**
 * The light at each time of day: pink first light with the lamps going off;
 * plain daylight, the colours as drawn and no lamps; a warm low sun with the
 * lamps coming on; the blue hour (the defaults); deep night under the lamps.
 */
export const TIME_PRESETS: Record<TimeOfDay, TimeLight> = {
    dawn: {
        AMBIENT_GROUND: 0.8, AMBIENT_CAR: 0.9, AMBIENT_PEOPLE: 0.85, AMBIENT_COLOUR: 0xf2c4d4, LAMPS: 0.35, HAZE: 0.6, HEADLIGHTS: 0.4,
        TAILLIGHTS: 0.4, RIM: 1, BLOOM_THRESHOLD: 0.65, BLOOM_STRENGTH: 0.3, EXPOSURE: 1, TEMPERATURE: 0.05, SATURATION: 0.85, CONTRAST: 1, VIGNETTE: 0.3,
    },
    daylight: {
        AMBIENT_GROUND: 1.05, AMBIENT_CAR: 1.05, AMBIENT_PEOPLE: 1.05, AMBIENT_COLOUR: 0xfff6e8, LAMPS: 0, HAZE: 0, HEADLIGHTS: 0,
        TAILLIGHTS: 0.3, RIM: 0.6, BLOOM_THRESHOLD: 0.85, BLOOM_STRENGTH: 0.2, EXPOSURE: 1, TEMPERATURE: 0.05, SATURATION: 1, CONTRAST: 1.05, VIGNETTE: 0.2,
    },
    sunset: {
        AMBIENT_GROUND: 0.85, AMBIENT_CAR: 0.9, AMBIENT_PEOPLE: 0.85, AMBIENT_COLOUR: 0xffad72, LAMPS: 0.5, HAZE: 0.7, HEADLIGHTS: 0.5,
        TAILLIGHTS: 0.5, RIM: 1.2, BLOOM_THRESHOLD: 0.6, BLOOM_STRENGTH: 0.4, EXPOSURE: 1, TEMPERATURE: 0.25, SATURATION: 1.05, CONTRAST: 1.08, VIGNETTE: 0.35,
    },
    blueHour: {
        AMBIENT_GROUND: 0.5, AMBIENT_CAR: 0.75, AMBIENT_PEOPLE: 0.6, AMBIENT_COLOUR: 0x9aa4e6, LAMPS: 1, HAZE: 1, HEADLIGHTS: 0.9,
        TAILLIGHTS: 0.7, RIM: 1.6, BLOOM_THRESHOLD: 0.55, BLOOM_STRENGTH: 0.35, EXPOSURE: 1, TEMPERATURE: 0, SATURATION: 0.9, CONTRAST: 1.05, VIGNETTE: 0.35,
    },
    night: {
        AMBIENT_GROUND: 0.26, AMBIENT_CAR: 0.5, AMBIENT_PEOPLE: 0.35, AMBIENT_COLOUR: 0x6a76c4, LAMPS: 1.3, HAZE: 1.3, HEADLIGHTS: 1.3,
        TAILLIGHTS: 1, RIM: 2, BLOOM_THRESHOLD: 0.45, BLOOM_STRENGTH: 0.45, EXPOSURE: 1.05, TEMPERATURE: -0.1, SATURATION: 0.85, CONTRAST: 1.1, VIGNETTE: 0.45,
    },
};

/** Sets the light to a time of day (the other settings, the lamps and the camera's lens, stay as they are). */
export function applyTimeOfDay(time: TimeOfDay): void {
    Object.assign(LIGHT, TIME_PRESETS[time]);
}

/** The time of day the light is set to now, if it's exactly one of them. */
export function currentTimeOfDay(): TimeOfDay | null {
    return TIMES_OF_DAY.find(time => (Object.keys(TIME_PRESETS[time]) as (keyof TimeLight)[]).every(key => LIGHT[key] === TIME_PRESETS[time][key])) ?? null;
}

/** A street lamp: where it stands on the junction (metres), how high its head is, its light, and whether its post is drawn. */
export interface LampDef {
    x: number;
    y: number;
    height: number;
    colour: number;
    /** How far its light reaches on the ground (metres). */
    reach: number;
    strength: number;
    /** The glow in the air round its head. */
    glow: number;
    post: boolean;
}

/** At most this many lamps: the lit shaders take 8 lights, and the car's lights and a flash need theirs. */
export const MAX_LAMPS = 4;

/** The numbers the lamp editor has a slider for: min, max, step. */
export const LAMP_RANGES = {
    height: [1, 15, 0.1],
    reach: [1, 40, 0.5],
    strength: [0, 3, 0.05],
    glow: [0, 3, 0.05],
} satisfies Partial<Record<keyof LampDef, [number, number, number]>>;

/** Four sodium lamps, one on each corner of the junction just off the road, reaching the middle where the car goes round. */
export const DEFAULT_LAMPS: readonly LampDef[] = [
    { x: -11.2, y: -11.2, height: 6, colour: 0xffb468, reach: 24, strength: 1.1, glow: 1, post: true },
    { x: 11.2, y: -11.2, height: 6, colour: 0xffb468, reach: 24, strength: 1.1, glow: 1, post: true },
    { x: -11.2, y: 11.2, height: 6, colour: 0xffb468, reach: 24, strength: 1.1, glow: 1, post: true },
    { x: 11.2, y: 11.2, height: 6, colour: 0xffb468, reach: 24, strength: 1.1, glow: 1, post: true },
];

/** The lamps now (the Lab moves, adds and removes them). */
export const LAMPS: LampDef[] = DEFAULT_LAMPS.map(lamp => ({ ...lamp }));

/** A lamp added in the Lab, before it's placed. */
export const NEW_LAMP: Omit<LampDef, 'x' | 'y'> = { height: 6, colour: 0xffd9a0, reach: 12, strength: 1, glow: 1, post: true };

/** The lamps back to the four on the corners. */
export function resetLamps(): void {
    LAMPS.splice(0, LAMPS.length, ...DEFAULT_LAMPS.map(lamp => ({ ...lamp })));
}

/** Whether the lamps are the four on the corners, as they start. */
export function lampsAreDefault(): boolean {
    return LAMPS.length === DEFAULT_LAMPS.length
        && LAMPS.every((lamp, i) => (Object.keys(lamp) as (keyof LampDef)[]).every(key => lamp[key] === DEFAULT_LAMPS[i][key]));
}

/**
 * Lamps from saved or pasted JSON: each value kept only if it's the right
 * type, the rest from a new lamp; at most MAX_LAMPS. Null if it isn't a list.
 */
export function lampsFrom(json: unknown): LampDef[] | null {
    if (!Array.isArray(json)) return null;
    return json.slice(0, MAX_LAMPS).map(item => {
        const lamp: LampDef = { ...NEW_LAMP, x: 0, y: 0 };
        const source = (item ?? {}) as Record<string, unknown>;
        for (const key of Object.keys(lamp) as (keyof LampDef)[]) {
            const value = source[key];
            if (typeof value === typeof lamp[key] && (typeof value !== 'number' || Number.isFinite(value))) {
                (lamp as unknown as Record<string, unknown>)[key] = value;
            }
        }
        return lamp;
    });
}

// ─── The light maths, shared by the shaders' set-up and the people and smoke ───

/** How much of a light reaches `distance` metres from it: full at the light, fading to nothing at `reach` (squared, like the shaders). */
export function falloff(distance: number, reach: number): number {
    if (reach <= 0) return 0;
    const left = Math.max(0, 1 - distance / reach);
    return left * left;
}

/** A colour's red, green and blue as 0 to 1, times `strength`, into `out` (three numbers). */
export function colourParts(colour: number, strength: number, out: Float32Array | number[], at = 0): void {
    out[at] = ((colour >> 16) & 255) / 255 * strength;
    out[at + 1] = ((colour >> 8) & 255) / 255 * strength;
    out[at + 2] = (colour & 255) / 255 * strength;
}

/**
 * How much of a cone's light reaches a point `awayX`, `awayY` from it (any
 * units): full inside the angle whose cosine is `cosInner`, fading to nothing
 * at `cosOuter`, round the way it points (`dirX`, `dirY`, a unit vector).
 */
export function coneShare(awayX: number, awayY: number, dirX: number, dirY: number, cosInner: number, cosOuter: number): number {
    const length = Math.hypot(awayX, awayY);
    if (length < 1e-6) return 1;
    const along = (awayX * dirX + awayY * dirY) / length;
    const t = Math.max(0, Math.min(1, (along - cosOuter) / Math.max(1e-6, cosInner - cosOuter)));
    return t * t * (3 - 2 * t);
}

/** `colour` lit by `light` (red, green, blue multipliers), each channel capped at full. */
export function litColour(colour: number, light: ArrayLike<number>): number {
    const r = Math.min(255, Math.round(((colour >> 16) & 255) * light[0]));
    const g = Math.min(255, Math.round(((colour >> 8) & 255) * light[1]));
    const b = Math.min(255, Math.round((colour & 255) * light[2]));
    return (r << 16) | (g << 8) | b;
}
