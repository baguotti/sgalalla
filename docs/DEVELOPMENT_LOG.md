# Sgalalla - Development Log


---

Part 2

---

### [2026-02-16] v0.12.0 - Refactoring & Technical Debt Cleanup
- **[V]** `v0.12.0`
- **[Refactor]** **Core Optimization**:
    - **Config Extraction**: Moved character animation configs to `src/config/CharacterConfig.ts` (Removed ~500 lines of duplication).
    - **Map Constants**: Extracted wall and blast zone boundaries to `src/config/MapConfig.ts` to prevent stage desync between Offline and Online modes.
    - **Physics Config**: Centralized magic numbers (friction, gravity, damage) in `src/config/PhysicsConfig.ts`.
- **[Quality]** **Code Health**:
    - **Type Safety**: Created `GameSceneInterface` to enforce typed access for entities (Chest, Bomb, Hitbox), fixing potential runtime crashes.
    - **Noise Reduction**: Removed all 50+ active `console.log` calls for a zero-noise production build.
    - **Cleanup**: Stripped 42+ "Refinement Round" comments and dead code blocks.
- **[Fix]** **Gameplay Consistency**: 
    - Unified animation frame rates (Run: 24fps) across modes.
    - Fixed missing 'sgu' character in Online mode.
- **[S]** **STATUS**: Codebase deep-cleaned and structured for scalability.

---

### [2026-02-16] v0.12.1 - Stage Factory & Deduplication
- **[V]** `v0.12.1`
- **[Refactor]** **StageFactory**: Created `src/stages/StageFactory.ts` to centralize stage creation logic.
    - **Deduplication**: Removed ~165 lines of duplicate code from `GameScene.ts` and `OnlineGameScene.ts`.
    - **Type Safety**: Introduced `GameSceneInterface` to enforce safe scene access in entities.
    - **Stability**: Ensures identical stage layout (platforms, walls, blast zones) for both Local and Online modes.
- **[Fix]** **Types**: Resolved `as any` technical debt in `PlayerCombat.ts`, `Bomb.ts`, and `Chest.ts` (partial).

---

### [2026-02-16] v0.12.2 - "Buttery Smooth" Input 🧈
- **[V]** `v0.12.2`
- **[Feat]** **Input Buffering**: Added 100ms buffer window for inputs.
    - **Jump/Dodge**: Can now be queued 6 frames before landing/action ends.
    - **Combat**: Attack inputs pressed during cooldowns or hitstun are stored and execute on first available frame.
    - **Technical**: Created `InputBuffer.ts` and integrated into `PlayerPhysics` and `PlayerCombat`.
- **[Docs]** **Technical Briefs**: Added deep-dive analysis on State Machines and Determinism.

---

### [2026-02-16] v0.12.3 - Entity Refactor & Magic Number Purge
- **[V]** `v0.12.3`
- **[Refactor]** **Type Safety**:
    - **Entity Logic**: Replaced all unsafe `as any` casts in `Bomb.ts`, `Chest.ts`, `Player.ts`, and `PlayerCombat.ts` with strict `GameSceneInterface` typing.
    - **Scene Interface**: Unified access to `players`, `bombs`, and `chests` between `GameScene` (Arrays) and `OnlineGameScene` (Maps).
- **[Refactor]** **Magic Numbers**:
    - **PhysicsConfig**: Centralized 30+ hardcoded constants (movement, platform limits, dodge damping, bomb fuse/blast radii, chest interactions).
    - **Deduplication**: Removed item-specific logic scattered across entity files, moving it to configuration.
- **[Fix]** **Stability**:
    - **Bomb Logic**: Fixed potential crashes in `OnlineGameScene` due to data structure mismatches.
    - **Collision**: Fixed `Chest` collision logic to safely identify players.

---

### [2026-02-16] v0.12.4 - Asset Pipeline & Character Integrity
- **[V]** `v0.12.4`
- **[Feature]** **Asset Pipeline**:
    - **Atlas Generation**: Implemented `pack_sgu.cjs` and `pack_pe.cjs` to generate optimized texture atlases.
    - **Format**: Standardized on Phaser 3 Array Format (`{ textures: [ ... ] }`).
- **[Fix]** **Sgu Character**:
    - **Idle Animation**: Fixed "Ghost Raccoon" glitch by correcting atlas frame count (11 -> 12).
    - **Integrity**: Refactored `LobbyScene.ts` to use `CharacterConfig.ts` as single source of truth.
- **[WIP]** **Pe Character**:
    - **Integration**: Generated new atlas with 43 frames (Idle, Run, Attacks).
    - **Status**: Idle works. Run/Ghost animations pending debug.

---

### [2026-02-17] v0.12.5 - Pe Mechanics & Optimization
- **[V]** `v0.12.5`
- **[Fix]** **Pe Character**:
    - **Mechanics**: Implemented missing "Side Sig Ghost" animation and hitbox logic (FSM-ready).
    - **HUD**: Added fallback icon for Pe (using idle frame) to fix missing asset issue.
    - **Visuals**: Enabled full texture atlas support for Pe, resolving run animation glitch.
- **[Refactor]** **Optimization**:
    - **Object Pooling**: Implemented `BombPool` for efficient projectile recycling, reducing GC pressure.
    - **Rendering**: Enabled Texture Atlases for `fok`, `sgu`, and `sga` to minimize draw calls.
- **[Docs]** **Process**:
    - **Skill Audit**: Integrated `find-skills` workflow to audit and validate project dependencies.

---

    ### [2026-02-17] v0.12.6 - Visual Pooling & New Challengers
- **[V]** `v0.12.6`
- **[Feat]** **Visual Pooling**:
    - **EffectManager**: Implemented object pooling for explosions and ghosts, significantly reducing GC spikes during combat.
    - **Optimization**: Refactored `Bomb.ts` and `PlayerCombat.ts` to use pooled visual effects.
- **[Fix]** **Nock Character**:
    - **Assets**: Restored missing sprites and fixed atlas loading issues.
    - **Mechanics**: Implemented "Side Sig Ghost" (1 frame) and corrected run animation prefix.
- **[Feat]** **Greg Character**:
    - **New Challenger**: Added Greg to the roster with full sprite sheet support.
    - **Mechanics**: Implemented "Side Sig Ghost" with custom 3-frame animation.
- **[S]** **STATUS**: Performance improved, roster expanded, and critical visual bugs resolved.

### [2026-02-17] v0.12.7 - Polish & Deep Clean
- **[V]** `v0.12.7`
- **[Feat]** **Game Feel**:
    - **Wall Slide Dust**: Added subtle particle effects when sliding down walls (`PlayerPhysics.ts` + `EffectManager.ts`).
    - **Renaming**: Changed "1v1" to "**BOTTE IN REMOTO**" in Main Menu for clarity.
- **[Refactor]** **Deep Code Cleanup**:
    - **Zombie Code**: Removed residual/dead "Chromatic Aberration" code from `GameScene` and `PlayerCombat`.
    - **Audit**: Conducted deep structure analysis (`audit_report_2.md`) identifying unused assets and complexity hotspots.
- **[S]** **STATUS**: Codebase is verifying clean and ready for next feature phase.

### [2026-02-17] v0.12.8 - Animation Refactor & Scrin Polish 🎞️
- **[V]** `v0.12.8`
- **[Refactor]** **Animation System**:
    - **Logic Extraction**: Created `AnimationHelpers.ts` to centralize asset loading and animation creation.
    - **Deduplication**: Removed ~230 lines of redundant code between `GameScene` and `OnlineGameScene`.
    - **Standardization**: Enforced consistent use of `CharacterConfig.ts` across all modes.
- **[Polish]** **Scrin Reveal**:
    - **"Pop & Focus"**: Replaced instant appearance with a punchy `Back.easeOut` scale animation simultaneously de-blurring the image.
    - **Input Blocking**: Added `canClose` lock to prevent accidental closing during the reveal sequence (800ms).
    - **Breathing**: Added gentle idle pulse to revealed images.
- **[Fix]** **Types**: Resolved `Phaser.Geom.Rectangle` incompatibility in `GameSceneInterface`.
- **[S]** **STATUS**: Animation pipeline robust; UI feel improved.
- **[Fix]** **Stability**: Fixed `GameScene` crash (`cannot read undefined reading size`) caused by accessing destroyed bomb group on restart.
- **[Cleanup]** **Assets**: Removed `background_lake` dead code to fix missing file error.

### [2026-02-18] v0.13.0 - Side Platform Overhaul & Physics Tuning
- **[V]** `v0.13.0`
- **[Refactor]** **Side Platform Overhaul**: Refactored `StageFactory` to fully decouple Visuals, Walkable Floors, and Slideable Walls. This allows independent tuning of each element.
- **[Feat]** **Improved Green Block (Left Platform)**:
    - **Visual**: Synced wall and floor positions to match the visual asset perfectly.
    - **Collision**: Added a "Chopped Corner" (Notification) to the bottom-right, trimming the wall and ceiling collision to match the texture's 45-degree cut.
    - **Solid Bottom**: Added a Ceiling Collision check to the Player Physics engine and a corresponding invisible Bottom Wall to prevent players from passing through the block from below.
- **[Tuning]** **Blast Zone**: Raised the top blast zone ceiling (`BLAST_ZONE_TOP`) from -600 to -1000 to provide more vertical play space.
- **[Tuning]** **Background**: Scaled up background image by 35% for better framing.
- **[Refactor]** **Physics Engine**: Added `checkCeilingCollision` to `PlayerPhysics` to support bottom-blocking infrastructure.

### [2026-02-18] v0.13.1 - Stage Cleanliness
- **[V]** `v0.13.1`
- **[Refactor]** **StageFactory Cleanup**: Deep cleaned `StageFactory.ts` by removing unused legacy code (Color constants, visual wall arrays), and unified wall collision logic across `GameScene` and `OnlineGameScene`.
- **[Docs]** **Logs**: Updated changelogs.

### [2026-02-18] v0.13.3 - Stage Polish & Dramatic Finish 🎭
- **[V]** `v0.13.3`
- **[Feat]** **Stage Assets (Adria v2)**:
    - **Visual Upgrade**: Swapped placeholder assets for final "Adria" stage art (Main, Side, Top platforms).
    - **Layout Tuning**: Consolidated top platforms into a single centered floating platform.
    - **Mapping**: Fixed main platform texture mapping to correctly cover the physics body.
    - **Background**: Verified and fixed background image loading.
- **[Feat]** **Dramatic Game End**:
    - **Zoom**: Implemented a dramatic camera zoom/pan to the winning player upon victory.
    - **Victory Text**: Updated victory text to "PLAYER X HA ARATO!" for local flavor.
    - **Polish**: Added a black overlay to dim the background, ensuring text legibility.
- **[Polishing]** **Training Room**:
    - **Loading Screen**: Added a black "LOADING..." overlay to hide the blue-screen transition when entering Training Mode.
- **[Fix]** **Lint**: Resolved TypeScript errors in `StageFactory`.

### [2026-02-18] v0.13.2 - Death Polish & Respawn Fixes
- **[V]** `v0.13.2`
- **[Fix]** **Respawn Glitch**: Fixed immediate death loop by resetting physics body and validating spawn points.
- **[Polishing]** **Death Impact**: Added camera shake and explosion visual effect on player death.
- **[Refactor]** **Effect Manager**: Centralized effect handling in `EffectManager.ts`.

## v0.13.4 (2026-02-18)
- **Gamepad Input Fixes**:
  - Implemented raw input polling via `navigator.getGamepads()` to support Xbox controllers and non-primary gamepads in menus and game.
  - Added input throttling to Main Menu to prevent hypersensitive scrolling.
  - Fixed "START" (Pause) and "SELECT" (Debug) buttons not working on some controllers by scanning all connected gamepads.
  - Verified and fixed logic for assigning the correct controller (Player 1) from Menu to Lobby to Game.
### [2026-02-18] v0.13.5 - Codebase Cleanup (Phase 1) 🧹
- **[V]** `v0.13.5`
- **[Cleanup]** **Asset Audit**:
    - **Deleted Unused**: Removed `public/assets/fok_v3/` (consolidated to `v4`), legacy audio files, and unused platform textures.
    - **Documentation**: Archived `DEVELOPMENT_LOG_LEGACY.md` to reduce clutter.
- **[Refactor]** **Legacy Code Removal**:
    - **PreloadScene**: Stripped commented-out asset loading blocks.
    - **AnimationHelpers**: Removed dead code for old platform types.
- **[S]** **STATUS**: Project size reduced; legacy debt cleared. Ready for architectural upgrades.

### [2026-02-18] v0.13.6 - Combat Audio 🔊
- **[V]** `v0.13.6`
- **[Feat]** **Combat SFX**:
    - **Movement**: Added custom SFX for Jump, Double Jump, Dash, and Landing (`PlayerPhysics.ts`).
    - **Combat**: Implemented distinct audio for Running Light Attacks vs Standard Light Attacks (Miss/Hit variations).
    - **Integration**: Mapped 8 new audio assets provided by user to gameplay events.

### [2026-02-19] v0.14.0 - Input Bulletproofing & Vertical Ghosts 👻
- **[V]** `v0.14.0`
- **[Fix]** **Input Carryover**: 
    - Completely bulletproofed the `LobbyScene` and `MainMenuScene` against phantom inputs carrying over from scene transitions. 
    - Implemented strict edge detection `Map<number, boolean>` tracking for Gamepads to distinguish held buttons from fresh presses.
    - Added lockout frame-polling to swallow inputs held during scene load.
    - Segregated Keyboard Join and Ready inputs to prevent accidental double-registration on the same frame.
- **[Fix]** **Safe Respawning**:
    - Centralized all respawn logic in `GameScene` and `OnlineGameScene`.
    - Players now respawn safely near the center of the stage `(960, 200)` with a slight X-offset, rather than dangerously close to the blast zones.
- **[Feat]** **Vertical Ghosts**:
    - Expanded the visual ghost system (previously only on Side Signatures) to Upward and Neutral Signatures.
    - Fok, Sgu, Sga, Pe, Nock, and Greg now all spawn dedicated ghost effects that shoot vertically during their Up/Neutral Heavy attacks.
    - Standardized ghost rotation (-90 degrees) for all characters except Nock.

### [2026-02-20] v0.14.1 - Online Multiplayer Sync & Stability Fixes
- **[V]** `v0.14.1`
- **[Fix]** **Dash Freeze**: Fixed an uncaught audio cache error (`sfx_dash`, `sfx_jump_2`) caused by missing `AnimationHelpers.loadUIAudio(this)` in `OnlineGameScene.preload()`. This uncaught error was killing the Phaser game loop whenever a local player dashed or jumped online.
- **[Fix]** **Remote Player Stuck**: Fixed a bug where remote players with an empty initial `animationKey` (`''`) fell through the `isRemotePlayer` guard and entered local grounded/airborne logic, getting permanently stuck in a `fall` animation loop.
- **[Fix]** **Platform Duplication**: Explicitly added `uiCamera.ignore(stage.platformTextures)` in `OnlineGameScene` to prevent the UI camera from rendering game-world platforms, which previously appeared as floating "ghost" platforms.
- **[Fix]** **Character Desync**: Changed the server's default character from the legacy `'fok_v3'` back to `'fok'` to match the client's texture atlas key, preventing the `Texture "__MISSING" has no frame "fok_v3_Idle_000.png"` error in `PlayerHUD`.
- **[Cleanup]** **Legacy Assets**: Removed loads for `platform.png` and `background.png` from `OnlineGameScene` as the assets were deleted in v0.13.5.

### [2026-02-20] v0.14.2 - Throwable Bomb Polish & Charge Silhouette Visuals
- **[V]** `v0.14.2`
- **[Feat]** **Advanced Throwable Logic**:
    - Implemented a unified `Throwable` interface for items.
    - Added escalating sensory feedback for bombs: violent jitter, pulsing red tint, and motion blur as the 4s fuse counts down.
    - Added a **6-frame Catch Window**: Players can now catch thrown bombs mid-air by pressing Light Attack at the perfect moment.
    - **Brawlhalla Physics**: Thrown items now inherit the player's momentum, bounce off walls (0.5 elasticity), tumble in the air, and have an initial "arming time" to prevent immediate self-explosions.
    - **Variable Force**: Damage and knockback now scale with throw power and the target's current damage percentage.
- **[Feat]** **Charge Attack Visuals**:
    - Replaced the basic charge circle with a high-fidelity **Silhouette Fill** effect.
    - The glowing silhouette mirrors the character's exact animation frame and fills from the feet to the head as charge time builds.
    - Features smooth color interpolation (White -> Pastel Red), Additive Blending, Bloom, and dynamic Motion Blur.
    - Added a scale "wobble" effect at 100% charge to indicate maximum intensity.
- **[Polishing]** **Pickup UX**:
    - Increased `pickupRange` significantly (from 60 to 100) to make item grabbing faster and more reliable.
    - Precented opened chests from being punched/kicked to ensure they remain interactable as items only.

