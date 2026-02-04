# Project Version History

| Version | Label | Date | Summary & Minor Tweaks |
| :--- | :--- | :--- | :--- |
| `offline-stable-v2` | **Offline Stable V2** | 2026-02-02 | Best stable offline version before online refactor. |
| `v0.2.0-online-sync` | **Online Sync** | 2026-02-02 | Initial Geckos.io integration with client-authoritative relay. |
| `v0.4.0-scale-map-camera` | **Scale & Map** | 2026-02-03 | Major rework of game dimensions and camera. <br> ↳ Characters scaled to 1:1 (256x256) <br> ↳ Map resized to Brawlhaven style <br> ↳ Dynamic camera ported to Online mode <br> ↳ Implemented MatchHUD with multi-player support <br> ↳ Multi-player Damage/UI doubling fixes |
| `v0.5.0-stocks-rematch` | **Stocks & Rematch** | 2026-02-03 | Core game loop completion and post-game flow. <br> ↳ Stock system (3 lives) implementation <br> ↳ Game Over detection and "PLAYER X WINS" screen <br> ↳ Rematch/Leave voting system <br> ↳ Keyboard & Gamepad menu navigation <br> ↳ **Fix**: Resolved immediate Game Over upon guest join |
| `v0.5.1-physics-tweak` | **Physics & network Tweak** | 2026-02-04 | Polished network sync and physics feel. <br> ↳ **Fix**: Damage Reset Bug (Client/Server sync conflict resolution) <br> ↳ **Fix**: Teleport Glitch (Snap logic for large deltas) <br> ↳ **Tweak**: Massive Knockback Increase (x5) for lighter feel <br> ↳ **Tweak**: Instant Respawn (Removed delay) |

> [!TIP]
> This history is updated automatically after every major commit or push. Use it as a rollback reference if needed.
