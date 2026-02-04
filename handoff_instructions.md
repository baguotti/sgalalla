# Handoff: Sgalalla Development (2026-02-03)

## Context
Project: Platform Fighter (Brawlhalla-style).
Current Version: `v0.5.0-stocks-rematch`
Source of Truth: [history.md](file:///Users/macstudio-smalloffice/Documents/__TEST/sgalalla/history.md)

## Progress Today
1. **Scale & Map (v0.4.0)**:
   - Characters scaled to 256x256. Physics tuned for 1:1 scale.
   - Map resized to Brawlhaven style.
   - Dynamic zoom camera implemented for Online mode.
2. **Stocks & Rematch (v0.5.0)**:
   - Stock system: 3 lives per player. Decremented on blast zone exit.
   - Game Over: Triggers at 1 survivor; displays "PLAYER X WINS".
   - Rematch System: Multi-player voting relay via server; resets state on all-ready.
   - Menu Nav: Added Keyboard (Arrows/AD/Space) and Gamepad poll-based navigation.
3. **Key Fixes**:
   - Fixed immediate Game Over on guest join (server relay was skipping `lives`).
   - Fixed UI doubling/camera exclusion issues in online mode.

## Next Steps
- Verify stock-loss persistence across high-latency joins.
- Enhance Game Over UI with more "WOW" aesthetics (animations/vFX).
- Monitor `OnlineGameScene.ts` for stale lint errors on `lastSurvivor` type inference (code is correct).

## Environment
- Local dev: `npm run dev`
- Server (Geckos): `cd server-geckos && npm run dev`
