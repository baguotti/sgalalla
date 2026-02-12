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

### [2026-02-07] v0.8.1 - Build Hotfix
- **[V]** `v0.8.1`
- **[Fix]** Build: Removed unused `onFloor` variable in `Player.ts` causing TS6133 error during Vercel deployment.
- **[S]** **STATUS**: v0.8.1 Complete. Build should pass.

### [2026-02-07] v0.8.2 - Fok_v3 Standardization
- **[V]** `v0.8.2`
- **[Refactor]** Default Character: Set `fok_v3` as the default selection in both Local Lobby and Online Play.
- **[Refactor]** Cleanup: Removed `fok_alt` from `Player.ts` constructor, `LobbyScene.ts` character list, and `OnlineGameScene.ts` types.
- **[Asset]** Optimization: Removed `fok_alt` asset loading from `GameScene.ts`.
- [Fix] Linter: Removed unused `P1_KEYS` from `LobbyScene.ts`.
- [S] **STATUS**: v0.8.2 Complete. Fok_v3 is now the main character.

### [2026-02-07] v0.8.3 - Mechanics Tuning (Round 11)
- **[V]** `v0.8.3`
- **[Phys]** Floatiness: Gravity reduced (3800 -> 2200), Jump Force reduced (-1700 -> -1250), Max Fall Speed reduced (2600 -> 1800).
- **[Move]** Run Default: Removed "Walk" state. All ground movement is now Running by default.
- **[Anim]** Scaling: Removed walk speed clamping; run animation scales dynamically from base speed.
- **[S]** **STATUS**: v0.8.3 Complete. Physics are significantly floatier and movement is faster/streamlined.

### [2026-02-07] v0.8.4 - Stage Expansion (Round 12)
- **[V]** `v0.8.4`
- **[Stage]** Width: Main Platform wider (1800 -> 2400).
- **[Stage]** Walls: Pushed boundaries out by 200px each side (-400 / 2320).
- **[Stage]** Platforms: Soft platforms spaced further apart (+/- 200px).
- **[Stage]** Blast Zones: Extended to prevent early kills with new mobility.
- **[S]** **STATUS**: v0.8.4 Complete. Stage is wider to match floaty physics.
### [2026-02-08] v0.8.5 - UI Cleanup & Physics Tuning
- **[V]** `v0.8.5`
- **[UX]** UI Cleanup: Hid name tags by default; removed debug legend; updated pause menu controls.
- **[Phys]** Air Control: Increased `AIR_FRICTION` to 0.91 for floatier drift.
- **[Phys]** Commitment: Disabled sprint, dodge, and jumping during Signature (Heavy) attacks.
- **[Phys]** Jump Metrics: Reduced Jump height (10%), Recovery height (20%), and Wall Jump height (to match regular jump).
- **[Fix]** Animation: Re-aligned `fok_v3` sprite offsets and texture boundaries.
- **[Fix]** Runtime: Removed orphaned `controlsHintText` references in `GameScene.ts`.
- **[S]** **STATUS**: v0.8.5 Complete. UI is cleaner and physics feel more deliberate.
323: 
324: ### [2026-02-08] v0.8.6 - Sig Tuning & Respawn Polish
325: - **[V]** `v0.8.6`

### [2026-02-08] v0.8.6 - Sig Tuning & Respawn Polish
- **[V]** `v0.8.6`
- **[Phys]** Sig Tuning: Reduced knockback growth of all heavy attacks by 20%; further 35% reduction for Up/Down sigs to normalize with Side Sigs.
- **[New]** Respawn Flow: Implemented a 2-second delay after death, immediate camera focus on survivors, and 1 second of flashing invulnerability upon respawn.
- **[Fix]** Bug: Resolved "bounce" glitch during upward KOs by removing rigid world bounds.
- **[T]** Mobility: Buffed `JUMP_FORCE` (-990 -> -1050) for better reach.
- **[UX]** Visuals: Removed recovery state tint; implemented alpha-blink for respawn invulnerability.
- **[S]** **STATUS**: v0.8.6 Complete. Sig power is balanced and respawn flow is polished.

