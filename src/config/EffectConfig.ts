/**
 * Screen effects of hits and movement (drawing only, the simulation doesn't
 * see them). The Studio Lab's FEEL mode tunes `effects` live; every other
 * match starts from the defaults.
 */
export const DEFAULT_EFFECTS = {
    // Camera kick on hard hits: knockback (px/s) it starts at, knockback per pixel of kick, most pixels, share left each step
    CAMERA_KICK_FROM: 1200,
    CAMERA_KICK_PER_PIXEL: 300,
    CAMERA_KICK_MAX: 10,
    CAMERA_KICK_DECAY: 0.75,
    // Screen shake on heavy hits and on KOs (ms and strength), and the KO's zoom-in factor
    HEAVY_SHAKE_MS: 100,
    HEAVY_SHAKE: 0.005,
    KO_SHAKE_MS: 220,
    KO_SHAKE: 0.012,
    KO_ZOOM_PUNCH: 1.04,
    // Most a fighter trembles in hit-stop (px)
    HITSTOP_TREMBLE: 4,
    // Hit sparks: size multiplier, and the damage from which a ring joins them
    SPARK_SIZE: 1,
    SPARK_RING_DAMAGE: 8,
    // Dust, air-jump rings and dash afterimages: opacity multipliers, and time between afterimages
    DUST_OPACITY: 1,
    JUMP_RING_OPACITY: 1,
    AFTERIMAGE_OPACITY: 1,
    AFTERIMAGE_EVERY_MS: 35,
};

export type EffectKey = keyof typeof DEFAULT_EFFECTS;

/** The values every match draws with. */
export const effects: Record<EffectKey, number> = { ...DEFAULT_EFFECTS };
