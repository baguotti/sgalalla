/**
 * Centralized Physics Configuration
 * Tweak these values to adjust the game feel
 */
export const PhysicsConfig = {
  // Gravity - high value for fast, heavy feel (like Brawlhalla)
  GRAVITY: 2500,

  // Movement - acceleration-based for responsive feel with slight slide
  MOVE_ACCEL: 1500,
  FRICTION: 0.85, // Applied each frame (0.85 = 15% speed reduction per frame)
  MAX_SPEED: 400,

  // Jump mechanics
  JUMP_FORCE: -700, // Full jump (hold)
  SHORT_HOP_FORCE: -400, // Short jump (tap)
  JUMP_HOLD_THRESHOLD: 150, // ms - if held longer than this, it's a full jump
  DOUBLE_JUMP_FORCE: -650,

  // Fast-fall
  FAST_FALL_MULTIPLIER: 1.5, // 50% increase in fall speed
  FAST_FALL_THRESHOLD: 100, // Minimum upward velocity to trigger fast-fall

  // Recovery attack (upward attack for vertical recovery)
  RECOVERY_FORCE_Y: -800, // Strong upward force
  RECOVERY_FORCE_X: 200, // Horizontal drift in facing direction
  RECOVERY_COOLDOWN: 1000, // ms - prevent spam
  RECOVERY_DURATION: 300, // ms - how long recovery state lasts

  // Platform drop-through
  PLATFORM_DROP_GRACE_PERIOD: 200, // ms - time to ignore platform collision

  // Attack system
  LIGHT_ATTACK_DAMAGE: 5, // Light attack damage percentage
  HEAVY_ATTACK_DAMAGE: 12, // Heavy attack damage percentage
  LIGHT_ATTACK_KNOCKBACK: 300, // Base knockback for light
  HEAVY_ATTACK_KNOCKBACK: 600, // Base knockback for heavy
  LIGHT_ATTACK_DURATION: 200, // ms - how long light attack lasts
  HEAVY_ATTACK_DURATION: 400, // ms - how long heavy attack lasts
  LIGHT_ATTACK_COOLDOWN: 300, // ms - time between light attacks
  HEAVY_ATTACK_COOLDOWN: 600, // ms - time between heavy attacks

  // Hitbox sizes
  LIGHT_HITBOX_WIDTH: 60,
  LIGHT_HITBOX_HEIGHT: 40,
  HEAVY_HITBOX_WIDTH: 80,
  HEAVY_HITBOX_HEIGHT: 60,

  // Dodge/Dash
  DODGE_DISTANCE: 150, // Distance traveled during dodge
  DODGE_DURATION: 250, // ms - how long dodge lasts
  DODGE_COOLDOWN: 800, // ms - time between dodges
  DODGE_INVINCIBILITY: 150, // ms - invincibility frames

  // Damage system
  MAX_DAMAGE: 999, // Maximum damage percentage
  KNOCKBACK_SCALING: 0.01, // How much damage affects knockback
  HIT_STUN_DURATION: 300, // ms - time player is stunned after being hit

  // Ledge detection
  LEDGE_SNAP_DISTANCE: 10,

  // Player dimensions
  PLAYER_WIDTH: 40,
  PLAYER_HEIGHT: 60,
  NOSE_SIZE: 8,

  // Attack frame timing (in ms)
  // Light attacks - fast startup, short active, quick recovery
  LIGHT_STARTUP_FRAMES: 50,    // 3 frames at 60fps
  LIGHT_ACTIVE_FRAMES: 100,    // 6 frames - hitbox active
  LIGHT_RECOVERY_FRAMES: 100,  // 6 frames - can't act

  // Heavy attacks - slower startup, longer active, longer recovery
  HEAVY_STARTUP_FRAMES: 150,   // 9 frames
  HEAVY_ACTIVE_FRAMES: 150,    // 9 frames
  HEAVY_RECOVERY_FRAMES: 200,  // 12 frames

  // Ground pound (down + attack in air)
  GROUND_POUND_STARTUP: 200,   // Pause in air before dropping
  GROUND_POUND_SPEED: 1200,    // Fast fall speed during ground pound
  GROUND_POUND_DAMAGE: 15,     // Higher damage for commitment
  GROUND_POUND_KNOCKBACK: 700,

  // Directional attack hitbox offsets
  SIDE_ATTACK_OFFSET_X: 50,    // How far in front of player
  UP_ATTACK_OFFSET_Y: -50,     // How far above player
  DOWN_ATTACK_OFFSET_Y: 50,    // How far below player
} as const;
