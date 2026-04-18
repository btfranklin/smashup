# Legibility Audit

## Current Strengths
- The core gameplay runtime now has named seams: session setup, per-frame runtime, debug serialization, and preview parsing.
- Browser automation surfaces are mechanically exercised through `npm run validate`.
- Product state, roadmap context, and current validation notes already live in-repo through `ROADMAP.md` and `progress.md`.

## Highest-Leverage Gaps Closed
- Added a short `AGENTS.md` that routes agents to deeper sources instead of making them rediscover the repo from source files.
- Added an indexed `docs/` area so architecture, operations, quality expectations, and validation surfaces are versioned inside the repo.
- Added `check:repo` so the repo map, docs, validation scripts, and runtime split do not drift silently.

## Remaining Gaps
- `src/game/session.ts` still owns both state progression and a large amount of roster/build data; if new content systems land, the car/roster factory likely wants its own module.
- There is no CI configuration in-repo yet, so validation is locally reproducible but not server-enforced.
- Physics and damage tuning remain understandable mostly through code and `progress.md`, not through dedicated design notes.

## Next Investments
1. Add CI that runs `npm run validate` on pull requests so repo checks and Vitest coverage become unavoidable.
2. Extract content-heavy factory logic from `src/game/session.ts` into a dedicated builder module before replay/meta work expands setup complexity.
3. Add a small tuning/design note for physics, damage, and thermal rules so future balancing work stops relying on archaeology in `progress.md`.

## What Still Lives Outside The Repo
- Human taste around “fun” balancing still mostly lives in user feedback and validation notes rather than dedicated design docs.
- There is no in-repo decision log yet for larger architectural tradeoffs beyond the roadmap/progress narrative.
