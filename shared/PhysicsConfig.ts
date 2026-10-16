/**
 * Tuning constants for the simulation (shared/). Speeds are in pixels per
 * second, accelerations in pixels per second squared, durations and timers in
 * milliseconds; a "friction" multiplies the horizontal speed twice per step.
 * The fighters are 184 px tall: the feel follows Brawlhalla's, quick to start
 * and stop on the ground, high snappy jumps, momentum kept in the air, and
 * launches that glide along their angle and slow smoothly.
 */
export const PhysicsConfig = {
    // Gravity: strong, for high jumps that rise and land quickly (but not frantically)
    GRAVITY: 4600,

    // Moving: a top speed on the ground and in the air, reached and left at these rates
    // (px/s²); above the top speed (a dash's run-on) the speed eases down instead of stopping
    RUN_SPEED: 880,
    GROUND_ACCEL: 9000,
    GROUND_DECEL: 9000,
    GROUND_OVERSPEED_DECEL: 3000,
    AIR_SPEED: 780,
    AIR_ACCEL: 4500,
    AIR_DECEL: 1400,
    SLIDE_ATTACK_SPEED: 2200,
    SLIDE_ATTACK_DECELERATION: 0.96,

    // Jump mechanics: a full jump rises about 2 fighters in 0.4 s, an air jump about 1.8
    JUMP_FORCE: -1880,
    SHORT_HOP_FORCE: -1295,
    DOUBLE_JUMP_FORCE: -1740,
    MAX_JUMPS: 3,

    // Falling: gravity accelerates a fall up to these speeds
    MAX_FALL_SPEED: 1500,
    MAX_FAST_FALL_SPEED: 2150,
    // Fast fall: holding down while descending; starts at least this fast
    FAST_FALL_SPEED: 1300,
    // Above the terminal speed once a fast fall ends, the excess shrinks by this share per step
    FALL_SPEED_EASE: 0.85,

    // Recovery attack
    RECOVERY_FORCE_Y: -2540,
    RECOVERY_FORCE_X: 550,
    RECOVERY_DURATION: 300,
    // A recovery used again before landing (or touching a wall) costs an air jump and has this share of the push
    EXHAUSTED_RECOVERY_FORCE: 0.6,

    // Input: a press is remembered this many steps, so one that comes a little early still counts
    INPUT_BUFFER_STEPS: 6,

    // Platform drop-through
    PLATFORM_DROP_GRACE_PERIOD: 200,
    // Holding down this many steps on a soft platform drops through it (a down attack comes out first)
    DROP_HOLD_STEPS: 4,

    // Landing from the air: steps with no jump, dodge or attack
    LANDING_LAG_STEPS: 4,

    // Dodges are invincible: a spot dodge on the ground or in the air, or an 8-way dodge in the air
    SPOT_DODGE_DURATION: 300,
    AIR_DODGE_DURATION: 200,
    AIR_DODGE_DISTANCE: 210,
    // Share of the vertical speed kept when a directional air dodge ends
    AIR_DODGE_END_SPEED: 0.3,
    DODGE_COOLDOWN: 1000,
    AIR_DODGE_COOLDOWN: 2700,
    // Landing after an air dodge: the dodge is back this long after it ended, unless it was gravity cancelled
    LANDED_AIR_DODGE_COOLDOWN: 1250,

    // Dash: dodge + direction on the ground. Not invincible and no dodge cooldown;
    // a jump, attack or spot dodge cancels it
    DASH_SPEED: 1500,
    DASH_DURATION: 150,
    DASH_REPEAT_DELAY: 130,
    // Jumping out of a dash: low and fast, coasting until it slows to about the top air drift speed
    DASH_JUMP_FORCE: -1080,
    DASH_JUMP_SPEED: 1300,
    DASH_JUMP_AIR_FRICTION: 0.985,
    DASH_MOMENTUM_MIN_SPEED: 520,

    // Chase dodge: a directional dodge within the attack that hit or CHASE_DODGE_WINDOW after it.
    // Cancels the attack's end, costs no cooldown (at most MAX_AIR_CHASE_DODGES before landing),
    // is invincible only at first, and an attack cancels it
    CHASE_DODGE_WINDOW: 200,
    CHASE_DODGE_DURATION: 250,
    CHASE_DODGE_INVINCIBLE: 150,
    CHASE_DODGE_SPEED: 1000,
    MAX_AIR_CHASE_DODGES: 2,
    // Share of the chase dodge's speed an attack out of it keeps
    CHASE_ATTACK_SPEED_KEPT: 0.5,

    // Damage system
    MAX_DAMAGE: 999,
    // Knockback, as in Brawlhalla: force = fixed + variable × (d/100 + d²/20000), d the target's damage after
    // the hit, and a full charge adds FULL_CHARGE_BONUS to a heavy's variable force and damage. Each unit of
    // force launches at this many px/s
    FORCE_SCALE: 30,
    FULL_CHARGE_BONUS: 0.25,
    // A hit stuns for the move's stun frames, and on while the fighter still flies faster than this across
    // or upward, up to this much longer
    STUN_FLYING_SPEED: 1000,
    STUN_EXTENSION_MAX: 1200,
    // A launch slows by this much along its angle (px/s²), so it flies v²/2 far: little at low damage, far
    // near a KO. Gravity pulls at this share of its strength, so the flight arcs
    LAUNCH_DECEL: 13000,
    HITSTUN_GRAVITY: 0.3,
    // The launch carries on past the stun (the fighter can act and drift) until it slows below this
    LAUNCH_END_SPEED: 600,
    // A downward hit on a fighter standing on the floor pops it up with this share of the knockback, lifted this many px
    GROUNDED_SPIKE_BOUNCE: 0.3,
    GROUNDED_SPIKE_LIFT: 10,
    // A stunned fighter hitting a floor or wall faster than this bounces off, keeping BOUNCE_KEEP of its speed
    BOUNCE_SPEED: 600,
    BOUNCE_KEEP: 0.8,

    // Hit pause: both fighters freeze on a hit, in steps: MIN, plus one per HITSTOP_SPEED_PER_STEP of knockback,
    // up to MAX. Light hits barely stop; hits that launch hard freeze for a beat
    HITSTOP_MIN_STEPS: 1,
    HITSTOP_SPEED_PER_STEP: 900,
    HITSTOP_MAX_STEPS: 8,

    // Player dimensions (the body, for collisions; a new match picks them up)
    PLAYER_WIDTH: 120,
    PLAYER_HEIGHT: 184,
    // Hurtbox: what attacks hit and blast zones test, narrower and shorter than the body
    HURTBOX_WIDTH: 46,
    HURTBOX_HEIGHT: 174,

    // Respawn: steps out of play after a KO, then invulnerable this long
    RESPAWN_DELAY_STEPS: 120,
    RESPAWN_INVULNERABILITY_MS: 1000,

    // The run attack slides this much faster than the slide, and comes out above this share of RUN_SPEED
    RUN_ATTACK_SPEED_MULT: 1.2,
    RUN_ATTACK_MIN_SPEED: 0.8,

    // Ground pound: after its startup hang it falls at MAX_FALL_SPEED times FALL_MULT; landing keeps this share of the speed
    GROUND_POUND_FALL_MULT: 1.5,
    GROUND_POUND_LANDING_SPEED_KEPT: 0.5,

    // Heavy attacks charge while held, up to this long
    CHARGE_MAX_TIME: 1000,

    // Signature ghosts (heavy side, up and neutral): thrown from in front of the fighter (NOCK's
    // further out), a side ghost a little further forward, an up ghost a little higher. It travels
    // TRAVEL px (more with charge) over TRAVEL_MS, lives LIFETIME ms (more with charge) plus the fade,
    // and the hitbox follows it: a square of the 256 px ghost frame times HITBOX_SCALE
    GHOST_OFFSET: 25,
    NOCK_GHOST_OFFSET: 35,
    GHOST_FORWARD: 15,
    GHOST_LIFT: 15,
    GHOST_TRAVEL: 110,
    GHOST_TRAVEL_PER_CHARGE: 35,
    GHOST_TRAVEL_MS: 300,
    GHOST_LIFETIME: 100,
    GHOST_LIFETIME_PER_CHARGE: 600,
    GHOST_FADE_MS: 200,
    GHOST_HITBOX_SCALE: 0.65,

    // Wall mechanics
    WALL_SLIDE_SPEED: 400,
    WALL_JUMP_FORCE_X: 1600,
    WALL_JUMP_FORCE_Y: -1520,
    WALL_COYOTE_TIME: 200,

    // Speed kept each half-step in these states (moving is RUN_SPEED and AIR_SPEED above)
    CHARGE_FRICTION: 0.2,
    CHARGE_GRAVITY_CANCEL: 0.5,
    ATTACK_RECOVERY_FRICTION: 0.75,
    ATTACK_ACTIVE_FRICTION: 0.95,
    AERIAL_STALL_GRAVITY_DAMP: 0.6,
    AERIAL_STALL_HORIZONTAL_DAMP: 0.9,
    SHORT_HOP_VELOCITY_DAMP: 0.5,

    // The recovery move's hit (Brawlhalla's Unarmed numbers, stun in frames): a square round the fighter
    RECOVERY_HITBOX_SIZE: 60,
    RECOVERY_DAMAGE: 15,
    RECOVERY_FIXED_FORCE: 55,
    RECOVERY_VARIABLE_FORCE: 40,
    RECOVERY_STUN: 25,
    RECOVERY_KNOCKBACK_ANGLE: 80,

    // Wall slip: after this many air jumps, wall jumps and recoveries without landing, hitting or
    // being hit, walls no longer hold the fighter or give back its jumps
    MAX_AIR_ACTIONS: 9,

    // Platform mechanics
    PLATFORM_DROP_NUDGE_Y: 1,
    PLATFORM_DROP_PUSH_Y: 100,
    PLATFORM_SNAP_THRESHOLD: 45,

    // Dodge mechanics
    SPOT_DODGE_AERIAL_Y_DAMP: 0.2,
    SPOT_DODGE_ALPHA: 0.7,
    AIR_DODGE_VERTICAL_DAMP: 0.3,
} as const;
