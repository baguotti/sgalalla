# Sgalalla - LLM Context & Protocol

> [!IMPORTANT]
> **MANDATORY**: Read this file first in every new session.

## Project Vision
Brawlhalla-style platform fighter. High snappiness, deterministic physics, 4-player online (Geckos.io).

## Sources of Truth
1. [history.md](history.md): High-level versioning/tags.
2. [DEVELOPMENT_LOG.md](DEVELOPMENT_LOG.md): High-density technical trace.
3. [LLM_CONTEXT.md](LLM_CONTEXT.md): (This file) Protocol and persistent state.

## Update Protocol (MANDATORY per Commit)
For every commit or major task completion, update `DEVELOPMENT_LOG.md` using the following token-saving prefixes:

- `[V]` **Version**: e.g., `[V] v0.5.1`
- `[R]` **Rationale**: Why the change was made (e.g., `[R] Silent crash on Node 22.4`).
- `[M]` **Modify**: Files changed.
- `[A]` **Add**: New files/features.
- `[D]` **Delete**: Removed files/features.
- `[T]` **Technical**: Low-level details (e.g., `[T] Switched to port 5175`).
- `[S]` **Status**: Current state of the app (e.g., `[S] Playable, manual start req`).

## Development Environment
- **Node**: v25.6.0+
- **Commands**: `(npm run dev --prefix server-geckos & npx vite --port 5175 --host 0.0.0.0)`
- **URLs**: Client: `localhost:5175`, Server: `9208`