### [2026-02-21] v0.14.4 - Audio Glitch Refinements 🔊
- **[V]** `v0.14.4`
- **[Fix]** **Spot Dodge Audio**:
    - Removed the `sfx_dash` whoosh sound from stationary spot dodges.
    - Prevents the "phasing" audio glitch caused by overlapping dash sounds during the 300ms dodge window.
- **[Fix]** **Charge Sound Persistence**:
    - Fixed a bug where `sfx_fight_charge` would loop forever if a player was hit mid-charge.
    - Integrated `clearChargeState()` into `applyHitStun()` and added a hard failsafe timeout to the sound cleanup routine to ensure looping sounds are always destroyed.
- **[Polish]** **Audio Transitions**: Balanced charge sound fade-out to trail off naturally while remaining technically solid against interruptions.

### [2026-02-21] v0.14.5 - UI Clarity & Training Metadata ℹ️
- **[V]** `v0.14.5`
- **[Feat]** **Controls Overlay**:
    - Added 'T' key information to the `COMANDI` overlay.
    - Explicitly documented the **Dummy Hostility Toggle** for Training Mode.

--------------------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-21] v1.0.0 - THE MASSIVE MILESTONE 🚀
- **[V]** `v1.0.0`
- **[Feat]** **Full Online Synchronization**:
    - **Chest Sync**: Rewrote chest interactions to be server-authoritative. Opening and closing are now relayed via Geckos, ensuring all players see the same rewards at the same time.
    - **Death Sync**: Added remote death effects (sounds, crowd reactions, camera shake) so opponents' deaths feel impactful for all players.
    - **Character Sync**: Fixed the critical bug where newer characters (Greg, Pe, Nock) would default to Fok in online rooms.
- **[Feat]** **Visual Overhaul**:
    - **Main Menu**: Swapped the background video to a high-fidelity `.webm` animation (`Main_Menu_Animation_001_webM.webm`) for better performance and visual punch.
- **[Fix]** **Network Stability**:
    - **Idle Logic**: Resolved "Connection Refused" issues by better managing server idle timeouts and file-watcher restarts.
- **[S]** **STATUS**: Stable v1.0.0 release. Competitive platform fighting is now fully synchronized online.
--------------------------------------------------------------------------------------------------------------------------------------------------
--------------------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-21] v1.0.1 - Player State Machine Refactor: Phase 2 🧠
- **[V]** `v1.0.1`
- **[Arch]** **State Machine Infrastructure (Phase 1 & 2)**:
    - Successfully implemented the core **Finite State Machine (FSM)** infrastructure to replace the legacy boolean-flag system.
    - **Created 15 Discrete State Classes**: Each state now owns its own lifecycle (`enter`, `update`, `exit`) and animation mapping.
        - **Ground**: `Idle`, `Run`, `Taunt`, `Win`.
        - **Airborne**: `Jump`, `Fall`, `WallSlide`.
        - **Combat**: `Attack`, `Charging`, `HitStun`.
        - **Defensive**: `Dodge`, `AirDodge`.
        - **Special**: `Recovery`, `GroundPound`, `Respawning`.
    - **StateMachine Core**: Implemented a passive `StateMachine` class that delegates logic to the active state, ensuring clean transitions and state isolation.
    - **Type Safety**: Verified full project compilation (`tsc --noEmit`) with the new FSM architecture integrated via forward declaration in `Player.ts`.
- **[Polish]** **Code Hygiene**: Cleaned up over 50 linting warnings related to unused parameters across the new state implementations to maintain high code standards.
- **[S]** **STATUS**: Phase 2 Complete. All state logic is defined and ready for Phase 3 (wiring and logic migration).
--------------------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-21] v1.0.2 - Player State Machine Refactor: Phase 3 (Integration) 🔗
- **[V]** `v1.0.2`
- **[Arch]** **FSM Integration**:
    - **Wiring `Player.ts`**: Successfully integrated the `StateMachine` into the core `Player` class, wiring all 15 states in the constructor.
    - **Logic Delegation**: Refactored `updateLogic()` to delegate state-dependent logic (movement, animations, combat availability) to the FSM, removing a large cluster of complex `if-else` branches.
    - **HitStun Refactor**: Simplified `applyHitStun()` to execute a clean state transition, leveraging `HitStunState.enter()` to automatically handle flag resetting and sound cleanup.
    - **Network Preservation**: Ensured `isAttacking` and `animationKey` properties remain synchronized for online play, maintaining full compatibility with `OnlineGameScene` and `server-geckos`.
- **[Fix]** **Network Recovery**: Identified and fixed an issue where the local Geckos server would shut down due to a 5-minute idle timeout, ensuring persistent local online testing capability.
- **[Verification]** **System Stability**: Verified through `npx tsc --noEmit` and `npm run build` that the project remains type-safe and production-ready.
- **[S]** **STATUS**: Phase 3 Complete. The character's core logic is now officially driven by the FSM.
--------------------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-21] v1.0.3 - Player FSM Refactor: Phase 4 (Cleanup & Polish) 🧹✨
- **[V]** `v1.0.3`
- **[Arch]** **FSM Cleanup & Refinement**:
    - **Optimization**: Replaced the 190-line `updateAnimation()` cascade in `Player.ts` with a streamlined 40-line FSM-driven logic. Removed ~140 lines of redundant code.
    - **Convenience**: Added `getAnimationKey()` to `StateMachine.ts` for centralized animation resolution.
    - **State Sync**: Modernized `getState()` to utilize FSM state names, improving the reliability of priority mapping for UI and Network snapshots.
- **[Fix]** **Animation Integrity**:
    - **Sprite Visibility**: Resolved "Missing Sprite" bugs for dodges, charges, and light attacks by correctly injecting `fsm.changeState()` hooks into `PlayerCombat` and `PlayerPhysics`.
    - **No-Interrupt**: Removed early boolean clearing from FSM `exit()` states to prevent premature animation termination.
    - **HitStun Cleanup**: Fixed a duplicate `isHitStunned` reset bug in `updateTimers()`.
- **[Feat]** **Dash Physics Polish**:
    - **Momentum Carryover**: Disabled friction decay during dashes, allowing players to maintain constant velocity throughout the dash duration.
    - **Seamless Transitions**: Re-wired `DodgeState` and `AirDodgeState` to transition directly into the `Run` state if movement keys are held, eliminating 1-frame "idle" jitters.
    - **Tuning**: Adjusted `DODGE_DISTANCE` to `210` px for a snappier, more balanced feel.
- **[S]** **STATUS**: FSM Transition successfully completed. Character movement and state management are now robust, clean, and highly extensible.
--------------------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-21] v1.0.4 - Server-Authoritative Physics: Phase 1 (Shared Module Extraction) 🏗️⚙️
- **[V]** `v1.0.4`
- **[Arch]** **Shared Physics Extraction**:
    - **Shared Modules**: Created `shared/` directory to house platform-agnostic code. Extracted `PhysicsConfig.ts`, `MapConfig.ts`, and `StageData.ts` as pure-data/constant modules.
    - **Simulation Logic**: Extracted core movement and collision logic from `PlayerPhysics.ts` into `shared/PhysicsSimulation.ts`. This module contains pure functions (`stepPhysics`, `checkPlatformCollisions`) that run identically on both client and server.
    - **Import Refactor**: Reconfigured `src/config/` modules to re-export from `shared/`, ensuring 0% breakage for existing client code while establishing a single source of truth.
- **[Net]** **Local Testing Readiness**:
    - **Local Connectivity**: Configured `NetworkManager.ts` to connect to `localhost` by default, enabling full-stack local testing of multiplayer mechanics during this transition.
- **[Build]** **Toolchain Updates**:
    - **TypeScript**: Updated both client and server `tsconfig.json` to resolve the `shared/` directory. Verified clean builds for both environments.
- **[S]** **STATUS**: Phase 1 Complete. The foundation for server authority is laid. Shared code is verified and operational.
--------------------------------------------------------------------------------------------------------------------------------------------------

### [2026-02-21] v0.1.5 - Server-Authoritative Physics: Phase 2 (Hybrid Game Loop) 🔌🕹️
- **[V]** `v0.1.5`
- **[Arch]** **Hybrid Server-Authoritative Logic**:
    - **Shadow Simulation**: Implemented a parallel physics loop on the server using `shared/PhysicsSimulation.ts`. The server now calculates player states at 60Hz.
    - **Relay Fallback**: Reverted to hybrid mode where the server relays client-reported positions to ensure smooth gameplay while the shared physics is refined.
    - **Input Mapping**: Implemented `INPUT` message handling on the server, mapping client `InputState` to the shared `SimInput` for authoritative validation.
- **[Sync]** **Multiplayer Fixes & Polish**:
    - **Interpolation Tuning**: Increased remote player snapshot buffer from 10 to 20 entries to handle the 60Hz server tick rate more smoothly.
    - **Grounding Fix**: Resolved the "idle/fall" animation flicker by implementing a 1px grounding epsilon and a tiny downward "grounding force" in the shared simulation.
    - **Animation Resolution**: Added `deriveAnimationKey()` to the server to translate physics state into animation keys for remote players.
    - **Visual Sync**: Introduced `updateRemoteVisuals()` to separate visual timers from FSM-driven animation logic, preventing client-side overrides of server animations.
- **[Fix]** **Spawn Consistency**: Aligned spawn points between client and server to prevent initial desynchronization.
- **[S]** **STATUS**: Phase 2 Complete (Hybrid). Infrastructure for server authority is active and stable. Ready for Phase 3 (Full Prediction & Reconciliation).
--------------------------------------------------------------------------------------------------------------------------------------------------
------------------------------------------------------------------------------------------------------------------------------------


- **[V]** `v1.0.6`
- **[Arch]** **Real Physics Extraction**:
    - **Logic Parity**: Rewrote `shared/PhysicsSimulation.ts` (~550 lines) to exactly replicate the 791-line logic from `PlayerPhysics.ts`. Replaced approximations with the actual client-side implementation.
    - **Full State Isolation**: Expanded `SimBody` and `SimInput` to include every state variable needed for identical simulation: `jumpsRemaining`, `dodgeTimer`, `isWallSliding`, `recoveryTimer`, etc.
    - **Event-Driven Visuals**: Implemented a `PhysicsEvent` system (SFX, Landing, DodgeStart) allowing the shared physics to remain pure and platform-agnostic while triggering client-side feedback.
- **[Net]** **Protocol Refinement**:
    - **Input Consistency**: Updated the server `INPUT` message handler to support the expanded `SimInput` shape (`jumpBuffered`, `dodgeBuffered`, etc.), ensuring the authoritative loop receives the same data as the client.
- **[Build]** **Toolchain Verification**:
    - **Cross-Platform Compile**: Verified both client (`vite build`) and server (`tsc --noEmit`) builds pass with the new shared logic.
- **[S]** **STATUS**: Phase 3 Complete. The shared simulation now provides 1:1 logic parity between client and server. Ready for Phase 4 (Wiring).
------------------------------------------------------------------------------------------------------------------------------------
 **[V]** `v1.0.7`
- **[Arch]** **Thin Wrapper Implementation**:
    - **Delegation**: Rewrote `PlayerPhysics.ts` (791 → ~420 lines). It now contains zero physics math, acting as a thin wrapper that delegates to `shared/stepPhysics()`.
    - **State Sync**: Implemented high-fidelity state syncing (`syncToBody`/`syncFromBody`) ensuring `SimBody` is perfectly aligned with Phaser's `Player` and `PlayerPhysics` public API.
    - **Event Handling**: Integrated the `PhysicsEvent` system to trigger SFX, FSM state changes (e.g., `Dodge`, `Recovery`), and visual effects (ghost sprites) from the shared simulation.
- **[Net]** **Foundation for Authority**:
    - **Logic Parity**: Confirmed both client and server now execute the exact same physics code, eliminating the desync-by-logic issues from earlier phases.
- **[S]** **STATUS**: Phase 4 Complete. The client is now "physics-agnostic," preparing for server-driven reconciliation in Phase 5.
------------------------------------------------------------------------------------------------------------------------------------

- **[V]** `v1.0.8`
- **[Net]** **Input Redundancy Implementation**:
    - **Client**: Modified `sendInput` to include a ring buffer of the last 10 frames of input in every UDP packet. This ensures that even if 9/10 packets are dropped, the server can still recover the missed inputs.
    - **Server**: Implemented an `inputQueue` (Map<frame, SimInput>) per player. The server now deduplicates incoming redundant inputs and processes them in chronological order.
    - **Fast-Forward**: The server can now "fast-forward" through multiple queued inputs in a single tick (capped at 5) to catch up after packet burst arrivals.
- **[UX]** **Reconciliation Tuning**: Temporarily disabled client-side lerp reconciliation to prevent "downward force" glitches during jumps until Phase 6C (Client Replay) is fully implemented.
- **[S]** **STATUS**: Step 6B Complete. UDP packet loss issues significantly mitigated. Ready for Step 6C (Prediction Replay).
------------------------------------------------------------------------------------------------------------------------------------

-

### [2026-02-21] v1.0.9 - Rollback to Client-Authoritative Physics 🔙🏃‍♂️
- **[V]** `v1.0.9`
- **[Net]** **Physics Authority Revert**:
    - **Revert**: Transitioned back from Server-Authoritative to Client-Authoritative physics for player positions.
    - **Rationale**: Independent clock drift (RAF vs setInterval) and variable deltas caused irreversible simulation divergence. 
    - **Hybrid Retention**: Kept Input Redundancy (last 10 frames) and FSM State Transmission for improved reliability and animation sync.
    - **Stability**: Restored the "offline-feel" lag-free local experience while maintaining robust network relay for remote players.
- **[S]** **STATUS**: Phase 6 conclusion. Physics authority shifted back to client for stability. Ready for production deployment.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-21] v1.0.10 - Connection Hostname Fix 🌐🔧
- **[V]** `v1.0.10`
- **[Net]** **Hostname Awareness**:
    - **Fix**: Replaced hardcoded `localhost` with `window.location.hostname` in `NetworkManager.ts`.
    - **Result**: Fixed `net::ERR_BLOCKED_BY_CLIENT` when running on production IP, allowing clients to correctly connect to the droplet.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-21] v1.0.11 - Jitter Optimization & Interpolation Tuning 📡✨
- **[V]** `v1.0.11`
- **[Net]** **Interpolation Smoothing**:
    - **Broadcast Rate**: Reduced server `STATE_UPDATE` frequency to 20Hz (every 3rd tick) to prevent UDP congestion and packet bursting.
    - **Render Delay**: Increased production `RENDER_DELAY_MS` to 100ms, providing enough buffer to absorb network jitter over the internet.
    - **Sync**: Reduced client `POSITION_UPDATE` frequency to 20Hz to match server broadcast rate.
    - **Result**: Significant reduction in remote player jitter and "teleporting" while maintaining local responsiveness.
- **[S]** **STATUS**: Deployment successful. Closing session.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-22] v1.0.12 - Decoupled Interpolation Timeline ⏱️💯
- **[V]** `v1.0.12`
- **[Net]** **Mathematical Timeline Fixing**:
    - **Flaw**: Previous interpolation anchored snapshots to their `performance.now()` arrival times. This caused massive teleportation glitches whenever the internet or the DO Droplet clustered UDP packets together.
    - **Fix**: Decoupled playback from network jitter entirely. Client now calculates the theoretical server time mathematically using the authoritative `serverFrame * TICK_MS`.
    - **Result**: The client's jitter buffer timeline is now perfectly immune to internet lag spikes, packet clustering, and Node.js `setInterval` drift on the server.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-22] v1.0.13 - Frame Relay Jitter Architecture Fix 🧩🚀
- **[V]** `v1.0.13`
- **[Net]** **Interpolation Timeline Flaw Fix**:
    - **Flaw**: Previous attempt to mathematically interpolate used the **Server's** broadcast frame index rather than the **Client A's** originating physics frame. Thus, Client A to Server UDP jitter was baked directly into the Server's broadcast.
    - **Fix**: Upgraded `NetPlayerState` to include `clientFrame` directly from Client A's local physics loop. The server receives, stores, and broadcasts this `clientFrame` telemetry. Client B mathematically anchors interpolation directly to this `clientFrame`.
    - **Result**: Client B can perfectly recreate Client A's chronological playback speed, effectively nullifying Relay Jitter across both "Client A -> Server" and "Server -> Client B" hops.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-22] v1.0.14 - Client-Side Hit Prediction & Snappy Tuning ⚡🥊
- **[V]** `v1.0.14`
- **[Predict]** **Hit Prediction (Zero Latency Hits)**:
    - **Flaw**: Hits felt extremely laggy because local knockback was immediately overwritten by the network interpolation buffer (which was 160ms+ in the past).
    - **Fix**: Implemented Client-Side Hit Prediction. When a remote player is locally hit (`isHitStunned`), they are temporarily detached from the network interpolation buffer. The local physics engine takes over (`player.updatePhysics()`) to simulate instant knockback and collisions.
    - **Result**: Hitting opponents offline or online feels absolutely identical. No massive latency or waiting for server confirmation.
