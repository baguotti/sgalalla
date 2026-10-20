/**
 * Tuning constants for the simulation (shared/). Speeds are in pixels per
 * second, accelerations in pixels per second squared, durations and timers in
 * milliseconds; a "friction" multiplies the horizontal speed twice per step.
 * Measured from Brawlhalla recordings, in legend heights (H): the fighters are
 * 124 px tall (H) on a main stage 9.5 H wide, as Brawlhalla's legends on its
 * stages. A run reaches 6.3 H/s in 17 frames and slides 0.7 H to a stop; air
 * drift 5.2 H/s; every jump (ground or air) rises 1.95 H, peaking in 27 frames.
 * Fighter-sized values (bodies, boxes, dashes) follow H; stage-sized ones
 * (knockback, blast zones, the recovery's height) don't.
 */
export const PhysicsConfig = {
    // Gravity: 19.3 H/s², a jump peaks in 27 frames (0.45 s) and lands after 55
    GRAVITY: 2388,

    // Running, as on main: holding a direction, the speed keeps RUN_FRICTION each half-step as it builds
    // towards RUN_SPEED (quick to start and turn); letting go it keeps STOP_FRICTION (all but a dead stop).
    // Above RUN_SPEED (a dash's run-on) it eases down at GROUND_OVERSPEED_DECEL (px/s²) instead
    RUN_SPEED: 832,
    RUN_FRICTION: 0.93,
    STOP_FRICTION: 0.6,
    GROUND_OVERSPEED_DECEL: 6000,
    // In the air: a top speed, reached and left at these rates (px/s²)
    AIR_SPEED: 645,
    AIR_ACCEL: 1935,
    AIR_DECEL: 1600,
    // An attack in the air drifts at this share of AIR_SPEED (faster momentum eases down to it at AIR_DECEL)
    AIR_ATTACK_DRIFT: 0.4,
    SLIDE_ATTACK_SPEED: 2200,
    SLIDE_ATTACK_DECELERATION: 0.92,
    // Side light lunges forward at this speed as its hitbox comes out (Brawlhalla's Unarmed side light: about 1.6 H)
    SIDE_LIGHT_LUNGE_SPEED: 2460,

    // Jump mechanics: a full jump and an air jump rise 1.95 H, a short hop about 1 H
    JUMP_FORCE: -1095,
    SHORT_HOP_FORCE: -775,
    DOUBLE_JUMP_FORCE: -1095,
    MAX_JUMPS: 3,

    // Falling: gravity accelerates a fall up to these speeds
    MAX_FALL_SPEED: 893,
    MAX_FAST_FALL_SPEED: 1180,
    // Fast fall: holding down while descending; starts at least this fast
    FAST_FALL_SPEED: 1000,
    // Above the terminal speed once a fast fall ends, the excess shrinks by this share per step
    FALL_SPEED_EASE: 0.85,

    // Recovery attack
    RECOVERY_FORCE_Y: -1830,
    RECOVERY_FORCE_X: 550,
    RECOVERY_DURATION: 300,
    // A recovery used again before landing (or touching a wall) costs an air jump and has this share of the push
    EXHAUSTED_RECOVERY_FORCE: 0.6,

    // Input: a press is remembered this many steps, so one that comes a little early still counts
    INPUT_BUFFER_STEPS: 6,

    // Platform drop-through
    PLATFORM_DROP_GRACE_PERIOD: 200,
    // Holding down this many steps on a soft platform drops through it (0.2 s: time to press light for a down light first)
    DROP_HOLD_STEPS: 12,

    // Landing from the air: steps with no jump, dodge or attack
    LANDING_LAG_STEPS: 4,

    // Dodges are invincible: a spot dodge on the ground or in the air, or an 8-way dodge in the air
    SPOT_DODGE_DURATION: 300,
    AIR_DODGE_DURATION: 200,
    AIR_DODGE_DISTANCE: 142,
    // Share of the vertical speed kept when a directional air dodge ends
    AIR_DODGE_END_SPEED: 0.3,
    DODGE_COOLDOWN: 1000,
    AIR_DODGE_COOLDOWN: 2700,
    // Landing after an air dodge: the dodge is back this long after it ended, unless it was gravity cancelled
    LANDED_AIR_DODGE_COOLDOWN: 1250,

    // Dash: dodge + direction on the ground. Not invincible and no dodge cooldown;
    // a jump, attack or spot dodge cancels it
    DASH_SPEED: 1170,
    DASH_DURATION: 150,
    DASH_REPEAT_DELAY: 130,
    // Jumping out of a dash: low and fast, coasting until it slows to about the top air drift speed
    DASH_JUMP_FORCE: -610,
    DASH_JUMP_SPEED: 1205,
    DASH_JUMP_AIR_FRICTION: 0.985,
    DASH_MOMENTUM_MIN_SPEED: 482,

    // Chase dodge: a directional dodge within the attack that hit or CHASE_DODGE_WINDOW after it.
    // Cancels the attack's end, costs no cooldown (at most MAX_AIR_CHASE_DODGES before landing),
    // is invincible only at first, and an attack cancels it
    CHASE_DODGE_WINDOW: 200,
    CHASE_DODGE_DURATION: 250,
    CHASE_DODGE_INVINCIBLE: 150,
    CHASE_DODGE_SPEED: 674,
    MAX_AIR_CHASE_DODGES: 2,
    // Share of the chase dodge's speed an attack out of it keeps
    CHASE_ATTACK_SPEED_KEPT: 0.5,

    // Damage system
    MAX_DAMAGE: 999,
    // Knockback, as in Brawlhalla: force = fixed + variable × (d/100 + d²/20000), d the target's damage after
    // the hit, and a full charge adds FULL_CHARGE_BONUS to a heavy's variable force and damage. Each unit of
    // force launches at this many px/s
    FORCE_SCALE: 19,
    FULL_CHARGE_BONUS: 0.25,
    // From red damage (the HUD's red, 170%) a launch's upward speed grows, up to LIFT more over the next RANGE
    HIGH_DAMAGE_FROM: 170,
    HIGH_DAMAGE_RANGE: 100,
    HIGH_DAMAGE_LIFT: 0.5,
    // A hit stuns for the move's stun frames, and on while the fighter still flies faster than this across
    // or upward, up to this much longer
    STUN_FLYING_SPEED: 630,
    STUN_EXTENSION_MAX: 1200,
    // A launch slows by LAUNCH_DECEL along its angle (px/s²), so it flies about v²/2 far: little at low
    // damage, far near a KO. Below LAUNCH_EASE_SPEED (px/s) the slowing eases off with the speed, so it
    // fades out; past the top of the arc only the sideways speed fades, LAUNCH_FALL_DRAG of it a second.
    // Gravity pulls at HITSTUN_GRAVITY of its strength: comparable to the slowing, so the flight arcs
    LAUNCH_DECEL: 5000,
    LAUNCH_EASE_SPEED: 800,
    LAUNCH_FALL_DRAG: 2.5,
    HITSTUN_GRAVITY: 0.6,
    // A downward hit on a fighter standing on the floor pops it up with this share of the knockback, lifted this many px
    GROUNDED_SPIKE_BOUNCE: 0.3,
    GROUNDED_SPIKE_LIFT: 7,
    // A stunned fighter hitting a floor or wall faster than this bounces off, keeping BOUNCE_KEEP of its speed
    BOUNCE_SPEED: 380,
    BOUNCE_KEEP: 0.8,

    // Hit pause: both fighters freeze on a hit, in steps: MIN, plus one per HITSTOP_SPEED_PER_STEP of knockback,
    // up to MAX. Light hits barely stop; hits that launch hard freeze for a beat
    HITSTOP_MIN_STEPS: 1,
    HITSTOP_SPEED_PER_STEP: 570,
    HITSTOP_MAX_STEPS: 8,

    // Player dimensions (the body, for collisions; a new match picks them up)
    PLAYER_WIDTH: 81,
    PLAYER_HEIGHT: 124,
    // Hurtbox: what attacks hit and blast zones test, narrower and shorter than the body
    HURTBOX_WIDTH: 31,
    HURTBOX_HEIGHT: 117,

    // Respawn: steps out of play after a KO, then invulnerable this long
    RESPAWN_DELAY_STEPS: 120,
    RESPAWN_INVULNERABILITY_MS: 1000,

    // The run attack slides at the slide speed times this (about the side light's lunge, as in Brawlhalla), and comes out above this share of RUN_SPEED
    RUN_ATTACK_SPEED_MULT: 0.85,
    RUN_ATTACK_MIN_SPEED: 0.8,

    // Ground pound: after its startup hang it falls at MAX_FALL_SPEED times FALL_MULT; landing keeps this share of the speed
    GROUND_POUND_FALL_MULT: 1.5,
    GROUND_POUND_LANDING_SPEED_KEPT: 0.5,

    // Heavy attacks charge while held, up to this long
    CHARGE_MAX_TIME: 1500,

    // After any move, no attack can start for this long (ms)
    ATTACK_END_COOLDOWN: 100,

    // Signature ghosts (heavy side, up and neutral): thrown from in front of the fighter (NOCK's
    // further out), a side ghost a little further forward, an up ghost a little higher. It travels
    // TRAVEL px (more with charge) over TRAVEL_MS, lives LIFETIME ms (more with charge) plus the fade,
    // and the hitbox follows it: a square of the 256 px ghost frame times HITBOX_SCALE
    GHOST_OFFSET: 17,
    NOCK_GHOST_OFFSET: 24,
    GHOST_FORWARD: 10,
    GHOST_LIFT: 10,
    GHOST_TRAVEL: 74,
    GHOST_TRAVEL_PER_CHARGE: 24,
    GHOST_TRAVEL_MS: 300,
    GHOST_LIFETIME: 100,
    GHOST_LIFETIME_PER_CHARGE: 600,
    GHOST_FADE_MS: 200,
    GHOST_HITBOX_SCALE: 0.438,

    // Wall mechanics
    WALL_SLIDE_SPEED: 270,
    WALL_JUMP_FORCE_X: 1078,
    WALL_JUMP_FORCE_Y: -901,
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
    RECOVERY_HITBOX_SIZE: 40,
    RECOVERY_DAMAGE: 13,
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
    PLATFORM_SNAP_THRESHOLD: 30,

    // Dodge mechanics
    SPOT_DODGE_AERIAL_Y_DAMP: 0.2,
    SPOT_DODGE_ALPHA: 0.7,

    // Bombs (Brawlhalla's Bouncy Bomb): the first drops BOMB_FIRST ms in, the next BOMB_GAP plus up to
    // BOMB_GAP_RANDOM ms after one is gone, one at a time (two with 4 fighters or more); a loose bomb is gone
    // after BOMB_LIFETIME ms. A throw charges from BOMB_THROW_SPEED_MIN to _MAX over BOMB_CHARGE_FULL ms, and
    // held past BOMB_OVERCHARGE ms the bomb goes off in the hand. Thrown, it flies under BOMB_FLIGHT_GRAVITY of
    // gravity, bounces keeping BOMB_BOUNCE of its speed, passes through everyone for BOMB_GRACE_STEPS, and is
    // safe again once slower than BOMB_SAFE_SPEED.
    BOMB_FIRST: 15000,
    BOMB_GAP: 5000,
    BOMB_GAP_RANDOM: 5000,
    BOMB_LIFETIME: 15000,
    BOMB_RADIUS: 15,
    // An armed bomb goes off within this much of a fighter's hurtbox (the hurtbox is narrower than the art)
    BOMB_HIT_RANGE: 34,
    BOMB_PICKUP_RANGE: 50,
    BOMB_THROW_SPEED_MIN: 900,
    BOMB_THROW_SPEED_MAX: 2100,
    BOMB_CHARGE_FULL: 1000,
    BOMB_OVERCHARGE: 2000,
    BOMB_FLIGHT_GRAVITY: 0.15,
    BOMB_BOUNCE: 0.7,
    BOMB_SAFE_SPEED: 337,
    BOMB_GRACE_STEPS: 8,
    // Its explosion hurts every fighter this close (thrower included), launching them away from it
    BOMB_BLAST_RADIUS: 150,
    BOMB_DAMAGE: 22,
    BOMB_FIXED_FORCE: 62,
    BOMB_VARIABLE_FORCE: 52,
    BOMB_STUN: 25,
} as const;
