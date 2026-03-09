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

### [2026-03-06] v2.2.2 - Settings & Minimap Visual Polish 🎨🗺️
- **[V]** `v2.2.2`
- **[Feat]** **Minimap Visual Overhaul**:
    - Integrated `Minimappa_001.jpg` as a tinted background and added a decorative 16-bit rounded frame.
    - Added a subtle path of glowing stars connecting the floating islands.
    - Restored the "ROAD TO LAMICIZIA" title to the top of the map persistently.
    - Added player portrait and name UI at the bottom-left of the minimap frame.
    - Implemented a subtle white text glow for the actively selected island name.
- **[UI]** **Save File Refinement**:
    - Cleaned up save cards by removing the "Avversari sconfitti" line.
    - Updated playtime format to `MM:SS` and switched text color to white.
    - Adjusted idle sprite positioning (+17px) to resolve overlap issues in Slot 0.
- **[Fix]** **Settings & Flow**:
    - Resolved Audio/Video settings bugs (volume controls & BACK button) caused by Italian/English string mismatches.
    - Simplified CRT intensity setting to a binary ON/OFF toggle.
    - Fixed `CampaignTitleScene` skippability by switching to persistent input listeners.
- **[S]** **STATUS**: Minimap and settings menus are now polished and fully functional for v2.2.2.

### [2026-03-06] v2.2.3 - Campaign Defeat Flow & Save Management 💀💾
- **[V]** v2.2.3
- **[Feat]** **Campaign Defeat Flow**:
    - Implemented a "Retry" dialogue upon match loss in campaign mode.
    - Added a cinematic fade-to-black transition before presenting the retry choices.
    - Integrated character-specific defeat dialogue lines (dialogueCampaignLose) across all fighters.
- **[Feat]** **Save File Management**:
    - Added a "CONTINUA" / "ELIMINA" submenu when selecting an occupied save slot.
    - Implemented a red-bordered confirmation dialog ("Sei sicuro di voler cancellare...?") for save deletion.
    - Fixed navigation logic to fully support horizontal D-Pad and Keyboard Arrow inputs for YES/NO choices.
- **[S]** **STATUS**: Campaign defeat flow is now respectful of the story, and save management is safer and more professional.

### [2026-03-07] v2.2.4 - Minimap Opponent Sprites 🗺️👤
- **[V]** v2.2.4
- **[Feat]** **Defeated Opponent Sprites**:
    - Defeated opponents now appear as idle sprites next to their respective islands on the campaign minimap.
    - Sprites float in sync with the islands and are scaled/flipped to face the island.
    - Implemented dynamic animation generation for all opponent characters on the map.
- **[S]** **STATUS**: The minimap now feels alive and shows visual progress of the player's conquests.
---
### [2026-03-07] v2.2.5 - Campaign Persistence & Asset Optimization 💾🎨
- **[V]** `v2.2.5`
- **[Feat]** **Campaign Persistence**:
  - Removed all auto-deletion logic triggered by campaign completion.
  - Completed save files are now permanently stored and selectable from the Save Menu.
  - Players can revisit a "conquered" campaign to engage in training matches with any opponent on the map.
- **[Feat]** **La Sala Prove Optimization**:
  - Converted the high-res "La Sala Prove" background asset to WebP (840KB), significantly improving load times.
- **[Fix]** **Background Scaling Fix**:
  - Standardized `StageFactory.ts` to use width-based scaling. All backgrounds (specifically Adria and Sala Prove) now use a consistent `scaleX * 2.0` zoom factor.
- **[Dev]** **Campaign Architecture Audit**:
  - Performed a deep technical audit of the single-player systems, identifying paths for future state-machine based refactors and input handling optimizations.
- **[S]** **STATUS**: Campaign longevity is secured with persistent saves and optimized high-res assets.

### [2026-03-07] v2.2.6 - Map Selection & Campaign Polish 🌍🗺️
- **[V]** `v2.2.6`
- **[Feat]** **Map Selection Screen**:
    - Added a dedicated map selection phase for Versus and Training modes.
    - P1 can pick between Adria, La Sala Prove, Sguzia, and Londra with real-time preview thumbnails.
- **[Feat]** **New High-Res Maps**:
    - Integrated optimized WebP backgrounds for Londra (Fok), Sguzia (Sga), and La Sala Prove (Nock).
