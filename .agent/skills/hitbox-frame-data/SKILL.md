---
name: hitbox-frame-data
description: Patterns for managing hitboxes, hurtboxes, and frame data in Phaser 3 fighting games.
license: MIT
metadata:
  version: "1.0.0"
  author: ant-generated
---

# Hitbox & Frame Data Management

Precision detection of attacks and damage.

## 1. Frame Data Structure

Define moves using a data-driven approach, not hardcoded if statements.

```typescript
type FrameData = {
    animName: string;
    description: string;
    damage: number;
    startup: number; // Frames before active
    active: number;  // Frames hitbox is deadly
    recovery: number;// Frames vulnerable after
    hitStun: number; // Frames opponent freezes
    blockStun: number;
    launchForce: { x: number, y: number };
}

const RYU_LIGHT_PUNCH: FrameData = {
    animName: 'lp',
    description: 'Jab',
    damage: 10,
    startup: 3,
    active: 4,
    recovery: 8,
    hitStun: 12,
    blockStun: 4,
    launchForce: { x: 100, y: 0 }
};
```

## 2. Hitbox vs Hurtbox

- **Hurtbox (Green)**: The area where the character *takes* damage. Usually approximates the body.
- **Hitbox (Red)**: The area where the character *deals* damage. Attached to fists/feet/weapons.

### Implementation in Phaser 3

Use `Phaser.GameObjects.Zone` or invisible physics bodies attached to the parent container.

```typescript
// Spawning a hitbox
function activateHitbox(fighter: Fighter, move: FrameData) {
    const hitbox = scene.add.zone(fighter.x + 50, fighter.y, 40, 40);
    scene.physics.add.existing(hitbox);
    
    // Check overlap only during active frames
    scene.physics.add.overlap(hitbox, enemy.hurtbox, () => {
        applyDamage(enemy, move);
        hitbox.destroy(); // One hit per move
    });
    
    // Auto-destroy after 'active' frames
    scene.time.delayedCall(framesToMs(move.active), () => hitbox.destroy());
}
```

## 3. Tick-Based Animation

For true frame perfection, sync logic to game *ticks* (fixed updates), not render frames.

- **Bad**: `scene.time.delayedCall(100)` (Time based, imprecise)
- **Good**: Decrement `currentFrame` counter in `update()` loop.
