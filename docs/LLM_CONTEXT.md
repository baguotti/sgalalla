# Sgalalla: context for AI assistants

> Read this first. It describes the game as it is today (v3, September 2026); `DEVELOPMENT_LOG.md` has the history.

## What it is
Super Smash Fioi: a 2 to 4 player platform fighter in the style of Brawlhalla, built with Phaser 3.90 and TypeScript. Local matches, CPU opponents, online matches of up to 4 players with rollback netcode, a single-player campaign (work in progress) and the Studio Lab for the lighting experiment.

## Branches
- `main`: the official release (v3.0.x), live at http://138.68.126.112. The campaign is hidden from its menu.
- `experimental-branch`: work in progress (v3.0.xe): the release plus the campaign, the lighting experiment and the Studio Lab.
- Old branches are archived as `archive/*` tags.

## Architecture

### The simulation (`shared/`)
All gameplay is a deterministic simulation of plain data: no Phaser, no wall-clock time, no `Math.random`, no `Math.sin`/`cos`.
- `GameSim.ts`: `MatchState` and `stepMatch(match, inputs, events)`, one step of exactly 1/60 s.
- `FighterState.ts`: a fighter's data, its input buffer and its state machine (states are names, not classes).
- `PhysicsSimulation.ts` + `PhysicsConfig.ts`: movement, jumps, dodges, walls, platforms.
- `Combat.ts` + `AttackData.ts`: attacks, charging, ground pound, recovery, signature ghosts, hits and knockback (knockback directions are precomputed numbers).
- `FixedStepClock.ts`: turns real frame time into whole 60 Hz steps, on a steady beat on 120 Hz screens.
- `Rollback.ts`: rollback netcode for 2 to 4 players; `NetProtocol.ts`: messages, packet layout, `PROTOCOL_VERSION`.

Changing gameplay means changing the simulation, and then:
1. bump `PROTOCOL_VERSION`, so builds with different rules can't meet online;
2. run `npm run replays:update`, which stores the recorded matches' new outcomes (`tests/replays/`, checked step by step by `npm test`).

### Movement (experimental branch), after Brawlhalla
- Ground: running; **dodge + direction dashes** (not invincible, no dodge cooldown; a jump, attack or spot dodge cancels it). A **jump out of a dash** is low and fast and coasts.
- Air: 1 ground jump + 2 air jumps; **hold down to fast fall**; falls stop accelerating at a terminal speed.
- **Dodges** are invincible: a spot dodge on the ground, a spot or **8-way dodge in the air**. Cooldown 1 s on the ground, 2.7 s in the air, shortened by landing.
- **Chase dodge**: after a hit, a directional dodge cancels the rest of the attack, costs no cooldown, and an attack cancels it. Otherwise attacks can't be dodge cancelled.
- **Gravity cancel**: an attack out of an aerial spot dodge is the grounded move.
- **Walls** give back the air jumps and the recovery; after 9 air actions without landing, hitting or being hit, walls stop holding the fighter (wall slip).
- **Hitstun** takes all control away; a hit gives a fighter out of jumps one back.
- Every value is in `PhysicsConfig.ts`; `tests/movement.test.ts` checks each rule.

### The view (`src/`)
Phaser only draws and reads input.
- `scenes/GameScene.ts`: the match scene for every mode (versus, training, campaign, online, Studio Lab). Each drawn frame it runs the simulation steps that are due, then draws.
- `entities/Player.ts`: draws a fighter from its simulation state, and reads its input from the keyboard, a gamepad, touch, the CPU (`player/PlayerAI.ts`) or the network.
- Sounds and effects react to the simulation's `MatchEvent`s.
- `network/`: `NetClient` (Geckos.io over WebRTC) and `OnlineMatch` (the rollback session).
- `lighting/`: the lighting experiment: lit sprites with rim light, the camera's post-processing, the Studio Lab. Drawing only.
- `stages/`: stage visuals (`StageFactory`) and backgrounds (`StageBackgrounds`: a match loads only its own, menus use small previews). The Studio Lab draws Londra in layers instead (`LondraLayers`): an engine sky gradient, cloud pieces repeated behind and in front of the island, each layer with its own position, size, parallax, opacity, rim and order (even in front of the fighters), all tunable in the Lab. Lights can sit behind any layer (`behind:<element>`), at its depth and parallax; the island and clouds use the `scenery` lit group, where a light behind an object outlines its silhouette instead of lighting its face.
- The HUD is drawn by a second camera (`uiCamera`); world objects must be hidden from it with `uiCamera.ignore(obj)`.

### The server (`server-geckos/index.ts`)
Rooms of 2 to 4 players, the match start (seed and input delay), and a relay for input packets. It doesn't simulate. PM2 runs it on the droplet.

## Testing
- `npm test`: recorded matches replay exactly, rollback players agree over a lossy simulated network, combat and KO rules.
- Recording a replay: dev server, `http://localhost:5175/?record`, play, F9.
- Several online clients on one machine: `npm run server` and `npm run dev`, then `/tests/online.html?clients=4&lag=50&loss=5`.

## Commands
- `npm run dev` (Vite, port 5175), `npm run server` (game server, port 9208), `npm run build`, `npm test`.
- Deploying the release, from `main`: `ssh-add ~/.ssh/id_rsa` once, then `./deploy_server.sh` and `./deploy_client.sh`, always together.
- Packing a character's sprites into its atlas: `node scripts/pack-character.cjs <character> <folder of sprites>`.
- Londra's layers from the full-size artwork: `python3 scripts/londra-layers.py "../assets/Stages/Londra/Layers"` (Pillow, numpy, cwebp).

## Update protocol

### Devlog tags
Entries in `DEVELOPMENT_LOG.md` use: `[Feat]` feature, `[Fix]` bug fix, `[Refactor]` restructuring and cleanup, `[Polish]` visual, audio and UX polish, `[Deploy]` deployment, `[S]` status and how it was verified.

### PROCEDURE
When the user says "**PROCEDURE**":
1. Bump the version in `package.json` (and `package-lock.json`); the main menu shows it by itself. Experimental versions end in `-e` (`3.0.1-e` shows as v3.0.1e).
2. Log every change since the previous version in the devlog.
3. Commit as `v[VERSION]: [short summary]` and push. Deploying is separate: only when asked.