### [2026-02-08] v0.8.7 - Training Mode Improvements
- **[V]** `v0.8.7`
- **[New]** Training Mode: Implemented CPU character selection flow. Players now select their character first, then the CPU character.
- **[Fix]** Logic: Resolved issue where Training mode was incorrectly initialized as 'versus' in `MainMenuScene.ts`.
- **[Fix]** Input: Fixed timing mismatch bug where `sceneStartTime` used `Date.now()` while input checks used Phaser's game time, causing broken debouncing.
- **[Fix]** Slots: Corrected slot initialization to ensure 2 slots are available in Training mode (fixing undefined access to CPU slot).
- **[S]** **STATUS**: v0.8.7 Complete. Training mode is now fully customizable.

### [2026-02-08] v0.8.8 - Online Asset Parity
- **[V]** `v0.8.8`
- **[Fix]** Sprites: Resolved critical bug where remote players in 1v1 mode appeared as squares.
    - Added fallback to `'fok_v3'` in `OnlineGameScene.ts` when server sends empty/invalid character string.
    - Updated `createPlayer` default to `'fok_v3'`.
- **[Fix]** Training: Removed "Dummy" from selectable character list in `LobbyScene.ts` (it has no sprite).
- **[Fix]** Visuals: Patched `OnlineGameScene` to call `player.updateVisuals(delta)`, enabling the respawn invulnerability blink effect for remote players.
- **[S]** **STATUS**: v0.8.8 Complete. Online mode now renders characters correctly and syncs visual effects.

### [2026-02-08] v0.8.9 - Input and Sprite Robustness
- **[V]** `v0.8.9`
- **[Fix]** Input: Implemented gamepad edge detection in `LobbyScene.ts`. Character selection now requires a discrete press, preventing held buttons from bypassing selection phases.
- **[Fix]** Sprites: Hardened character validation in `OnlineGameScene.ts`. Implemented strict whitelist checking (`['fok_v3']`) for incoming server data, ensuring invalid keys default correctly to a loaded texture.
- **[S]** **STATUS**: v0.8.9 Complete. Input handling and asset loading are now robust against server-side data inconsistencies.

### [2026-02-08] v0.8.10 - Controller Handover Fix
- **[V]** `v0.8.10`
- **[Fix]** Input: Resolved issue where Xbox controllers didn't work in the Training lobby because `inputType` and `gamepadIndex` were not being passed from the main menu.
- **[S]** **STATUS**: v0.8.10 Complete. Controller data now correctly persists from the main menu into the character selection lobby.

### [2026-02-08] v0.8.11 - Interpolation & Codebase Audit
- **[V]** `v0.8.11`
- **[Fix]** Network: Replaced frame-based timing (`frame * 50ms`) with client arrival timestamps (`performance.now()`) for jitter buffer. Eliminates teleportation caused by clock drift.
- **[Fix]** Network: Added adaptive clock speed (80%-120%) based on buffer fullness to prevent starvation/overflow.
- **[Refactor]** Event Parity: Added missing `ATTACK_START`, `HIT_EVENT`, `POSITION_UPDATE`, `INPUT_ACK` to server `NetMessageType`.
- **[Refactor]** Dead Code: Deleted `LocalMultiplayerSetupScene.ts` (258 lines). Removed commented blocks in `TrainingDummy.ts`.
- **[Refactor]** Memory: Added pooled `_boundsRect` to `Player.getBounds()` to eliminate per-frame allocations.
- **[Refactor]** Lifecycle: Added `shutdown()` method to `OnlineGameScene` for proper socket/player cleanup on scene stop.
- **[S]** **STATUS**: v0.8.11 Complete. Online interpolation is now smooth and codebase is audited for performance.

### [2026-02-08] v0.9.0 - Geckos.io UDP Migration
- **[V]** `v0.9.0`
- **[Major]** Network: Migrated from Socket.io (TCP) to Geckos.io (UDP/WebRTC) to eliminate TCP head-of-line blocking lag.
- **[Refactor]** Server: Rewrote `server-geckos/index.ts` to use `@geckos.io/server` API (`onConnection`, `onDisconnect`, `channel.emit`).
- **[Refactor]** Client: Rewrote `NetworkManager.ts` to use `@geckos.io/client` API (`geckos()`, `onConnect`, `onDisconnect`).
- **[Config]** Port: Changed from 3000 to 9208 (Geckos.io default).
- **[S]** **STATUS**: v0.9.0 Complete. UDP-based networking should dramatically reduce lag and teleportation.

