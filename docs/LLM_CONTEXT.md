# Sgalalla: context for AI assistants

> Read this first. It describes the game as it is today (v3, September 2026); `DEVELOPMENT_LOG.md` has the history.

## What it is
Super Smash Fioi: a 2 to 4 player platform fighter in the style of Brawlhalla, built with Phaser 3.90 and TypeScript. Local matches, CPU opponents, online matches of up to 5 players with rollback netcode (experimental branch; 4 on main), a single-player campaign (work in progress) and the Studio Lab for the lighting experiment.

## Branches
- `main`: the official release (v3.0.x), live at http://138.68.126.112. The campaign is hidden from its menu.
- `experimental-branch`: work in progress (v3.0.xe): the release plus the campaign, the lighting experiment and the Studio Lab. Live at http://138.68.126.112:8081 with its own game server on port 9209 (the client picks 9209 when the page is on port 8081; 8080 is DERAPATE's).
- Old branches are archived as `archive/*` tags.

## Architecture

### The simulation (`shared/`)
All gameplay is a deterministic simulation of plain data: no Phaser, no wall-clock time, no `Math.random`, no `Math.sin`/`cos`.
- `GameSim.ts`: `MatchState` and `stepMatch(match, inputs, events)`, one step of exactly 1/60 s.
- `FighterState.ts`: a fighter's data, its input buffer and its state machine (states are names, not classes).
- `PhysicsSimulation.ts` + `PhysicsConfig.ts`: movement, jumps, dodges, walls, platforms.
- `Combat.ts` + `AttackData.ts`: attacks, charging, ground pound, recovery, signature ghosts, hits and knockback (knockback directions are precomputed numbers).
- `FixedStepClock.ts`: turns real frame time into whole 60 Hz steps, on a steady beat on 120 Hz screens.
- `Rollback.ts`: rollback netcode for 2 to 5 players, and players leaving mid-match (`playerLeft`: every copy retires their fighter the frame after the last input the server has from them); `NetProtocol.ts`: messages, packet layout, `PROTOCOL_VERSION`.
    - Rollback window `MAX_ROLLBACK` 16 frames: one player's network spike or stalled frame makes the others roll back further instead of freezing. Online the clock keeps the time a stalled frame lost and catches it up, 4 steps a frame (`ONLINE_BACKLOG_STEPS`), so whoever stalled gets level again instead of the others waiting. Packets go once per simulated frame. The debug overlay (Q) shows, for each other player, how many frames behind their inputs arrive and their packet loss: the player with the big number is the slow connection.

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
- **Moving** (Brawlhalla's feel, sized to the 6.4-fighter-wide main stage): a run speed and an air speed reached in a few steps (`RUN_SPEED`/`GROUND_ACCEL`, `AIR_SPEED`/`AIR_ACCEL`; a run crosses the main stage in 1.8 s), crisp stops on the ground and a short ease-off in the air (`AIR_DECEL`). Attacks own the movement on the ground to their end (recovery is stuck); in the air they drift at `AIR_ATTACK_DRIFT` of the air speed, so a move carries the fighter under a fighter's height. Gravity 4300: a full jump rises 1.55 fighters, an air jump 1.3, a short hop 0.8; letting go of jump cuts only a jump's rise (`isJumpRising`), not a dash jump, wall jump, recovery or launch.
- **Launches**: the knockback speed loses a steady amount along its angle (`LAUNCH_DECEL`, Brawlhalla's Defense rule) under light gravity (`HITSTUN_GRAVITY`): a flight goes speed²/2 × decel far, so soft hits barely push and hard hits fly. The launch (`isLaunched`) outlasts the stun until the fighter lands, jumps, dodges, recovers or slows below `LAUNCH_END_SPEED`, and out of stun it can drift against it.
- **Hitstun** takes all control away for the move's stun frames, and longer while the fighter still flies fast; a hit gives a fighter out of jumps one back.

### Combat (experimental branch): Brawlhalla's Unarmed
- Every move in `AttackData.ts` carries Unarmed's frame data (brawlhalla.wiki.gg), every fighter on the same average stats: damage, fixed and variable force, stun, and startup, active, recovery (on a hit and a miss) and cooldown (on a hit and a miss), in frames (sim steps). A multi-hit string is one hit with the string's damage; a hit ends the move's active frames.
- **Knockback** = (fixed + variable × (d/100 + d²/20000)) × `FORCE_SCALE` px/s, d the target's damage after the hit. Calibrated with `npm run balance`: heavies KO around 120–160%, lights from about 270%.
- **Cooldown** stops only the same attack; any other move comes out at once. Heavies have none.
- **Heavies** (the signatures) charge up to `CHARGE_MAX_TIME` for up to `FULL_CHARGE_BONUS` more damage and variable force; the ghost comes out with the punch. In the air, any heavy but down is the recovery.
- **Ground pound**: comes out on the press, hangs through its startup, falls until it lands; the landing is its recovery.
- **Hit pause**: `HITSTOP_MIN_STEPS` plus one step per `HITSTOP_SPEED_PER_STEP` of knockback: light hits barely stop, hard launches freeze for a beat.
- True combos come from stun against recovery + the next startup: down light into side signature or jump + neutral air, neutral light into side light at low damage.
- Every value is in `PhysicsConfig.ts`; `tests/movement.test.ts` checks each rule.

### The view (`src/`)
Phaser only draws and reads input.
- `scenes/GameScene.ts`: the match scene for every mode (versus, training, campaign, online, Studio Lab). Each drawn frame it runs the simulation steps that are due, then draws.
- `entities/Player.ts`: draws a fighter from its simulation state, and reads its input from the keyboard, a gamepad, touch, the CPU (`player/PlayerAI.ts`) or the network.
- Sounds and effects react to the simulation's `MatchEvent`s.
- `network/`: `NetClient` (Geckos.io over WebRTC) and `OnlineMatch` (the rollback session).
- `lighting/`: the lighting experiment: lit sprites with rim light, the camera's post-processing, the Studio Lab's LOOK mode. Drawing only.
- `lab/`: the **Studio Lab** (main menu), two modes switched with TAB (`StudioLab.ts`), full screen (panels float) or **windowed** (the game's container narrowed to the middle, panels docked in a column each side). ESC opens the Lab's pause menu: mode, view, the player's and dummy's characters (saved; the Lab restarts with them on resume; `labSceneData()`). LOOK tunes lights, camera and stage (`lighting/LightLab.ts`); **FEEL** (`FeelLab.ts`) tunes every gameplay setting live: MOVEMENT and COMBAT panels (all of `PhysicsConfig`, grouped and labelled in `FeelCatalog.ts`), MOVES (each move's damage, knockback, angle, timing and hitbox, with its hitbox or ghost drawn on Fok), TEST (game speed, freeze F, next step N, restart R, dummy damage, infinite lives, last-hit readout, jumps measured off screen by `FeelMeasure.ts`, find box, screen effects from `config/EffectConfig.ts`). `Tuning.ts` changes the live values and puts the defaults back: every match outside the Lab calls `resetTuning()`, so online always plays the defaults. **Copy changes** gives JSON of only what differs from the defaults (`{"sgalallaFeel":1, physics, moves, effects}`); to make them defaults, put the values in `PhysicsConfig.ts`, `AttackData.ts` and `EffectConfig.ts`, add any new knockback angle to `KNOCKBACK_DIRECTIONS` (a test checks), bump `PROTOCOL_VERSION` and run `npm run replays:update`.
- `stages/`: stage visuals (`StageFactory`) and backgrounds (`StageBackgrounds`: a match loads only its own, menus use small previews). The Studio Lab draws Londra in layers instead (`LondraLayers`): an engine sky gradient, cloud pieces repeated behind and in front of the island, each layer with its own position, size, parallax, opacity, rim and order (even in front of the fighters), all tunable in the Lab. Lights can sit behind any layer (`behind:<element>`), at its depth and parallax; the island and clouds use the `scenery` lit group, where a light behind an object outlines its silhouette instead of lighting its face.
- `minigames/racing/` + `scenes/RacingScene.ts`: **CORSA** (main menu), an Outrun-style cruise. `RaceTrack.ts` builds a seeded highway loop of segments (curves, hills, roadside things); `RaceSim.ts` steps the car and 30 traffic cars at 60 Hz as plain data (no Phaser or Math.random, ready for a multiplayer race later; `CAR` holds the feel numbers); `RoadRenderer.ts` projects the road pseudo-3D onto a 480x270 canvas the scene scales up 4x with hard pixels, with parallax sky, clouds and mountains; `EngineSound.ts` synthesises engine and wind with Web Audio. Scenery, traffic and backdrop are placeholder blocks; the car is a temp sprite (`scripts/racing-car.py` shrinks it to game pixels).
- **DERAPATE** (the donut mini-game) moved to its own project on 2026-10-11: `/Users/riccardofusetti/Documents/Coding/Derapate`, https://github.com/baguotti/derapate. Its history up to then is in this repo's DEVELOPMENT_LOG.
- The HUD is drawn by a second camera (`uiCamera`); world objects must be hidden from it with `uiCamera.ignore(obj)`.

### The server (`server-geckos/index.ts`)
Rooms of 2 to 5 players, the match start (seed and input delay), and a relay for input packets, keeping a copy of every input. When a player leaves mid-match it sends the others their last frame and final inputs (PLAYER_LEFT) and the match goes on; rematches start with whoever is left. Anyone joining while a match is on **spectates** (up to 4): WATCH with the match's start, then WATCH_INPUTS batches of every input from frame 0 every 50 ms; their copy (`shared/Spectate.ts`, `network/SpectatorMatch.ts`, GameScene mode `spectate`) needs no rollback, fast-forwards silently to live, then stays ~6 steps behind. Spectators book a seat for the next match (SEAT); rematches seat them. `GET /rooms` shows rooms, seats and spectators. It doesn't simulate. PM2 runs it on the droplet.

## Testing
- `npm test`: recorded matches replay exactly, rollback players agree over a lossy simulated network, combat and KO rules.
- Recording a replay: dev server, `http://localhost:5175/?record`, play, F9.
- Several online clients on one machine: `npm run server` and `npm run dev`, then `/tests/online.html?clients=4&lag=50&loss=5`.

## Commands
- `npm run dev` (Vite, port 5175), `npm run server` (game server, port 9208), `npm run build`, `npm test`.
- Deploying the release, from `main`: `ssh-add ~/.ssh/id_rsa` once, then `./deploy_server.sh` and `./deploy_client.sh`, always together.
- Deploying the experimental version, from `experimental-branch` with everything committed: `./deploy_experimental.sh` (site on 8081 and its game server, PM2 `geckos-experimental`; the release is untouched).
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
