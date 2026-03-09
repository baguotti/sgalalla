# Agent Rules & Skills Index

This document defines the core architecture, development protocols, and specialized skills for the Sgalalla project.

## 🏗️ Core Architecture & Protocol (v1.2.0)

### Project Vision
A snappy, high-fidelity platform fighter (Brawlhalla-style). Features deterministic physics, local and online multiplayer (Geckos.io), and a 6-character roster.

### Technical Architecture
1.  **Character Logic (FSM)**: Driven by a Finite State Machine. `Player.ts` delegates to `StateMachine`. States (e.g., `Idle`, `Attack`) are in `src/state/states/`.
2.  **Physics Simulation**: Source of truth is `shared/PhysicsSimulation.ts`. `PlayerPhysics.ts` is a thin wrapper.
3.  **Multiplayer**: Geckos.io (UDP/WebRTC). Client-authoritative movement. SNAPSHOT interpolation (60ms delay) for remotes.
4.  **UI Camera**: Dedicated `uiCamera`. Always use `uiCamera.ignore(newGameObject)` for game entities.

### Update Protocol & Versioning
- **Dual Devlogs**:
    - `DEVELOPMENT_LOG.md`: Main online version. Uses **V1.x.x**.
    - `DEVELOPMENT_LOG_SINGLE_PLAYER.md`: Experimental Single Player campaign. Uses **V2.x.x**.
- **Context-Aware Logging**: Update the correct devlog based on the feature being developed. If working on campaign features, log in the Single Player devlog and bump the V2.x.x version. **DO NOT MIX** the two versions.
- **Logging Format**: Use tags `[V]`, `[Feat]`, `[Fix]`, `[Refactor]`, `[Polish]`, `[S]` in the appropriate devlog.
- **PROCEDURE**: When requested: Bump correct version in `package.json`, Sync version in `MainMenuScene.ts`, Update the relevant devlog, Commit with `v[VERSION]: [Summary]`, and Push.

## 📦 Build Organization Rule
When compiling executables, they must be neatly organized into specific folders:
- **Mac builds**: `/Users/riccardofusetti/Documents/Coding/sgalalla/release/mac`
- **Windows builds**: `/Users/riccardofusetti/Documents/Coding/sgalalla/release/win`
- **Cleanup**: Whenever a new version is compiled, the previous version in the target folder must be deleted first.

## 🛠️ Meta Skills

### [Skill Creator](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/skill-creator/SKILL.md)
**Use when:** Creating new skills or saving current work as a reusable skill.

## 🎮 Game Development

### [Fighting Game State Machine](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/fighting-game-state-machine/SKILL.md)
**Use when:** Implementing character logic (attacks, movement, states).

### [Hitbox & Frame Data](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/hitbox-frame-data/SKILL.md)
**Use when:** Defining attacks, active frames, and collisions.

### [Phaser UI Camera Ghosting](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/phaser-ui-camera-ghosting/SKILL.md)
**Use when:** Adding new objects to a scene with a UI camera or fixing platform duplication.

### [Deterministic Input Buffer](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/deterministic-input-buffer/SKILL.md)
**Use when:** Handling player input for combos or rollback networking.

### [Phaser + Geckos.io Networking](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/phaser-geckos-networking/SKILL.md)
**Use when:** Building multiplayer features, player synchronization, or handling game state.

### [Phaser Optimization](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/phaser-optimization/SKILL.md)
**Use when:** Writing game loops, creating game objects, or debugging performance issues.

### [DigitalOcean Deployment](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/digitalocean-deploy/SKILL.md)
**Use when:** Setting up or troubleshooting the production server.

## ⚛️ Web Development

### [React Best Practices](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/react-best-practices/SKILL.md)
**Use when:** Writing UI components or frontend logic.

### [Web Design Guidelines](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/web-design-guidelines/SKILL.md)
**Use when:** Styling the game UI or landing page.

## 📱 Mobile

### [React Native Skills](file:///Users/riccardofusetti/Documents/Coding/sgalalla/.agent/skills/react-native-skills/SKILL.md)
**Use when:** Porting to mobile or working on a companion app.