### [2026-02-08] v0.9.1 - Geckos.io Connection Patch
- **[V]** `v0.9.1`
- **[Fix]** Network: Restored `http://` protocol prefix in `NetworkManager.ts`. Geckos.io requires a valid protocol (http/https) for the initial WebRTC signaling handshake.
- **[S]** **STATUS**: v0.9.1 Complete. Geckos.io connection is now stable for local and production environments.

### [2026-02-08] v0.9.2 - Geckos.io Production Deployment
- **[V]** `v0.9.2`
- **[Config]** Network: Added Google STUN servers (`stun:stun.l.google.com:19302`, `stun:stun1.l.google.com:19302`) for NAT traversal.
- **[Config]** Fly.io: Updated `fly.toml` internal_port and `Dockerfile` EXPOSE from 3000 to 9208.
- **[Deploy]** Server: Deployed Geckos.io UDP server to Fly.io production.
- **[S]** **STATUS**: v0.9.2 Complete. UDP networking is now live at `sgalalla-geckos.fly.dev`.

### [2026-02-08] v0.9.3 - Production Port Fix
- **[V]** `v0.9.3`
- **[Fix]** Network: Updated `NetworkManager.ts` to use port 443 for production (Fly.io routes 443 → internal 9208). Local still uses 9208 directly.
- **[S]** **STATUS**: v0.9.3 Complete. Production client now connects via HTTPS port 443.
- **[S]** **STATUS**: v0.9.3 Complete. Production client now connects via HTTPS port 443.

### [2026-02-08] v0.9.4 - DigitalOcean UDP Migration
- **[V]** `v0.9.4`
- **[Infra]** DigitalOcean: Created setup script `server-geckos/setup_digitalocean.sh` for auto-provisioning.
- **[Config]** Network: Updated `NetworkManager.ts` to point to DigitalOcean Droplet IP `164.90.235.15` on port 9208 (UDP).
- **[S]** **STATUS**: v0.9.4 Pending Deployment. User needs to run setup script on Droplet.

### [2026-02-08] v0.9.5 - DigitalOcean CORS & Recovery
- **[V]** `v0.9.5`
- **[Fix]** Server: Enabled CORS (`origin: '*'`) in `server-geckos/index.ts` to allow connections from localhost and Vercel.
- **[Ops]** Recovery: Pushed fix to git to recover from potential `sed` command corruption on server.
- **[S]** **STATUS**: v0.9.5 Pushed. User needs to `git pull` on server.

### [2026-02-08] v0.9.6 - WebRTC Port Range Fix
- **[V]** `v0.9.6`
- **[Fix]** Firewall: Updated `setup_digitalocean.sh` and server UFW to allow UDP ports `1025:65535`. Necessary for WebRTC data channels which use random high ports for peer connectivity.

### [2026-02-08] v0.9.7 - Distribution URL Logic
- **[V]** `v0.9.7`
- **[Refactor]** Network: Restored proper conditional URL logic in `NetworkManager.ts` to distinguish between `localhost` development and production endpoints.

### [2026-02-08] v0.9.8 - Cloudflare Tunnel Migration
- **[V]** `v0.9.8`
- **[Infra]** Cloudflare: Established `cloudflared` tunnel on the DigitalOcean Droplet to provide a stable HTTPS endpoint (`https://sensors-flash-trackback-survival.trycloudflare.com`).
- **[Fix]** Security: Solved "Mixed Content" blocker preventing the HTTPS Vercel client from communicating with the HTTP DigitalOcean backend.
- **[S]** **STATUS**: v0.9.8 Deployed. Online mode is functionally active via DigitalOcean + Cloudflare Tunnel.

### [2026-02-08] v0.9.9 - Latency Optimizations
- **[V]** `v0.9.9`
- **[Perf]** Server: Increased tick rate from 20Hz to 60Hz for smoother state updates.
- **[Perf]** Client: Reduced interpolation buffer from 100ms to 40ms (~2.5 frames at 60Hz).
- **[Perf]** Client: Increased state send rate from 30Hz to 60Hz for faster position updates.
- **[S]** **STATUS**: v0.9.9 Complete. Local testing shows acceptable input responsiveness.

