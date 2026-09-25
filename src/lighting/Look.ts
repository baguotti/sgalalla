/**
 * The lighting look and the Studio Lab's lights. Drawing only: the simulation
 * never reads any of this, so matches play the same with or without it.
 */

/** Everything the Studio Lab's panel tunes besides the lights (H shows it). */
export interface Look {
    /** Brightness of the sky painting, the platforms and the fighters away from any light. */
    skyAmbient: number;
    stageAmbient: number;
    /** Kept higher than the stage so fighters never get lost in the dark. */
    fighterAmbient: number;
    /** Scale every sun and every lamp. */
    sun: number;
    lamps: number;
    /** Rim light on fighters' edges facing a light: width in the sprite's own pixels, and strength. */
    rimWidth: number;
    rimStrength: number;
    /** Rim light on the platforms' edges facing a light; never on their undersides, like fighters' feet. */
    stageRim: number;
    /** Glow round every light, on top of each light's own setting. */
    haze: number;
    /** Bloom: the brightness it starts at, its strength and its spread. */
    bloomThreshold: number;
    bloomStrength: number;
    bloomSpread: number;
    /** Sun rays: strength, length (share of the way to the sun) and fade along them. */
    rays: number;
    rayLength: number;
    rayFade: number;
    /** Mist rising from below the stage. */
    mist: number;
    /** Darkness of the shadow under each fighter's feet. */
    shadow: number;
    /** Light from match events: strength, reach in world pixels and length in milliseconds. */
    hitFlash: number;
    hitFlashRadius: number;
    hitFlashTime: number;
    koFlash: number;
    koFlashRadius: number;
    koFlashTime: number;
    respawnFlash: number;
    respawnFlashRadius: number;
    respawnFlashTime: number;
    /** Grading: overall brightness, warm (+) or cold (-), colour, contrast. */
    exposure: number;
    temperature: number;
    saturation: number;
    contrast: number;
    vignette: number;
    /** Film grain: amount, and grain size in screen pixels. */
    grain: number;
    grainSize: number;
    /** Colour fringes toward the screen's edges. */
    aberration: number;
    /** Tilt-shift: blur above and below a sharp band, its height on screen (0 bottom, 1 top) and its width. */
    tiltShift: number;
    tiltFocus: number;
    tiltBand: number;
    /** CRT screen: strength (0 off), scanline spacing in screen pixels, and the red-green-blue stripe mask. */
    crt: number;
    crtLineSize: number;
    crtMask: number;
}

export const DEFAULT_LOOK: Look = {
    skyAmbient: 0.18,
    stageAmbient: 0.69,
    fighterAmbient: 0.68,
    sun: 0.55,
    lamps: 0.65,
    rimWidth: 2.2,
    rimStrength: 2,
    stageRim: 1,
    haze: 1.35,
    bloomThreshold: 0.48,
    bloomStrength: 0.25,
    bloomSpread: 1.7,
    rays: 2.1,
    rayLength: 0.24,
    rayFade: 0.92,
    mist: 0.95,
    shadow: 0.38,
    hitFlash: 1.75,
    hitFlashRadius: 260,
    hitFlashTime: 470,
    koFlash: 1.6,
    koFlashRadius: 800,
    koFlashTime: 500,
    respawnFlash: 0.8,
    respawnFlashRadius: 380,
    respawnFlashTime: 300,
    exposure: 0.76,
    temperature: 0,
    saturation: 0.69,
    contrast: 1.06,
    vignette: 0.36,
    grain: 0.04,
    grainSize: 1.2,
    aberration: 0.16,
    tiltShift: 0,
    tiltFocus: 0,
    tiltBand: 0,
    crt: 0,
    crtLineSize: 2,
    crtMask: 1,
};

/** Slider range for each setting: min, max, step. */
export const LOOK_RANGES: Record<keyof Look, [number, number, number]> = {
    skyAmbient: [0, 1.5, 0.01],
    stageAmbient: [0, 1.5, 0.01],
    fighterAmbient: [0, 1.5, 0.01],
    sun: [0, 3, 0.05],
    lamps: [0, 3, 0.05],
    rimWidth: [0, 4, 0.1],
    rimStrength: [0, 4, 0.05],
    stageRim: [0, 4, 0.05],
    haze: [0, 2, 0.05],
    bloomThreshold: [0, 1, 0.01],
    bloomStrength: [0, 3, 0.05],
    bloomSpread: [0.5, 4, 0.1],
    rays: [0, 3, 0.05],
    rayLength: [0, 1, 0.01],
    rayFade: [0.9, 1, 0.001],
    mist: [0, 1, 0.01],
    shadow: [0, 1, 0.01],
    hitFlash: [0, 3, 0.05],
    hitFlashRadius: [50, 1500, 10],
    hitFlashTime: [30, 1000, 10],
    koFlash: [0, 3, 0.05],
    koFlashRadius: [50, 2000, 10],
    koFlashTime: [30, 2000, 10],
    respawnFlash: [0, 3, 0.05],
    respawnFlashRadius: [50, 1500, 10],
    respawnFlashTime: [30, 1000, 10],
    exposure: [0.3, 2, 0.01],
    temperature: [-1, 1, 0.01],
    saturation: [0, 2, 0.01],
    contrast: [0.5, 1.5, 0.01],
    vignette: [0, 1, 0.01],
    grain: [0, 0.3, 0.005],
    grainSize: [1, 4, 0.1],
    aberration: [0, 1, 0.01],
    tiltShift: [0, 1, 0.01],
    tiltFocus: [0, 1, 0.01],
    tiltBand: [0, 1, 0.01],
    crt: [0, 1, 0.01],
    crtLineSize: [2, 6, 0.5],
    crtMask: [0, 1, 0.01],
};

