# Architecture

Smashup Derby is a browser-only Vite + TypeScript + canvas game with one authoritative in-memory `GameState`. The repository is intentionally small, but the main gameplay loop has enough moving parts that boundaries need to stay explicit.

## Runtime Shape
- `src/main.ts` is a thin entrypoint that imports styles and mounts the app.
- `src/app/bootstrap.ts` boots the app, parses preview URLs, wires browser hooks, and owns menu/UI event binding.
- `src/game/session.ts` owns state construction, preview-state creation, and Career Night mode transitions outside the per-frame loop.
- `src/game/career.ts` owns seeded five-round generation, placement resolution, points, and standings.
- `src/game/awards.ts` owns the pure rules that select Wreck Awards from a completed round.
- `src/game/roster.ts` owns lineup constants, AI roster data, and car construction helpers.
- `src/game/upgrades.ts` owns upgrade bonuses and between-round condition servicing.
- `src/game/roundStats.ts` owns round-stat defaults and reset lifecycle.
- `src/game/events.ts` owns event-feed appends and capping.
- `src/game/runtime.ts` owns per-frame mutation: AI updates, physics/effects stepping, collision drama, event expiration, elimination handling, camera updates, and transitions into spectating or round results.
- `src/game/debug.ts` is the read-only serialization layer for `window.render_game_to_text()`.
- `src/game/preview.ts` owns URL parsing and validation for the hidden preview surface.
- `src/game/content.ts` is the source of truth for preset, arena, modifier, upgrade, Wreck Award, and preview ids plus their display content.

## Career Night Flow
- `menu` → `car_select` creates a seeded five-round schedule, then `intro` → `running` starts each round.
- If the player is disabled while opponents remain, `running` → `spectating` leaves the hulk in play while the AI finish. The player may continue watching or run the same fixed-step simulation forward with **Skip to Results**.
- A completed round enters `round_results`, where placements, points, and Wreck Awards are visible.
- Non-final results continue through `upgrade` and the next `intro`, even after a player wreck. The fifth result continues to `career_over`.
- `career_over` derives the complete eight-driver standings and podium from the five stored round summaries. The entire session is in memory and a restart creates a new Career Night.

## Supporting Modules
- `src/game/physics.ts`, `damage.ts`, `ai.ts`: gameplay tuning and simulation rules
- `src/game/render.ts`: canvas rendering only
- `src/game/audio.ts`: procedural audio driven by game state transitions
- `src/game/conditions.ts`: shared condition cloning/capture helpers
- `src/game/selectors.ts`, `math.ts`, `debris.ts`, `dust.ts`, `smoke.ts`: reusable helpers and effect systems

## Boundary Rules
- Keep preview, Career Night, and Wreck Award ids and display content in `src/game/content.ts`. Other modules should consume those definitions, not restate them.
- Keep schedule composition, scoring, and tie-breaking in `src/game/career.ts`; do not duplicate authored round sequences in session, bootstrap, or tests.
- Keep award thresholds and priority in `src/game/awards.ts`; rendering consumes the selected ids and content definitions.
- Keep `render_game_to_text()` in `src/game/debug.ts` as a read-only view of current state. Do not hide state mutations inside debug helpers.
- Keep browser bootstrap concerns in `src/app/bootstrap.ts`. Simulation modules should not import from the browser entrypoint.
- If session and runtime need to share more helpers than they already do, extract a dedicated shared module instead of rebuilding a catch-all `game.ts`.

## Change Guidance
- Adding an arena, modifier, award, car preset, or preview scenario usually starts in `src/game/content.ts`, then extends Vitest coverage if the new behavior changes the validation surface.
- Changing Career Night composition, placement, points, or standings belongs in `src/game/career.ts`.
- Changing award qualification belongs in `src/game/awards.ts`.
- Changing mode transitions or round preparation belongs in `src/game/session.ts`.
- Changing roster construction belongs in `src/game/roster.ts`.
- Changing upgrade mechanics belongs in `src/game/upgrades.ts`, while labels and descriptions stay in `src/game/content.ts`.
- Changing how a running round behaves belongs in `src/game/runtime.ts` plus the relevant simulation module.
- Changing the hidden preview URL, startup errors, or browser hooks requires updates to `docs/references/validation-surfaces.md`, `tests/preview.spec.ts`, `tests/bootstrap.spec.ts`, the relevant `tests/browser/` spec, and `docs/QUALITY.md`.
