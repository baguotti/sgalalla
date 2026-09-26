# Super Smash Fioi (Sgalalla)

A 2 to 4 player platform fighter in the style of Brawlhalla, for the browser and desktop. Built with Phaser 3 and TypeScript, with a deterministic simulation and rollback netcode for online play.

Play online: http://138.68.126.112

## Running it
Requires Node 22 or later.

```bash
npm install
npm run dev
```

Open http://localhost:5175. For online play on one machine, also start the game server:

```bash
npm install --prefix server-geckos
npm run server
```

## Tests
```bash
npm test
```

Recorded matches must replay exactly, rollback players must stay in sync over a lossy simulated network, and the combat rules must hold.

## Branches
- `main`: the official release.
- `experimental-branch`: work in progress (campaign, lighting, Studio Lab).

## More
- [docs/LLM_CONTEXT.md](docs/LLM_CONTEXT.md): how the game is built, commands and deployment.
- [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md): the history of every change.
