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

    /** The tyre marks: width (px), how dark the newest are, how many steps they last. */
    MARK_WIDTH: 6,
    MARK_DARKNESS: 0.55,
    MARK_TRAIL: 900,
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
