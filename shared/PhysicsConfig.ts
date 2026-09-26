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
    MAX_FALL_SPEED: 1800,

    // Jump mechanics
    JUMP_FORCE: -1050,
    SHORT_HOP_FORCE: -540,
    DOUBLE_JUMP_FORCE: -900,
    MAX_JUMPS: 3,

    // Fast-fall
    FAST_FALL_MULTIPLIER: 1.7,
    FAST_FALL_THRESHOLD: 300,

    // Recovery attack
    RECOVERY_FORCE_Y: -1760,
    RECOVERY_FORCE_X: 550,
    RECOVERY_DURATION: 300,

    // Platform drop-through
    PLATFORM_DROP_GRACE_PERIOD: 200,

    // Dodge/Dash - Brawlhalla style
    DODGE_DISTANCE: 210,
    DODGE_DURATION: 180,
    DODGE_COOLDOWN: 800,
    SPOT_DODGE_DURATION: 300,

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
