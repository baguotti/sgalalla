/**
 * Centralized Physics Configuration
 * Tweak these values to adjust the game feel
 */
export const PhysicsConfig = {
  // Gravity - high value for fast, heavy feel (like Brawlhalla)
  GRAVITY: 2500,

  // Movement - acceleration-based for responsive feel with slight slide
  MOVE_ACCEL: 2400, // Faster acceleration
  FRICTION: 0.85, // Applied each frame (0.85 = 15% speed reduction per frame)
  RUN_FRICTION: 0.93, // Less friction when running/stopping from run (slidier)
  MAX_SPEED: 500, // Slightly reduced base speed (was 520)
  MAX_FALL_SPEED: 1000, // Maximum fall speed to prevent glitches

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
  LIGHT_ATTACK_DAMAGE: 4, // Reduced from 5
  HEAVY_ATTACK_DAMAGE: 9, // Reduced from 12
  LIGHT_ATTACK_KNOCKBACK: 300,
  HEAVY_ATTACK_KNOCKBACK: 600,
  LIGHT_ATTACK_DURATION: 200, // ms - how long light attack lasts
  HEAVY_ATTACK_DURATION: 400, // ms - how long heavy attack lasts
  LIGHT_ATTACK_COOLDOWN: 300, // ms - time between light attacks
  HEAVY_ATTACK_COOLDOWN: 600, // ms - time between heavy attacks

  // Hitbox sizes
  LIGHT_HITBOX_WIDTH: 60,
  LIGHT_HITBOX_HEIGHT: 40,
  HEAVY_HITBOX_WIDTH: 80,
  HEAVY_HITBOX_HEIGHT: 60,

  // Dodge/Dash - Brawlhalla style (fast and covers ground)
  DODGE_DISTANCE: 150, // Reduced from 180 to slow down the burst
  DODGE_DURATION: 180, // Increased from 160 for more readable timing
  DODGE_COOLDOWN: 800, // Increased slightly to prevent spam
  DODGE_INVINCIBILITY: 150, // ms - invincibility frames
  SPOT_DODGE_DURATION: 300, // ms - spot dodge lasts slightly longer

  // Run mechanics (dodge kickstarts running)
  RUN_SPEED_MULT: 2.25, // 2.25x faster (Fast but controllable)
  RUN_ACCEL_MULT: 1.2, // Smoother acceleration (was 2.0) to fix abrupt transition

  // Damage system - Smash/Brawlhalla style (higher damage = further knockback)
  MAX_DAMAGE: 999, // Maximum damage percentage
  KNOCKBACK_SCALING: 0.012, // Very low scaling for longer survival
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
  LIGHT_RECOVERY_FRAMES: 50,   // Reduced for snappy feel (was 100)

  // Heavy attacks - slower startup, longer active, longer recovery
  HEAVY_STARTUP_FRAMES: 150,   // 9 frames
  HEAVY_ACTIVE_FRAMES: 150,    // 9 frames
  HEAVY_RECOVERY_FRAMES: 200,  // 12 frames

  // Ground pound (down + attack in air)
  GROUND_POUND_STARTUP: 200,   // Pause in air before dropping
  GROUND_POUND_SPEED: 1200,    // Fast fall speed during ground pound
  GROUND_POUND_DAMAGE: 8,      // Reduced from 11
  GROUND_POUND_KNOCKBACK: 900, // Strong knockback for spikes

  // Directional attack hitbox offsets
  SIDE_ATTACK_OFFSET_X: 50,    // How far in front of player
  UP_ATTACK_OFFSET_Y: -50,     // How far above player
  DOWN_ATTACK_OFFSET_Y: 50,    // How far below player

  // Chargeable heavy attacks
  CHARGE_MAX_TIME: 1000,       // Max charge time in ms
  CHARGE_DAMAGE_MULT: 2.0,     // 2x damage at full charge
  CHARGE_KNOCKBACK_MULT: 1.8,  // 1.8x knockback at full charge

  // Wall mechanics - Brawlhalla style
  WALL_SLIDE_SPEED: 150,       // Max fall speed while wall sliding (much slower than normal)
  WALL_JUMP_FORCE_X: 600,      // Horizontal force away from wall
  WALL_JUMP_FORCE_Y: -650,     // Vertical force (similar to double jump)
  WALL_FRICTION: 0.7,          // Friction applied while sliding on wall

  // Edge grab mechanics
  EDGE_GRAB_HORIZONTAL_RANGE: 20,
  EDGE_GRAB_VERTICAL_RANGE: 30,
  LEDGE_HANG_OFFSET_X: 15, // Distance from edge while hanging
  LEDGE_HANG_OFFSET_Y: 15, // Distance below platform top
  LEDGE_CLIMB_SPEED: -400, // Upward velocity when climbing
  LEDGE_JUMP_X: 450, // Horizontal boost when jumping from ledge
  LEDGE_JUMP_Y: -600, // Vertical boost when jumping from ledge
} as const;