/** The panel's sections, in order. */
export const LOOK_SECTIONS: readonly [string, readonly (keyof Look)[]][] = [
    ['AMBIENT', ['skyAmbient', 'stageAmbient', 'fighterAmbient']],
    ['LIGHTS', ['sun', 'lamps', 'rimWidth', 'rimStrength', 'stageRim', 'haze', 'shadow']],
    ['BLOOM AND RAYS', ['bloomThreshold', 'bloomStrength', 'bloomSpread', 'rays', 'rayLength', 'rayFade', 'mist']],
    ['FLASHES', ['hitFlash', 'hitFlashRadius', 'hitFlashTime', 'koFlash', 'koFlashRadius', 'koFlashTime', 'respawnFlash', 'respawnFlashRadius', 'respawnFlashTime']],
    ['CAMERA', ['exposure', 'temperature', 'saturation', 'contrast', 'vignette', 'grain', 'grainSize', 'aberration', 'tiltShift', 'tiltFocus', 'tiltBand']],
    ['CRT', ['crt', 'crtLineSize', 'crtMask']],
];

/** Where a light's orb and glow are drawn: in front of the sky, the platforms, or the fighters. */
export type LightLayer = 'back' | 'stage' | 'front';

export const LIGHT_LAYERS: Record<LightLayer, string> = {
    back: 'behind the stage',
    stage: 'behind the fighters',
    front: 'in front of everything',
};

export interface LightDef {
    /** The sun casts the rays and is scaled by the look's sun setting; lamps by its lamps setting. */
    kind: 'sun' | 'lamp';
    /** World position. */
    x: number;
    y: number;
    color: number;
    /** Reach in world pixels. */
    radius: number;
    /** How much it lights what faces the camera, and how brightly it outlines fighters' edges. */
    fill: number;
    rim: number;
    /** How much it brightens the sky painting. */
    sky: number;
    /** Glow in the air round it, and the size of the bright orb at its centre. */
    halo: number;
    orb: number;
    /** 0 for a steady light; flames wobble. */
    flicker: number;
    /** False: it lights the scene but its orb and glow aren't drawn. */
    visible: boolean;
    layer: LightLayer;
}

/** The numbers the light editor has a slider for: min, max, step. */
export const LIGHT_RANGES = {
    radius: [50, 3000, 10],
    fill: [0, 2, 0.05],
    rim: [0, 3, 0.05],
    sky: [0, 2, 0.05],
    halo: [0, 2, 0.05],
    orb: [0, 5, 0.1],
    flicker: [0, 0.5, 0.01],
} satisfies Partial<Record<keyof LightDef, [number, number, number]>>;

/** The Studio Lab's rig on Londra: an unseen sun above the stage and a warm lantern on the main platform's left edge. */
export const LAB_LIGHTS: readonly LightDef[] = [
    { kind: 'sun', x: 959, y: 169, color: 0xffd1f7, radius: 1160, fill: 0.6, rim: 2.95, sky: 1.2, halo: 0.5, orb: 3.5, flicker: 0, visible: false, layer: 'stage' },
    { kind: 'lamp', x: 568, y: 871, color: 0xff9a4d, radius: 1640, fill: 0.9, rim: 1, sky: 0.55, halo: 0.95, orb: 1.4, flicker: 0, visible: true, layer: 'back' },
];

/** A lamp added in the Studio Lab, before it's placed and tuned. */
export const NEW_LAMP: Omit<LightDef, 'x' | 'y'> = {
    kind: 'lamp', color: 0xffd9a0, radius: 420, fill: 0.9, rim: 1, sky: 0, halo: 0.5, orb: 0.7, flicker: 0.08, visible: true, layer: 'stage',
};

/** Colours of the short-lived lights from match events; their strength, reach and length are in the look. */
export const FLASH_COLORS = {
    hit: 0xfff1d6,
    ko: 0xff7a5c,
    respawn: 0xffffff,
} as const;

export type FlashKind = keyof typeof FLASH_COLORS;
