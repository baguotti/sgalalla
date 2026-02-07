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

### [2026-02-06] v0.6.2 - In-Room Online Selection
- **[V]** `v0.6.2`
- **[New]** Online Flow: Removed external lobby; character selection now happens inside `OnlineGameScene`.
- **[New]** Selection Timer: 10-second countdown starts when 2nd player joins.
- **[UX]** Character Cycling: Added A/D and Arrow key support for choosing characters during countdown.
- **[Fix]** Persistence: Implemented server-side room reset and timer cleanup for reliable re-joins.
- **[S]** **STATUS**: v0.6.2 Complete. Online matchmaking setup is now localized and automated.

### [2026-02-06] v0.6.3 - Global Sync & Ghost Fixes
- **[V]** `v0.6.3`
- **[Fix]** Ghost Sprites: Gated `processStateUpdate` to return early unless in `PLAYING` phase, preventing premature sprite creation.
- **[Fix]** Lifecycle: Ensured server state updates don't leak "side-sig" frames during character selection.
- **[S]** **STATUS**: v0.6.3 Complete. Selection flow is now visually clean and stable.

### [2026-02-06] v0.6.4 - Character Confirmation & Dev UX
- **[V]** `v0.6.4`
- **[New]** Manual Confirmation: Players can now lock their character with SPACE/ENTER/Button A. Game starts immediately if both are ready.
- **[New]** Dev UX: Added `npm run server` shortcut in root `package.json` for easy restarts.
- **[Fix]** UI: Restored MatchHUD (damage/character UI) initialization in the new `handleGameStart` flow.
- **[Fix]** Stability: Fixed build errors related to unused shared state in `LobbyScene` and `OnlineGameScene`.
- **[S]** **STATUS**: v0.6.4 Complete. Selection flow is now fully interactive and production-ready.

### [2026-02-06] v0.6.5 - Fly.io Deployment & Prod Sync
- **[V]** `v0.6.5`
- **[Live]** Production Backend: `https://sgalalla-geckos.fly.dev`
- **[New]** Fly.io Config: Added `fly.toml`, `Dockerfile`, and `.dockerignore` for server deployment (App: sgalalla-geckos).
- **[New]** Networking: Updated `NetworkManager.ts` to be environment-aware (auto-connects to `sgalalla-geckos.fly.dev`).
- **[Tech]** Port Unification: Standardized on port 3000 for server/fly.io compatibility.
- **[Fix]** Server Stability: Created dedicated `tsconfig.json` for server Node.js types.
- **[S]** **STATUS**: v0.6.5 Complete. Infrastructure live on Fly.io.

### [2026-02-06] v0.6.6 - Scale to Zero (Cost Optimization)
- **[V]** `v0.6.6`
- **[New]** Auto-Stop: Server now automatically shuts down after 5 minutes of inactivity (saves money).
- **[Fix]** Connectivity: Explicitly binding to `0.0.0.0` using `http.createServer` (fixes Fly.io reachability).
- **[S]** **STATUS**: v0.6.6 Complete. Production cost-efficiency implemented.

### [2026-02-06] v0.6.7 - Asset Restoration & Docs Reorg
- **[V]** `v0.6.7`
- **[Fix]** Assets: Generated and added `platform.png` and `background.png` to `public/assets/` to fix Vercel 404s.
- **[M]** Project Management: Moved `history.md` and `DEVELOPMENT_LOG.md` to `docs/` directory.
- **[Rule]** Policy: Documentation MUST be updated for every commit.
- **[S]** **STATUS**: v0.6.7 Complete. Assets restored and project structure cleaned up.

### [2026-02-06] v0.6.8 - Server Build Fix
- **[V]** `v0.6.8`
- **[Fix]** Build: Updated `server-geckos/tsconfig.json` to output to `./dist` so Docker can find `index.js`.
- **[S]** **STATUS**: v0.6.8 Complete. Fixes `MODULE_NOT_FOUND` crash on Fly.io.

### [2026-02-06] v0.6.9 - Server Optimization
- **[V]** `v0.6.9`
- **[Perf]** Boot: Added `"type": "module"` to `server-geckos/package.json` to fix Node.js ESM performance warning.
- **[S]** **STATUS**: v0.6.9 Complete. Server boot is clean and optimized.

### [2026-02-06] v0.6.10 - Infrastructure Scaling Fix
- **[V]** `v0.6.10`
- **[Fix]** Infrastructure: Forced Fly.io scale to 1 machine to prevent load-balancing errors (404 on matching) with in-memory Geckos state.
- **[S]** **STATUS**: v0.6.10 Complete. Connection reliability restored.

