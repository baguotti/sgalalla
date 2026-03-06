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
### [2026-03-04] v2.0.5 - Randomized Ladder & UI Polish 🎲✨
- **[V]** `v2.0.5`
- **[Feat]** **Dynamic Campaign Ladder**:
    - Implemented randomized opponent order (shuffled excluding player's character).
    - **Mirror Match**: Final boss is now always a mirror match of the player's character.
    - **Persistence**: Ladder order is now saved in `localStorage`, persisting through reloads.
    - **Reset Logic**: Campaign now automatically resets if the player selects a different character mid-run.
- **[Feat]** **Character Expansion**:
    - Added **Greg** as a playable and campaign opponent with unique dialogue and animations.
- **[UI]** **HUD & Aesthetic Polish**:
    - Opponent name color changed to white in HUD while keeping the diamond indicator dark grey.
    - Dialogue speaker names increased to `36px` font size for better clarity.
    - **Main Menu Optimization**: Reduced font size (`48px` -> `40px`) and vertical spacing (`70px` -> `55px`) to ensure all 5 options fit on screen without cropping.
- **[Fix]** **Stale Save Protection**: Constructor now auto-clears invalid legacy save data missing the `ladderOrder` field.
- **[S]** **STATUS**: Campaign logic is now dynamic and fully scalable. UI optimized for readability.
### [2026-03-04] v2.1.0 - Save System & Campaign Interstitials 💾🎬
- **[V]** `v2.1.0`
- **[Feat]** **Save File System**:
    - Implemented a Pokémon-style 3-slot save system (`SaveFileScene.ts`).
    - **Persistence**: Slots track character, progress (e.g. "3/6"), and total play time in milliseconds.
    - **Migration**: Legacy single-key saves are automatically imported into Slot 0 on first launch.
- **[Feat]** **Campaign Screens**:
    - Added `CampaignTitleScene` ("ROAD TO LAMICIZIA") as a pre-lobby interstitial.
    - Added `CreditsScene` placeholder after final boss defeat.
    - Both screens are skippable via keyboard/gamepad or auto-advance on timer.
- **[UI]** **Campaign Lobby Refinement**:
    - Campaign lobby now shows only one central character slot.
    - Slot theme changed from red to **white** for a more premium "single player" aesthetic.
- **[Dev]** **Secondary Deployment**:
    - Created `deploy_campaign.sh` to host the campaign branch on port `8080` concurrently with the main site.
- **[Fix]** **TypeScript Scope Errors**: Resolved scoping issues with Phaser event listeners in title/credits scenes.
- **[S]** **STATUS**: Campaign experience is now feature-complete with persistent multi-save support.
----------------------------------------------------------------------------------------------------------------------------
### [2026-03-04] v2.1.1 - Campaign Opponent Visuals 🎨
- **[V]** `v2.1.1`
- **[Feat]** **Opponent Desaturation**:
    - Campaign opponents now start with the same -0.5 desaturation effect as the background and platforms.
    - Saturation restoration is perfectly synced with the background/platforms on opponent death.
- **[Fix]** **Damage Tinting**:
    - Removed the red/orange flashing damage tint applied to campaign opponents to preserve the aesthetic desaturation effect.
- **[S]** **STATUS**: Opponent visuals in campaign mode are aligned with the environment.
----------------------------------------------------------------------------------------------------------------------------
### [2026-03-04] v2.1.2 - Campaign Fog Overlay 🌫️
- **[V]** `v2.1.2`
- **[Feat]** **Atmospheric Fog**:
    - Added a 1:1 scale scrolling fog overlay (`fog_full_compressed.png`) to campaign matches.
    - Fog scrolls smoothly left-to-right across the foreground at depth 20 (`alpha: 0.6`).
    - Uses `TileSprite` attached to the camera (`scrollFactor: 0`) and `uiCamera` exclusions so it sits perfectly behind UI.
- **[S]** **STATUS**: Campaign atmosphere increased.


### [2026-03-06] v2.2.0 - Training Mode & Dialogue Overhaul 🥋🗣️
- **[V]** `v2.2.0`
- **[Feat]** **Training Mode on Defeated Islands**:
    - Reaching a defeated island now prompts a training match with the opponent.
    - Added YES/NO choice system with keyboard/gamepad/mouse support.
    - Integrated character-specific training dialogues.
- **[Refactor]** **Dialogue Data Centralization**:
    - Moved all hardcoded scene dialogue into character-specific files (`nock.ts`, `pe.ts`, `sgu.ts`, `sga.ts`, `fok.ts`, `greg.ts`).
    - Added new exports for `dialogueTrainingPrompt`, `dialogueTrainingWin`, and `dialogueTrainingLose`.
- **[Fix]** **Dialogue Stability**:
    - Replaced the standalone `DialogueScene` overlay on the map with a native inline prompt in `CampaignMapScene` to fix texture loading issues and silent crashes.
    - Implemented input debounce (300ms) on prompt confirmation to prevent "key bleed through" when entering an island.
- **[UI]** **Visual Polish**:
    - Matched training prompt name styling (32px bold, white, 8px stroke) and box positioning (50px from bottom) exactly to in-game standard.
    - Dynamic opponent icons and names now display correctly above the prompt box.
- **[S]** **STATUS**: Campaign map exploration feel is now complete with repeatable training bouts.

### [2026-03-06] v2.2.1 - La Sala Prove Stage 🎸
- **[V]** `v2.2.1`
- **[Feat]** **New Stage: La Sala Prove**:
    - Implemented a dedicated training/fight background for Nock.
    - Uses the same balanced platform layout as Adria with a new musical-themed background asset.
- **[Refactor]** **Dynamic Stage Loading**:
    - Refactored `StageFactory.ts` to support dynamic background textures.
    - Updated `GameScene.ts` to load the appropriate stage background based on the campaign opponent.
- **[S]** **STATUS**: Visual variety improved for campaign progression.