### [2026-02-08] v0.9.9.1 - Server Tick Rate Bugfix
- **[V]** `v0.9.9.1`
- **[Bugfix]** Server: Fixed `setInterval` timing - was still `1000/20` (50ms/20Hz) despite comment saying 60Hz. Changed to `1000/60` (16.67ms) for actual 60Hz updates.

### [2026-02-08] v0.9.10 - Interpolation Stutter Fixes
- **[V]** `v0.9.10`
- **[Fix]** Client: Increased interpolation buffer from 40ms to 80ms for better internet jitter tolerance.
- **[Fix]** Client: Replaced snap-to-position extrapolation with velocity-based smooth prediction using lerp factor 0.3.
- **[S]** **STATUS**: Testing on production (Vercel + DigitalOcean).

### [2026-02-08] v0.9.11 - Production Stability
- **[V]** `v0.9.11`
- **[Perf]** Server: Lowered tick rate from 60Hz to 30Hz - reduces packet pressure through Cloudflare Tunnel.
- **[Fix]** Client: Increased interpolation buffer from 80ms to 120ms for better jitter absorption.
- **[S]** **STATUS**: Testing production performance.

### [2026-02-08] v0.9.12 - Optimal Local Performance (TARGET)
- **[V]** `v0.9.12`
- **[Perf]** Server: 60Hz tick rate (16.67ms interval) for low-latency updates.
- **[Perf]** Client: 60ms interpolation buffer (~4 frames at 60Hz) - best balance of smoothness and responsiveness.
- **[Note]** This configuration is the **target performance for online**. Local testing confirms smooth movement with minimal jitter and low input delay.
- **[S]** **STATUS**: v0.9.12 is the LOCAL baseline. Next: achieve same performance on production.

### [2026-02-08] v0.9.13 - Adaptive Buffer for Production
- **[V]** `v0.9.13`
- **[Perf]** Client: Implemented adaptive buffer based on environment. Local (`localhost`/`127.0.0.1`) uses 60ms, production uses 100ms.
- **[Note]** Production requires larger buffer due to real internet jitter. 100ms provides stability while maintaining reasonable responsiveness.

### [2026-02-08] v0.9.14 - Reliability Research & Buffer Tuning
- **[V]** `v0.9.14`
- **[Research]** Investigated "Head-of-Line Blocking" - turns out Geckos.io **already defaults to `ordered: false`** (unreliable/unordered). Not the stutter cause.
- **[Config]** Server: Explicitly set `ordered: false` in geckos config for clarity.
- **[Perf]** Client: Set production buffer to **80ms** (user-requested balance between smoothness and responsiveness).
- **[S]** **STATUS**: Testing 80ms buffer on production. Further investigation needed if stutter persists.

### [2026-02-08] v0.9.15 - Self-Hosted Deployment (Pure Direct UDP)
- **[V]** `v0.9.15`
- **[Infra]** Client: Now self-hosted on DigitalOcean Droplet alongside server. No more Vercel, no more Cloudflare Tunnel.
- **[Config]** NetworkManager: Updated to connect to `window.location.hostname:9208` (same-origin, avoiding mixed content).
- **[Deploy]** Created `deploy_client.sh` script for easy redeployment.
- **[Note]** This eliminates all middleware latency. Client and server communicate directly via UDP.
- **[S]** **STATUS**: Testing at `http://164.90.235.15`. This is the best possible latency configuration.

### [2026-02-08] v0.9.16 - Smooth Interpolation Tweaks
- **[V]** `v0.9.16`
- **[Perf]** Clock Speed: Changed from discrete jumps (0.9/1.0/1.1) to smooth continuous curve (0.95-1.05). Eliminates visible stuttering from clock adjustments.
- **[Perf]** Extrapolation: Reduced lerp factor from 0.3 to 0.15 for gentler blending. Reduces snap-back when new packets arrive.
- **[S]** **STATUS**: Deployed to `http://164.90.235.15`. Testing smoothness improvements.

## v0.9.18: Re-implement Version Display (Stable)
- **[UI]** Restored version number on Title Screen (v0.9.18) after revert.
- **[Dev]** Enhanced `deploy_client.sh` with version prompt and safer SCP path handling.
- **[Fix]** Ensured clean separation from experimental netcode changes.

