---
name: phaser-ui-camera-ghosting
description: Prevents UI camera ghosting and platform duplication glitches by enforcing strict camera exclusions in Phaser 3.
license: MIT
metadata:
  version: "1.0.0"
  author: antigravity
---

# Phaser UI Camera Ghosting & Duplication

When using multiple cameras in Phaser 3 (e.g., a `main` camera for the game world and a `uiCamera` for HUD/UI elements), game objects added to the scene will be rendered by **all active cameras** by default. 

If this happens, the `uiCamera` will render static "ghosts" or duplicate copies of game world objects (like platforms, backgrounds, and players) that don't scroll with the main camera.

## Usage

Use this skill whenever you are:
1. Adding new platforms, backgrounds, or textures to a Phaser scene that has a UI camera.
2. Creating a separate UI camera.
3. Refactoring a Stage Factory or shared stage creation logic.

## Instructions / Patterns

### The "Ignore" Pattern

Whenever you create a new game object (or a group of game objects) that belongs exclusively to the game world, you **MUST** explicitly tell the `uiCamera` to ignore them. Conversely, any UI elements must be ignored by the `main` camera.

### ❌ BAD: Forgetting to update camera exclusions
```typescript
// StageFactory.ts
export function createStage(scene: Phaser.Scene) {
    const mainPlatform = scene.add.image(0, 0, 'platform');
    const newBackground = scene.add.image(0, 0, 'bg'); // Just added by developer
    
    // Result: newBackground is rendered by BOTH main camera and UI camera (duplication glitch)
    return { mainPlatform, newBackground };
}

// OnlineGameScene.ts
private configureCameraExclusions(): void {
    if (this.uiCamera) {
        this.uiCamera.ignore(this.stage.mainPlatform);
        // Forgot to ignore the newBackground!
    }
}
```

### ✅ GOOD: Grouping visual arrays and ignoring everything
If you use a helper function to create stage elements, make sure to bundle **all** visual textures in an array and return them so the scene can ignore them.

```typescript
// StageFactory.ts
export function createStage(scene: Phaser.Scene) {
    const mainPlatform = scene.add.image(0, 0, 'platform_main');
    const leftPlatform = scene.add.image(0, 0, 'platform_side');
    const rightPlatform = scene.add.image(0, 0, 'platform_side');
    
    return { 
        physicsBodies: [/* ... */],
        // Bundle ALL visuals so the caller can easily pass them to uiCamera.ignore()
        platformTextures: [mainPlatform, leftPlatform, rightPlatform] 
    };
}

// OnlineGameScene.ts
private configureCameraExclusions(): void {
    if (!this.uiCamera) return;

    // Ignore EVERYTHING from the stage that isn't UI
    if (this.stage.platformTextures && this.stage.platformTextures.length > 0) {
        this.uiCamera.ignore(this.stage.platformTextures);
    }
    
    // Ignore players
    this.players.forEach(p => p.addToCameraIgnore(this.uiCamera));
}
```

### Key Takeaways
- **Default Behavior:** Phaser cameras render everything.
- **UI Cameras:** Must ignore **all** game-world sprites, rectangles, backgrounds, and tile-sprites.
- **Main Camera:** Must ignore **all** HUD text, overlays, and UI element groups.
- **Stage Factories:** Always return an array containing every single visual object instantiated so the parent scene can safely pass it to `this.uiCamera.ignore()`.
