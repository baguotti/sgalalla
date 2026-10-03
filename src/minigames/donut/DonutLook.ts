/**
 * How DERAPATE looks, apart from the rules: the camera, the car's drawing and
 * the screen shakes. A plain object so the Lab can change it live (and plain
 * data, no Phaser, so the Lab's settings list can be tested).
 */
export const LOOK = {
    /** Pixels per metre (the camera's zoom), and where the junction's centre is on screen. */
    SCALE: 26,
    CENTRE_X: 960,
    CENTRE_Y: 470,

    /** The car drawn this much bigger than life next to the people, so it reads. */
    CAR_SIZE: 1.75,
    /** The car as Riccardo's sprites (1) or the old blocks (0); the sprite's size on top of CAR_SIZE, how far down it sits (px), and its shadow's opacity. */
    CAR_SPRITES: 1,
    CAR_SPRITE_SCALE: 1,
    CAR_SPRITE_Y: 0,
    CAR_SHADOW: 0.3,
    /**
     * The suspension (the body on its springs, straight up and down over the
     * wheels, screen px): how much lower it sits loaded at full cornering; how
     * far it lifts speeding up (dips slowing); how hard a bump bounces it; the
     * rumble at top speed; the most it can travel either way; the springs'
     * bounce (times a second) and damping (0 bouncy, 1 no overshoot).
     */
    SUSP_LEAN: 1.5,
    SUSP_SQUAT: 2,
    SUSP_BUMP: 4,
    SUSP_RUMBLE: 0.4,
    SUSP_TRAVEL: 3,
    SUSP_FREQ: 2.5,
    SUSP_DAMP: 0.35,
    /** How far the nose points into the circle (degrees from straight ahead; 90 is at the centre). */
    NOSE_IN: 70,
    /** How much the balance swings the nose (degrees at the edge), and the revs swing the tail out (at full revs). */
    SLIP_SWING: 50,
    REV_SWING: 11,
    /** How fast the car whirls in a testacoda (degrees a second). */
    SPIN_TURN: 630,

    /**
     * The revs shown on the car, each tint's opacity over the black car (0 to 1):
     * white (at the top of the white), green, orange (heating), red (about to
     * overheat), the dull red of a stall, and the flash of white on reaching the green; and how fast it
     * flashes red before overheating (flashes a second).
     */
    TINT_WHITE: 0,
    TINT_GREEN: 0,
    TINT_HOT: 0.35,
    TINT_RED: 0.37,
    TINT_STALL: 0,
    GREEN_FLASH: 0,
    HOT_FLASH: 7.5,

    /** Backfires: flame from the exhaust when lifting off at high revs (at least BACKFIRE_FROM of the bar) and on reaching the green; how big, and how long (ms). */
    BACKFIRE_FROM: 0.6,
    BACKFIRE_SIZE: 0.35,
    BACKFIRE_MS: 200,

    /**
     * The HUD: the steering wheel at the bottom (its centre's place on screen,
     * below the bottom edge so only the top shows; its size; how far it turns
     * with the balance at the edge, degrees; how quickly it follows, a second),
     * and the upright rev bar (its middle across, its bottom, height and width, px).
     */
    WHEEL_X: 960,
    WHEEL_Y: 1150,
    WHEEL_SCALE: 0.7,
    WHEEL_TURN: 90,
    WHEEL_EASE: 12,
    REV_BAR_X: 1350,
    REV_BAR_Y: 1050,
    REV_BAR_HEIGHT: 300,
    REV_BAR_WIDTH: 34,

    /** Tyre smoke (little cubes from the rear tyres): cubes a second at full wheelspin, their size, how long they last (s), how fast they rise (m/s), and how thick (opacity). */
    SMOKE: 260,
    SMOKE_SIZE: 0.75,
    SMOKE_LIFE: 1.6,
    SMOKE_RISE: 1.3,
    SMOKE_OPACITY: 0.7,

    /**
     * The rear tyres (from Riccardo's wheel renders: metres before CAR_SIZE):
     * how far the rear axle is behind the car's centre, and how far each tyre is
     * from the middle. The tyre marks and the smoke come from there.
     */
    REAR_AXLE: 1.29,
    HALF_TRACK: 0.77,
    /** Sound: the engine, the tyres' screech, the one-shots (boost, hits, pops…), and DERAPATE's soundtrack (shares, on top of the SFX and music volumes in Settings). */
    ENGINE_VOLUME: 0.7,
    /** How much the engine's pitch climbs from standing to the top of the white (0.75 at rest, plus this), and the screech. */
    ENGINE_PITCH: 0.75,
    SCREECH_VOLUME: 1,
    /** MOTORE CALDO's crackle; the overheat's hiss over the engine dying; the flame's pops; the rev on a fresh stab of the pedal: how loud, how likely, and the least gap between them (s). */
    HOT_VOLUME: 0.7,
    HISS_VOLUME: 0.5,
    FLAME_VOLUME: 0.3,
    REV_VOLUME: 0.7,
    REV_CHANCE: 0.85,
    REV_GAP: 0.8,
    EFFECTS_VOLUME: 0.8,
    MUSIC_VOLUME: 0.7,

    /** The tyre marks: how wide (metres before CAR_SIZE), how dark a fresh strip is, and how much fades a second (share). */
    MARK_WIDTH: 0.26,
    MARK_DARKNESS: 0.6,
    MARK_FADE: 0.03,
    /** The faint ring where the donut runs now (opacity). */
    RING: 0.18,

    /** Hitting a red walker: a hard jolt (share of the screen, and ms). */
    HIT_SHAKE: 0.01,
    HIT_SHAKE_MS: 250,
    /** A green boost: a lighter, longer rumble and a quick zoom punch (extra zoom, and ms there and back). */
    BOOST_SHAKE: 0.003,
    BOOST_SHAKE_MS: 450,
    BOOST_ZOOM: 0.05,
    BOOST_ZOOM_MS: 320,
    /** A fresh stab of the pedal above this share of top speed shakes the camera this much (0: off). */
    STAB_SHAKE: 0.002,
    STAB_FROM: 0.55,
};