- **[Tuning]** **Floatiness Reduction**:
    - **Render Delay**: Reduced base `RENDER_DELAY_MS` to a tight 60ms (down from 100ms). The timeline architecture fix was so effective we no longer need the massive buffer.
    - **Drift Bounds**: Tightened `clockSpeed` drift adjustments from `0.90 - 1.10` to `0.95 - 1.05`, eliminating the "floaty" or "sluggish" feeling caused by the client over-correcting the jitter timeline.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-22] v1.0.15 - Targeted Revert to Proven Interpolation 🔙✅
- **[V]** `v1.0.15`
- **[Net]** **Revert to v1.0.9 Proven Logic**:
    - **Reverted**: `clientFrame * TICK_MS` mathematical timeline back to `performance.now()` arrival timestamps. The mathematical approach broke because a single global interpolation clock cannot handle independent per-player frame epochs.
    - **Reverted**: Client-Side Hit Prediction removed. It caused animation desync (stuck "hurt" poses) and violent position snapback when hitstun ended.
    - **Reverted**: Direct velocity extrapolation back to lazy lerp (`Linear(player.x, predictedX, 0.15)`).
    - **Reverted**: Clock drift gain from `0.005` back to `0.002`.
- **[Net]** **Retained Improvements from v1.0.11+**:
    - **Kept**: 30Hz server broadcast rate (per-room `broadcastCounter`).
    - **Kept**: 30Hz client send rate.
    - **Kept**: `RENDER_DELAY_MS = 60` flat (simpler than adaptive).
    - **Kept**: Per-room `broadcastCounter` bug fix.
- **[S]** **STATUS**: Restored v1.0.9 reliability with v1.0.11 broadcast improvements.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-22] v1.0.16 - Signatures & Scrin Expansion 🎭📦
- **[V]** `v1.0.16`
- **[Audio]** **Signature SFX**:
    - Added unique `sfx_greg_sig`, `sfx_sgu_sig`, and `sfx_pe_sig`.
    - Implemented layered charge SFX for **Pe** (`sfx_pe_charge` layered over base hum).
    - Restructured `PlayerCombat.ts` to handle an array of active charge sounds for graceful fade-outs.
- **[Content]** **Scrin Massive Expansion**:
    - Replaced 31 legacy images with **134 new high-quality rewards**.
    - **Optimization**: Converted all images to **WebP** at 1000px height (Total folder size: 5.7MB).
    - Updated `Chest.ts` and `AnimationHelpers.ts` to support the new 134-image inventory.
- **[UI]** **Polish**:
    - Moved version string in Main Menu to the bottom-right for a cleaner title layout.
    - Removed FSM state change debug logs to keep the console noise-free.
- **[S]** **STATUS**: Ready for rewards-focused playtesting.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-22] v1.1.0 - Online Ghost Visuals Sync & Spawning Balance 👻📦
- **[V]** `v1.1.0`
- **[Net]** **Ghost Visuals Sync**:
    - **Recovery Sync**: Implemented `RECOVERY_START` network event. Remote players now see the upward ghost sprite, which correctly follows the player's vertical movement via tween position updates.
    - **Charge Sync**: Replaced instant-spawn logic with a proper `startRemoteCharge` state. Remote clients now see the same gradual alpha fade-in as the local player, driven by the `updateChargeState` loop.
    - **Stability**: Added `clearChargeState()` to `startAttack()` to prevent "double ghosting" (charge ghost + attack ghost overlapping) on remote clients upon release.
- **[Tuning]** **Chest Spawning**:
    - **Rate Adjustment**: Updated chest spawn rules to a **35% chance every 30 seconds** across all modes.
    - **Implementation**: Aligned the server's 10s interval in `server-geckos/index.ts` with the client's 30s standard and verified `GameScene` timer consistency.
- **[S]** **STATUS**: Online visual integrity significantly improved; spawning frequency balanced for competitive play.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-23] v1.1.1 - Codebase Audit & Performance Sweep (Tier 1 & 2) 🧹⚡
- **[V]** `v1.1.1`
- **[Audit]** **Sanitation (Tier 1)**:
    - **Dead Code**: Stripped commented-out properties and duplicate `loadUIAudio()` calls in `GameScene.ts`.
    - **Visual Noise**: Removed production "Crash Splash" and duplicate HUD text additions.
    - **Console**: Removed live `console.log` in `PlayerCombat.endAttack()` firing 60x/sec.
    - **Cache**: Removed query-string cache-busting from audio URLs in `AnimationHelpers.ts`.
- **[Perf]** **Optimization (Tier 2)**:
    - **Allocation Reduction**: Hoisted `new Map()` and keyboard `addKey()` calls out of 60Hz `update()` loop.
    - **GC Management**: Implemented object pooling for wall dust in `EffectManager.ts`.
    - **Geometry Pooling**: Unified `_boundsRect` into `Fighter` base class as a pooled resource (Zero-allocation `getBounds()`).
    - **Vector Pooling**: Replaced `new Vector2` allocations in `Chest.ts` and `NetworkManager.ts` with reusable/shared instances.
- **[S]** **STATUS**: Critical performance bottlenecks removed; GC pressure significantly reduced.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-23] v1.1.2 - Debug Mode Awareness & Controls Overhaul 🎮🛠️
- **[V]** `v1.1.2`
- **[Feat]** **Debug Mode Awareness**:
    - **Contextual Toggle**: The [Q] debug toggle is now mode-aware. 
        - **Botte in Locale / Online**: Shows only FPS and Ping for a clean competitive experience.
        - **Training Mode**: Shows full technical data (State, Velocity, Hitboxes, Recovery state, etc.).
    - **Performance**: Disabled heavy debug visual updates (physics geometries/hitboxes) when in minimal mode.
- **[Feat]** **Controls Overlay (F1) Rewrite**:
    - **3-Column Layout**: Completely redesigned the [F1] overlay with a denser, more organized "Overwatch-style" layout.
    - **Coverage**: Documented 100% of inputs, including Keyboard (WASD/Arrows/SPACE/Brawlhalla defaults) and Gamepad mappings.
    - **Moveset**: Added a comprehensive moveset reference (NLight, SSig, Recovery, etc.) and interaction guide (Chests/Items).
- **[UX]** **Pause Menu Parity**:
    - **Synchronization**: Rewrote the "COMANDI" section of the Pause Menu to exactly match the new F1 overlay content and layout.
    - **Layout Fix**: Corrected the title positioning in the Pause Menu to prevent overlaps with the new 3-column content.
- **[S]** **STATUS**: Game UX significantly improved with high-fidelity control references and cleaner performance monitoring.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-24] v1.1.3 - Production Deployment & Maintenance 🚀📦
- **[V]** `v1.1.3`
- **[Maint]** **Workspace Cleanup**:
    - Removed AppleDouble (`._*`) metadata files from the repository to prevent file-system pollution.
    - Normalized file permissions across the source tree for better cross-platform compatibility.
- **[Deploy]** **Full Stack Release**:
    - Synchronized client and server builds for v1.1.3.
    - Verified online connectivity and versioning consistency.
### [2026-02-24] v1.1.4 - Input Standardization & Combat Polish 🎮🥊
- **[V]** `v1.1.4`
- **[Refactor]** **Input Standardization**:
    - **Gamepad Constants**: Migrated all hardcoded gamepad button indices (e.g. `buttons[0]`) to the `GamepadButton` enum for Xbox/Brawlhalla parity.
    - **Joy-Con Support**: Integrated `JoyConMapper` to support L/R Joy-Con pairs.
    - **Controls Overlay**: Refactored the [F1] and Pause Menu overlays to "Hold-to-show" behavior (F1 / LB).
- **[Feat]** **Combat Polish**:
    - **Ground Pound Sound**: Implemented a heavy landing "thud" (`sfx_landing` + `sfx_chest_drop`) for missed ground pounds with full network synchronization.
- **[Fix]** **Animation Integrity**:
    - **Jump Sprite**: Resolved a state machine transition bug where characters would skip the "jump" sprite and instantly show "fall" during ascent.
- **[S]** **STATUS**: Competitive integrity and input flexibility reached new standards.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-02-26] v1.2.0 - Ground Pound Overhaul & Input Expansion 🔨🎮
- **[V]** `v1.2.0`
- **[Feat]** **Ground Pound Refinement**:
    - **Charging**: Implemented full charge functionality for Ground Pound (Down + Heavy in air). Players can hold to suspend in mid-air and charge the attack.
    - **Scaling**: Damage scales (4 → 12) and knockback scales (up to 1.8x base) based on charge duration.
    - **Visuals**: Replaced ghost silhouette with character's actual Ground Pound pose during charge for better impact.
    - **Fixes**: Fixed "double flip" glitch during charge/slam transitions and ensured orientation is preserved during landing recovery.
- **[Feat]** **Pause Menu & Input**:
    - **Aggregated Gamepad Input**: Refactored `PauseMenu.ts` to read from **all connected gamepads** simultaneously. Any player can now navigate and control the pause menu from any controller.
    - **UI**: Adjusted Menu Background Video scale (1.505) for pixel-perfect framing.
- **[S]** **STATUS**: Combat mechanics and UI input robustness significantly enhanced. Ready for next phase.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-03-02] v1.2.1 - CRT Filter & Input Remapping Polish 📺🎮
- **[V]** `v1.2.1`
- **[Feat]** **CRT Advanced Visuals**:
    - **Intensity Levels**: Implemented 3 togglable intensity levels: **BASSO**, **MEDIO**, **ALTO**.
    - **Highlight Glow**: Rearchitected the glow to use a secondary canvas/filter layer ensuring the glow only affects bright highlights.
    - **ALTO Effects**: Added cinematic extras: heavy vignette, programmatic barrel distortion, and subtle screen jitter.
- **[Feat]** **Settings UI Restructure**:
    - **Submenus**: Moved SFX and MUSIC controls into a dedicated **SONORO** submenu.
    - **Video**: Created a **VIDEO** submenu for CRT effects.
- **[Feat]** **Input Remapping**:
    - **Gamepad Polish**: Enabled remapping to the 'B' button (previously reserved for back).
    - **Safety**: Implemented "Press START to Remap" flow to prevent accidental overrides.
- **[Tuning]** **Combat & Balance**:
    - **Neutral Light**: Refactored to a single snappy hit for faster combat.
    - **Chests**: Drastically reduced spawn rate for tactical discovery.
- **[S]** **STATUS**: Visual fidelity and UI flows refined for production.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-03-02] v1.2.2 - Keyboard Overhaul & UI Polish ⌨️✨
- **[V]** `v1.2.2`
- **[Feat]** **Keyboard Remapping**:
    - **Remap Submenu**: Added a full **TASTIERA** remap screen in IMPOSTAZIONI.
    - **Listening Flow**: Implemented a "PREMI..." listening flow for physical keypress rebinding.
    - **Persistence**: Keyboard mappings are now saved to `localStorage` via a new `KeyboardMapping` singleton.
- **[Refactor]** **Input Simplicity**:
    - **Split Keyboard Removal**: Removed the P2 arrow-key split mode. Keyboard now always joins as a single player using 'all' mappings (WASD + Arrows both work for movement).
    - **Routing**: Streamlined `InputManager` to use dynamic key lookups instead of hardcoded keycodes.
- **[UI]** **Legend Polish**:
    - **Controls Overlay**: Updated the `F1` legend to a cleaner 2-column layout (Tastiera/Gamepad).
    - **Pause Menu**: Updated the commands page with dynamic labels and removed P2 keyboard references.
- **[Fix]** **Build Integrity**:
    - **Type Safety**: Fixed a `keyboardMapping` type mismatch in `Player.ts`.
- **[S]** **STATUS**: Keyboard input fully rebindable and localized. Ready for production.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-03-02] v1.2.3 - Keyboard Remap Fixes 🛠️
- **[V]** `v1.2.3`
- **[Fix]** **Keyboard Remap Stale State**: Properly reset `kbTexts`, `kbValueTexts`, and `kbOptions` in `create()` to prevent ghost menu items on scene restart.
- **[Feat]** **UX Improvements**:
    - **ESC to Cancel**: Added the ability to cancel rebinding by pressing Escape.
    - **Enter/Space Support**: Allowed binding actions to Enter and Space by ignoring `event.repeat`.
- [S] **STATUS**: Keyboard remapping is now stable and fully functional. Release confirmed.
------------------------------------------------------------------------------------------------------------------------------------
### [2026-03-03] v1.2.4 - Gamepad Profiles, Taunts & Match Flow 🎮🎭
- **[V]** `v1.2.4`
- **[Feat]** **Gamepad Profiles**:
    - **Per-Slot Customization**: Added independent button remapping for two gamepads in local play. Settings UI now features **GAMEPAD 1** and **GAMEPAD 2** tabs, mapping slot 0 and 1 automatically in the Lobby based on join order.
- **[Feat]** **Taunt Overhaul**:
    - **Unified Atlas**: Replaced standalone character taunts with a unified 18-frame taunt atlas.
    - **Dedicated Animations**: All characters now have dedicated taunt animations (Fok: 8 frames, Sgu/Sga/Pe/Nock/Greg: 2 frames). Slowed down Sga's loop to 2fps for better pacing.
- **[Feat]** **End of Match Flow**:
    - **Unskippable Taunt Window**: Eliminated the hard page reload on match end. Added a 5-second unskippable delay to watch the winning player's taunt.
    - **In-Game Menu**: After the delay, a seamless UI menu offers **RIVINCITA** (instant rematch) or **TORNA ALLA LOBBY** (maintain controller assignments), fully navigable via D-Pad or Keyboard.
- **[Fix]** **Nintendo Switch Controller**:
    - **Button Mapping**: Removed manual A/B X/Y swaps in `GamepadInput`. The standard API already maps buttons by physical position on macOS, fixing reversed inputs for Switch Pro controllers.
- **[S]** **STATUS**: Competitive UX significantly improved. Match flow is seamless and celebratory.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-03-09] v1.2.5 - Hotfix: Physics Stability
- **[V]** `v1.2.5`
- **[Fix]** **Ground Pound Clipping**:
    - **Collision Pipeline**: Modified `PhysicsSimulation.ts` to calculate a dynamic `PLATFORM_SNAP_THRESHOLD` based on downward velocity (`body.vy`). This prevents characters from falling so fast during a ground pound that they completely bypass the 45px floor thickness check in a single frame.
- **[S]** **STATUS**: Major clipping bug resolved. Stability restored.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-23] v1.3.0 - Zero-Lag Rollback Netcode & Engine Performance Overhaul ⚡🥋
- **[V]** `v1.3.0`
- **[Feat]** **Deterministic GGPO Rollback Netcode**:
    - Replaced the broken snapshot interpolation system (`RENDER_DELAY_MS = 60`) with true client-authoritative Rollback netcode.
    - **0ms Local Latency**: Local inputs execute immediately on Frame 0, exactly matching offline local play.
    - **RollbackBuffer**: Pre-allocated 128-frame circular ring buffer (`StateSnapshot.ts`) with $O(1)$ constant-time lookup and restoration.
    - **Sub-0.05ms Resimulation**: Pure-math physics loop re-simulates 40 frames of rollback in 0.055ms (<0.3% of a 16.6ms frame budget).
    - **10-Byte Compact Binary UDP Codec**: Encodes 16 button inputs into a uint16 bitmask (`NetworkProtocol.ts`) with 3-frame redundancy (`[frame: uint32, maskN, maskN-1, maskN-2]`), eliminating UDP packet loss drops.
- **[Refactor]** **Engine Frame Pacing & GC Elimination**:
    - **VSync Restored**: Removed `forceSetTimeOut: true` from `main.ts`, restoring browser `requestAnimationFrame` with `smoothStep: true`.
    - **Hitbox Bounds Pooling**: Pooled `_boundsRect` inside `Hitbox.getBounds()`, eliminating 240+ heap allocations per second.
    - **PlayerHUD Dirty Checking**: Added dirty check in `PlayerHudSlot.update()`, halting redundant canvas text re-renders on unchanged damage.
    - **Scene Memory Leak Fix**: Replaced anonymous arrow listeners in `DialogueScene.ts` with named methods and added explicit `shutdown()` unbinding for all keyboard/gamepad events.
    - **PlayerAI Allocation Fix**: Pre-allocated reusable input structure and replaced full scene tree filtering with `scene.getPlayers()`.
