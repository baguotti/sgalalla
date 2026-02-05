# Sgalalla - Development Log

**Total Time Logged:** 9.0 Hours

---

### [2026-01-29] Baseline Restoration
- **[R]** Restoring core feel; existing physics was unstable.
- **[M]** Restricted Brawlhalla mechanics: Run, Dodge, Recovery, Platform Drop.
- **[M]** `PhysicsConfig.ts`: Tuned movement constants for snappiness.
- **[S]** Offline stable, Online sync pending.

### [2026-02-04] v0.5.1 - Online Polish
- **[V]** `v0.5.1`
- **[R]** Damage reset bug (Client/Server conflict) & Teleport glitches.
- **[T]** Implemented damage overrides for remote players; added Snap logic (>500px).
- **[M]** Knockback increased (x5) for lighter feel.

### [2026-02-05] v0.5.2 - Infrastructure & Protocol
- **[V]** `v0.5.2`
- **[R]** v0.5.2 knockback/animation sync was failed experiment; reverted to v0.5.1.
- **[V]** `v0.5.1` (Git reset --hard `2abe106`).
- **[R]** `localhost` unreachable due to Node 22.4.1/Vite 7 mismatch & silent process suspension.
- **[T]** Node upgraded `22.4.1` -> `25.6.0` (Homebrew).
- **[T]** Deep reset: `rm -rf node_modules` + `npm install` (Client & Server).
- **[T]** Port migration: `5173` -> `5175` (host: `0.0.0.0`) for visibility.
- **[A]** `LLM_CONTEXT.md`: Established token-dense logging protocol.
- **[M]** `handoff_instructions.md`: Deprecated/Redirected to `LLM_CONTEXT.md`.
- **[S]** **STATUS**: v0.5.1 Active. Manual server start required (agent environment kills background tasks).
