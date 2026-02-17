---
name: phaser-optimization
description: Advanced performance optimization patterns for Phaser 3 games (60fps+ on low-end devices).
license: MIT
metadata:
  version: "1.1.0"
  author: ant-generated
---

# Phaser 3 Performance Optimization

Guidance for maintaining 60FPS (or higher) in complex Phaser 3 games.

## 1. Object Pooling (The Golden Rule)

NEVER create and destroy objects (Sprites, Images, Text) during the game loop (update). This causes Garbage Collection (GC) pauses which look like stutters.

**Correct Pattern:**
Use `Phaser.GameObjects.Group` with:
- `classType`: Your custom class.
- `runChildUpdate`: If true, calls `update()` on active children.
- `maxSize`: Limit the pool size.

```javascript
// Initialization
this.bullets = this.add.group({
    classType: Bullet,
    maxSize: 50,
    runChildUpdate: true
});

// Spawning
const bullet = this.bullets.get(x, y); // reuses inactive or creates new
if (bullet) {
    bullet.setActive(true);
    bullet.setVisible(true);
    bullet.fire(x, y);
}

// Despawning (in Bullet class)
this.setActive(false);
this.setVisible(false);
```

## 2. WebGL Pipelines & Shaders (State of the Art)

Don't use thousands of sprites for effects (e.g., fog, lighting, distortion). Use a custom WebGL Pipeline.
**Why**: 1 draw call vs 1000 draw calls.

```javascript
// Add custom pipeline
const GrayscalePipeline = new Phaser.Class({
    Extends: Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline,
    initialize: function (game) {
        Phaser.Renderer.WebGL.Pipelines.TextureTintPipeline.call(this, {
            game: game,
            renderer: game.renderer,
            fragShader: `...` // GLSL shader code
        });
    }
});
```

## 3. Culling & Spatial Hashing

If the world is large, don't update/render entities off-screen.
- **Camera Culling**: `this.cameras.main.cull(sprites)` (Automatic for some types, manual for others).
- **Spatial Hash**: Split world into a grid. Only check collisions in the cells the player occupies.

```typescript
// Simple spatial check before expensive collision
if (Math.abs(player.x - enemy.x) > 1000) return; // Skip logic
```

## 4. Render Batching Strategy

Phaser batches sprites by texture.
- **Atlas**: Put EVERYTHING in 1-2 atlases.
- **Z-Ordering**: Group by Texture first, then Y-sort.
- **Interleaving**: Avoid switching textures frequently (Character -> UI -> Character -> UI).
  - *Bad*: 200 draw calls.
  - *Good*: 2 draw calls (Layer Grouping).

## 5. Event Memory Leaks

Phaser's `EventEmitter` is a common source of leaks.
**Rule**: If you `on()`, you MUST `off()` or `destroy()`.

```javascript
// Bad
scene.input.on('pointerdown', this.shoot);

// Good (Auto-cleanup when Game Object is destroyed)
this.scene = scene;
this.scene.input.on('pointerdown', this.shoot, this);
this.on('destroy', () => {
    this.scene.input.off('pointerdown', this.shoot, this);
});
```

## 6. Logic Isolation (State of the Art)

Don't run logic that doesn't need to run.
- **Entities**: If `!entity.visible`, skip `entity.update()`.
- **Physics**: Disable bodies when inactive `body.enable = false`.
