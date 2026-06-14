# Legibility Audit

## Current Strengths
- The core gameplay runtime now has named seams: session setup, per-frame runtime, debug serialization, and preview parsing.
- Browser automation surfaces are mechanically exercised through `npm run validate`.
- Product state, roadmap context, and current validation notes already live in-repo through `ROADMAP.md` and `progress.md`.
- CI now runs the same validation path on pushes and pull requests.
- Gameplay tuning intent has a dedicated reference note for physics, damage, AI, thermal, and spectacle behavior.

## Highest-Leverage Gaps Closed
- Added a short `AGENTS.md` that routes agents to deeper sources instead of making them rediscover the repo from source files.
- Added an indexed `docs/` area so architecture, operations, quality expectations, and validation surfaces are versioned inside the repo.
- Added `check:repo` so the repo map, docs, validation scripts, and runtime split do not drift silently.

## Remaining Gaps
- `src/game/session.ts` still owns both state progression and a large amount of roster/build data; if new content systems land, the car/roster factory likely wants its own module.
- Artifact retention for `output/` is still implicit; decide which captures are long-lived references and which are disposable validation residue.
- Broader design decisions still live mostly in roadmap/progress narrative rather than a dedicated decision log.

## Next Investments
1. Extract content-heavy factory logic from `src/game/session.ts` into a dedicated builder module before replay/meta work expands setup complexity.
2. Decide an artifact retention rule for `output/` so local captures do not become ambiguous project state.
3. Add a lightweight decision log when architectural tradeoffs outgrow the roadmap/progress narrative.

## What Still Lives Outside The Repo
- Human taste around “fun” balancing still mostly lives in user feedback and validation notes rather than dedicated design docs.
- There is no in-repo decision log yet for larger architectural tradeoffs beyond the roadmap/progress narrative.
