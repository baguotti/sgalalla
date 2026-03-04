# Sgalalla - Single-Player Campaign Development Log

---

### [2026-03-04] v2.0.0 - Single-Player Campaign Mode Launch 🎬🗺️
- **[V]** `v2.0.0`
- **[Feat]** **Campaign Manager**:
    - Implemented a 5-opponent ladder system (`CampaignManager.ts`) for single-player progression.
    - Added `SaveService.ts` utilizing `localStorage` to persist campaign progress, active character, and current level.
- **[Feat]** **Cinematic Flow**:
    - Added `CinematicState.ts` to the Player Finite State Machine to suppress inputs and allow programmatic movement during cutscenes.
    - Implemented a lightweight narrative dialogue system (`DialogueScene.ts`) overlay for pre-match banter (Chrono Trigger style).
    - Integrated `transitionToCutscene()` in `GameScene.ts` to orchestrate player tweening and dialogue triggering before matches.
- **[UI]** **Menu Integration**:
    - Added "CAMPAGNA" to `MainMenuScene.ts` routing the player to an exclusive single-player lobby path.
    - Tweaked `LobbyScene.ts` to automatically assign Player 1 and start the campaign ladder sequence upon character selection.
- **[S]** **STATUS**: The foundational framework for the single-player campaign is live.
----------------------------------------------------------------------------------------------------------------------------
### [2026-03-04] v2.0.2 - Campaign Cutscene Polishing 🎬
- **[V]** `v2.0.2`
- **[Feat]** **Dialogue UI Polishing**:
    - Portraits scaled to 2x (512px) for more impact.
    - Icons aligned with dialogue box corners (Left Icon at 10%, Right Icon at 90%).
    - Portraits rendered behind the dialogue box (Depth layering).
    - Expanded dialogue for Nock (4 pages).
- **[Fix]** **Hovering & Gravity**: Players now land naturally during cutscenes while remaining input-frozen.
- **[S]** **STATUS**: Campaign intro is polished and versioned as v2.0.2.
----------------------------------------------------------------------------------------------------------------------------
### [2026-03-04] v2.0.3 - Campaign Multi-Phase Flow ⚔️🎭
- **[V]** `v2.0.3`
- **[Feat]** **Multi-Phase Fight Flow**:
    - **Mid-Fight Cutscene**: Cinematic pause when the opponent reaches 1 life remaining. Players repositioned grounded face-to-face with idle animation.
    - **Custom Defeat Flow**: Dedicated cutscene after eliminating an opponent. Skips standard victory screen and rematch prompt entirely.
    - **Opponent Transitions**: Smooth 2000ms black fade between campaign opponents.
- **[Fix]** **Cinematic Physics Rearchitecture**:
    - Skipped `physics.update()` / `syncFromBody()` during `CinematicState` to prevent stale body data overwriting manual positioning.
    - Manual velocity→position still applied for intro gravity.
    - Fixed `animationKey` not being reset, causing characters to freeze in death/fall sprites.
- **[Fix]** **Attack Animation**: Eliminated 1-frame light punch flash at end of heavy attacks (`AttackState.getAnimationKey` fallback changed to `'idle'`).
- **[S]** **STATUS**: Campaign story flow is functional with mid-fight and defeat cutscenes.
----------------------------------------------------------------------------------------------------------------------------


### [2026-03-04] v2.0.4 - Cutscene Polish & Visual Progression 🎨🎬
- **[V]** `v2.0.4`
- **[Feat]** **Fade Transitions**:
    - Mid-fight and defeat cutscenes now use fade-to-black (1s out → setup → 1s in) transitions instead of hard cuts.
    - Players are grounded and playing idle animation when the scene fades in.
- **[Feat]** **Desaturation Visual Progression**:
    - Background and platform textures start 66% desaturated using `postFX.addColorMatrix().saturate()`.
    - Saturation progressively restores with each opponent life lost (3s smooth tween per life).
    - Opponent character is NOT desaturated (only environment).
    - Switched from `preFX` to `postFX` to prevent background image cropping on scaled sprites.
- **[Fix]** **Grounded Enforcement**: All three cutscene types (intro, mid-fight, defeat) now force both players to Y=750 with `isGrounded=true`, `velocity.set(0,0)`, and `playAnim('idle', false)`.
- **[Fix]** **Tint Location**: Moved saturation restoration from `killPlayer()` (only fired at 0 lives) to `checkBlastZones` (fires on every death) so visual progression is gradual.
- **[S]** **STATUS**: Campaign visuals and flow are polished and immersive.
