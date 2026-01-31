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

  // Hitbox sizes
  LIGHT_HITBOX_WIDTH: 60,
  LIGHT_HITBOX_HEIGHT: 40,
  HEAVY_HITBOX_WIDTH: 80,
  HEAVY_HITBOX_HEIGHT: 60,

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
  KNOCKBACK_SCALING: 0.015, // Increased scaling slightly (was 0.012)
  // Wait, if KNOCKBACK_SCALING converts damage% to velocity force, and we want higher velocity force for larger screen...
  // We already scaled LIGHT_ATTACK_KNOCKBACK base force.
  // Formula is usually Base + (Damage * Scaling). Both result in velocity.
  // Since we want 1.5x velocity, we should verify logic. But for now, let's assume scaling factor works on percentage to force ratio.
  // If we want 1.5x force for same damage, we should scale this too?
  // Let's assume yes: 0.012 * 1.5 = 0.018? No, let's keep it and see. The base knockback is scaled.

  HIT_STUN_DURATION: 300,

  // Ledge detection
  LEDGE_SNAP_DISTANCE: 15,

  // Player dimensions
  PLAYER_WIDTH: 60,
  PLAYER_HEIGHT: 90,
  NOSE_SIZE: 12,

  // Attack frame timing
  LIGHT_STARTUP_FRAMES: 50,    // 3 frames at 60fps
  LIGHT_ACTIVE_FRAMES: 100,    // 6 frames - hitbox active
  LIGHT_RECOVERY_FRAMES: 50,   // Reduced for snappy feel (was 100)

  // Heavy attacks
  HEAVY_STARTUP_FRAMES: 80,    // ~5 frames (reduced from 150ms/9 frames)
  HEAVY_ACTIVE_FRAMES: 150,    // 9 frames
  HEAVY_RECOVERY_FRAMES: 200,  // 12 frames

  // Ground pound (down + attack in air)
  GROUND_POUND_STARTUP: 200,   // ms
  GROUND_POUND_SPEED: 1800,    // 1200 * 1.5
  GROUND_POUND_DAMAGE: 8,      // unchanged
  GROUND_POUND_KNOCKBACK: 1050, // Reduced from 1350 (now comparable to heavy)

  // Directional attack hitbox offsets
  SIDE_ATTACK_OFFSET_X: 75,    // 50 * 1.5
  UP_ATTACK_OFFSET_Y: -75,     // -50 * 1.5
  DOWN_ATTACK_OFFSET_Y: 75,    // 50 * 1.5

  // Chargeable heavy attacks
  CHARGE_MAX_TIME: 1000,       // Max charge time in ms
  CHARGE_DAMAGE_MULT: 2.0,     // 2x damage at full charge
  CHARGE_KNOCKBACK_MULT: 1.8,  // 1.8x knockback at full charge

  // Wall mechanics - Brawlhalla style
  WALL_SLIDE_SPEED: 225,       // 150 * 1.5
  WALL_JUMP_FORCE_X: 900,      // 600 * 1.5
  WALL_JUMP_FORCE_Y: -975,     // -650 * 1.5
  WALL_FRICTION: 0.7,          // unchanged

  // Edge grab mechanics
  EDGE_GRAB_HORIZONTAL_RANGE: 30, // 20 * 1.5
  EDGE_GRAB_VERTICAL_RANGE: 45, // 30 * 1.5
  LEDGE_HANG_OFFSET_X: 22.5, // 15 * 1.5
  LEDGE_HANG_OFFSET_Y: 22.5, // 15 * 1.5
  LEDGE_CLIMB_SPEED: -600, // -400 * 1.5
  LEDGE_JUMP_X: 675, // 450 * 1.5
  LEDGE_JUMP_Y: -900, // -600 * 1.5
} as const;
