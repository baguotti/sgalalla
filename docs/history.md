# Project Version History

| Version | Label | Date | Summary & Minor Tweaks |
| :--- | :--- | :--- | :--- |
| `offline-stable-v2` | **Offline Stable V2** | 2026-02-02 | Best stable offline version before online refactor. |
| `v0.2.0-online-sync` | **Online Sync** | 2026-02-02 | Initial Geckos.io integration with client-authoritative relay. |
| `v0.4.0-scale-map-camera` | **Scale & Map** | 2026-02-03 | Major rework of game dimensions and camera. <br> ↳ Characters scaled to 1:1 (256x256) <br> ↳ Map resized to Brawlhaven style <br> ↳ Dynamic camera ported to Online mode <br> ↳ Implemented MatchHUD with multi-player support <br> ↳ Multi-player Damage/UI doubling fixes |
| `v0.5.0-stocks-rematch` | **Stocks & Rematch** | 2026-02-03 | Core game loop completion and post-game flow. <br> ↳ Stock system (3 lives) implementation <br> ↳ Game Over detection and "PLAYER X WINS" screen <br> ↳ Rematch/Leave voting system <br> ↳ Keyboard & Gamepad menu navigation <br> ↳ **Fix**: Resolved immediate Game Over upon guest join |
| `v0.5.1-physics-tweak` | **Physics & network Tweak** | 2026-02-04 | Polished network sync and physics feel. <br> ↳ **Fix**: Damage Reset Bug (Client/Server sync conflict resolution) <br> ↳ **Fix**: Teleport Glitch (Snap logic for large deltas) <br> ↳ **Tweak**: Massive Knockback Increase (x5) for lighter feel <br> ↳ **Tweak**: Instant Respawn (Removed delay) |
| `v0.5.2-infra-protocol` | **Infra & Protocol** | 2026-02-05 | Major infrastructure upgrade and logging protocol. <br> ↳ **Upgrade**: Node.js to v25.6.0 (Stability/Vite 7 compatibility) <br> ↳ **Fix**: Resolved localhost connectivity/process suspension <br> ↳ **Tweak**: Migrated client to port 5175 <br> ↳ **New**: Established LLM-optimized high-density logging protocol |
| `v0.5.3-online-physics` | **Online Sync & Physics** | 2026-02-05 | Critical online sync fixes and physics tuning. <br> ↳ **Fix**: Opponent damage sync (added damagePercent to server relay) <br> ↳ **Fix**: Visual knockback for remote players in OnlineGameScene <br> ↳ **Tweak**: Drastic knockback force increase (L: 25k, H: 45k, Scal: 0.1) |
| `v0.5.4-gameplay-polish` | **Gameplay Polish** | 2026-02-05 | Refined mechanics and camera logic. <br> ↳ **New**: Down Light Slide Move (horizontal knockback/velocity) <br> ↳ **Fix**: Camera filtering for dying players & wider viewport <br> ↳ **Tweak**: Extended blast zones and bomb scaling (1:1 with player) |
| `v0.5.5-input-fixes` | **Input & Online Fixes** | 2026-02-05 | Fixed Online Gamepad and Multiple-Tab Testing. <br> ↳ **Fix**: Online Gamepad (added useExternalInput to Player.ts) <br> ↳ **Fix**: Gamepad index forcing (index 0) in OnlineGameScene <br> ↳ **New**: Focus-based input gating (document.hasFocus) for local testing <br> ↳ **New**: Strict Input Routing (prevent dual-character control) |
| `v0.5.6-unified-restart` | **Unified Restart Input** | 2026-02-05 | Added Gamepad Button A support for Game Over restart. <br> ↳ **New**: Gamepad Button A (0) now triggers match restart <br> ↳ **M**: Updated Game Over instruction text |
| `v0.5.7-network-stability` | **Network & HUD Refinement** | 2026-02-06 | Stabilized frame rates and network smoothing. <br> ↳ **New**: 60Hz FPS Capping (Sync for 120Hz displays) <br> ↳ **New**: 100ms Jitter Buffer/Render Delay for remote players <br> ↳ **New**: Delta Compression (skips redundant position updates) <br> ↳ **Tweak**: Debug HUD 30% font scale increase (16px) <br> ↳ **Fix**: Volatile packet confirmation (reliable: false) |
| `v0.5.8-smooth-reckoning` | **Network Smoothing & Perf** | 2026-02-06 | Implemented dead-reckoning and removed update loop stutter. <br> ↳ **New**: Velocity-based Dead Reckoning (0ms latency render) <br> ↳ **Fix**: Periodic stutter (increased ping interval 1s ↳ 2s) <br> ↳ **Fix**: GC pressure (removed console log spam & throttled snapshots) <br> ↳ **Fix**: Hit detection restored for local vs remote <br> ↳ **Tweak**: Exponential Moving Average (EMA) for stable ping display |
| `v0.6.10` | **Scaling Fix** | 2026-02-06 | Fixed 404 Signaling errors. <br> ↳ **Fix**: Scaled Fly.io app to 1 machine (preventing round-robin load balancing of UDP state) |
| `v0.6.9` | **Server Optimization** | 2026-02-06 | Removed Node.js ESM boot warning. <br> ↳ **Perf**: Added `"type": "module"` to server package.json |
| `v0.6.8` | **Server Build Fix** | 2026-02-06 | Fixed `MODULE_NOT_FOUND` crash on Fly.io. <br> ↳ **Fix**: Added `"outDir": "./dist"` to `server-geckos/tsconfig.json` |
| `v0.6.7` | **Asset Restoration** | 2026-02-06 | Fixed 404 errors by adding missing platform/background assets. <br> ↳ **M**: Moved project documentation to `docs/` folder <br> ↳ **New**: Generated `platform.png` and `background.png` <br> ↳ **Fix**: Resolved Vercel deployment asset mapping issues |
| `v0.6.6` | **Scale to Zero (Cost Savings)** | 2026-02-06 | Implemented automated shutdown for cost efficiency. <br> ↳ **New**: 5-minute Idle Timeout (self-termination) <br> ↳ **New**: Auto-wake on connection via Fly Proxy <br> ↳ **Fix**: Explicit `0.0.0.0` binding fix via `http.createServer` |
| `v0.6.5` | **Fly.io Deployment** | 2026-02-06 | Configured for production deployment on Fly.io. <br> ↳ **URL**: [sgalalla-geckos.fly.dev](https://sgalalla-geckos.fly.dev) <br> ↳ **New**: Environment-aware `NetworkManager` (auto-connect to Fly.io) |
| `v0.6.4` | **Manual Confirmation** | 2026-02-06 | Added character locking and manual confirmation for online rooms. <br> ↳ **New**: Manual Confirmation (SPACE/Button A) to skip selection timer <br> ↳ **New**: `npm run server` root shortcut for manual restarts <br> ↳ **Fix**: MatchHUD UI visibility restoration after selection <br> ↳ **Fix**: Unified `LobbyScene` and `OnlineGameScene` state synchronization |
| `v0.6.3` | **Online Selection Fix** | 2026-02-06 | Fixed ghost sprites and lifecycle issues in Online Selection. <br> ↳ **Fix**: Ghost sprites (side-sig frames) no longer appear during countdown <br> ↳ **Fix**: Phase-gated state updates (players only spawn when match starts) |
| `v0.6.2` | **Online Selection** | 2026-02-06 | In-room character selection for Online mode. <br> ↳ **New**: Character cycling (10s timer) inside Online room <br> ↳ **New**: Automatic match start after countdown <br> ↳ **Fix**: Server-side room reset and timer cleanup on disconnect |
| `v0.6.0_lobby` | **Lobby System** | 2026-02-06 | Implemented full Lobby system for local multiplayer. <br> ↳ **New**: `LobbyScene` with 4-player support (Keyboard + Gamepad) <br> ↳ **New**: Character Selection UI (Cycle through characters) <br> ↳ **UX**: Dynamic slot management (Join/Ready states) <br> ↳ **Tech**: Clean separation of Input Types and Device Indices |
| `v0.6.1_old_lobby` | **Fok Alt & Quick Lobby** | 2026-02-06 | Added alternate character skin and streamlined local lobby. <br> ↳ **New**: Character 'Fok (Alt)' added with full animation set <br> ↳ **UX**: Local Lobby restricted to Single Player (P1 Only) for focused testing <br> ↳ **UX**: Auto-Start enabled (Match begins 500ms after P1 Ready) |

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
- **[Perf]** Boot: Added `"type": "module"` to `Start-geckos/package.json` to fix Node.js ESM performance warning.
- **[S]** **STATUS**: v0.6.9 Complete. Server boot is clean and optimized.

### [2026-02-06] v0.6.10 - Infrastructure Scaling Fix
- **[V]** `v0.6.10`
- **[Fix]** Infrastructure: Forced Fly.io scale to 1 machine to prevent load-balancing errors (404 on matching) with in-memory Geckos state.
- **[S]** **STATUS**: v0.6.10 Complete. Connection reliability restored.

### [2026-02-06] v0.6.4 - Character Confirmation & Dev UX
- **[V]** `v0.6.4`
- **[New]** Manual Confirmation: Players can now lock their character with SPACE/ENTER/Button A. Game starts immediately if both are ready.
- **[New]** Dev UX: Added `npm run server` shortcut in root `package.json` for easy restarts.
- **[Fix]** UI: Restored MatchHUD (damage/character UI) initialization in the new `handleGameStart` flow.
- **[Fix]** Stability: Fixed build errors related to unused shared state in `LobbyScene` and `OnlineGameScene`.
- **[S]** **STATUS**: v0.6.4 Complete. Selection flow is now fully interactive and production-ready.

### [2026-02-06] v0.6.5 - Fly.io Deployment & Prod Sync
- **[V]** `v0.6.5`
- **[New]** Fly.io Config: Added `fly.toml`, `Dockerfile`, and `.dockerignore` for server deployment.
- **[New]** Networking: Updated `NetworkManager.ts` to be environment-aware (auto-connects to production URL).
- **[Tech]** Port Unification: Standardized on port 3000 for server/fly.io compatibility.
- **[S]** **STATUS**: v0.6.5 Complete. Infrastructure ready for production rollout.

### [2026-02-06] v0.6.3 - Global Sync & Ghost Fixes
- **[V]** `v0.6.3`
- **[Fix]** Ghost Sprites: Gated `processStateUpdate` to return early unless in `PLAYING` phase, preventing premature sprite creation.
- **[Fix]** Lifecycle: Ensured server state updates don't leak "side-sig" frames during character selection.
- **[S]** **STATUS**: v0.6.3 Complete. Selection flow is now visually clean and stable.

> [!TIP]
> This history is updated automatically after every major commit or push. Use it as a rollback reference if needed.
