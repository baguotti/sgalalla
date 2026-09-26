/**
 * Tuning constants for the simulation (shared/). Speeds are in pixels per
 * second, accelerations in pixels per second squared, durations and timers in
 * milliseconds; friction multiplies the horizontal speed twice per step.
 */
export const PhysicsConfig = {
    // Gravity - high value for fast, heavy feel (like Brawlhalla)
    GRAVITY: 2200,

    // Movement - acceleration-based for responsive feel with slight slide
    MOVE_ACCEL: 6500,
    GLOBAL_KNOCKBACK_SCALING: 5.0,
    FRICTION: 0.60,
    RUN_FRICTION: 0.93,
    SLIDE_ATTACK_SPEED: 2200,
    SLIDE_ATTACK_DECELERATION: 0.96,
    MAX_SPEED: 1400,

    // Jump mechanics
    JUMP_FORCE: -1050,
    SHORT_HOP_FORCE: -540,
    DOUBLE_JUMP_FORCE: -900,
    MAX_JUMPS: 3,

    // Falling: gravity accelerates a fall up to these speeds
    MAX_FALL_SPEED: 1800,
    MAX_FAST_FALL_SPEED: 2200,
    // Fast fall: holding down while descending; starts at least this fast
    FAST_FALL_SPEED: 1100,
    // Above the terminal speed once a fast fall ends, the excess shrinks by this share per step
    FALL_SPEED_EASE: 0.85,

    // Recovery attack
    RECOVERY_FORCE_Y: -1760,
    RECOVERY_FORCE_X: 550,
    RECOVERY_DURATION: 300,

    // Platform drop-through
    PLATFORM_DROP_GRACE_PERIOD: 200,

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
    DASH_JUMP_FORCE: -750,
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

    // Run mechanics
    RUN_SPEED_MULT: 2.25,
    RUN_ACCEL_MULT: 1.2,

    // Damage system
    MAX_DAMAGE: 999,
    HIT_STUN_DURATION: 300,

    // Player dimensions
    PLAYER_WIDTH: 120,
    PLAYER_HEIGHT: 184,

    // Attack phases
    LIGHT_STARTUP_MS: 50,
    LIGHT_ACTIVE_MS: 100,
    LIGHT_RECOVERY_MS: 50,
    HEAVY_STARTUP_MS: 30,
    HEAVY_ACTIVE_MS: 300,
    HEAVY_RECOVERY_MS: 200,

    // Ground pound
    GROUND_POUND_STARTUP: 100,
    GROUND_POUND_DAMAGE: 8,

    // Chargeable heavy attacks
    CHARGE_MAX_TIME: 1500,

    // Wall mechanics
    WALL_SLIDE_SPEED: 400,
    WALL_JUMP_FORCE_X: 1600,
    WALL_JUMP_FORCE_Y: -1050,
    WALL_COYOTE_TIME: 200,

    // State-dependent friction multipliers
    AIR_FRICTION: 0.91,
    CHARGE_FRICTION: 0.2,
    CHARGE_GRAVITY_CANCEL: 0.5,
    ATTACK_RECOVERY_FRICTION: 0.75,
    ATTACK_ACTIVE_FRICTION: 0.95,
    AERIAL_STALL_GRAVITY_DAMP: 0.6,
    AERIAL_STALL_HORIZONTAL_DAMP: 0.9,
    HITSTUN_FRICTION: 0.95,
    SHORT_HOP_VELOCITY_DAMP: 0.5,

    // Combat hitbox overrides
    UP_SIG_HITBOX_WIDTH: 147,
    UP_SIG_HITBOX_HEIGHT: 34,
    SIDE_LIGHT_HITBOX_WIDTH: 81,
    SIDE_LIGHT_OFFSET_EXTRA: 20,
    GHOST_HITBOX_SCALE: 0.65,
    RECOVERY_HITBOX_SIZE: 60,
    RECOVERY_DAMAGE: 8,

    // Side Sig damage scaling
    SIDE_SIG_MIN_DAMAGE: 6,
    SIDE_SIG_MAX_DAMAGE: 20,

    // Movement thresholds
    HIGH_SPEED_THRESHOLD_MULT: 1.2,
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
