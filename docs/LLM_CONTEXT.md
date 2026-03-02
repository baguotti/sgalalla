# Sgalalla - LLM Context & Protocol (v1.2.0)

> [!IMPORTANT]
> **MANDATORY**: Read this file first in every new session. It defines the core architecture and development protocols for the Sgalalla platform fighter.

## Project Vision
A snappy, high-fidelity platform fighter (Brawlhalla-style). Features deterministic physics, local and online multiplayer (Geckos.io), and a 6-character roster.

## Sources of Truth
1. [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md): Full technical history and feature trace.
2. [shared/PhysicsSimulation.ts](../shared/PhysicsSimulation.ts): The "Source of Truth" for all movement and collision logic.

## Technical Architecture

### 1. Character Logic (FSM)
Character behavior is driven by a **Finite State Machine (FSM)**.
- **Core**: `Player.ts` delegates logic to `fsm: StateMachine`.
- **States**: 15+ discrete classes in `src/state/states/` (e.g., `Idle`, `Run`, `Attack`, `HitStun`, `GroundPound`).
- **Logic**: Each state handles its own `enter`, `update`, and `exit` hooks, managing animations and transitions.

### 2. Physics Simulation
- **Shared Logic**: All physics math resides in `shared/PhysicsSimulation.ts`. This module is platform-agnostic and used by both Client and Server.
- **Thin Wrapper**: `PlayerPhysics.ts` acts as a thin wrapper that:
    1. Syncs current state to a `SimBody` interface.
    2. Calls `stepPhysics(body, input, dt)`.
    3. Syncs the resulting body back to Phaser properties.
    4. Processes `PhysicsEvent` results (SFX, landings, FSM triggers).

### 3. Multiplayer & Networking
- **Authority**: Client-authoritative for player movement to ensure "perfect" local feel.
- **Protocol**: Uses Geckos.io (UDP/WebRTC).
- **Redundancy**: Every input packet contains a ring buffer of the last 10 frames of input to mitigate UDP packet loss.
- **Sync**: Remote players are interpolated from snapshots with a tunable `RENDER_DELAY_MS` (currently 60ms).

### 4. Assets & UI
- **Atlases**: Characters (fok, sgu, sga, pe, nock, greg) use texture atlases.
- **UI Tracking**: `GameScene` uses a dedicated `uiCamera`. Always call `uiCamera.ignore(newGameObject)` for game-world entities.
- **Controls**: Hold-to-show behavior for [F1] / Gamepad [LB].

---

## Update Protocol (MANDATORY)

### Logging Prefix System
When updating `DEVELOPMENT_LOG.md`, use these tags:
- `[V]` **Version** (e.g., `v1.2.0`)
- `[Feat]` **Feature**: New functionality.
- `[Fix]` **Fix**: Bug resolutions.
- `[Refactor]` **Refactor**: Architectural changes/cleanup.
- `[Polish]` **Polish**: Visual/Audio/UX improvements.
- `[S]` **Status**: Current project health/readiness.

### PROCEDURE Protocol
When the user says "**PROCEDURE**", perform these EXACT steps:
1.  **Bump Version**: Update `package.json` (e.g., `1.2.1`).
2.  **Update UI**: Sync version string in `MainMenuScene.ts`.
3.  **Log**: Add latest changes to `docs/DEVELOPMENT_LOG.md` (chronological).
4.  **Commit**: Message format: `v[VERSION]: [Short Summary]`.
5.  **Push**: Execute `git push` to deploy online.

## Development Commands & URLs
- **Client**: `npm run dev` (Vite on port `5175`). URL: `http://localhost:5175`
- **Server**: `npm run server` (Kills port `9208` then starts Geckos). URL: `http://localhost:9208`
- **Deployment**: `./deploy_client.sh` and `./deploy_server.sh` (Pass: 3003)
- **Node**: v25.6.0+
