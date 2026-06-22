# Legibility Audit

## Current Strengths
- The public front door is now versioned in-repo through `README.md`, `LICENSE`, and package license metadata.
- The core gameplay runtime now has named seams: session setup, per-frame runtime, debug serialization, and preview parsing.
- Browser automation surfaces are mechanically exercised through `npm run validate`.
- Product state, roadmap context, and current validation notes already live in-repo through `ROADMAP.md` and `progress.md`.
- CI now runs the same validation path on pushes and pull requests.
- Gameplay tuning intent has a dedicated reference note for physics, damage, AI, thermal, and spectacle behavior.

## Highest-Leverage Gaps Closed
- Added a short `AGENTS.md` that routes agents to deeper sources instead of making them rediscover the repo from source files.
- Added an indexed `docs/` area so architecture, operations, quality expectations, and validation surfaces are versioned inside the repo.
- Added `check:repo` so the repo map, public README/license metadata, docs, validation scripts, ignored artifact hygiene, and runtime split do not drift silently.
- Documented `output/` as ignored, disposable local inspection residue instead of ambiguous project state.

## Remaining Gaps
- `src/game/session.ts` still owns both state progression and a large amount of roster/build data; if new content systems land, the car/roster factory likely wants its own module.
- Broader design decisions still live mostly in roadmap/progress narrative rather than a dedicated decision log.
- Visual regressions are mostly covered by deterministic render/unit checks; there is no committed screenshot-smoke workflow for human-facing UI polish.

## Next Investments
1. Extract content-heavy factory logic from `src/game/session.ts` into a dedicated builder module before replay/meta work expands setup complexity.
2. Add a lightweight decision log when architectural tradeoffs outgrow the roadmap/progress narrative.
3. Add an optional browser/screenshot smoke workflow if UI polish starts changing faster than unit-level render coverage can explain.

## What Still Lives Outside The Repo
- Human taste around “fun” balancing still mostly lives in user feedback and validation notes rather than dedicated design docs.
- There is no in-repo decision log yet for larger architectural tradeoffs beyond the roadmap/progress narrative.