- **[Quality]** **Comprehensive Technical Audit**: Published [`docs/PERFORMANCE_AND_CODE_AUDIT.md`](../docs/PERFORMANCE_AND_CODE_AUDIT.md) rating code quality, GC hotspots, determinism, and architecture.
- **[S]** **STATUS**: Online multiplayer revived to tournament-grade responsiveness.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-24] Netcode rebuild, step 1 - Fixed 60 Hz simulation tick (branch `netcode-rebuild`, unreleased)
- **[Fix]** **Frame-rate independent gameplay**: `GameScene` advances gameplay in fixed 1/60 s steps through `shared/FixedStepClock.ts` instead of once per rendered frame. Since v2.3.0 removed `forceSetTimeOut`, 120 Hz screens ran horizontal movement at half speed (416 instead of 822 px/s top run speed).
- **[S]** **Verified**: with the game loop forced to ~30, ~60, ~120 and ~144 Hz, the game runs ~60 steps/s with bit-identical per-step physics (821.554 px/s after 30 steps, 241.889 px jump height).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-24] Netcode rebuild, step 2a - Shared simulation core and replay tests (branch `netcode-rebuild`, unreleased)
- **[Refactor]** **Stage geometry single-sourced**: `StageFactory` now builds its collision boxes from `STAGE_LAYOUT` in `shared/StageData.ts`. The previous shared copy had drifted from the game (walls off by 30-50 px, left platform by 25 px).
- **[Feat]** **`shared/GameSim.ts`**: deterministic, plain-data simulation of fighter movement, input buffering, the state machine and timers. Combat comes next.
- **[Feat]** **Replay tests** (`npm test`): a match recorded in the game with `?record` in the URL (F9 saves it to `tests/replays/`) is replayed through `GameSim`, and every fighter's state must match the recording at every step. First replay: 2,108 steps of movement, identical.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-24] Netcode rebuild, step 2b - Combat in the simulation (branch `netcode-rebuild`, unreleased)
- **[Feat]** **`shared/Combat.ts`**: light attacks, charged signatures and their ghost projectiles, ground pound, recovery, hitboxes and hits, ported from `PlayerCombat`. Knockback directions come from a table of exact values, so every browser computes identical knockback.
- **[Refactor]** Fighter data, input buffer and state machine moved to `shared/FighterState.ts`.
- **[S]** **Verified**: two new recordings replay exactly, including a 16 s fight against the CPU with 9 hits (a side signature, a ground pound, lights).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-25] Netcode rebuild, step 2c - KOs, respawn and game over in the simulation (branch `netcode-rebuild`, unreleased)
- **[Feat]** **KOs in `GameSim`**: a fighter whose hurtbox crosses a blast zone loses a life and sits out 2 s, then drops in above the stage centre with 1 s of invulnerability and 1.5 s of blast-zone immunity, the same durations as the game but counted in steps. The match ends when at most one fighter has lives left.
- **[Feat]** **Seeded random generator** in the match state picks the respawn offset (±50 px) instead of `Math.random`. Recordings now carry the seed.
- **[Refactor]** Removed the simulation's `Respawning` state, which nothing entered.
- **[S]** **Verified**: `tests/match.test.ts` covers KO timing, seeded respawn points, blast-zone immunity, wins and draws; the three recordings still replay exactly. The game keeps its own KO code until local play moves onto the simulation (step 2d).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-25] Netcode rebuild, step 2d-1 - Old online mode retired (branch `netcode-rebuild`, unreleased)
- **[Refactor]** Deleted `OnlineGameScene`, `NetworkManager`, `StateSnapshot`, `BinaryCodec` and `shared/NetworkProtocol.ts`, and removed "BOTTE IN REMOTO" from the main menu. The old online mode runs on the per-player gameplay code that local play is about to replace, and it was not playable. Online play returns in step 4 on the shared simulation; `main` keeps the old version. The Geckos server is untouched.
- **[S]** **Verified**: typecheck and tests pass; the menu and a local training match start with no console errors.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-25] Netcode rebuild, step 2d-2 - Local play runs on the shared simulation (branch `netcode-rebuild`, unreleased)
- **[Refactor]** **`GameScene` steps `GameSim`**: each fixed step reads every player's input (keyboard, gamepad, touch or CPU), advances the match and plays the step's events: sounds, signature ghosts, hit flashes, camera shakes, KOs and respawns. `Player` only draws its fighter from the simulation state, and the CPU reads the simulation too.
- **[Refactor]** Deleted the per-player simulation: `PlayerPhysics`, `PlayerCombat`, `Fighter`, `TrainingDummy`, the 17 state classes, `Attack`, `Hitbox`, `DamageSystem` and `InputBuffer`. The simulation's unreachable `Win` and `Cinematic` states are gone too; `movement-basics.json` was re-encoded for the new state numbering after checking every step against the old one.
- **[Change]** Chests and bombs are off on this branch until they move into the simulation (`Chest` and `Throwable` deleted), and Matter.js is no longer loaded. A rematch starts a fresh match at the spawn points instead of dropping everyone at the stage centre. Campaign cutscenes pause the match and place the fighters through the simulation.
- **[S]** **Verified**: typecheck, production build and `npm test` (10 tests). In the browser: training, versus against the CPU, KOs, respawns, game over and rematch, pause, the Q debug view, a CPU added mid-match, and the campaign's intro, mid-fight and victory cutscenes. A match recorded in the browser (CPU hits, 3 KOs, 2 respawns, game over; 1,763 steps) replays exactly in Node.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-25] Netcode rebuild, step 4 - Lockstep online play (branch `netcode-rebuild`, unreleased)
- **[Feat]** **Online 1v1 in delay-based lockstep** (`shared/Lockstep.ts`): both clients run the whole match on `GameSim` and simulate a frame only once both players' inputs for it have arrived. Inputs are sampled a few frames ahead (the input delay, which the server picks from both pings), and every packet repeats the inputs the other side hasn't acknowledged, so a lost packet needs no resend. A checksum of the full match state every second flags any disagreement; the stats line (Q) shows input delay, stalls, packet loss and sync.
- **[Feat]** **"BOTTE IN REMOTO" is back** with a new online lobby: connect, wait for an opponent, pick a character, ready. Rematch and leaving work; an online match can't pause, so ESC leaves it.
- **[Refactor]** **Server rewritten as lobby and relay** (`server-geckos/index.ts`, 677 lines down to about 200): it pairs players two by two, starts matches with a random seed and the input delay, forwards input packets, and rejects clients with a different protocol version. Control messages are sent reliably.
- **[Feat]** **Testing aids**: `?lag=50&jitter=10&loss=5` adds network conditions to a client, `?anyfocus` keeps reading input in an unfocused window, and `tests/online.html` shows two clients side by side against the local server.
- **[S]** **Verified**: `tests/lockstep.test.ts` plays two peers over a simulated network (clean; 100 ms ping with jitter, 5% loss and a late start; 30% loss) and checks their matches are identical after every frame, and that a tampered copy is caught. In the browser, two clients through the local server at 100 ms ping, ±10 ms jitter and 5% loss played a full match (8,731 frames) with zero desyncs, 1.2% of frames waiting for input, and byte-identical final states. Rematch, leaving and the version check work. Not yet tested between two machines, or against the production server, which still runs the old server code.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-25] Netcode rebuild, step 5 - Rollback (branch `netcode-rebuild`, unreleased)
- **[Feat]** **Rollback replaces lockstep** (`shared/Rollback.ts`): each client simulates right away with its own input and a guess of the opponent's (their last input, minus new presses). When the real input differs, the match goes back to the state saved before that frame and is simulated again. Sounds and effects already played are not replayed, but those that only happen in the corrected frames are. Game over only counts once its frame is confirmed.
- **[Feat]** **Staying level**: a client more than 8 frames past the opponent's inputs waits, and a client running ahead of the other skips an occasional frame (each side sends its frame advantage). The server now picks a shorter input delay (1 to 3 frames, about half the one-way trip); protocol version 2.
- **[Change]** The stats line (Q) shows input delay, last and largest rollback, waits, skips, packet loss and sync. Online matches are not recorded, since their frames can be simulated more than once.
- **[S]** **Verified**: `tests/rollback.test.ts` plays two peers over a simulated network and checks every frame both confirmed is identical on both (clean; 100 ms ping with jitter, 5% loss and a late start; 30% loss), plus tamper detection and that a restored copy of the match continues exactly like the original. In Node at 100 ms ping and 5% loss, rollbacks average 2.6 frames (at most 7) with no waits, at about 30 µs per step. In the browser, two clients through the local server at 100 ms ping, ±10 ms jitter and 5% loss played a full match (5,490 frames) with zero desyncs, rollbacks of at most 6 frames, no waits, and byte-identical final states; a rematch and 200 ms ping (rollbacks up to 6, no waits) also stayed in sync. Not yet tested between two machines.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-25] Server address moved to 138.68.126.112 (branch `netcode-rebuild`, unreleased)
- **[Deploy]** The DigitalOcean droplet was restored from its snapshot at a new address, `138.68.126.112`. The deploy scripts, the nip.io HTTPS script and the packaged app's fallback server address now point there. The droplet still runs the old game and server from `main`.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-25] Online matches of up to 4 players (branch `netcode-rebuild`, unreleased)
- **[Feat]** **2 to 4 players online**: rollback (`shared/Rollback.ts`) now handles any number of players: guesses, corrections, frame advantage and checksums are kept per player, and a player waits for, or slows down to, the furthest one behind. Packets carry the sender's slot plus an acknowledgement and an advantage for every other player; protocol version 3.
- **[Feat]** **Rooms**: the server puts new players in the open room (up to 4) and starts the match once everyone in it, at least 2, is ready. It relays each player's packets to all the others and picks the input delay from the two furthest players. If anyone leaves mid-match, the match ends for everyone. The online lobby lists the room's players, their characters and who is ready.
- **[Fix]** `deploy_server.sh` pushes the current branch from this machine to the droplet over SSH, since the droplet can't pull from the now private GitHub repository.
- **[S]** **Verified**: `tests/rollback.test.ts` runs 2, 3 and 4 players over the simulated network (4 players at 100 ms ping, ±10 ms jitter, 5% loss and staggered starts: rollbacks average 2.6 frames, at most 5, no waiting) and checks every confirmed frame is identical for all. In the browser, four clients through the local server at 100 ms ping and 5% loss played a full match (4,074 frames) with zero desyncs and byte-identical final states; the four-way rematch, a player leaving, and 1v1 through the new rooms also work.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-25] Online rebuild deployed (branch `netcode-rebuild`)
- **[Deploy]** The droplet at `138.68.126.112` runs `netcode-rebuild` at `0f988cd`: online matches of up to 4 players in rollback, protocol 3. Checked: the server's health page reports protocol 3 and the site serves the new build. Not yet played between separate machines.
- **[Docs]** The GitHub repository is public again. `deploy_server.sh` keeps pushing the branch from this machine straight to the droplet, so a deploy doesn't depend on what is on GitHub; its comment now says so.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] v3.0.0 - Lighting experiment and Studio Lab (branch `lighting-experiment`)
- **[Feat]** **Studio Lab** in the main menu: Fok and a dummy on Londra with the new lighting, a panel to tune it (H), lights on/off (G), draggable lights, a whole-stage view, settings saved in the browser and copied as JSON.
- **[Feat]** **Lighting without normal maps** (`src/lighting/`): lit sprites with ambient, per-light fill and a rim light found from the sprite's edges (none on feet standing on a floor or on platform undersides), light orbs and glows drawn behind or in front of the stage or fighters, flashes on hits, KOs and respawns. Lab only for now.
- **[Feat]** **Camera pass** at quarter resolution: bloom, sun rays blocked by what's in front, mist, exposure, temperature, grain, colour fringes, tilt-shift and a CRT mode. Preset baked from the user's settings.
- **[Feat]** Contact shadows under fighters and see-through glowing attack ghosts in every match.
- **[Fix]** **Judder on 120 Hz screens**: the camera moved every drawn frame while fighters move 60 times a second; it now moves once per step, and `FixedStepClock` counts whole display frames so steps land on an even beat.
- **[S]** Verified: 17 tests pass; cadence simulation with measured timer noise shows no irregular steps at 60 or 120 Hz (before: up to 81 a minute at 60 Hz); GPU per frame on the user's Mac at 1080p 1.17 ms lights off, 3.20 ms default look.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] v3.0.1e - Experimental version (branch `lighting-experiment`)
- **[Release]** The experimental version is v3.0.1e: the official release plus the lighting experiment, the Studio Lab and the campaign. Runs locally.

