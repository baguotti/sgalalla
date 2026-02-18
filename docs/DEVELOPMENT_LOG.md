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