### [2026-02-06] v0.6.11 - Local Network & Dev UX
- **[V]** `v0.6.11`
- **[Fix]** Networking: Updated `NetworkManager.ts` to detect `192.168.` IPs as local and use port 3000.
- **[S]** **STATUS**: v0.6.11 Complete. Local network testing enabled.

### [2026-02-06] v0.6.12 - Client Production Deployment
- **[V]** `v0.6.12`
- **[Fix]** Deployment: Pushed client-side NetworkManager changes to `main` (was only on local branch).
- **[Fix]** Networking: Client now correctly targets port 443 for production.
- **[S]** **STATUS**: v0.6.12 Complete. Vercel should now have the correct client code.

### [2026-02-06] v0.6.13 - Server Logic & UDP Consolidation
- **[V]** `v0.6.13`
- **[Fix]** Server: Consolidated duplicate HTTP server instances in `index.ts` to ensure consistent logging and signaling.
- **[Fix]** Networking: Explicitly forced Geckos.io to use UDP port 3000 to match `fly.toml` configuration.
- **[S]** **STATUS**: v0.6.13 Complete. Internal signaling path verified.

### [2026-02-06] v0.6.14 - Infrastructure Persistence
- **[V]** `v0.6.14`
- **[Fix]** Scaling: Set `min_machines_running: 1` in `fly.toml` to prevent mid-handshake restarts.
- **[Fix]** Stability: Fixed connection ID expiration (404) by ensuring one machine is always "warm".
- **[S]** **STATUS**: v0.6.14 Complete. Signal persistence verified.

### [2026-02-06] v0.6.15 - Server Connectivity (Draft)
- **[V]** `v0.6.15`
- **[Fix]** WebRTC: Implemented **TURN Relay** configuration on server.
- **[Note]** Discovered that `iceTransportPolicy: relay` is ignored by the server-side library.

### [2026-02-06] v0.6.17 - Production Connectivity (STABLE)
- **[V]** `v0.6.17`
- **[Fix]** WebRTC: Shifted **TURN Relay** force to the **Client** in `NetworkManager.ts`.
- **[Fix]** Sync: Confirmed all files (including `src`) are correctly pushed to `main`.
- **[S]** **STATUS**: v0.6.17 Complete. Connection successfully established using client-side relay force.

### [2026-02-06] v0.6.18 - Explicit Port 3000 Strategy
- **[V]** `v0.6.18`
- **[Fix]** Fly.io: Removed `[http_service]` abstraction.
- **[Fix]** Infrastructure: Defined explicit TCP (Signaling/TLS) and UDP (Game) services on Port 3000.
- **[Fix]** Client: Updated `NetworkManager.ts` to connect strictly to `https://...:3000`.
- **[S]** **STATUS**: v0.6.18 Complete. Pure Port 3000 architecture enabled.

### [2026-02-06] v0.6.19 - HTTP Response Fix
- **[V]** `v0.6.19`
- **[Fix]** Server: Implemented `res.end()` for root `/` route to prevent browser hanging.
- **[Fix]** Health Check: Root URL now returns "Geckos.io Game Server is Running! 🦎".
- **[S]** **STATUS**: v0.6.19 Complete. Server reachability confirmed.

### [2026-02-06] v0.7.0 - Socket.io Migration (Pivoting from WebRTC)
- **[V]** `v0.7.0`
- **[A]** Architecture: Pivoted from WebRTC/UDP (Geckos.io) to WebSockets/TCP (Socket.io).
- **[Reason]** Diagnosis: Fly.io UDP support found unreliable for WebRTC data channels; signaling worked but data failed.
- **[Fix]** Server: Replaced Geckos.io with Socket.io server; handled connection/logic mapping.
- **[Fix]** Client: Replaced Geckos.io with Socket.io-client in `NetworkManager.ts`.
- **[Fix]** Infra: Updated `fly.toml` to pure TCP 3000/443 (removed UDP service).
- **[S]** **STATUS**: v0.7.0 Complete. Reliable WebSocket connectivity enabled.

### [2026-02-06] v0.7.1 - Socket.io Deployment Fixes
- **[V]** `v0.7.1`
- **[Fix]** fly.toml: Removed orphaned port 3000 entry (was causing routing confusion).
- **[Fix]** Client: Fixed production URL to use standard HTTPS (443) instead of explicit :3000.
- **[Fix]** Dependencies: Added `socket.io-client` to `package.json` (was missing from initial migration).
- **[S]** **STATUS**: v0.7.1 Complete. WebSocket routing corrected.

### [2026-02-06] v0.7.2 - Build Fix
- **[V]** `v0.7.2`
- **[Fix]** Removed unused `overridePort` parameter causing TS6133 build failure on Vercel.
- **[S]** **STATUS**: v0.7.2 Complete. Build passes.

