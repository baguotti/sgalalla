---
name: deterministic-input-buffer
description: Implementing deterministic game loops and input buffers for predictable, rollback-ready gameplay.
license: MIT
metadata:
  version: "1.0.0"
  author: ant-generated
---

# Deterministic Input Buffer

Ensures that "moves come out" when the player intends them to, and that the game state is reproducible (crucial for networking).

## 1. The Input Buffer

Players adhere to a rhythm, not a timestamp. Allow inputs to "hang" for a few frames.

```typescript
class InputBuffer {
    private buffer: { key: string, frames: number }[] = [];
    private MAX_BUFFER_FRAMES = 10; // ~160ms at 60fps

    add(key: string) {
        this.buffer.push({ key, frames: this.MAX_BUFFER_FRAMES });
    }

    update() {
        // Decrease life of buffered inputs
        this.buffer.forEach(b => b.frames--);
        this.buffer = this.buffer.filter(b => b.frames > 0);
    }

    consume(key: string): boolean {
        const index = this.buffer.findIndex(b => b.key === key);
        if (index !== -1) {
            this.buffer.splice(index, 1);
            return true;
        }
        return false;
    }
}
```

## 2. Fixed Timestep (Determinism)

Physics and Game Logic MUST run at a fixed rate (e.g., 60Hz), independent of render rate (Hz).

**Phaser Config:**

```javascript
physics: {
    default: 'arcade',
    arcade: {
        fps: 60, // Fixed step
        timeScale: 1
    }
}
```

**Custom Loop (for pure determinism):**

```typescript
const MS_PER_TICK = 1000 / 60;
let accumulator = 0;

function update(time, delta) {
    accumulator += delta;
    while (accumulator >= MS_PER_TICK) {
        processInputs(); // Consumes from buffer
        updatePhysics(); // Advance state
        accumulator -= MS_PER_TICK;
    }
    renderInterpolation(accumulator / MS_PER_TICK);
}
```

## 3. Rollback Concepts (Geckos.io context)

Since we are using UDP (Geckos), we deal with packet loss/delay.

- **Server**: Authoritative, runs fixed loop.
- **Client**: Predicts local inputs immediately.
- **Rollback**: If server state differs from predicted state (History), rewind to the mismatch frame, apply correct server input, and replay inputs to present.
