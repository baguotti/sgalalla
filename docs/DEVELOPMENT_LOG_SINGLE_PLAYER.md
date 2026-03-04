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
