# Sgalalla - Development Log

Part 2



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