## v0.9.19: Stability & Visual Polish
- **[Fix]** Training mode: Return to lobby now correctly restores training mode.
- **[Fix]** Scene restart: Reset all state arrays to prevent freeze on second game start.
- **[Fix]** Training dummy uses valid character sprite to prevent freeze.
- **[Visual]** Removed blue tint and opacity effects from dash (kept on spot dodge).

### [2026-02-09] v0.10.0 - Side Sig Seal & UI Polish
- **[V]** `v0.10.0`
- **[New]** **Side Sig Seal**: Summoned Seal now functions as a piercing projectile.
    - Reverted charge scaling per feedback (light attacks restored).
    - Fixed duplication and camera following bugs.
    - Updated Seal physics (sensor, no gravity).
- **[T]** **Physics Tuning**:
    - Increased `FAST_FALL_MULTIPLIER` to `1.7` for snappier vertical movement.
    - Refined Fok's hitbox: Shaved 10px from top, added 6px width (46x174).
- **[UI]** **Visual Overhaul**:
    - Changed global font to **"Silkscreen"** (16-bit style).
    - **HUD Updates**:
        - Right-side player icons are now flipped horizontally.
        - Right-side HUD layout is mirrored ([Damage] [Portrait] [Stocks]).
- **[Deploy]** **Server Update Instructions**:
    - **Step 1**: SSH into your DigitalOcean Droplet: `ssh root@<your-server-ip>`
    - **Step 2**: Navigate to the project directory: `cd sgalalla`
    - **Step 3**: Pull the latest changes: `git pull`
    - **Step 4**: Restart the server process: `pm2 restart geckos-server`
    - *(Optional)* Monitor logs: `pm2 logs geckos-server`
- **[UI]** **Preload & Polish**:
    - Implemented `PreloadScene` to ensure 'Silkscreen' font loads before game starts.
    - Added custom logo and "PRESS START" interaction to title screen.
    - Added black background to loading screen.
- **[G]** **gameplay**:
    - **Reverted Side Sig**: Removed `SealEntity` and restored standard hitbox behavior for `fok_v3`.
- **[UI]** **Debug Display**:
    - Moved Ping and FPS from main HUD to `DebugOverlay` (toggle with 'Q').
    - Integrated `DebugOverlay` into `OnlineGameScene`.
- **[A]** **Animation**:
    - **Wall Slide**: Increased visual offset to **5px** towards the wall for `fok_v3` (was 2px).
    - **Wall Slide**: Increased visual offset to **7px** towards the wall for `fok_v3` (was 5px).
    - **Refactor**: Moved sprite offset logic to `updateSpriteOffset` to run every frame.
- **[UI]** **Title Screen**:
    - Reverted Main Menu background to black.
    - Added `title_card.jpg` as background for the **Loading Screen**.
- **[Fix]** **Stability**:
    - Fixed game freeze when exiting Training Mode (replaced page reload with proper scene transition to `MainMenuScene`).
    - Fixed crash when returning to Main Menu (cleared `menuTexts` array on scene start to avoid referencing destroyed objects).
- **[Refactor]** **Online Gameplay**:
- **[S]** **STATUS**: v0.10.2 Released.
- **[Fix]** **Visual Glitches**:
    - Fixed **Duplicate Visuals (Ghosting)** in Online mode by properly configuring the UI camera to ignore game world objects.

## **v0.10.3** - **Sga Implementation & Polish**
- **[New]** **Character: Sga**
    - **Enabled**: Added **Sga** to the character selection screen in Lobby and Online.
    - **Animations**: Mapped all Sga animations (Idle, Jump, Fall, Attacks) to the correct frames in `sga.json`.
    - **Hitboxes**: Synced Sga's hitbox size to match **Fok** (46x174) for competitive consistency.
    - **Assets**: Added `sga_icon` to the UI and moved asset loading to `preload()` for stability.
- **[Fix]** **Assets**:
    - **Renaming**: Renamed `logo.jpeg` to `logo.jpg` to resolve 403 Forbidden errors on deployment.

