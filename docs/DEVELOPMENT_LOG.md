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

### [2026-02-16] v0.12.2 - "Buttery Smooth" Input 🧈
- **[V]** `v0.12.2`
- **[Feat]** **Input Buffering**: Added 100ms buffer window for inputs.
    - **Jump/Dodge**: Can now be queued 6 frames before landing/action ends.
    - **Combat**: Attack inputs pressed during cooldowns or hitstun are stored and execute on first available frame.
    - **Technical**: Created `InputBuffer.ts` and integrated into `PlayerPhysics` and `PlayerCombat`.
- **[Docs]** **Technical Briefs**: Added deep-dive analysis on State Machines and Determinism.

---

### [2026-02-16] v0.12.1 - Stage Factory & Deduplication
- **[V]** `v0.12.1`
- **[Refactor]** **StageFactory**: Created `src/stages/StageFactory.ts` to centralize stage creation logic.
    - **Deduplication**: Removed ~165 lines of duplicate code from `GameScene.ts` and `OnlineGameScene.ts`.
    - **Type Safety**: Introduced `GameSceneInterface` to enforce safe scene access in entities.
    - **Stability**: Ensures identical stage layout (platforms, walls, blast zones) for both Local and Online modes.
- **[Fix]** **Types**: Resolved `as any` technical debt in `PlayerCombat.ts`, `Bomb.ts`, and `Chest.ts` (partial).

---
