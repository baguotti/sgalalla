/**
 * Centralized Physics Configuration
 * Tweak these values to adjust the game feel
 */
export const PhysicsConfig = {
  // Gravity - high value for fast, heavy feel (like Brawlhalla)
  GRAVITY: 2200,

  // Movement - acceleration-based for responsive feel with slight slide
  MOVE_ACCEL: 6500,
  GLOBAL_KNOCKBACK_SCALING: 5.0, // Increased from 0.12 to match pixel scale
  FRICTION: 0.60,
  RUN_FRICTION: 0.93,
  SLIDE_ATTACK_SPEED: 2200,
  SLIDE_ATTACK_DECELERATION: 0.96,
  MAX_SPEED: 1400,
  MAX_FALL_SPEED: 1800, // Reduced from 2600 for floatier fall

  // Jump mechanics
  JUMP_FORCE: -1050,
  SHORT_HOP_FORCE: -540, // Reduced proportionally
  JUMP_HOLD_THRESHOLD: 150,
  DOUBLE_JUMP_FORCE: -900, // Reduced proportionally
  MAX_JUMPS: 3,

  // Fast-fall
  FAST_FALL_MULTIPLIER: 1.7,
  FAST_FALL_THRESHOLD: 300,

  // Recovery attack
  RECOVERY_FORCE_Y: -1760,
  RECOVERY_FORCE_X: 550, // Reduced from 600
  RECOVERY_COOLDOWN: 1000,
  RECOVERY_DURATION: 300,

  // Platform drop-through
  PLATFORM_DROP_GRACE_PERIOD: 200,

  // Attack system
  LIGHT_ATTACK_DAMAGE: 4,
  HEAVY_ATTACK_DAMAGE: 9,
  LIGHT_ATTACK_KNOCKBACK: 25000, // Drastically increased for testing (was 7000)
  HEAVY_ATTACK_KNOCKBACK: 45000, // Drastically increased for testing (was 12000)
  LIGHT_ATTACK_DURATION: 200,
  HEAVY_ATTACK_DURATION: 400,
  LIGHT_ATTACK_COOLDOWN: 300,
  HEAVY_ATTACK_COOLDOWN: 600,

  // Hitbox sizes (Doubled for 1:1 scale)
  LIGHT_HITBOX_WIDTH: 120,
  LIGHT_HITBOX_HEIGHT: 80,

  HEAVY_HITBOX_WIDTH: 600,
  HEAVY_HITBOX_HEIGHT: 120,

  // Dodge/Dash - Brawlhalla style
  DODGE_DISTANCE: 400, // Reduced from 450
  DODGE_DURATION: 180,
  DODGE_COOLDOWN: 800,
  DODGE_INVINCIBILITY: 150,
  SPOT_DODGE_DURATION: 300,

  // Run mechanics
  RUN_SPEED_MULT: 2.25,
  RUN_ACCEL_MULT: 1.2,

  // Damage system
  MAX_DAMAGE: 999,
  HIT_STUN_DURATION: 300,

  // Ledge detection
  LEDGE_SNAP_DISTANCE: 30,

  // Player dimensions (Doubled for 1:1 scale)
  PLAYER_WIDTH: 120,
  PLAYER_HEIGHT: 184,
  NOSE_SIZE: 24,

  // Attack frame timing
  LIGHT_STARTUP_FRAMES: 50,
  LIGHT_ACTIVE_FRAMES: 100,
  LIGHT_RECOVERY_FRAMES: 50,

  // Heavy attacks

  HEAVY_STARTUP_FRAMES: 30,

  HEAVY_ACTIVE_FRAMES: 300,
  HEAVY_RECOVERY_FRAMES: 200,

  // Ground pound
  GROUND_POUND_STARTUP: 200,
  GROUND_POUND_SPEED: 3200, // Reduced from 3600
  GROUND_POUND_DAMAGE: 8,
  GROUND_POUND_KNOCKBACK: 500, // Reduced from 1800 to match recovery

  // Directional attack hitbox offsets (Doubled)

  SIDE_ATTACK_OFFSET_X: 300,
  UP_ATTACK_OFFSET_Y: -150,
  DOWN_ATTACK_OFFSET_Y: 150,

  // Chargeable heavy attacks
  CHARGE_MAX_TIME: 1500,
  CHARGE_DAMAGE_MULT: 2.0,
  CHARGE_KNOCKBACK_MULT: 1.8,

  // Wall mechanics
  WALL_SLIDE_SPEED: 400, // Reduced from 450
  WALL_JUMP_FORCE_X: 1600, // Reduced from 1800
  WALL_JUMP_FORCE_Y: -1050,
  WALL_FRICTION: 0.7,
  WALL_COYOTE_TIME: 200, // Grace period for wall jumps and wall slide stability

  // Edge grab mechanics
  EDGE_GRAB_HORIZONTAL_RANGE: 60,
  EDGE_GRAB_VERTICAL_RANGE: 90,
  LEDGE_HANG_OFFSET_X: 45,
  LEDGE_HANG_OFFSET_Y: 45,
  LEDGE_CLIMB_SPEED: -1000, // Reduced from -1200
  LEDGE_JUMP_X: 1200, // Reduced from 1350
  LEDGE_JUMP_Y: -1600, // Reduced from -1800

  // State-dependent friction multipliers (applied per-frame to velocity.x)
  AIR_FRICTION: 0.91,               // Floaty air drift
  CHARGE_FRICTION: 0.2,             // Massive friction to stop quickly when charging sigs
  CHARGE_GRAVITY_CANCEL: 0.5,       // Vertical damping during aerial charge (gravity cancel)
  ATTACK_RECOVERY_FRICTION: 0.75,   // Higher friction during attack recovery phase
  ATTACK_ACTIVE_FRICTION: 0.95,     // Slight slide during startup/active attack frames
  AERIAL_STALL_GRAVITY_DAMP: 0.6,   // Strong vertical damping for aerial flurry attacks
  AERIAL_STALL_HORIZONTAL_DAMP: 0.9,// Extra horizontal friction for aerial flurry attacks
  HITSTUN_FRICTION: 0.95,           // Low friction during hitstun for long knockback travel
  SHORT_HOP_VELOCITY_DAMP: 0.5,     // Velocity multiplier when releasing jump early

  // Combat hitbox overrides (per-attack-type dimension tweaks)
  DOWN_SIG_HITBOX_WIDTH: 160,
  DOWN_SIG_HITBOX_HEIGHT: 30,
  UP_SIG_HITBOX_WIDTH: 127,
  UP_SIG_HITBOX_HEIGHT: 34,
  SIDE_LIGHT_HITBOX_WIDTH: 81,
  SIDE_LIGHT_OFFSET_EXTRA: 20,      // Extra forward offset for side/neutral/up light attacks
  GHOST_HITBOX_SCALE: 0.65,         // Scale factor for ghost sprite hitbox (Fok Side Sig)
  RECOVERY_HITBOX_SIZE: 60,         // Width and height of recovery attack hitbox
  RECOVERY_DAMAGE: 8,               // Damage dealt by recovery attack

  // Side Sig damage scaling (Fok)
  SIDE_SIG_MIN_DAMAGE: 6,
  SIDE_SIG_MAX_DAMAGE: 20,
} as const;