### [2026-02-11] v0.10.4 - HUD Redesign & Sga/Sgu Side Run
- **[V]** `v0.10.4`
- **[New]** **HUD Redesign**:
    - **Style**: Rounded rectangular bars with solid black background and colored borders (Player Color).
    - **Layout**: Simplified left-to-right flow for all players ([Heart/Stocks] -> [Portrait] -> [Damage %] -> [P# Label]).
    - **Details**:
        - **Portrait**: Masked rounded square with border, positioned left-center.
        - **Damage**: Large centered text (Pixeloid Sans), offset right to prevent overlap with portrait.
        - **Lip**: Player label (P1, P2) contained in a rounded tab sticking out of the top edge.
    - **Typography**: Unified all lobby and HUD text to use **"Pixeloid Sans"**.
- **[New]** **Combat Mechanics**:
    - **Side Run Attack**: Enabled `light_run_grounded` attack for **Sga** and **Sgu**.
    - **Logic**: Updated `PlayerCombat.ts` to include Sga/Sgu in the running attack conditional check.
- **[Fix]** **Fonts**:
    - **Lobby**: Standardized "TRAINING", "P1", "P2", and instructions to Pixeloid Sans.
    - **Main Menu**: Validated version and debug text fonts.
- **[S]** **STATUS**: v0.10.4 Complete. HUD is sleek and readable.


### [2026-02-12] v0.10.5 - Combat Tuning & HUD Polish
- **[A]** **Combat Tuning**:
    - **Blast Zones**: Significantly reduced top and bottom blast zones for faster gameplay.
    - **Wall Height**: Lowered walls to allow more off-stage play.
    - **Side Run Attack**: Increased hitbox size for `light_run_grounded` (120x70) to improve consistency.
- **[V]** **Visuals**:
    - **Stage Background**: Tweaked "Adria" background scroll factor and scale for better depth perception.
    - **HUD Refinement**: Extensive iterative polish on the Diamond HUD style:
        - **Icon**: ~1.35x Scale, bottom-aligned.
        - **Layout**: Tucked name tag behind diamond, moved stocks below name tag.
        - **Typography**: Removed italics from damage numbers, separated heart icon and stock count.
- **[Fix]** **Online Sync**:
    - Verified that all local HUD changes automatically apply to Online mode (shared `MatchHUD` class).
- **[S]** **STATUS**: v0.10.5 Released. HUD is pixel-perfect.

### [2026-02-12] v0.10.6 - Chest Mechanic & Scrin Collection
- **[V]** `v0.10.6`
- **[New]** **Chest Mechanic**:
    - **Spawning**: Rare chests (35% chance) drop from the sky every 30 seconds.
    - **Damage**: Deals 15% damage + knockback if it lands on a player.
    - **Interaction**: Players can open chests by attacking them (Light Attack / J).
    - **Reward**: Displays a random image from the **Scrin Collection** (31 images).
    - **UI**: Added a dark overlay and legend ("Press J / Ⓑ to close") for better readability.
- **[New]** **Online Integration**:
    - **Sync**: Chests now spawn and function identically in **Online 1v1** matches.
    - **Assets**: Preloaded all 31 Scrin images for smooth online playback.
- **[Dev]** **Debugging**:
    - **Manual Spawn**: Added **Y** key shortcut (Local only) to instantly spawn a chest for testing.
- **[Fix]** **Stability**:
    - **Double Rendering**: Fixed issue where chest overlay appeared twice (on both main and UI cameras).
    - **Input Jitter**: Resolved input conflict by properly cleaning up key listeners on overlay close.
- **[S]** **STATUS**: v0.10.6 Released. Chests add a fun, random element to matches.

### [2026-02-12] v0.10.7 - Hotfix: Online Assets
- **[V]** `v0.10.7`
- **[Fix]** **Assets**: Renamed all Scrin images to replace spaces with underscores (e.g. `22.36.58.jpg` -> `22.36.58.jpg`) to resolve 404 errors on Linux/Nginx.
- **[Fix]** **Online**: Updated preload lists in `GameScene` and `OnlineGameScene` to match new filenames.
- **[S]** **STATUS**: v0.10.7 Released. Images should now load correctly in online mode.

### [2026-02-12] v0.10.8 - Loading Screen Polish
- **[V]** `v0.10.8`
- **[Fix]** **Loading Screen**: Removed dimming overlay from `main_title.jpg` (Loading Card) for full brightness.
- **[Fix]** **Assets**: Synced local asset renames (`scrin_00X`) and removed broken `logo.jpg` reference.
- **[S]** **STATUS**: v0.10.8 Released. Loading screen is crisp.
