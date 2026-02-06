# Sgalalla - Development Log

**Total Time Logged:** 12.0 Hours

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
### [2026-02-05] v0.5.5 - Input & Online Fixes
- **[V]** `v0.5.5`
- **[Fix]** Online Gamepad: Implemented `useExternalInput` in `Player.ts` to allow `OnlineGameScene` to inject verified inputs without internal re-polling.
- **[Fix]** Gamepad Detection: Forced `gamepadIndex: 0` for local players in `OnlineGameScene` to match local game behavior.
- **[M]** Input Gating: Added `document.hasFocus()` check to `InputManager.ts` to allow testing multiple browser tabs on one machine without input cross-talk.
### [2026-02-05] v0.5.6 - Visual & Input Polish
- **[V]** `v0.5.6`
- **[Fix]** Online Visuals: Fixed missing damage color flash on remote clients (`NetHitEvent` now triggers local flash).
- **[Fix]** Sprite Tints: Removed legacy debug tints (Red AI/Green P2) from `Player.ts` and `OnlineGameScene.ts`.
- **[Fix]** Input Crosstalk: Enforced strict input source separation (Keyboard vs Gamepad) in `InputManager.ts`.
- **[UX]** Unified Restart: Added Gamepad (A) support for restarting matches.
- **[T]** Code Cleanup: Removed unused variables (`showDebugHitboxes`, `targetHeight`) from `Player.ts`.
- **[S]** **STATUS**: Online Gamepad restored and Focus-based testing enabled.
### [2026-02-05] v0.5.6 - Unified Restart Input
- **[V]** `v0.5.6`
- **[New]** Unified Restart: Added Gamepad Button A (0) support for restarting matches on the Game Over screen in `GameScene.ts`.
- **[M]** Game Over UI: Updated instruction text to "Press SPACE or (A) to Restart".
- **[T]** Code Cleanup: Removed unused `gameOverText` from `GameScene.ts` and organized gamepad state tracking.
- **[S]** **STATUS**: Match restart is now accessible via keyboard and gamepad.

### [2026-02-06] v0.5.7 - Network Stability & HUD Refinement
- **[V]** `v0.5.7`
- **[T]** FPS Capping: Forced `target: 60` and `forceSetTimeOut: true` in Phaser config to sync 60Hz and 120Hz devices.
- **[T]** Network Smoothing: Implemented 100ms jitter buffer (render delay) for remote player interpolation.
- **[T]** Delta Compression: Added `shouldSendState` to skip redundant position updates (2px threshold).
- **[T]** Volatile Flags: Confirmed movement packets use `reliable: false` to prevent buffering/rubber-banding.
- **[M]** Debug HUD: Increased font size by 30% (16px) and scaled background for better visibility on remote screens.
- **[Fix]** Binary Encoding: Attempted 15-byte binary optimization; reverted to JSON due to Geckos.io protocol mismatch (Uint8Array detection issues).
- **[S]** **STATUS**: v0.5.7 Complete. Online is synchronized but remains stuttery due to jitter.

### [2026-02-06] v0.5.8 - Network Smoothing, Performance & Disconnect Cleanup
- **[V]** `v0.5.8`
- **[T]** Dead Reckoning: Removed 100ms jitter buffer for velocity-based projection (0ms latency rendering).
- **[T]** Adaptive Correction: Implemented 40% blend factor (lerp) toward server position to eliminate "gliding".
- **[Fix]** Disconnect Cleanup: Implemented `player_left` handler to destroy "ghost" sprites when clients disconnect.
- **[Fix]** Hit Detection: Restored `checkHitAgainst` call and fixed remote knockback visual sync.
- **[Fix]** Periodic Stutter: Increased ping interval (1s -> 2s) to reduce timer-induced frame drops.
- **[Fix]** GC Pressure: Throttled snapshot saves (3 frames) and removed all `console.log` spam from update loop.
- **[UX]** Ping Stability: Implemented Exponential Moving Average (EMA) smoothing for HUD ping display.
- **[S]** **STATUS**: v0.5.8 Complete. Smooth 60fps movement and proper session cleanup.

### [2026-02-06] v0.6.0_lobby - Local Multiplayer Lobby
- **[V]** `v0.6.0_lobby`
- **[New]** Lobby Scene: Created `LobbyScene.ts` to handle local multiplayer setup.
- **[New]** Slot System: Support for up to 4 players with dynamic joining (Jump-in).
- **[New]** Device Management: Distinct handling for Keyboard vs Gamepad inputs per slot.
- **[UX]** Selection UI: Added character cycling and Ready state confirmation.
- **[S]** **STATUS**: v0.6.0 Complete. Solid foundation for local play.

### [2026-02-06] v0.6.1_old_lobby - Fok Alt & Simplified Lobby
- **[V]** `v0.6.1_old_lobby`
- **[New]** Character Variant: Added `fok_alt` (Blue/White palette) with full texture atlas and animation mappings.
- **[UX]** Local Lobby: Removed multi-player slots; restricted to **Player 1 Only**.
- **[UX]** Auto-Start: Implemented automatic match start (500ms delay) upon P1 Ready confirmation.
- **[Fix]** Lobby Logic: Bypassed P2-P4 joining logic to streamline local testing flow.
