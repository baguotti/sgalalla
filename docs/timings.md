# Sgalalla - Mechanics & Timings Documentation

## Movement Physics
- **Gravity:** 2500 (Heavy, fast fall)
- **Acceleration:** 2400
- **Friction:** 0.85 (Ground), 0.93 (Run/Stop)
- **Max Speed:** 500
- **Fast Fall:** 1.5x speed (Threshold: 100 upward velocity)

## Jump Mechanics
- **Full Jump:** -700 force
- **Short Hop:** -400 force
- **Hold Threshold:** 150ms
- **Double Jump:** -650 force

## Attack Frame Data
*Derived from `PhysicsConfig.ts`*

### Light Attacks
- **Startup:** 50ms (3 frames @ 60fps)
- **Active:** 100ms (6 frames)
- **Recovery:** 50ms (3 frames)
- **Total Duration:** 200ms
- **Cooldown:** 300ms

### Heavy Attacks
- **Startup:** 80ms (~5 frames)
- **Active:** 150ms (9 frames)
- **Recovery:** 200ms (12 frames)
- **Total Duration:** 430ms
- **Cooldown:** 600ms

### Ground Pound
- **Startup:** 200ms (Hover time)
- **Speed:** 1200 (Descent velocity)

## Defensive Mechanics
- **Dodge Duration:** 180ms
- **Dodge Distance:** 150px
- **Invincibility:** 150ms
- **Cooldown:** 800ms
- **Spot Dodge:** 300ms duration

## Wall Mechanics
- **Wall Slide Speed:** 150 (Caps fall speed)
- **Wall Jump:** X: 600, Y: -650

## Hit Stun
- **Base Duration:** 300ms
