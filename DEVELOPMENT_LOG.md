# Sgalalla - Development Log

**Total Time Logged:** 10.5 Hours

---

### [2026-01-29] Baseline Restoration
- **[R]** Restoring core feel; existing physics was unstable.
- **[M]** Restricted Brawlhalla mechanics: Run, Dodge, Recovery, Platform Drop.
- **[M]** `PhysicsConfig.ts`: Tuned movement constants for snappiness.
- **[S]** Offline stable, Online sync pending.

### [2026-02-04] v0.5.1 - Online Polish
- **[V]** `v0.5.1`
- **[R]** Damage reset bug (Client/Server conflict) & Teleport glitches.
- **[T]** Implemented damage overrides for remote players; added Snap logic (>500px).
- **[M]** Knockback increased (x5) for lighter feel.

### [2026-02-05] v0.5.3 - Online Sync & Physics Tuning
- **[V]** `v0.5.3`
- **[R]** Opponent damage and knockback force not syncing online; base physics felt weak.
- **[T]** Node upgraded `22.4.1` -> `25.6.0` (Homebrew/Vite 7).
- **[T]** Port migration: `5173` -> `5175` (host: `0.0.0.0`) for visibility.
- **[T]** Knockback Tuning: Drastically increased base forces (L: 25k, H: 45k) and scaling (0.1).
- **[M]** `server-geckos/index.ts`: Added `damagePercent` to `position_update` handler for sync.
- **[M]** `OnlineGameScene.ts`: Added visual knockback/Hurt animation for remote players in `handleHitEvent`.
- **[A]** `LLM_CONTEXT.md`: Established token-dense logging protocol.
- **[S]** **STATUS**: v0.5.3 Complete.

### [2026-02-05] v0.5.4 - Gameplay Polish
- **[V]** `v0.5.4`
- **[T]** Jump Tuning: Reduced GRAVITY (4800); Increased JUMP_FORCE (-2400) and DOUBLE_JUMP_FORCE (-2200).
- **[T]** Recovery Tuning: Boosted RECOVERY_FORCE_Y to -3500 for extreme height.
- **[T]** Middle-Ground Tuning: Balanced GRAVITY (5600), JUMP_FORCE (-2150), DOUBLE_JUMP_FORCE (-1950), and RECOVERY_Y (-2800).
- **[T]** Camera Tuning: Increased Lerp (Zoom: 0.1, Pan: 0.2) for snappier tracking.
- **[Fix]** Platform Collision: Increased soft platform tolerance (10px -> 45px) to fix fall-through at max speed.
- **[T]** Fine-Tuning: Adjusted RECOVERY_Y to -2450 for better travel control.
- **[Fix]** Player ID: Implemented slot reuse to prevent infinite player ID increment on rejoin.
- **[T]** Bomb Sizing: Doubled bomb radius (15 -> 30) and blast radius (80 -> 160) to match player scale.
- **[T]** Held Item: Adjusted held item offset (25 -> 55) to display in front of player character.
- **[New]** Slide Attack: Implemented Down Light Slide (Speed: 1200, Decel: 0.9) with low profile hitbox.
- **[T]** Attack Tuning: Changed Down Light knockback to horizontal (Angle: 80 -> 30) to match slide momentum.
- **[Fix]** Boundaries: Extended Blast Zones (Top: -2500, Bottom: 3500) to prevent accidental boundary deaths.
- **[Fix]** Camera: Added "Dead Player" filtering to stop camera from tracking players flying into the blast zone. Widened viewport padding.
