# Smashup Derby Docs

`docs/` is the repo-local system of record for non-trivial repository knowledge. Start here when you need to understand where logic lives, how to run the game, or what invariants must stay enforced.

## Core Docs
- [Public README](../README.md): user-facing overview, controls, setup, and validation summary
- [Architecture](./ARCHITECTURE.md): top-level module map, boundaries, and change guidance
- [Operations](./OPERATIONS.md): setup, local runtime, validation commands, and artifact locations
- [Quality](./QUALITY.md): golden rules, validation coverage, and recovery guidance
- [Validation Surfaces](./references/validation-surfaces.md): preview endpoint and browser automation hooks
- [Gameplay Tuning](./references/gameplay-tuning.md): intent behind physics, damage, AI, thermal, and spectacle rules
- [Legibility Audit](./LEGIBILITY-AUDIT.md): current strengths, remaining gaps, and next leverage points
- [License](../LICENSE): MIT license terms

## Plans And Memory
- [Tech Debt Tracker](./exec-plans/tech-debt-tracker.md): prioritized follow-on cleanup and legibility work
- [Roadmap](../ROADMAP.md): deferred product-facing work

## Code Map
- `src/app/bootstrap.ts`: browser bootstrap, menus, startup errors, and runtime hooks
- `src/main.ts`: thin browser entrypoint and CSS import
- `src/game/session.ts`: state creation, preview state, and round/tournament progression
- `src/game/roster.ts`: lineup data and car construction helpers
- `src/game/upgrades.ts`: upgrade bonuses and condition servicing
- `src/game/roundStats.ts`: round stat defaults and reset lifecycle
- `src/game/events.ts`: event-feed appends and capping
- `src/game/runtime.ts`: per-frame advancement, eliminations, event expiration, and camera updates
- `src/game/debug.ts`: `render_game_to_text()` payload
- `src/game/render.ts`: canvas drawing
- `tests/`: Vitest unit coverage, jsdom bootstrap coverage, and deterministic transition checks

## Maintenance Rule
When repo navigation, commands, or validation surfaces change, update this index and the linked deep docs in the same change.
