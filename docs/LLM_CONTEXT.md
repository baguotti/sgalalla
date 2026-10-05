# Sgalalla: context for AI assistants

> Read this first. It describes the game as it is today (v3, September 2026); `DEVELOPMENT_LOG.md` has the history.

## What it is
Super Smash Fioi: a 2 to 4 player platform fighter in the style of Brawlhalla, built with Phaser 3.90 and TypeScript. Local matches, CPU opponents, online matches of up to 5 players with rollback netcode (experimental branch; 4 on main), a single-player campaign (work in progress) and the Studio Lab for the lighting experiment.

## Branches
- `main`: the official release (v3.0.x), live at http://138.68.126.112. The campaign is hidden from its menu.
- `experimental-branch`: work in progress (v3.0.xe): the release plus the campaign, the lighting experiment and the Studio Lab. Live at http://138.68.126.112:8080 with its own game server on port 9209 (the client picks 9209 when the page is on port 8080).
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
- `lighting/`: the lighting experiment: lit sprites with rim light, the camera's post-processing, the Studio Lab's LOOK mode. Drawing only.
- `lab/`: the **Studio Lab** (main menu), two modes switched with TAB (`StudioLab.ts`), full screen (panels float) or **windowed** (the game's container narrowed to the middle, panels docked in a column each side). ESC opens the Lab's pause menu: mode, view, the player's and dummy's characters (saved; the Lab restarts with them on resume; `labSceneData()`). LOOK tunes lights, camera and stage (`lighting/LightLab.ts`); **FEEL** (`FeelLab.ts`) tunes every gameplay setting live: MOVEMENT and COMBAT panels (all of `PhysicsConfig`, grouped and labelled in `FeelCatalog.ts`), MOVES (each move's damage, knockback, angle, timing and hitbox, with its hitbox or ghost drawn on Fok), TEST (game speed, freeze F, next step N, restart R, dummy damage, infinite lives, last-hit readout, jumps measured off screen by `FeelMeasure.ts`, find box, screen effects from `config/EffectConfig.ts`). `Tuning.ts` changes the live values and puts the defaults back: every match outside the Lab calls `resetTuning()`, so online always plays the defaults. **Copy changes** gives JSON of only what differs from the defaults (`{"sgalallaFeel":1, physics, moves, effects}`); to make them defaults, put the values in `PhysicsConfig.ts`, `AttackData.ts` and `EffectConfig.ts`, add any new knockback angle to `KNOCKBACK_DIRECTIONS` (a test checks), bump `PROTOCOL_VERSION` and run `npm run replays:update`.
- `stages/`: stage visuals (`StageFactory`) and backgrounds (`StageBackgrounds`: a match loads only its own, menus use small previews). The Studio Lab draws Londra in layers instead (`LondraLayers`): an engine sky gradient, cloud pieces repeated behind and in front of the island, each layer with its own position, size, parallax, opacity, rim and order (even in front of the fighters), all tunable in the Lab. Lights can sit behind any layer (`behind:<element>`), at its depth and parallax; the island and clouds use the `scenery` lit group, where a light behind an object outlines its silhouette instead of lighting its face.
- `minigames/racing/` + `scenes/RacingScene.ts`: **CORSA** (main menu), an Outrun-style cruise. `RaceTrack.ts` builds a seeded highway loop of segments (curves, hills, roadside things); `RaceSim.ts` steps the car and 30 traffic cars at 60 Hz as plain data (no Phaser or Math.random, ready for a multiplayer race later; `CAR` holds the feel numbers); `RoadRenderer.ts` projects the road pseudo-3D onto a 480x270 canvas the scene scales up 4x with hard pixels, with parallax sky, clouds and mountains; `EngineSound.ts` synthesises engine and wind with Web Audio. Scenery, traffic and backdrop are placeholder blocks; the car is a temp sprite (`scripts/racing-car.py` shrinks it to game pixels).
- `minigames/donut/` + `scenes/DonutScene.ts`: **DERAPATE** (main menu): a car doing donuts in a junction from a fixed isometric camera, on desktop (keys, gamepad) and phones (a left-thumb steering stick, right-thumb gas; `DonutTouch.ts`). `DonutSim.ts` is the rules (plain data, fixed 60 Hz steps, its own seeded random, no Phaser: the same seed and controls always play out the same): the pedal climbs the rev bar's white (90%, about 1.5 s), the speed follows the revs and the donut's width the speed, and off the pedal it shrinks back towards the middle. The green (last 10%) holds the speed and doubles the points but heats the engine: about 3.5 s of pedal overheats it (MOTORE FUSO, -300: it stalls and coasts back to the middle); a lift under 0.5 s keeps the green. The balance drifts (more in the green) and the steering counters it: forgiving, but in the green half a second at its edge is a testacoda on the spot (-300). People walk in along the pavements and cross, at most one per crossing: white ones give points, revs and a burst past the top speed, and a streak of them raises the top speed; blue ones cost points, the streak and the green. The scene reads the controls, steps the sim and hands what happened to `DonutRenderer.ts` (the junction painted once into a RenderTexture, rubber on another, Riccardo's car renders as wheel and body layers with the body on springs, people, voxel tyre smoke from a pool, the exhaust flame; everything drawn as triangles, since Phaser re-triangulates filled paths every frame and leaves garbage), `DonutAudio.ts` (engine loops pitched by the revs, a rev on a fresh stab, the tyre screech, one-shots, and the Zutomayo soundtrack in place of the game's music; loops and revs load before the scene, the song and the other one-shots in the background) and `DonutHud.ts` (on its own camera, so shakes and zooms move only the junction: the steering wheel shows the balance, beside an upright rev bar; texts are rewritten only when they change). `DonutLook.ts` holds the camera, car drawing, HUD placement, sound levels and shakes. **Lighting**, like the Studio Lab's and always on where WebGL allows: `DonutLight.ts` (the `LIGHT` settings: ambient, rim, car lights, flashes, bloom, grading, lens; five times of day `TIME_PRESETS` (dawn, daylight, sunset, blue hour = the defaults, night), each setting the same keys so a day cycle can fade between them later; the street lamps `LAMPS`, at most 4; pure light maths, cones included), `DonutLighting.ts` (the fighting game's `LitPipeline` on two groups, 'ground' for the junction and rubber with each pool an iso ellipse via the shader's falloff scale, and 'car' with a rim from the lamp's head via its rim offsets; lights placed through the camera's matrix so they hold during shakes; the headlights as two cones (the shader's cone uniforms) and the tail lights, the exhaust flame's light, boost/hit flashes, in priority order for the 8 slots; on phones a LUCI button switches lighting off, remembered in `sgalalla.donutLightsOff`; the lamps' glows; `lightAt` for the people, smoke and lamp posts, lit per face on the CPU; the `AtmospherePipeline` on the main camera only), `DonutIso.ts` (the projection, shared). The car sheets' frame layout comes from `public/assets/donut/car.json` (written by `scripts/donut-car-sprites.py`). The **DERAPATE Lab** (L in the game) is always windowed, with two tabs (TAB): LOOK (lights and lamps, with rings on screen to drag them; camera picture, view and shakes; car; smoke, marks and junction; HUD; sound) and FEEL (a short list in clear units: seconds to the green, km/h, %…), plus a TEST panel in both; G switches the lighting. `DonutTuning.ts` lists the settings (each shows one or more of DONUT, PEDESTRIANS, JUNCTION, LOOK, LIGHT's numbers, some worked out); the rest are in `HIDDEN` on purpose (a test checks every number is one or the other). `DonutLab.ts` builds the panels from the Studio Lab's LabUi/FeelUi pieces and its exported `WindowedView`. Lab changes, the lamps included, are saved in the browser (`sgalalla.donutLab`) and used whenever DERAPATE runs there; Copy changes gives JSON (`sgalallaDerapate`) to bake in as defaults. CORSA's scene is in the code but hidden from the menu.
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
- Deploying the experimental version, from `experimental-branch` with everything committed: `./deploy_experimental.sh` (site on 8080 and its game server, PM2 `geckos-experimental`; the release is untouched).
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
