/**
 * Centralized Physics Configuration
 * Tweak these values to adjust the game feel
 */
export const PhysicsConfig = {
  // Gravity - high value for fast, heavy feel (like Brawlhalla)
  GRAVITY: 3750, // 2500 * 1.5

  // Movement - acceleration-based for responsive feel with slight slide
  MOVE_ACCEL: 3600, // 2400 * 1.5
  FRICTION: 0.85, // Applied each frame (0.85 = 15% speed reduction per frame)
  RUN_FRICTION: 0.93, // Less friction when running/stopping from run (slidier)
  MAX_SPEED: 750, // 500 * 1.5
  MAX_FALL_SPEED: 1500, // 1000 * 1.5

  // Jump mechanics
  JUMP_FORCE: -1050, // -700 * 1.5
  SHORT_HOP_FORCE: -600, // -400 * 1.5
  JUMP_HOLD_THRESHOLD: 150, // ms - unchanged
  DOUBLE_JUMP_FORCE: -975, // -650 * 1.5
  MAX_JUMPS: 3, // Enable Triple Jump

  // Fast-fall
  FAST_FALL_MULTIPLIER: 1.5, // 50% increase in fall speed (multiplier)
  FAST_FALL_THRESHOLD: 150, // 100 * 1.5

  // Recovery attack (upward attack for vertical recovery)
  RECOVERY_FORCE_Y: -1200, // -800 * 1.5
  RECOVERY_FORCE_X: 300, // 200 * 1.5
  RECOVERY_COOLDOWN: 1000, // ms - unchanged
  RECOVERY_DURATION: 300, // ms - unchanged

  // Platform drop-through
  PLATFORM_DROP_GRACE_PERIOD: 200, // ms - unchanged

  // Attack system
  LIGHT_ATTACK_DAMAGE: 4,
  HEAVY_ATTACK_DAMAGE: 9,
  LIGHT_ATTACK_KNOCKBACK: 700, // Increased from 450
  HEAVY_ATTACK_KNOCKBACK: 1200, // Increased from 900
  LIGHT_ATTACK_DURATION: 200,
  HEAVY_ATTACK_DURATION: 400,
  LIGHT_ATTACK_COOLDOWN: 300,
  HEAVY_ATTACK_COOLDOWN: 600,

  // Hitbox sizes (Doubled for 1:1 scale)
  LIGHT_HITBOX_WIDTH: 120, // 60 * 2
  LIGHT_HITBOX_HEIGHT: 80, // 40 * 2
  HEAVY_HITBOX_WIDTH: 160, // 80 * 2
  HEAVY_HITBOX_HEIGHT: 120, // 60 * 2

  // Dodge/Dash - Brawlhalla style
  DODGE_DISTANCE: 225,
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
  LEDGE_SNAP_DISTANCE: 30, // 15 * 2

  // Player dimensions (Doubled for 1:1 scale)
  PLAYER_WIDTH: 120, // 60 * 2
  PLAYER_HEIGHT: 170, // 85 * 2
  NOSE_SIZE: 24, // 12 * 2

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
  GROUND_POUND_SPEED: 1800,
  GROUND_POUND_DAMAGE: 8,
  GROUND_POUND_KNOCKBACK: 1050,

  // Directional attack hitbox offsets (Doubled)
  SIDE_ATTACK_OFFSET_X: 150,    // 75 * 2
  UP_ATTACK_OFFSET_Y: -150,     // -75 * 2
  DOWN_ATTACK_OFFSET_Y: 150,    // 75 * 2

  // Chargeable heavy attacks
  CHARGE_MAX_TIME: 1000,
  CHARGE_DAMAGE_MULT: 2.0,
  CHARGE_KNOCKBACK_MULT: 1.8,

  // Wall mechanics
  WALL_SLIDE_SPEED: 225,
  WALL_JUMP_FORCE_X: 900,
  WALL_JUMP_FORCE_Y: -975,
  WALL_FRICTION: 0.7,

  // Edge grab mechanics (Doubled ranges/offsets)
  EDGE_GRAB_HORIZONTAL_RANGE: 60, // 30 * 2
  EDGE_GRAB_VERTICAL_RANGE: 90, // 45 * 2
  LEDGE_HANG_OFFSET_X: 45, // 22.5 * 2
  LEDGE_HANG_OFFSET_Y: 45, // 22.5 * 2
  LEDGE_CLIMB_SPEED: -600,
  LEDGE_JUMP_X: 675,
  LEDGE_JUMP_Y: -900,
} as const;
