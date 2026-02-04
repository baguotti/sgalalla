/**
 * Centralized Physics Configuration
 * Tweak these values to adjust the game feel
 */
export const PhysicsConfig = {
  // Gravity - high value for fast, heavy feel (like Brawlhalla)
  GRAVITY: 6400, // Reduced from 7500

  // Movement - acceleration-based for responsive feel with slight slide
  MOVE_ACCEL: 6500, // Reduced from 8000
  FRICTION: 0.85,
  RUN_FRICTION: 0.93,
  MAX_SPEED: 1400, // Reduced from 1600
  MAX_FALL_SPEED: 2600, // Reduced from 3000

  // Jump mechanics
  JUMP_FORCE: -1900, // Reduced from -2100 (Target ~280px height)
  SHORT_HOP_FORCE: -1100, // Reduced from -1200
  JUMP_HOLD_THRESHOLD: 150,
  DOUBLE_JUMP_FORCE: -1750, // Reduced from -1950
  MAX_JUMPS: 3,

  // Fast-fall
  FAST_FALL_MULTIPLIER: 1.5,
  FAST_FALL_THRESHOLD: 300,

  // Recovery attack
  RECOVERY_FORCE_Y: -2100, // Reduced from -2400
  RECOVERY_FORCE_X: 550, // Reduced from 600
  RECOVERY_COOLDOWN: 1000,
  RECOVERY_DURATION: 300,

  // Platform drop-through
  PLATFORM_DROP_GRACE_PERIOD: 200,

  // Attack system
  LIGHT_ATTACK_DAMAGE: 4,
  HEAVY_ATTACK_DAMAGE: 9,
  LIGHT_ATTACK_KNOCKBACK: 7000, // increased ~5x
  HEAVY_ATTACK_KNOCKBACK: 12000, // increased ~5x
  LIGHT_ATTACK_DURATION: 200,
  HEAVY_ATTACK_DURATION: 400,
  LIGHT_ATTACK_COOLDOWN: 300,
  HEAVY_ATTACK_COOLDOWN: 600,

  // Hitbox sizes (Doubled for 1:1 scale)
  LIGHT_HITBOX_WIDTH: 120,
  LIGHT_HITBOX_HEIGHT: 80,
  HEAVY_HITBOX_WIDTH: 160,
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
  KNOCKBACK_SCALING: 0.02,
  HIT_STUN_DURATION: 300,

  // Ledge detection
  LEDGE_SNAP_DISTANCE: 30,

  // Player dimensions (Doubled for 1:1 scale)
  PLAYER_WIDTH: 120,
  PLAYER_HEIGHT: 170,
  NOSE_SIZE: 24,

  // Attack frame timing
  LIGHT_STARTUP_FRAMES: 50,
  LIGHT_ACTIVE_FRAMES: 100,
  LIGHT_RECOVERY_FRAMES: 50,

  // Heavy attacks
  HEAVY_STARTUP_FRAMES: 80,
  HEAVY_ACTIVE_FRAMES: 150,
  HEAVY_RECOVERY_FRAMES: 200,

  // Ground pound
  GROUND_POUND_STARTUP: 200,
  GROUND_POUND_SPEED: 3200, // Reduced from 3600
  GROUND_POUND_DAMAGE: 8,
  GROUND_POUND_KNOCKBACK: 1800, // Reduced from 2100

  // Directional attack hitbox offsets (Doubled)
  SIDE_ATTACK_OFFSET_X: 150,
  UP_ATTACK_OFFSET_Y: -150,
  DOWN_ATTACK_OFFSET_Y: 150,

  // Chargeable heavy attacks
  CHARGE_MAX_TIME: 1000,
  CHARGE_DAMAGE_MULT: 2.0,
  CHARGE_KNOCKBACK_MULT: 1.8,

  // Wall mechanics
  WALL_SLIDE_SPEED: 400, // Reduced from 450
  WALL_JUMP_FORCE_X: 1600, // Reduced from 1800
  WALL_JUMP_FORCE_Y: -1750, // Reduced from -1950
  WALL_FRICTION: 0.7,

  // Edge grab mechanics
  EDGE_GRAB_HORIZONTAL_RANGE: 60,
  EDGE_GRAB_VERTICAL_RANGE: 90,
  LEDGE_HANG_OFFSET_X: 45,
  LEDGE_HANG_OFFSET_Y: 45,
  LEDGE_CLIMB_SPEED: -1000, // Reduced from -1200
  LEDGE_JUMP_X: 1200, // Reduced from 1350
  LEDGE_JUMP_Y: -1600, // Reduced from -1800
} as const;
