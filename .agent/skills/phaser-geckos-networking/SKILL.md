---
name: phaser-geckos-networking
description: Best practices for building high-performance real-time multiplayer games using Phaser 3 and Geckos.io (WebRTC/UDP).
license: MIT
metadata:
  version: "1.1.0"
  author: ant-generated
---

# Phaser 3 + Geckos.io Networking Skills

Guidelines for implementing "snappy" real-time multiplayer games using Phaser 3 (Client/Server) and Geckos.io.

## Core Architecture: Server-Authoritative

### 1. Headless Phaser Server
Run Phaser in HEADLESS mode on the server to handle physics and game logic.
**Why**: Ensures the server is the single source of truth and prevents client-side cheating.

```javascript
// Server-side Phaser config
const config = {
  type: Phaser.HEADLESS,
  parent: 'phaser-game',
  width: 1280,
  height: 720,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 300 },
      fps: 60 // Server tick rate
    }
  },
  scene: [ServerGameScene]
}
```

## Network Optimization (State of the Art)

### 1. Binary State & Delta Compression
**Goal**: Reduce packet size to < 1KB per tick.
**Pattern**:
1. **Schema**: Use a byte-aligned schema (e.g., Buffer, `geckos.io-snapshot-interpolation`, or `msgpack`).
2. **Delta**: Only send properties that changed, or send full snapshots at a lower rate and deltas at a high rate.
3. **Quantization**: Don't send `float64`. Multiply by 10/100 and send `int16`.

```typescript
// Example: Encoding functionality using ArrayBuffer
function encodePlayer(p: Player): ArrayBuffer {
    const buf = new ArrayBuffer(10); // ID(2) + X(2) + Y(2) + Rot(2) + Anim(2)
    const view = new DataView(buf);
    view.setUint16(0, p.id);
    view.setInt16(2, Math.round(p.x * 10)); // Quantize x (precision 0.1)
    view.setInt16(4, Math.round(p.y * 10)); // Quantize y
    view.setUint16(6, Math.round(p.rotation * 100));
    view.setUint16(8, p.animIndex);
    return buf;
}
```

### 2. Snapshot Interpolation
**Goal**: Smooth movement despite network jitter.
**Tools**: Use `@geckos.io/snapshot-interpolation`.

1. **Server**: Broadcast global world state at 20Hz-60Hz.
2. **Client**: Store snapshots in a "Vault".
3. **Render**: Interpolate between the two closest snapshots relative to `serverTime - 100ms` (render delay).

```typescript
import { SnapshotInterpolation } from '@geckos.io/snapshot-interpolation'
const SI = new SnapshotInterpolation()

// On Packet
SI.snapshot.add(decodedState)

// On Update
const snapshot = SI.calcInterpolation('x y rotation')
if (snapshot) {
    const { state } = snapshot
    state.forEach(entity => {
        const sprite = scene.players.get(entity.id)
        if (sprite) {
             sprite.x = entity.x
             sprite.y = entity.y
             sprite.setRotation(entity.rotation)
        }
    })
}
```

### 3. Client-Side Prediction (CSP)
**Goal**: Instant feedback for the local player.

1. **Input**: Player presses 'Right'.
2. **Predict**: Move local sprite 'Right' immediately.
3. **Send**: Send 'Right' input to server.
4. **Reconcile**:
    - Receive server state for that tick.
    - If `abs(serverPos - predictedPos) > Threshold`:
        - Snap/Lerp to server position.
        - Re-run inputs from that tick to present (Rollback).

## Advanced: Lag Compensation (Rewind)

**Context**: Player A shoots at Player B. On A's screen, B is at (100, 100). On Server, B has moved to (120, 100).
**Solution**:
1. Server stores a history of Hitboxes (last 1 sec).
2. When A shoots, they send "I shot at time T".
3. Server receives packet at T+latency.
4. Server **rewinds** world state to Time T.
5. Server checks collision.
6. Server restores world state.

## Geckos.io Specifics

- **Channels**: Use `emit` (UDP, unreliable) for movement. Use `reliable: true` for Game Over/Spawn.
- **NAT Traversal**: Geckos handles WebRTC content. Ensure UDP ports (default 9208) are open in cloud firewalls.
- **Disconnects**: Handle `onDisconnect`. If temporary, keep the entity alive for 5s (reconnect window) before destroying.

## Checklist

- [ ] **Frame Rate**: Server Physics FPS matches Client Snapshot Rate (or multiple thereof).
- [ ] **Packet Size**: Average packet < 1400 bytes (MTU safety).
- [ ] **GC**: Reuse ArrayBuffers/Objects. Don't `new` things in the network loop.