### [2026-09-26] Smooth play on 120 Hz screens (branch `netcode-rebuild`)
- **[Fix]** **Judder and ghosting on 120 Hz screens**: the camera eased toward the fighters on every drawn frame while they move 60 times a second, so at 120 Hz they jittered against it. The camera now moves once per simulation step, and `FixedStepClock` counts whole display frames so steps land on an even beat despite noisy browser timestamps.
- **[S]** Verified: 17 tests pass; a cadence simulation with measured timer noise shows no irregular steps at 60 or 120 Hz (before: up to 81 a minute at 60 Hz), and the clock keeps real time.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] Campaign hidden from the release (branch `netcode-rebuild`)
- **[Change]** The main menu no longer offers CAMPAGNA: the campaign is a work in progress and lives on the experimental branch (`lighting-experiment`). Its code stays in place.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] v3.0.1 - Official release (branch `netcode-rebuild`)
- **[Release]** The official release is v3.0.1: 4-player online in rollback, smooth play on 120 Hz screens, campaign hidden while it's a work in progress. Live on the droplet.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] Deep clean (branch `experimental-branch`, checkpoint tag `checkpoint/deep-clean`)
- **[Refactor]** **Dead code out**, found with the TypeScript compiler's reference search: unused simulation functions (`copyBody`, `cloneBody`, `doJump`, the old per-wall/per-platform/blast-zone checks, `setDropThroughY`), unused fighter fields (`jumpHoldTime`, `wallTouchesExhausted`, `isThrowCharging`, a second `damagePercent`/`lives`), 57 unused tuning constants, the attacks' unused `knockback`/multi-hit fields, and unused methods in input, HUD, pause menu, overlays and dialogue. Physics steps write their events into a reused list instead of allocating one per call. Timings named `*_FRAMES` that were milliseconds are now `*_MS`.
- **[Refactor]** **`GameScene`**: typed scene data and player slots, the campaign cutscenes share one dialogue player, and shutdown removes every listener it added. `GamepadPresses` gives the match's menus one "just pressed" check for all pads; it fixes the game-over menu skipping entries while the D-pad is held. `EffectManager` is only the ghost pool now. `StageFactory` rewritten with the same layout.
- **[Perf]** **Stage backgrounds load per match**: each painting is 9862×8263 (about 330 MB of video memory), and the lobby and every match loaded all four. A match now loads only its own stage and frees the others; the lobby shows 1000 px previews (40 to 80 KB each).
- **[Perf]** **Build halved, 81 MB to 41 MB**: unused files are out of `public/`: the 134 chest-reward images, chest items and sounds, old platform art, the old Fok atlas, and the old title image, video and music (an 8.5 MB WAV, twice). They remain in git history, e.g. `git checkout 1177079 -- public/assets/scrins`. Phaser is its own chunk (1.2 MB), so browsers keep it cached across game updates.
- **[Fix]** **Online lobby**: leaving while it was still connecting threw an error and left you stuck on "CONNESSIONE...", and the abandoned connection went on to join a room. A failed connection now also shows its message. (The release has the same bug.)
- **[Fix]** The desktop app's dev mode pointed at the wrong port, and a hidden window slowed the game down (bad for online matches).
- **[Change]** Protocol version 4: the match state lost unused fields, so its checksum no longer matches the release's; the two builds can't meet online.
- **[Refactor]** **Project**: the old JavaScript server and its Docker/Fly.io files are gone (the droplet runs `index.ts` with tsx), unused packages are removed (`socket.io`, `socket.io-client`, snapshot interpolation), the server has `npm run typecheck`, and one script packs any character's atlas (`scripts/pack-character.cjs`) instead of three copies.
- **[Docs]** `LLM_CONTEXT.md` rewritten for the game as it is now, a new `README.md`, and the agent rules updated; removed an outdated audit and six skill packs for other stacks (React, React Native, Vercel).
- **[S]** Verified: game and server typecheck, 17 tests pass (the recorded replays play out identically), production build. In the browser: main menu, lobby previews, a training match (only its stage loaded, every asset request 200), dummy toggle, pause, game over menu, rematch, Studio Lab, the campaign intro cutscene, and the online lobby against the local server (leaving mid-connect, connecting, leaving).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] Brawlhalla movement, first pass (branch `experimental-branch`)
- **[Feat]** **Dash and dash jump**: on the ground, dodge + direction dashes (1500 px/s for 150 ms, not invincible, no dodge cooldown). A jump, attack or spot dodge cancels it, dashing back the other way is immediate, and a jump out of a dash is low and fast and coasts. Running on after a dash starts at dash speed.
- **[Feat]** **Dodges as in Brawlhalla**: a spot dodge on the ground; in the air a spot dodge or a dodge in any of 8 directions that floats for 200 ms. Cooldown 1 s after a grounded dodge and 2.7 s after an air dodge, which landing shortens to 1.25 s after it. Dodges show see-through while they're invincible.
- **[Feat]** **Chase dodge**: after landing a hit, a directional dodge until 200 ms after the attack ends cuts the attack short, costs no cooldown (2 in the air before landing), is invincible for its first 150 ms, and an attack cancels it into the aimed move.
- **[Feat]** **Gravity cancel**: an attack out of an aerial spot dodge is the grounded move, done in the air; that dodge's cooldown stays the full air cooldown.
- **[Feat]** **Falling**: falls stop accelerating at 1800 px/s; holding down while descending fast falls at once (at least 1100 px/s, up to 2200 px/s) and releasing eases back.
- **[Feat]** **Walls and air actions**: touching a wall gives back the air jumps and the recovery; after 9 air jumps, wall jumps and recoveries without landing, hitting or being hit, walls stop holding the fighter (wall slip).
- **[Fix]** **Hitstun takes control away**: a stunned fighter could jump (cancelling the knockback), dodge and steer. Being hit also stops a dash, dodge, fast fall, wall slide or recovery (a hit recovery kept its hitbox), and gives a fighter out of jumps one back.
- **[Fix]** A light attack could be dodge cancelled while its hitbox stayed out, an invincible attack; attacks, charges and the recovery can now only be left by a chase dodge after a hit.
- **[Change]** Protocol version 5. `npm run replays:update` stores the recordings' new outcomes after an intentional gameplay change.
- **[S]** Verified: `tests/movement.test.ts` (16 tests, one per rule) and the other 17 tests pass after updating the replays; typecheck and build. In the browser through the keyboard: dash, dash jump, up air dodge, fast fall, the landed air dodge cooldown, a light attack into a chase dodge into a side light, and a gravity-cancelled neutral light, with no errors.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] Londra in layers for the Studio Lab (branch `experimental-branch`)
- **[Feat]** **Layered Londra** (`src/stages/LondraLayers.ts`): the Studio Lab no longer loads the 9862x8263 painting. It draws a sky gradient in the engine (5 colours measured from the painting), clouds behind the island, the floating island, and clouds in front of its waterfall, each layer scrolling at its own rate (sky 0.75, back clouds 0.8, island 0.86, front clouds 0.93). The clouds are 5 pieces repeated across three canvas widths, drifting slowly and wrapping round. About 21 MB of graphics memory and 570 KB to download, against 330 MB for the painting; same GPU time.
- **[Feat]** **SKY section in the Studio Lab panel**: the gradient's 5 colours and the clouds' drift, saved with the other settings and included in Copy settings.
- **[Feat]** `scripts/londra-layers.py` rebuilds the layers from the artwork: the island trimmed and halved, and the cloud pieces cut out, scaled to 0.45 and packed into one atlas.
- **[Fix]** The main menu video was deleted by the deep clean along with unused files in its folder; restored.
- **[S]** Verified: typecheck, 33 tests, build. In the browser: the Studio Lab loads only the layers (no painting), lit and unlit views match the painting's composition, the drift wraps evenly after an hour, and there are no errors.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] Studio Lab: stage layers and lights behind them (branch `experimental-branch`)
- **[Feat]** **STAGE section**: the layered stage's elements (sky, back clouds, island, front clouds) in a list, front at the top, with the platforms and fighters as a fixed entry. Send back / Bring forward reorders them, and past the platforms and fighters an element is drawn in front of them. Each has visibility, position (sliders, or a square on screen to drag), size, parallax, opacity, rim strength, and drift for the clouds.
- **[Feat]** **SKY GRADIENT section**: every colour of the gradient with its height, plus adding and removing colours.
- **[Feat]** **Lights behind a layer**: a light's glow can go behind the back clouds, the island or the front clouds, following the order set in STAGE. It then sits at that layer's depth and scrolls with it, and the layer blocks it: the island turns into a silhouette the light outlines, and the sun's rays are blocked by it. The light rings drag by screen distance, so they follow the pointer at any parallax.
- **[Feat]** **Scenery lighting**: the island and clouds are lit like the sky was (sky ambient and each light's sky setting, so the look is unchanged) plus a rim; a light behind an object lights its whole outline instead of its face (`LitPipeline`: per-object rim strength and lights-behind flags).
- **[Change]** The island texture has a 4-texel empty border, so its outline stops at its edges.
- **[S]** Verified: typecheck, 33 tests, build. In the browser through the panel: the sun behind the island (outline and silhouette), reordering the front clouds in front of the fighters and back, dragging the island (100 screen px at zoom 1.5 moved it 67 world px), adding and removing gradient colours, saving and Reset all. GPU per frame in the test browser: about 3.3 ms, 4.3 ms with a light behind the island while it fills the screen.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] Studio Lab: three panels, resets, frame statistics (branch `experimental-branch`)
- **[Feat]** **Three panels** instead of one: LIGHTS (lights, ambient, light strengths, flashes, ghosts), CAMERA (bloom and rays, grading and lens, CRT) and STAGE (layers and sky gradient). Each is styled like the in-game debug panel, moves by dragging its title bar, folds with a click on it, and has Copy settings and Reset panel. H hides them all.
- **[Feat]** **A reset (↺) on every slider and colour**: look and ghost settings go back to the lab's defaults, lights to the rig's light in the same place (or a new lamp's values), stage elements to their defaults, and sky colours to the default gradient's colour at the same place.
- **[Feat]** **Frame statistics** on the canvas, top left, beside the FPS panel when Q shows it: lights on or off, frame rate and the slowest frame's, frame time and its worst, CPU drawing time, GPU time, WebGL draw calls and triangles, objects shown, total and lit, stage lights and flashes, and texture memory, coloured green, yellow or red against a 60 Hz budget.
- **[Refactor]** The lab is split into `src/lighting/lab/` (UI helpers, one file per panel, the statistics) with `LightLab.ts` keeping settings, handles and wiring.
- **[S]** Verified: typecheck, 33 tests, build. In the browser: the three panels and statistics, 67 reset buttons, a slider's reset restoring its default, the statistics moving beside the FPS panel with Q, no errors.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] v3.0.2e - Brawlhalla movement, layered Londra, Studio Lab panels (branch `experimental-branch`)
- **[Release]** The experimental version is v3.0.2e: the first pass of Brawlhalla movement (dash and dash jump, 8-way air dodges, chase dodge, gravity cancel, fast fall, wall rules, real hitstun), Londra drawn in layers with an engine sky, and the Studio Lab's LIGHTS, CAMERA and STAGE panels with lights behind layers, per-setting resets and frame statistics. Protocol version 5. Entries above.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] Experimental version on the droplet (branch `experimental-branch`)
- **[Deploy]** `deploy_experimental.sh` (was `deploy_campaign.sh`) builds `experimental-branch`, publishes it at http://138.68.126.112:8080 in place of the old campaign build, and runs its own game server on port 9209 (PM2 `geckos-experimental`, from a separate clone), next to the release's on 9208. It refuses to run from another branch or with uncommitted changes.
- **[Change]** The client connects to game server 9209 when the page is served on port 8080, else 9208.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-26] v3.0.3e - Feel pass: hitstop, flying stun, bounces, effects, menu input, campaign flow (branch `experimental-branch`)
- **[V]** `v3.0.3-e`. Protocol version 6 (simulation state and rules changed).
- **[Feel]** **Hitstop**: both fighters freeze 3 to 9 steps per hit, scaled by damage; presses during it are buffered. Deterministic, so it works online.
- **[Feel]** **Stun while flying fast** (Brawlhalla's rule): hitstun lasts while the fighter moves faster than 1300 px/s, up to 1.5 s. Stunned fighters bounce off floors and walls when they hit them fast.
- **[Balance]** Knockback and KO pass after the stun change, measured with `npm run balance` (`scripts/ko-table.mts`, lowest KO damage per move): neutral heavy growth 8 → 3.6, side heavy 9.5 → 10.5.
- **[Feel]** **Rest of Brawlhalla movement**: a weaker second recovery after the first (costs a jump, 0.6 push), holding down drops through soft platforms, a short landing recovery (4 steps) after air landings.
- **[Visual]** Hit sparks sized by damage (ring on heavy hits), camera kick on hard hits, KO shake and zoom punch; subtle dust on dashes and landings, afterimages behind dashes and chase dodges, rings on air jumps; HUD damage colour ramp white → deep red, number pop and a damped portrait shake on hits.
- **[Fix]** **Collision**: the two platform undersides were side walls and shoved fighters jumping up into them about 130 px sideways; they are now ceilings (push down only; stunned fighters bounce).
- **[Fix]** **Timers count whole frames** (`countDown` in `FixedStepClock`): a 300 ms timer now lasts 18 steps, not 19.
- **[Refactor]** **One menu input** (`src/input/MenuInput.ts`) for keyboard and every gamepad, with held-button guarding and direction repeat, used by all menus (main, save files, campaign map and title, pause, game over, credits, preload, online lobby, dialogue, lobby, settings).
- **[Refactor]** **Campaign flow out of GameScene**: `src/scenes/CampaignFlow.ts` holds the opponent setup, colour drain and return, cutscenes, retry and practice prompts and map/credits transitions; GameScene is ~1200 lines, down from ~1600.
- **[Art]** Londra (Studio Lab) uses the new cloud sheet `Londra_Clouds_V2`: five clouds cut at native resolution, cloud scale 0.39.
- **[S]** Verified: typecheck, 43 tests (26 movement tests incl. hitstop, stun, bounces, drop-through, landing lag, ceilings, exact timer lengths), replays re-baselined, build. Campaign flow tested by the user.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-27] Studio Lab: FEEL mode, every gameplay setting live (branch `experimental-branch`)
- **[Feat]** **Two Lab modes**, ESC switching (a LOOK / FEEL switch at the bottom too): LOOK is the lights, camera and stage panels as before; **FEEL** tunes the gameplay while you play. In the Lab, M or the gamepad's Start opens the pause menu (P is taunt); H hides the panels.
- **[Feat]** **MOVEMENT and COMBAT panels**: every `PhysicsConfig` setting (about 130, in 23 sections) with a plain label, a hover hint with its default, a slider, a box for an exact value, ↺ reset, and yellow while changed. Durations show how many 16.7 ms steps they last.
- **[Feat]** **MOVES panel**: each move's damage, base knockback, growth, angle, startup, active, recovery, hitbox size and position, and air stall. "Follow my moves" selects the move Fok just used; its hitbox (or a signature's ghost: start, end with no charge and at full charge) and knockback angle are drawn on Fok.
- **[Feat]** **TEST panel**: game speed (slow motion), freeze (F), next step (N), restart (R), dummy damage with hold, dummy fights back, infinite lives, hitboxes; a readout of the last hit (move, damage, knockback, angle, hit-stop, stun length) and live state; jump, short hop, air jump, top speed and dash distance measured by running the simulation off screen with the current settings; a find box across all panels; the screen effects (camera kick, shakes, sparks, dust, rings, afterimages, from the new `EffectConfig.ts`).
- **[Feat]** **Copy changes** puts only what differs from the defaults on the clipboard as JSON, ready to paste to Claude to make defaults (Shift-click: every value); Paste applies a set; changes are kept in the browser. Lab panels remember where they were moved and whether they're folded.
- **[Refactor]** Hard-coded feel numbers are now named settings, with the same values: signature ghosts (offsets, travel, lifetime, fade), ground pound (fall speed, damage, knockback bonuses, landing), the recovery hit, signature knockback bonuses, run attack, attack cooldowns, respawn, input buffer, hurtbox. The light and ground-pound hitbox overrides are now each move's own numbers; the unused up-signature hitbox settings are gone. Replays unchanged, so the game plays exactly as before.
- **[Safety]** Tuned values live only in the Lab: every other match starts with `resetTuning()`, so online matches always use the defaults (no protocol change).
- **[S]** Verified: typecheck (client and server), 47 tests (new: tuning resets fully, pasted settings skip unknown names, every setting is in the FEEL panels), build. In the browser: live damage change applied to the next hit, readouts, restart, copy, paste, freeze and step, slow motion at a quarter speed, find, ESC and M, and a versus match after the Lab back on the defaults.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-27] Studio Lab: windowed view and its own pause menu (branch `experimental-branch`)
- **[Feat]** **Windowed view**: the game sits in the middle and the panels dock in a column either side (FEEL: TEST and MOVEMENT left, MOVES and COMBAT right; LOOK: LIGHTS left, STAGE and CAMERA right). Full screen with floating panels stays as before. Switched from the Lab's menu or the WINDOWED / FULL SCREEN button on the mode bar, and remembered.
- **[Feat]** **ESC opens the Lab's pause menu** again (M no longer needed), with Lab entries: RESUME, MODE (LOOK / FEEL), VIEW (windowed / full screen), PLAYER and DUMMY (left / right picks any character; the Lab restarts with them on resume and remembers them), RESTART MATCH, CONTROLS, SETTINGS, EXIT TO MENU. Full screen, the panels step aside while it's open.
- **[Change]** **TAB** switches LOOK and FEEL.
- **[S]** Verified: typecheck, 47 tests, build. In the browser at 1512×900: the windowed layout and the game fitted between the columns, TAB, the menu's entries, switching the view from it, changing the dummy to Sga and resuming into a match with Sga, still windowed; leaving the Lab gives the main menu the full screen back.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-27] v3.0.4e - Studio Lab FEEL mode, windowed view, Lab menu (branch `experimental-branch`)
- **[Feat]** Windowed view: the Lab's frame statistics leave the canvas for a **PERFORMANCE** strip in a band above the game, between the columns (full screen keeps them top left in the frame).
- **[V]** `v3.0.4-e`: the FEEL mode, the windowed view and the Lab's pause menu (entries above). No simulation rule changes: protocol version 6.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-28] CORSA: an Outrun-style car mini-game (branch `experimental-branch`)
- **[Feat]** **CORSA** in the main menu: cruising an endless coastal highway in Fok's car. Pseudo-3D road built from segments, with bends, hills, four lanes, rumble strips and haze into the distance; palm rows, bend signs, rocks, bushes and billboards whizzing by; a banded 16-bit sky with blocky clouds and two mountain ranges sliding with the bends. All drawn on a 480x270 canvas scaled up 4x with hard pixels.
- **[Feel]** Acceleration that fades through the gears (top speed 293 km/h in about 6 s), steering that eases in and turns more with speed, bends pulling the car outwards (easy and medium ones flat out, hard ones need a lift), grass drag, crashes into roadside things, bumps into slower traffic (30 placeholder cars). Car lean and bounce, dust off the road, screen shake on crashes and rough ground, speed lines flat out, and a synthesised engine that climbs through five gears plus wind noise.
- **[Feat]** HUD: time, distance, speed with a segmented rev bar. Keyboard (Up/W/J, Down/S/K, Left/Right/A/D), gamepad (analogue RT/LT, A, X, stick or D-pad). ESC or Start pauses: RIPRENDI, RICOMINCIA, TORNA AL MENU.
- **[Arch]** `src/minigames/racing/`: the track and race rules are plain data stepped at 60 Hz with a seeded generator, so a multiplayer race can share them later. Scenery, traffic and backdrop are placeholder blocks; `scripts/racing-car.py` makes the temp car (`public/assets/racing/car_temp.png`, 112x82 game pixels).
- **[Clean]** The old hidden racing prototype (`RoadEngine.ts`) is replaced.
- **[S]** Verified: typecheck, 50 tests (new: same seed same race, top speed, grass drag), build. In the browser: 20 s flat out without crashes, traffic, pause menu and back to the main menu, 60 fps, no errors.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-28] CORSA: smoother, calmer, more precise driving (branch `experimental-branch`)
- **[Fix]** **No more flicker**: frames are drawn part of the way between the 60 Hz steps (`FixedStepClock.stepShare`), so 120 Hz screens get smooth motion instead of each step shown twice; the screen shake, car bounce and rough-ground knocks follow smooth curves instead of random numbers each frame; speed lines are streaks that glide outwards and fade; the sky slides per step, not per frame; rumble strips and grass bands alternate more slowly and more subtly.
- **[Fix]** **Crisp car pixels**: the car is no longer rotated (rotating pixel art shears it); it shifts a pixel or two with its sideways speed.
- **[Change]** **A touch slower**: top speed down by a fifth (260 km/h on the dial), reached in about 7 s (half speed in 1.9 s).
- **[Feel]** **Driving model**: sideways momentum and tyre grip (less on the grass), steering that eases in and recentres faster, quick at low speed and calmer flat out, analogue-precise; bends push the car out by speed. Glancing a roadside thing bounces the car off with a speed loss; only square hits stop it. Rear-ending traffic slows the car to its speed and nudges it aside.
- **[Feat]** **Slipstream** (SCIA): tucked in behind a car it builds up to 10% more top speed. **Near misses** (SFIORATO! +250) for squeezing past a car closer than a lane apart. **Score** (PUNTI) for distance at speed plus near misses.
- **[Fix]** **Bends you can see coming**: bends ease in over as long as they last, sharp bends stay off big hills (none hides behind a crest), warning arrows start 45 segments before medium and hard bends, and the haze is lighter with a longer draw distance.
- **[S]** Verified: typecheck, 51 tests (new: near miss close vs a lane over), build. In the browser: 30 s of driving with slipstream building, score counting, no errors.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-28] CORSA: full resolution, faster, and driving that takes skill (branch `experimental-branch`)
- **[Change]** Drawn at **1920x1080** instead of 480x270 scaled up, ready for higher-res "fake pixel art" like the fighting game's; the temp car is rebuilt at 448x327 (`scripts/racing-car.py`, CAR_WIDTH 448). Distant placeholder palms no longer flicker between one and two pixels.
- **[Change]** Fewer palms (a pair every 6 segments instead of 4, and a sparser outer row). Top speed up by about 14% (280 km/h on the dial).
- **[Feel]** **Driving that takes planning**: heavier steering flat out; bends pull harder, and past the tyres' grip the car slides, losing steering bite, washing out wide and scrubbing speed (with tyre smoke); braking at speed eats grip, so braking in the bend runs wide; turning always costs a little speed. Easy bends go flat out, medium ones need a lift (held at most about 86% of top speed), hard ones need braking before them (about 73%). Harsher grass, costlier glancing hits, near-stops on square hits, costlier rear-ending, palms and signs a little closer to the road.
- **[Feat]** Traffic (42 cars) signals with a flashing indicator, then changes lane when there's room. The race keeps its own random-number state, so a multiplayer race would still match.
- **[Measured]** 90 s on the course without traffic: flat out 47.4 km with 18 trips onto the grass, 5 glancing hits and 3 crashes; lifting for medium bends and braking for hard ones at the limit 50.9 km, clean.
- **[S]** Verified: typecheck, 52 tests (new: a hard bend flat out washes off the road, lifting stays on), build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-30] Online: lobby like BOTTE IN LOCALE, 5 players, matches that survive a player leaving (branch `experimental-branch`)
- **[Feat]** **Online lobby redesigned** like the offline one: the same player cards (now shared, `src/ui/PlayerCard.ts`), each slot's fighter animating on it, arrows while choosing, green PRONTO! when ready, "P2 · TU" on your own card, "Sceglie..." on others still picking, "In attesa di giocatori" on empty slots, and the pulsing blue instructions.
- **[Feat]** **5 players online** (`MAX_PLAYERS` 5). Measured: a rollback session costs each machine about 0.12 ms a frame on average (worst 2.4 ms) against a 16.7 ms budget; each player sends about 6 KB/s and receives about 23 KB/s.
- **[Feat]** **A player leaving no longer ends the match**: the server keeps a copy of every input it relays; when a player leaves it sends the others (PLAYER_LEFT) the last frame it has from them and their final inputs, every copy of the match retires their fighter the frame after (`GameSim.retireFighter`, applied inside the rollback timeline so it stays in sync), and a notice shows on screen ("PE (P2) HA LASCIATO LA PARTITA"). Rematches start with whoever is left, in new slots (the scene rebuilds for the new line-up); a player left alone goes back to the lobby.
- **[Feat]** **Leaving is noticed fast**: closing or leaving the page closes the connection straight away (server notices in about 0.1 s); a player silent for 10 s mid-match (crash, dropped connection) counts as gone. `GET /rooms` on the game server shows rooms and seats.
- **[Protocol]** Version 7.
- **[S]** Verified: typecheck (client and server), 54 tests (new: 5 players in sync at 120 ms with loss; a player quitting mid-match, the other four retire their fighter at the same frame and play on in sync), build. Live on the local server: three players in the new lobby, one closed their tab mid-match, the other two got the notice and played on in sync; with two players, the one left won the match.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-28] Studio Lab: better bloom (branch `experimental-branch`)
- **[Change]** The camera's bloom (`AtmospherePipeline`) is a downsample/upsample chain instead of two blurs at a quarter size: the bright parts at half size (with a Karis average so a lone bright pixel can't make it flicker), halved level by level to 1/64 with a 13-tap filter, then doubled back up with a tent filter, each level adding its light. A soft glow near bright things and a wide one round them, fading out smoothly. Threshold and strength work as before; spread sets how much the wider levels count, and the result is normalised so strength means the same at any spread. Tested by hand.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-30] Online: spectator mode (branch `experimental-branch`)
- **[Feat]** **Watching a match**: someone who joins BOTTE IN REMOTO while a match is on watches it (up to 4 spectators). The server sends them the match's start and then every player's inputs in batches from frame 0 (every 50 ms); their copy of the match (`shared/Spectate.ts`) simulates a frame only once it has every input for it, so there's no guessing and no rollback wobble. Joining late, it fast-forwards silently to the live action, then stays about 6 steps (0.1 s) behind. Players who leave are retired at the same frame as for the players.
- **[Feat]** Spectator screen: a pulsing "● IN DIRETTA · SPETTATORE" badge, the match's sounds and effects, "IN ATTESA DELLA PROSSIMA PARTITA..." after the end, ESC back to the lobby. Players see how many are watching (top right).
- **[Feat]** **Taking a seat**: while watching, left and right pick a fighter and confirm books a place in the next match; rematches seat booked spectators (up to 5 players), the others watch the new match from its start. A player left alone after the others quit can wait for a spectator to book and play again.
- **[Protocol]** Version 8: WATCH, WATCH_INPUTS, WATCH_END, SEAT, SPECTATORS.
- **[S]** Verified: typecheck (client and server), 55 tests (new: a spectator fed shuffled batches of the relayed inputs matches the players' confirmed match frame for frame, a player quitting included), build. Live on the local server with three tabs: two players, a spectator joining mid-match caught up from frame 0 in moments and matched the player's checksums frame for frame; it booked Pe, the match ended the same way for everyone, both players voted for a rematch, and the spectator joined it as P3, in sync.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-30] v3.0.5e - Online: 5 players, leaving mid-match, spectators; bloom; CORSA (hidden) (branch `experimental-branch`)
- **[Change]** CORSA is hidden from the main menu until it's ready; its code stays (`RacingScene`, `src/minigames/racing/`).
- **[V]** `v3.0.5-e`: the entries above since v3.0.4e. Protocol version 8.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-30] DERAPATE: donut mini-game prototype (branch `experimental-branch`)
- **[Feat]** **DERAPATE** in the main menu, a first prototype in plain blocks (no sound): a car doing donuts in the middle of a junction, seen from a fixed isometric camera, after Riccardo's sketch and the Audi reference frames. Roads crossing, zebra crossings on the four arms, pavements, corner buildings; the car leaves tyre marks, and a faint ring shows the loop it's on.
- **[Gameplay]** The throttle (Up/W/J/Space, RT/A) widens and speeds up the donut, letting go tightens it, the brake (Down/S/K, LT/X) tightens it hard. The drift has to be balanced with left/right (or the stick): it tips further by itself, wobbles, and the throttle swings the tail out; past the edge the car spins out (-150, speed lost). People cross on the zebra crossings: red ones cost 300 points, most of the speed and the combo; green ones give +50 and a burst of speed. Points grow with the donut's width and speed, 1.5x while the balance is clean, and wide loops build a combo up to x3. Measured over a minute: tight and safe 70, flat out through the crowd 480, wide but tightening when a red walker is crossing 1,720. R restarts, ESC back to the menu.
- **[Arch]** `src/minigames/donut/DonutSim.ts` (plain data, 60 Hz, its own seeded random numbers), `DonutRenderer.ts` (isometric blocks), `src/scenes/DonutScene.ts`. `tests/donut.test.ts`: the throttle sizes the donut, unbalanced it spins out and balanced it holds, and both kinds of pedestrian do what they should.
- **[S]** Verified: typecheck, 58 tests, build; in the browser, driving with throttle and balance, people crossing and being hit, no errors.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-30] DERAPATE: more forgiving balance (branch `experimental-branch`)
- **[Change]** The drift tips over far more slowly (TIP 1.1 → 0.35), wobbles less (1.6 → 0.8), the throttle pushes the tail out less (0.9 → 0.35), counter-steering is gentler so it's hard to overcorrect (4.2 → 3), and the swing settles sooner (damping 2.2 → 4). Left alone, the car now spins out after about 11 s instead of 3.
- **[Feat]** A grace moment at the edge: past it, the car spins out only after staying there 0.35 s, and the needle flashes red, so a quick correction saves it.
- **[S]** 58 tests, build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-30] DERAPATE: the Audi reference as the car (branch `experimental-branch`)
- **[Art]** The car is the Audi reference render until the real sprites come: `scripts/donut-car.py` keys out the grey background of the 45 frames (background joined to the frame's edge only, so the car's grey parts stay), crops each round the car and packs them into `public/assets/donut/car_temp.png` (9x5 frames of 243 px). The frame is picked from the car's heading (frame 6 faces the camera, 8° per frame), checked against a heading arrow; drawn at 1.6x, in scale with the people, between those behind and in front of it.
- **[Feel]** Locked into the donut: the nose now points about 70° into the circle (the tail swinging round the centre) instead of 55°, rocked by the balance; the throttle, eased in and out, swings the tail out a further 17°. Tyre smoke pours from the rear wheels, lightly all the time, billowing under throttle and in spin-outs.
- **[S]** 58 tests, build; checked in the browser.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-30] DERAPATE: back to the block car (branch `experimental-branch`)
- **[Revert]** The Audi reference didn't suit the game: it spins round a point on its own circle, so as a sprite the car did its donuts round a moving point rather than widening from the junction's centre. Tried a pivot model to match it (the car spinning tightly round a pivot that the throttle moves outwards); it felt worse, so the car is the red block car again, circling the centre with the throttle widening the donut, as before the sprites.
- **[Change]** The block car is drawn 1.75x (the Audi sprite's size next to the people), with wider tyre marks; the hit distance follows it (1.7 → 2.8 m) and a red walker now costs 500, so driving through the crowd doesn't pay (a minute of bots: careful 803, reckless 203).
- **[Note]** `scripts/donut-car.py` and `public/assets/donut/` are still there but nothing loads them.
- **[S]** 58 tests, build; checked in the browser.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-09-30] v3.0.6e (branch `experimental-branch`)
- **[Release]** DERAPATE, the donut mini-game prototype (main menu), with the block car. Version 3.0.6-e.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: a pedal you blip (branch `experimental-branch`)
- **[Feel]** The pedal snaps down and up in 0.1 s and the engine's revs follow it fast; the revs set the speed and the donut's width (about 3x quicker than before). Each stab kicks the tail out, harder the faster the car goes (0.85 of the edge at top speed, about 0.4 slow), with the tyres biting a little differently every time; each lift brings it part of the way back. Kept moderate on purpose: stronger and tapping without steering would balance itself.
- **[Feat]** Rev meter (GIRI) above the balance bar: revs between 0.55 and the red line (0.88) score double (`GIRI x2`); past the red line the engine bounces off the limiter, the bar flashes red and the push on the tail builds over 3 s until steering can't hold it. Blipping in rhythm (about 0.3 s on, 0.2 off) keeps the revs in the sweet spot nearly all the time; flat out spins about every 7 s even with perfect steering.
- **[Change]** Random gusts down to a light wobble (0.8 → 0.3, more at the limiter): the chaos now comes from your pedal.
- **[Look]** The car's body swings with every stab and lift (balance drawn between steps), wheelspin swings the tail out a little more and lays darker rubber, and a stab at speed shakes the camera slightly.
- **[Balance]** One minute of test drivers: blipping and balancing 16,700 vs flat out 3,400; with people, careful blipping 752, careful flat out 281, blipping through the crowd 151.
- **[S]** 60 tests (new: the kick and lift, the sweet spot vs the limiter), build; checked in the browser.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: the balance rises slower, room to rev (branch `experimental-branch`)
- **[Feel]** A stab of the pedal no longer jolts the balance: its kick is a push that builds and fades over half a second (`KICK_TIME`), and it's gentler (KICK 4.5 → 2.5, the revs' steady push 1 → 0.6). Pedal down at speed with no steering, the balance takes 0.8 s to reach halfway instead of 0.4, so there's time to catch it and to hold the pedal long enough to get the revs up.
- **[Change]** Lifting now mainly stops the push (the kick ends); it only pulls the tail back once it's past 0.6 (SNAP 4 → 2). A strong pull-back balanced the car by itself when tapping, which made steering optional.
- **[Change]** The limiter's push builds over 4 s instead of 3: a moment in the red is fine, staying there isn't.
- **[Balance]** A keyboard player who reacts 0.2 s late: holding 1.2 s / lifting 0.4 s now never spins (it spun 5.6 times a minute) and spends 44% of the time in the red; flat out still spins about every 8 s; without steering every pedal style spins. With people: careful 1,441, reckless 260.
- **[S]** 60 tests, build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: the Lab, hit shakes, nose into the circle (branch `experimental-branch`)
- **[Feat]** The **DERAPATE Lab** (L in the game, L again closes it): every number of the mini-game live, in the Studio Lab's style and windowed by default (the game in the middle, panels docked either side; FULL SCREEN floats them). DRIVING (pedal, revs, speed, size, the donut's centre), BALANCE (kick, lift, limiter, tipping, steering, spin-outs, combo), PEOPLE AND ROAD (people, junction size), CAR AND CAMERA (car size, nose angle, swings, tyre marks, zoom, junction on screen, every shake), and TEST: restart, freeze (F), next step (N), slow motion, test shakes, live readouts, the car's live values (radius, angle, speed, revs, balance) to put it anywhere, a find box, Copy changes / Copy all / Paste / Reset all. H hides the panels. Changes are kept in this browser and used whenever DERAPATE runs here.
- **[Feat]** Two camera shakes: a hard short jolt for a red walker (1% of the screen, 250 ms), a lighter longer rumble with a 5% zoom punch for a green boost. The pedal-stab shake is off by default (a Lab slider). The HUD has its own camera, so only the junction shakes and zooms.
- **[Look]** The car's nose points further into the circle: 70° from straight ahead instead of 54°.
- **[Code]** The settings are plain objects (`DONUT`, `PEDESTRIANS`, `JUNCTION`, new `LOOK` in `DonutLook.ts`); `DonutTuning.ts` lists them with ranges, keeps the defaults, applies/copies changes; `DonutLab.ts` builds the panels from `LabUi`/`FeelUi`; the Studio Lab's `WindowedView` is exported with a configurable top band. R now starts again without restarting the scene, so the Lab stays open.
- **[S]** 62 tests (new: every setting is in the Lab, changes copy out and paste back), build; checked in the browser (windowed and full screen, shakes on the world camera only, the junction redrawn live, freeze and step, closing).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] v3.0.7e (branch `experimental-branch`)
- **[Release]** DERAPATE: a pedal you blip (revs, sweet spot, limiter), slower balance rise, hit and boost shakes, nose further into the circle, and the DERAPATE Lab (L). Version 3.0.7-e.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: the speed lock, no brakes, no testacoda, fewer people (branch `experimental-branch`)
- **[Feat]** The speed lock: reaching the green revs locks them there. Locked, the pedal moves the revs only 15% as much and its kick is a quarter, and they can't leave the green (no red line); steering bites twice as hard while the drift tips over 6.5x more, wobbles 7x more and settles less: livelier and harder. A red hit ends it (and losing the balance, see below); the revs drop back into the white to be built up again. The GIRI bar gets an outline round the green and reads `BLOCCATO x2`.
- **[Change]** Below the green (white revs) it's more forgiving: the pedal's push on the tail ×0.7, steering ×1.3.
- **[Change]** Testacoda is off by default (`SPIN_OUTS`, a checkbox in the Lab under BALANCE → SPIN-OUTS AND COMBO): the balance stops at 1.15 instead. With it off, staying past the edge for the grace time ends the lock and keeps 60% of the speed (switch in SPEED LOCK).
- **[Change]** No brakes: only the pedal and steering (keys and gamepad).
- **[Change]** Letting go slows the car gently: revs fall at 0.5/s (was 1.5), speed follows them down at 1/s (was 3), the donut tightens at 2 m/s (was 4).
- **[Change]** Far fewer people: one every 2.5–5 s (was 0.9–2.2), and at most one on each crossing (`PER_CROSSING`).
- **[Lab]** New SPEED LOCK panel (the lock and the white zone); on/off settings are checkboxes; the readout shows the lock.
- **[Balance]** One minute of test drivers holding the pedal (1.2 s on, 0.4 off): attentive players stay locked the whole time; a sloppy one loses the lock about 5 times a minute; nobody steering loses it constantly.
- **[S]** 68 tests (new: the lock, the gentle slow-down, losing the balance with testacoda off, one person per crossing), build; checked in the browser.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: no pedal, no movement (branch `experimental-branch`)
- **[Change]** The slowest speed is now 0 (was 4 m/s): without the pedal the car stands still (and starts at the tightest radius, so it doesn't slide in). Standing still nothing pushes the tail about and the balance settles back to the middle. A spin-out whirls on the spot.
- **[Note]** Locked in the green, the revs can't fall out of it, so letting go keeps the car moving until a red hit or losing the balance ends the lock.
- **[S]** 69 tests (new: no pedal, no movement), build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: off the pedal, it stops (branch `experimental-branch`)
- **[Fix]** The car kept going with nothing pressed: once locked in the green, the revs couldn't fall. Now, off the pedal, the revs fall as usual and the lock ends once they leave the green; revs under 0.1 (`REV_IDLE`) drive nothing, and a rolling friction (1.5 m/s², `ROLL_FRICTION`) brings it to a full stop: from top speed it rolls about 4 s and stands still. With any pedal down, the lock works as before.
- **[Fix]** A gamepad trigger resting a little above 0 no longer counts as throttle (dead zone 0.1).
- **[S]** 70 tests (new: off the pedal the lock ends and the car stops), build; checked in the browser (standing still at the start).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: quicker stop, heavier edges (branch `experimental-branch`)
- **[Change]** Off the pedal the car stops in about 1.7 s from top speed (was about 4): revs fall at 1.2/s (was 0.5), speed follows at 2/s (was 1.5), rolling friction 6 m/s² (was 1.5). A blip off the pedal shorter than 0.3 s (`LOCK_LIFT_GRACE`) keeps the speed lock; longer and it starts to go.
- **[Feel]** The balance isn't linear any more: the drag on its swing is ×0.65 in the middle of the bar (light, responsive) rising to ×2.6 at the edges (heavy, forgiving), growing with the square of the distance (`CENTRE_DRAG`, `EDGE_DRAG`, in the Lab under BALANCE). A sloppy test driver loses the lock about 2.6 times a minute (was about 5); attentive ones never.
- **[S]** 71 tests (new: the stop within two seconds, light middle / heavy edges), build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: rethink, the pedal and the heat (branch `experimental-branch`)
- **[Change]** The rules started again, simpler and forgiving, pedal only: steering and the balance are gone for now (they come back once this stage feels right). The rev bar is 90% white and 10% green. Pedal down, the white fills steadily (0.3 of the bar a second: about 3 s to the green); pedal up, it empties (0.6 a second) and the car rolls to a stop. The speed follows the revs and the donut's width follows the speed (tight standing still, widest at top speed).
- **[Feat]** The green: top speed holds while the pedal stays down, but the engine heats up (the green part of the bar fills, orange then flashing red, `MOTORE CALDO!`). About 4 s of pedal overheats it: the car is sent back to the start (stopped, tightest circle) and does a testacoda on the spot (`MOTORE FUSO!`, -300 points, combo reset), then builds up again. Lifting cools the engine (1 s to cool fully); a lift shorter than 0.5 s keeps the green, longer drops back into the white. Points in the green count double.
- **[Change]** A red hit costs 500 points and knocks you out of the green (40% of the revs kept); a green person gives 50 points and a little revs. Standing still or spinning, the car hits no one.
- **[Lab]** Panels follow the new rules: DRIVING (the white, speed and size), GREEN AND HEAT (overheating, cooling, lift grace, testacoda, combo), PEOPLE AND ROAD, CAR AND CAMERA; readouts show revs, heat and pedal-up time; live values include the heat. The old balance, kick, limiter, lock and testacoda settings are gone with the rules they tuned.
- **[S]** 64 tests (rewritten for the new rules), build; checked in the browser (green after 3.0 s, heat warning, overheat back to the start).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: quicker to the green, 3 s in it (branch `experimental-branch`)
- **[Change]** The white fills twice as fast (0.6 of the bar a second, was 0.3): about 1.5 s from standing to the green.
- **[Change]** The engine overheats after 3 s of pedal in the green (was 4). Cooling is unchanged (1 s to cool fully), so staying in the green takes a rhythm of about 1 s down, 0.4 s up.
- **[S]** 64 tests (now following the timing settings), build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: steering back, as forgiving flair (branch `experimental-branch`)
- **[Feat]** The balance is back, light: it drifts slowly by itself while the car moves (twice as much in the green), left/right (A/D, the stick) nudge it, a gentle pull brings it home, and it simply stops at the edges: nothing is ever lost to it (no testacoda, no leaving the green). Inside the middle band points count ×1.25. A small balance bar sits above the rev bar; the car's nose rocks with the balance (±25°).
- **[Balance]** One minute of test drivers: left alone, the balance stays clean 56% of the time; tapping when it leaves the band keeps it clean 100% of the time and scores about 11% more.
- **[Lab]** New STEERING panel (drift, drift in the green, steering, settling, pull to the middle, clean band and bonus); balance swing in CAR AND CAMERA; readout and live value for the balance.
- **[S]** 66 tests (new: the balance costs nothing and rewards a little; it settles standing still), build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: the revs on the car, and a testacoda for the balance in the green (branch `experimental-branch`)
- **[Look]** The rev bar is shown on the car itself, so you can watch the car instead of the bar: the car is black at rest and takes a white tint as the white fills; reaching the green it flashes bright, then glows green with a slow pulse, turns orange as the engine heats and flashes red, faster and faster, before overheating; it flashes red fast at the edge of the balance in the green, and in the testacoda (`LOOK.TINT`, `LOOK.HOT_FLASH` in the Lab).
- **[Feat]** The balance can now cost you, but only in the green: staying at an edge (past 0.97) for 0.5 s there is a testacoda, back to the start like overheating (`TESTACODA!`, -300). In the white the edges stay safe. The drift grows with the speed and is 3.2x stronger in the green (was 2x). In the green the bar's ends turn red and the needle flashes red at an edge.
- **[Balance]** One minute of test drivers: never steering, about 3 testacodas a minute; steering a little whenever it leaves the middle band, none; steering late and lazily, about one every five minutes.
- **[S]** 67 tests (new: the edge is safe in the white and a testacoda in the green; steering avoids it), build; the tint checked in the browser (black, white, green).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: testacoda on the spot, a smooth stall, losing control shows (branch `experimental-branch`)
- **[Change]** The testacoda is only for the steering (at an edge of the balance in the green), and it happens on the spot: the car stops and spins where it is, keeps 40% of the white's revs, and carries on from there (-300).
- **[Change]** Overheating no longer spins the car or puts it back at the start: the engine stalls (`MOTORE FUSO!`, -300), the pedal does nothing, and the car coasts back to the middle as the revs and the speed run down and the donut tightens; once the revs are gone it can start again. The car glows a dull, throbbing red while stalled.
- **[Change]** Off the pedal the donut starts tightening towards the middle straight away (at least 3 m/s, `RETURN`), even during a short lift in the green.
- **[Look]** Losing control shows more: the balance rocks the car twice as far (±50°) and pushes it out of (or into) its circle by up to 1.5 m (`SLIP_SHIFT`; collisions follow it).
- **[S]** 68 tests (new: the stall coasts home smoothly; tightening off the pedal; the testacoda stays on the spot), build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: quicker steering, tint opacities, a clearer steering bar (branch `experimental-branch`)
- **[Feel]** The steering reacts much quicker and grows with the speed: its push is 12 at top speed (was 2.5 at any speed), 15% of that standing still (`STEER_SLOW`), with a little more settling (4, was 3). Full lock moves the balance halfway in 0.35 s at top speed (was 0.93 s), 0.5 s at half speed. The drift in the green is up to 3.8x (was 3.2x) to keep the same challenge: never steering, about 3 testacodas a minute; steering a little, none.
- **[Lab]** Every tint on the car has its own opacity, in CAR AND CAMERA → CAR TINTS: white, green, orange, red, the stall's dull red, the flash on reaching the green, and the overheat flashing speed (replacing the single `TINT`).
- **[Look]** The steering bar (STERZO) is bigger and colour-coded: green in the middle (clean), then yellow, orange, and red at the edges, with a centre mark and a needle outlined in black. In the white (edges safe) the colours are dimmed; in the green they're bright and the needle takes the colour of the zone it's in, flashing red at an edge.
- **[S]** 69 tests (new: the steering reacts quicker at speed), build; the bar checked in the browser.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-01] DERAPATE: the car shows only the revs and the heat (branch `experimental-branch`)
- **[Look]** The car no longer flashes red for the steering (at the edge of the balance, or in the testacoda): its tint is only the rev bar and the engine (white, green, orange, the red flashes before overheating, the stall's dull red). The steering shows only on the STERZO bar.
- **[S]** 69 tests, build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] v3.0.8e: the Lab settings as defaults (branch `experimental-branch`)
- **[Tuning]** Riccardo's DERAPATE Lab settings are now the defaults: the donut widens at 2.8 m/s (was 6), overheating after 3.5 s in the green (was 3), 91% of people are green (was 30%), a wider junction (road half width 10.2 m, crossings at 12.8 m and 4.4 m wide), the camera zoomed out (30 px/m, was 40), and the car's tints: no white or green tint and no green flash, orange at 0.35, red at 0.37, no stall tint, red flashing at 7.5 a second.
- **[Release]** DERAPATE rebuilt around the pedal and the engine's heat, forgiving steering with a testacoda only in the green, the revs shown on the car. Version 3.0.8-e.
- **[S]** 69 tests, build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE on phones (branch `experimental-branch`)
- **[Feat]** The main menu works by touch (and mouse): tap an entry to pick it (rows a thumb wide; bigger and further apart on a phone). Only DERAPATE has touch controls; the fighting modes still need a keyboard or gamepad.
- **[Feat]** DERAPATE's thumb controls on a phone (`src/minigames/donut/DonutTouch.ts`): a left/right steering stick under the left thumb (put it down anywhere in the left half and slide sideways: further is harder, a small dead zone in the middle), the accelerator under the right (hold anywhere in the right half), several fingers at once, and two buttons top right (start again, back to the menu). The score, speed and the two bars are drawn bigger on a phone; the keyboard help line is hidden.
- **[Feat]** Phones: full screen on the first tap (in the menu and in DERAPATE; `src/input/Touch.ts`), and a "RUOTA IL TELEFONO" screen while the phone is held upright (CSS, `#rotate-phone`).
- **[S]** 69 tests, build; checked in the browser's phone view: the rotate screen upright; in landscape the menu tap reaches DERAPATE, the controls show, gas and steering together drive the car, restart works.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] v3.0.9e (branch `experimental-branch`)
- **[Release]** DERAPATE on phones: touch menu, thumb controls, full screen, rotate prompt. Version 3.0.9-e.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: greens raise the top speed (branch `experimental-branch`)
- **[Feat]** The base top speed stays 18 m/s (65 km/h). Every green person hit raises it for the rest of the run, with diminishing returns so it stays in check: top = base × (1 + 0.5 × (1 − e^(−greens/19))). One green +1.3%, a minute's worth (about 13 for a steady driver, measured) +25% (81 km/h), three minutes' +44% (93 km/h), never past +50% (97 km/h). `SPEED_BONUS_MAX`, `SPEED_BONUS_SCALE` in the Lab.
- **[Feat]** A green also gives a burst of speed above the top: +30% of the base (about +19 km/h), fading over 1.5 s (`BOOST_SPEED`, `BOOST_SECONDS`). The HUD shows `KM/H   MAX …` and `BOOST!` during a burst.
- **[Change]** Past the base top speed the balance keeps getting livelier (drift and steering scale up to 1.5x), so the extra speed is felt.
- **[S]** 70 tests (new: diminishing returns, the cap, the burst and its fade), build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: the combo raises the speed, a shaped burst, white and blue people (branch `experimental-branch`)
- **[Change]** The combo multiplier now comes from white (boost) people hit in a row: each adds ×0.25 (up to ×5); a blue hit, overheating or a testacoda ends the run (wide loops no longer build it). The run also raises the top speed past the base, with diminishing returns: top = base × (1 + 0.5 × (1 − e^(−in a row/8))): 3 in a row +15%, 5 +23%, 10 +36%, never past +50%. Back to the base when the run ends.
- **[Feel]** The burst from a white person follows Riccardo's sketch: straight up to its peak (+30% of the base top speed) in 0.25 s, a moment held at the top, then down and easing out over 1.5 s (a cosine), back to the speed the car should be at (`BOOST_RISE`, `BOOST_FALL`). It rides on top of the cruising speed instead of being smoothed by it, so the shape shows.
- **[Look]** The people: boost ones are white (were green), costly ones navy blue (were red); the score pop-ups match (white, and blue outlined in white). Lab labels follow.
- **[S]** 71 tests (new: the run in a row and its end, the burst's shape and return), build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: exhaust backfires (branch `experimental-branch`)
- **[Look]** Flame pops from the exhaust when you lift off with the revs at least 0.6 of the bar (bigger the higher they were) and when you reach the green: a hot yellow core and orange tongues behind the car, flickering and shrinking over 0.22 s. `BACKFIRE_FROM`, `BACKFIRE_SIZE`, `BACKFIRE_MS` (0 turns it off) in the Lab under CAR AND CAMERA.
- **[S]** 71 tests, build; checked in the browser.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: Lab settings as defaults, STERZO bar hidden (branch `experimental-branch`)
- **[Tuning]** Riccardo's Lab settings baked in: camera zoom 26 px/m (was 30), junction 470 px down the screen (was 530), backfires smaller (×0.35) and 200 ms, and the pedal-stab shake on at 0.002.
- **[Change]** The STERZO bar is hidden (`SHOW_STEER_BAR` in DonutScene); the balance still plays and the steering still works.
- **[S]** 71 tests, build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] v3.1.0e (branch `experimental-branch`)
- **[Release]** DERAPATE: white boosts in a row build the combo and raise the top speed, the shaped boost burst, white and navy people, exhaust backfires, Riccardo's camera and effect settings, the STERZO bar hidden. Version 3.1.0-e.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: a steering wheel, an upright rev bar (branch `experimental-branch`)
- **[Art]** Riccardo's steering wheel (`public/assets/donut/wheel.png`, from `assets/Derapate/UI/wheel_000.png`) sits at the bottom of the screen, its centre below the bottom edge so only the top shows; it turns round its rim's centre with the steering (up to 90° at full lock, eased).
- **[Change]** The rev bar stands upright beside the wheel: the white fills from the bottom, the green is the top; in the green the fill is the engine's heat (green, orange, flashing red). The label (GIRI, IN VERDE x2, MOTORE CALDO!, MOTORE FUSO, TESTACODA) sits on top of it.
- **[Change]** The keyboard help line is gone.
- **[Lab]** CAR AND CAMERA → HUD: WHEEL AND REV BAR: the wheel's place (across, down), size, turn at full lock and how quickly it follows; the rev bar's place, height and width.
- **[S]** 71 tests, build; checked in the browser.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: the wheel is the balance (branch `experimental-branch`)
- **[Change]** The steering wheel now shows the balance, as the STERZO bar did: it turns by itself as the drift pulls it (up to 90° at the edge) and you counter-steer to bring it back to straight: turned right, steer left; turned left, steer right. In the green it goes orange near the edge and flashes red at it (staying there is a testacoda).
- **[S]** 71 tests, build; checked in the browser (left alone it drifted to 16°, a short counter-steer brought it back).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: the wheel with the driver's arm, people walking in (branch `experimental-branch`)
- **[Art]** The steering wheel is Riccardo's new sprite with the driver's arm (`public/assets/donut/wheel_v3.webp`), turning round the rim's centre; placed lower and bigger (centre 1060 px down, ×0.85) and turning up to 60° at the edge (was 90°, so the arm doesn't swing too far).
- **[Change]** People appear 14 m up the pavement and walk to their crossing before stepping onto it, so you see them coming (`PEDESTRIANS.APPROACH`, "People walk in from" in the Lab).
- **[S]** 71 tests, build; checked in the browser.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: the wheel without the arm again (branch `experimental-branch`)
- **[Art]** The steering wheel is Riccardo's `wheel_000.webp` (the wheel alone, as WebP): `public/assets/donut/wheel.webp`, replacing the version with the arm and the earlier PNG. Back to centre 1150 px down, ×0.7, 90° at the edge.
- **[S]** 71 tests, build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: the car is Riccardo's renders (branch `experimental-branch`)
- **[Art]** The car is drawn from Riccardo's renders of the full car (`assets/Derapate/Sprite macchina/Completo`, 90 frames turning on the spot, 4° apart). `scripts/donut-car-sprites.py` cuts every frame with the same window, scales them to 0.4 (320x230) and packs them into `public/assets/donut/car_full.webp` (10 columns, 2.3 MB, lossless) with `car_full.json`: the pivot (the car's centre on the ground, worked out from the frames: across, the middle of all of them; down, from the nose-on frame's bumper), the frame facing straight down the screen (12th, heading 45°; the frames turn the other way round as they go), and the car's length in pixels (side on, half the width over 0.6124 for the isometric squash). The game picks the frame for the car's heading, and draws it as long as the block car was (4.4 m × car size × zoom).
- **[Look]** People and the exhaust flame nearer the camera than the car are drawn over it, the others behind; the car keeps a soft shadow. The revs' tints are a copy of the sprite filled with the tint's colour at its opacity over the car.
- **[Lab]** CAR AND CAMERA → CAR: Car sprites (off: the old block car), Sprite size ×, Sprite down (to sit it on its shadow), Car shadow.
- **[Note]** The separate body, wheels and wheel-mask renders aren't used yet.
- **[S]** 71 tests, build; checked in the browser (the right frames as it goes round).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: the car in two layers, on springs (branch `experimental-branch`)
- **[Art]** The car is drawn from Riccardo's separate renders: the wheels (`car_wheels.webp`, 0.6 MB) under the body (`car_body.webp`, 2.1 MB), which gives back the full car. `scripts/donut-car-sprites.py` now packs both with the same window and pivot (found from the full renders, `car.json`), and drops a frame identical to the one before it: the body folder's frame 59 repeats frame 58, which had shifted every later body frame by one. The full-car sheet is gone.
- **[Feat]** A first suspension: the body rides on a damped spring over the wheels (render only, not the rules): it leans out of the turn and tilts a little with the cornering, squats back speeding up and dips forward slowing, rumbles at speed, and bounces when hitting someone or in a testacoda. Lab, CAR AND CAMERA → CAR: lean, tilt, squat, bump, rumble, bounce (springs' frequency), damping; 0 turns each off.
- **[Note]** The Wheels-mask renders (the near-side wheels) aren't used: the wheels under the body already match the full car.
- **[S]** 71 tests, build; checked in the browser (layers line up; the body leans up to about 9 px and 2° at full cornering).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: the body stays on its wheels (branch `experimental-branch`)
- **[Fix]** The wheels looked off the car: the suspension slid the body sideways (up to about 9 px) and tilted it, pulling the arches off the wheels. (The layers themselves line up in every frame: checked against the full renders.) The body now only travels straight up and down over the wheels, at most 3 px (`SUSP_TRAVEL`): it sits a little lower loaded in the turn, lifts speeding up and dips slowing, rumbles at speed, bounces on hits. The sideways lean and the tilt are gone.
- **[S]** 71 tests, build; checked in the browser (body and wheels never more than 0 px apart sideways, about 2 px up and down, no tilt).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: voxel tyre smoke (branch `experimental-branch`)
- **[Look]** Smoke from the two rear tyres as little grey cubes (drawn like the junction's blocks: two shaded sides and a top): they kick back off the tyre, rise, grow to four times their size and fade, thickest just after they appear. More the harder the wheels spin: with the pedal down and the revs up, the most in a testacoda, a wisp coasting off the pedal or stalled, none standing still. Nearer the camera than the car they're drawn over it. Render only. Lab, CAR AND CAMERA → CAR: Tyre smoke (cubes a second, 80; 0 off), size, how long it lasts, how fast it rises, thickness.
- **[S]** 71 tests, build; checked in the browser (a trail of rising cubes behind the car at speed).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] DERAPATE: tyre marks from the rear tyres, finer smoke (branch `experimental-branch`)
- **[Fix]** The tyre marks came from the car's centre. They now come from the two rear tyres, placed from Riccardo's wheel renders: the rear axle 1.29 m behind the centre and the tyres 0.77 m either side (both times the car size; `REAR_AXLE`, `HALF_TRACK` in the Lab). The same measurements put the car's centre on the ground within a pixel of the sprite's pivot. The smoke comes from the same two tyres.
- **[Look]** Better marks: rubber is laid on a texture over the road, a strip as wide as the tyre on the ground (0.26 m × car size, drawn in perspective, a little ragged, with a darker core), darker with the pedal down and the revs up, a trace when coasting; laps over the same place build up darker, and it fades slowly (3% a second) instead of the trail being cut off. Drawn once per step instead of redrawing the whole trail every frame. Cleared on a restart or when the Lab moves the camera or the junction.
- **[Look]** The smoke is made of cubes about half the size, three and a half times as many (260 a second at full wheelspin, up to 800 at once), the same amount of smoke.
- **[S]** 71 tests, build; checked in the browser (the strip starts under the near rear tyre; frames about 0.6 ms median with the smoke).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-02] v3.1.1e (branch `experimental-branch`)
- **[Release]** DERAPATE: the steering wheel HUD (the balance) and the upright rev bar, people walking in, Riccardo's car renders in two layers on springs, voxel tyre smoke, tyre marks from the rear tyres. Version 3.1.1-e.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-03] DERAPATE: sound (branch `experimental-branch`)
- **[Audio]** Riccardo's recordings (`assets/Audio/SFX/Derapate`), 14 of them picked and converted to mono 44.1 kHz WAV in `public/assets/audio/derapate` (1.6 MB); the four engine loops and the hot whine crossfaded over 60 ms at their loop point so they loop without a click.
- **[Audio]** `DonutAudio`: the engine is four loops recorded at rising revs, blended by the rev bar (each loudest at its own revs, pitched up past them, still climbing during a white burst), louder with the pedal down, bouncing at the top in the green, a hot whine rising under it as the engine nears overheating, cut out when it stalls. The tyres' screech loop grows with wheelspin under power, the balance being out and the steering, loud in a testacoda. One-shots: nitrous on a white person; a thud and a short horn on a blue one; a screech for the testacoda; the overheat when the engine gives out; exhaust pops on reaching the green and, lifting off at high revs, pops plus the turbo's blow-off. The game's music drops to 35% while driving and comes back after.
- **[Lab]** CAR AND CAMERA → SOUND: engine, tyre screech, effects, music under the engine (on top of Settings' volumes).
- **[S]** 71 tests, build; checked in the browser (all 14 loaded, the engine layers handing over as the revs climb).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-03] DERAPATE: green whoosh, louder screech, a deeper engine (branch `experimental-branch`)
- **[Audio]** Reaching the green plays Riccardo's whoosh (`Boost/00000000_6474.wav` → `green.wav`) instead of the exhaust pops (the flame stays).
- **[Audio]** The tyre screech is much louder: both screech recordings raised by about 10 dB (limited) and the screech volume at 1 (was 0.45); at speed in the green it now plays at about 0.8 (was 0.34) of a louder file.
- **[Audio]** A deeper engine: the two high loops are gone; the engine is the low loop Riccardo liked, then a deep exhaust (`car_11_exh` → `engine_mid.wav`, crossfaded to loop) and the second engine loop only at the very top, climbing in pitch more gently (`ENGINE_PITCH` 0.35 a bar, was 0.7; at the top the loudest loop plays at 0.96 of its pitch).
- **[S]** 71 tests, build; checked in the browser (all loaded; at the top the deep layers carry it).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-03] DERAPATE: motore caldo crackle, a proper overheat, occasional revs (branch `experimental-branch`)
- **[Audio]** MOTORE CALDO is the straight-pipe crackle (`car_01_exh_mb_ee_smarmittata` → `engine_hot.wav`, looped): it comes in as the heat passes three quarters and climbs in pitch towards overheating (0.85 → 1.45). No longer used for the backfire pops.
- **[Audio]** Overheating plays `Engine_overheat.mp3` (trimmed to 3.8 s, faded) and, overlapping as it fades, `Car_Down.mp3` 2.4 s in (louder, limited).
- **[Audio]** Revs from `Revving.wav`: three revs cut out of it (`rev_1`–`rev_3`, faded, limited) play now and then on a fresh stab of the pedal after a lift: 40% of the time, at least 4 s apart.
- **[Lab]** SOUND: motore caldo crackle, car dies after, rev on a stab (chance), revs at least apart.
- **[S]** 71 tests, build; checked in the browser (a rev on a stab, the whoosh into the green, the crackle rising, the overheat then the car dying 2.4 s later).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-03] DERAPATE: vroom, quieter flame, a new stall, a soundtrack (branch `experimental-branch`)
- **[Audio]** The engine dipped when accelerating: the blend handed over to a recording lower in pitch than the one before. Now it's one engine (the low loop Riccardo liked) whose pitch climbs all the way with the revs (0.75 at rest, +0.75 at the top of the white), with the deep exhaust growing under it; every fresh stab of the pedal surges it (louder, a quick jump in pitch, fading over 0.6 s) and most times (85%, at least 0.8 s apart) a rev from the revving recording rips over it. The second engine loop is gone.
- **[Audio]** The flame's pops and blow-off are much quieter (`FLAME_VOLUME` 0.3; were 0.8 and 0.55).
- **[Audio]** Overheating redone as one event with the stall: the engine loops cut at once, the engine winds down and dies (`Car_Down`) with the overheat's hiss over it (trimmed to 2.4 s, at half volume) while the car coasts back to the middle; a restart stops them. The delayed car-dying sound is gone.
- **[Audio]** DERAPATE's soundtrack: Zutomayo_001 (re-encoded to 128 kbps, 3.9 MB) loops while driving, loaded in the background so the game starts at once; the game's music fades out and pauses, and comes back after. Follows Settings' music volume × `MUSIC_VOLUME` (0.7).
- **[Lab]** SOUND: engine pitch climb, overheat hiss, flame pops, rev on a stab (volume, chance, gap), soundtrack.
- **[S]** 71 tests, build; checked in the browser (the pitch climbing press after press with a surge on each, a rev on every stab, the whoosh into the green, the dying sounds at the stall, the game's music paused and the song playing).

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-03] DERAPATE: revs on the beat, the song keeps going (branch `experimental-branch`)
- **[Fix]** The revs came late: each clip cut from the revving recording began with 0.4–1.4 s of build-up before the actual rev. They're re-cut to start on their attack (loud within 10–30 ms, peaking at about 0.2 s), so the vroom lands on the press; and each plays pitched to the engine's revs at that moment instead of at random.
- **[Fix]** The soundtrack stopped right after starting on Riccardo's side (it plays on here through the real flow: start screen, menu, DERAPATE). Whatever stops it (focus, full screen, the browser), it now picks up again by itself while DERAPATE is showing.
- **[S]** 71 tests, build.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-03] v3.1.2e (branch `experimental-branch`)
- **[Release]** DERAPATE sound: engine with vroom surges and revs, tyre screech, motore caldo crackle, the overheat and the engine dying, boosts, hits, green whoosh, quiet flame pops, and the Zutomayo soundtrack. Version 3.1.2-e.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-05] DERAPATE: deep clean (branch `experimental-branch`)
- **[Refactor]** `DonutScene` split (483 → 334 lines): the HUD (texts, steering wheel, rev bar, the big message) is its own `DonutHud`; the soundtrack moved into `DonutAudio`; the Lab remembers by itself whether it was open (`donutLabWasOpen`, `close()`). One frame time per frame, the sim's events in a switch, hits read the person's kind (not the sign of the points), typed keys, the controls object reused. The hidden STERZO bar's code is gone.
- **[Refactor]** `DonutSim` split into revs, speed, balance and people steps, people cleared in place; bit-identical to before (5 seeds × 2 minutes compared step by step).
- **[Refactor]** `DonutRenderer`: the block car is gone (the sprites are the car, `CAR_SPRITES` removed); it loads its own sheets and cuts the frames as `car.json` says (frame size, columns: no copy in the code); `reset()` clears rubber, smoke, flame and springs on a restart; the flame times itself.
- **[Perf]** Everything drawn every frame goes in as triangles (quads as two, shadows as fans) instead of filled paths, which Phaser cuts into triangles again every frame, leaving garbage; no throwaway point objects in the drawing; smoke cubes recycled. In the same tab, the switch to triangles took the heap churn with the smoke from about 50 to 5–8 MB per 600 frames.
- **[Perf]** The HUD rewrites a text only when it changes (Phaser redraws and re-uploads a text even when only its colour is set: the rev bar's label was redrawn every frame); the score formatter is made once.
- **[Perf]** `DonutAudio`: loop volume and pitch go to Web Audio only when they change (to the thousandth); the song and nine one-shots (1.1 MB) load in the background, so DERAPATE starts sooner (a sound not in yet is skipped). Named events (`lock`, `spin`, `hit`, `backfire`, `overheat`) instead of sound names in the scene.
- **[Fix]** Phones: re-entering DERAPATE no longer adds two more touch points each time; the touch controls redraw only when a finger comes, goes or steers.
- **[Cleanup]** Red/green → blue/white in comments, the Lab's shake button and the tests; the Lab's unused switch rows and DonutTouch's unused getter removed; LLM_CONTEXT's DERAPATE section rewritten (it still described the pedal-only prototype).
- **[Tests]** The same seed and controls replay identically; the crowd never builds up over ten minutes.
- **[S]** tsc, 73 tests, build. In the browser, the same scripted drive on the committed and the cleaned version: in the game's real loop (120 Hz) per frame median 1.1 → 1.0–1.1 ms, p99 2.2–2.3 → 1.9–2.0 ms, worst 2.9–3.0 → 2.5–2.8 ms, no frames dropped; stepped at 60 Hz by hand, median 2.0 → 0.7 ms, p99 2.9 → 1.9 ms. Phone view: thumb controls and the bigger HUD work, nothing piles up over restarts.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-05] v3.1.3e (branch `experimental-branch`)
- **[Release]** DERAPATE deep clean: scene split (HUD, audio, Lab flag), lighter drawing (triangles, no per-frame garbage), HUD texts only on change, background sound loading, phone pointer fix, new tests. Version 3.1.3-e.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-05] DERAPATE: lighting, and the Lab in LOOK and FEEL tabs (branch `experimental-branch`)
- **[Cleanup]** Deleted the unused `public/assets/donut/car_temp.png`/`.json` and `scripts/donut-car.py`.
- **[Look]** Lighting like the Studio Lab's, always on (where WebGL has shader derivatives): dusk over the junction, four sodium street lamps on the corners (posts, glowing heads, orbs and glows), their light pooling on the ground as isometric ellipses; the car's renders lit with a rim from the lamps' heads as it swings past; headlights ahead of the car and a red tail-light glow; the exhaust flame lights what's round it; a flash of light where a white or blue person is hit; people, smoke and lamp posts lit per face on the CPU; the camera's pass (bloom, grading, vignette, grain, colour fringes, tilt-shift, CRT) on the junction only, the HUD crisp. New `DonutLight.ts` (settings, lamps, maths), `DonutLighting.ts` (on screen), `DonutIso.ts` (the projection).
- **[Shared]** `LitPipeline`: an optional falloff scale (isometric ground) and per-light rim offsets, both defaulting to the fighting game's behaviour; `AtmospherePipeline` takes a narrower settings type and skips its rays pass when there are no rays (saves a 32-sample pass at quarter size in both games); the glow textures are exported. The Studio Lab checked: unchanged.
- **[Perf]** The junction is painted once into a texture instead of re-batching hundreds of Graphics commands every frame; the CPU time per frame is the same lit or not (median 0.5–0.9 ms in the real loop at 120 Hz).
- **[Lab]** Always windowed (no full screen), in two tabs (TAB, or the buttons): LOOK has everything you see or hear (LIGHTS with a lamp editor and rings on screen to drag lamps, CAMERA, CAR, EFFECTS, HUD, SOUND), FEEL how it plays; TEST (restart, freeze, step, slow motion, readouts, live values, find, copy/paste/reset) in both. G switches the lighting off and on to compare. H is gone (L closes the Lab).
- **[Lab]** FEEL simplified from about 50 settings to 19, in plain words and clear units: seconds to the green, seconds to stop, top speed in km/h, tightest and widest donut, seconds in the green, short lift keeps it; how much the wheel wanders (and ×in the green), steering strength, seconds at the edge; a person about every N s, white people %, boost burst %, combo top speed %; points. The rest are hidden on purpose (`HIDDEN`, with reasons) and keep their values; saved or pasted changes to them are skipped.
- **[Fix]** Leaving DERAPATE with the lights switched off in the Lab crashed (the Lab turned them back on after the scene's objects were gone); they now come back on only when the Lab is closed with L.
- **[Tests]** The catalogue: every number shown once or hidden on purpose, ranges hold the defaults, FEEL at most 20; the worked-out settings go both ways; copy/paste with the lamps; the light maths (falloff, lit colours, lamps from JSON, the isometric falloff measuring ground metres). 78 tests.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-05] DERAPATE: times of day, headlight cones, lights off on phones (branch `experimental-branch`)
- **[Look]** Five lighting presets for the times of day, picked in the Lab (LOOK → LIGHTS → TIME OF DAY): dawn (pink first light, lamps going off), daylight (the colours as drawn, no lamps, lamp heads grey), sunset (a warm low light, lamps coming on), blue hour (the defaults) and night (deep blue, strong lamps and headlights). Each sets the same settings (ambient, lamps, glow, car lights, rim, bloom, grading) so a day cycle can fade from one to the next later; the button of the time the light is set to lights up.
- **[Look]** Headlights as two cones of light from the car's front corners, along the way it points (reach and spread in the Lab); people and smoke in the beams are lit too. Lights go to the shaders most important first (lamps, headlights, flame, flashes, then the tail-light glow).
- **[Shared]** `LitPipeline`: optional cone lights (a direction and inner/outer angles per light; none for the fighting game, which looks the same).
- **[Phones]** A LUCI button next to restart and menu switches the lighting off (and back on), remembered on that phone; the Lab no longer opens by itself on a phone (no L key to close it).
- **[Fix]** Opening the Lab twice (L while it was already opening) left a second one behind; the scene now ignores it.
- **[Tests]** Cones (full ahead, fading to the edge, nothing behind), the times of day (same settings each, the blue hour is the defaults, recognised when set). 80 tests.

------------------------------------------------------------------------------------------------------------------------------------
### [2026-10-05] v3.1.4e (branch `experimental-branch`)
- **[Release]** DERAPATE lighting (dusk street lamps, rim-lit car, headlight cones, flashes, camera effects), five time-of-day presets, a LUCI button on phones, and the Lab in windowed LOOK and FEEL tabs with a short FEEL list. Version 3.1.4-e.
