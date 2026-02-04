# Project Sgalalla - Development Log

**Total Time Logged:** 7.5 Hours

## Session Log

| Date       | Duration | Task Summary |
|------------|----------|--------------|
| Previous   | 4h 0m    | Baseline from RTF file (Initial setup, core research?) |
| 2026-01-29 | 3h 30m   | Restored Brawlhalla mechanics (Run, Dodge, Recovery, Platform Drop), Fixed Physics Config, Tuned movement feel. |
| 2026-02-04 | 1h 30m   | v0.5.1 - Fixed Online Damage Reset Bug & Teleport Glitch. Increased Knockback (x5). |

## v0.5.1 Changelog
- **Fixed Damage Reset**: Implemented overrides for remote players to rely solely on server state for damage values, preventing local glitches.
- **Fixed Teleport Glitch**: Added "snap" logic for large position corrections (>500px).
- **Physics Tweak**: Massive knockback increase (Light: 7000, Heavy: 12000) for testing dynamic blasts.
