# Agent Rules & Skills Index

Rules and skills for AI assistants working on Sgalalla.

## Start here
Read [docs/LLM_CONTEXT.md](../docs/LLM_CONTEXT.md): the game's architecture, branches, tests, commands and the update protocol. It overrides anything generic in the skills below: gameplay lives in the deterministic simulation in `shared/` (plain data, no Phaser), and Phaser only draws.

## Versions and devlog
- `main` is the official release (v3.0.x); `experimental-branch` is the work in progress (v3.0.xe).
- Every commit gets an entry in `docs/DEVELOPMENT_LOG.md` (tags in LLM_CONTEXT.md). `DEVELOPMENT_LOG_SINGLE_PLAYER.md` is the campaign's history up to v2.3.1 and is no longer updated.
- **PROCEDURE**: see LLM_CONTEXT.md.

## Build organization
Desktop builds go in:
- **Mac**: `release/mac`
- **Windows**: `release/win`

Delete the previous build in the target folder before building a new one.

## Skills
Generic advice; where it disagrees with LLM_CONTEXT.md, LLM_CONTEXT.md wins.

### [Skill Creator](skills/skill-creator/SKILL.md)
**Use when:** creating new skills or saving current work as a reusable skill.

### [Find Skills](skills/find-skills/SKILL.md)
**Use when:** looking for a skill that isn't installed.

### [Fighting Game State Machine](skills/fighting-game-state-machine/SKILL.md)
**Use when:** changing fighter states. Here the state machine is data in `shared/FighterState.ts`, not classes.

### [Hitbox & Frame Data](skills/hitbox-frame-data/SKILL.md)
**Use when:** defining attacks, active frames and collisions (`shared/AttackData.ts`, `shared/Combat.ts`).

### [Deterministic Input Buffer](skills/deterministic-input-buffer/SKILL.md)
**Use when:** handling input for combos or rollback.

### [Phaser UI Camera Ghosting](skills/phaser-ui-camera-ghosting/SKILL.md)
**Use when:** adding objects to a scene with a UI camera.

### [Phaser Optimization](skills/phaser-optimization/SKILL.md)
**Use when:** writing game loops, creating game objects, or chasing performance problems.

### [DigitalOcean Deployment](skills/digitalocean-deploy/SKILL.md)
**Use when:** setting up or troubleshooting the production server.