- **[Feat]** **Campaign UX Polish**:
    - **Re-challenge Saturation**: Removed visual desaturation for re-challenge/training matches; the cinematic color restoration now only applies on first encounters.
    - **Pause Menu**: Cleaned up "versus" options in campaign mode; added "Ritorna alla mappa".
- **[Fix]** **Stability & Logic**:
    - Fixed a critical `TypeError` crash when restarting matches (stale FX reference cleanup).
    - Fixed training mode input priority bug where character cycling blocked map selection.
    - Fixed player spawning at the correct island when returning to the map.
    - Resolved blast zone infinite sound loop glitch.
- **[S]** **STATUS**: Campaign experience is polished and visually upgraded; new flexible map selection available in local modes.

### [2026-03-08] v2.2.7 - Campaign Architecture & Stability Audit 🧩🔧
- **[V]** `v2.2.7`
- **[Refactor]** **Campaign Architecture**:
    - Centralized campaign initialization logic into `CampaignManager.ensureActive()` to eliminate duplication between scenes.
    - Added type-safe `getCurrentLevel()` getter, removing unsafe `as any` private field access across the codebase.
    - Centralized character-to-stage mapping in `CampaignIslandData.ts` to replace nested ternaries and simplify expansion.
- **[Fix]** **Campaign Flow & UX**:
    - Fixed a bug where players were reset to the first island after a campaign win; now correctly positions on the just-defeated opponent.
    - Added a smooth 500ms fade-out transition to `CampaignTitleScene` for visual consistency.
    - Resolved a memory leak in `CampaignMapScene` by ensuring gamepad update listeners are cleaned up on scene shutdown.
- **[Perf]** **Input Optimization**:
    - Optimized `CampaignMapScene` by caching keyboard keys in `create()`, reducing per-frame overhead.
- **[Cleanup]** **Save System**:
    - Removed unused deprecated legacy methods from `SaveService.ts`.
- **[S]** **STATUS**: Campaign core architecture is now robust, type-safe, and leak-free.

----------------------------------------------------------------------------------------------------------------------------
### [2026-03-08] v2.2.8 - Stage Platform Upgrades & Asset Optimization 🏗️🎨
- **[V]** `v2.2.8`
- **[Feat]** **Londra Stage Upgrade**:
    - Integrated custom-themed platforms (Main, Side, Top) with converted WebP assets for optimal performance.
- **[Feat]** **Sguzia Stage Upgrade**:
    - Integrated custom-themed platforms (Main, Side, Top) with converted WebP assets.
- **[Perf]** **Asset Optimization**:
    - Converted all new platform assets from PNG to WebP using `convert_to_webp.sh`, achieving significant file size reductions (e.g., Sguzia Main: 1.0MB -> 86KB).
- **[Refactor]** **Stage Logic**:
    - Updated `AnimationHelpers.ts` to support map-specific platform loading.
    - Enhanced `StageFactory.ts` with dynamic platform texture selection based on the active background.
- **[S]** **STATUS**: Stage visuals are becoming more distinct and performance-optimized.
---
### [2026-03-09] v2.2.9 - Electron ESM Fixes & Build Organization 📦🔧
- **[V]** `v2.2.9`
- **[Fix]** **Electron ESM Compatibility**:
    - Renamed `main.ts` and `preload.ts` to `.cts` to force CommonJS output as `.cjs`.
    - Resolved `ReferenceError: exports is not defined` in ES module scope.
- **[Fix]** **Packaged App Rendering**:
    - Configured Vite `base: './'` to ensure relative asset paths when served via `file://`.
    - Resolved black screen issue in the packaged Mac application.
- **[Fix]** **Online Multiplayer Connectivity**:
    - Added fallback to production droplet IP (`164.90.235.15`) in `NetworkManager` for Electron environments.
    - Fixed black screen when entering "Botte in Remoto" on macOS.
- **[UI]** **App Branding**:
    - Configured custom application icon (512x512) for Mac and Windows builds.
- **[Refactor]** **Build Organization & Cleanup**:
    - Implemented organized output folders: `release/mac` and `release/win`.
    - Added automatic cleanup logic in `package.json` to delete previous builds before a new one.
- **[Refactor]** **Agent Protocol & Rules**:
    - Integrated `LLM_CONTEXT.md` into `AGENTS.md` and established strict dual-devlog/versioning protocol (V1 for Main, V2 for Single Player).
- **[S]** **STATUS**: Electron packaging issues resolved and versioning protocols formalized.