### [2026-02-06] v0.7.3 - Remote Player Stutter Fix
- **[V]** `v0.7.3`
- **[Fix]** Reduced interpolation blend factor from 0.4 to 0.15 for smoother remote player movement.
- **[Fix]** Adjusted snap threshold from 300→200 and blend threshold from 1→2 for gentler corrections.
- **[S]** **STATUS**: v0.7.3 Complete. Stutter reduced.

### [2026-02-06] v0.7.4 - Rematch Overlay & Lag Fix
- **[V]** `v0.7.4`
- **[Fix]** Added `lives` sync in `interpolatePlayer` - winner now sees loser's lives drop and triggers game over overlay.
- **[Fix]** Replaced velocity-based dead-reckoning with simple direct lerp (0.25 factor) - eliminates prediction stutter.
- **[S]** **STATUS**: v0.7.4 Complete. Rematch overlay works for both players.

### [2026-02-06] v0.7.5 - UI Polish & Server Limits
- **[V]** `v0.7.5`
- **[UI]** Renamed "LOCAL VERSUS" to "TRAINING".
- **[UI]** Renamed "QUICK JOIN" to "1v1".
- **[Logic]** Server now enforces strict 2-player limit per room (rejects 3rd connection).
- **[S]** **STATUS**: v0.7.5 Complete.

### [2026-02-06] v0.7.6 - Lag Tuning (Deploy Fix)
- **[V]** `v0.7.6`
- **[Fix]** Server: DEPLOYED v0.7.5 logic (fixed Player 3 joining issue which was due to missing deploy).
- **[Tune]** Client: Reduced interpolation factor 0.25 → 0.1 for smoother movement (less jittery).
- **[S]** **STATUS**: v0.7.6 Complete. Server enforces limit; Client movement smoothed.

### [2026-02-06] v0.7.7 - Jitter Buffer Implementation
- **[V]** `v0.7.7`
- **[Network]** Client-side snapshot buffering (jitter buffer) added to smooth player movement.
- **[Network]** Implemented 100ms render delay to mitigate TCP Head-of-Line blocking.
- **[Entities]** `Player.ts`: Exposed `playAnim` as public to allow authoritative control from scene.
- **[S]** **STATUS**: v0.7.7 Complete.

### [2026-02-06] v0.7.8 - Advanced Netcode Optimization
- **[V]** `v0.7.8`
- **[Network]** Switched to **Wall-Clock Interpolation** (using `performance.now()`) to prevent frame drift.
- **[Network]** Added **Adaptive Buffer Pacing** (±5% playback speed) to stabilize buffer size.
- **[Server]** Reduced tick/broadcast rate 60Hz → **20Hz** to prevent TCP saturation.
- **[Optimization]** Server now skips state broadcasts if room phase is not `PLAYING`.
- **[S]** **STATUS**: v0.7.8 Complete. Netcode hardened for production stability.

### [2026-02-07] v0.7.9 - Stable Timeline Interpolation
- **[V]** `v0.7.9`
- **[Fix]** Refactored interpolation from **arrival-time** to **reconstructed server timeline**.
- **[Fix]** Uses fixed 50ms delta (`serverTime = frame * 50`) instead of jittery `receiveTime`.
- **[Fix]** Corrected syntax corruption (HTML entities, operator spacing) in `OnlineGameScene.ts`.
- **[S]** **STATUS**: v0.7.9 Complete. Remote player movement should be smooth.

### [2026-02-07] v0.8.0 - Fok_v3 Character Refinements
- **[V]** `v0.8.0`
- **[New]** Character: Implemented `fok_v3` with distinct hitbox, animations, and move properties.
- **[Phys]** Hitbox Tuning: Converged on precise 40x120px hitbox (Skinny) with correct debug visualization.
- **[Anim]** Walk vs Run: Implemented strict state separation; Walk forced to 0.5x speed, Run scales dynamically from 0.85x.
- **[Anim]** Checks: Fixed `updateAnimation` logic where `isAttacking` early return prevented attack animations from playing.
- **[Phys]** Floatiness: Drastically reduced Gravity (5600 -> 3800) and Jump Force (-2150 -> -1700) for "floatier" air control.
- **[Move]** Slide Attack: Implemented Run-Attack Override (Running + Light = Down Light Slide).
- **[Move]** Slide Buff: Increased Slide Attack speed (2200) and reduced deceleration for massive travel distance.
- **[Vis]** Wall Slide: Added 2px visual offset to close the gap between character and wall.
- **[S]** **STATUS**: v0.8.0 Complete. Fok_v3 feels distinct, floaty, and responsive.
