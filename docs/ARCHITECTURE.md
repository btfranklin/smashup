# Architecture

Smashup Derby is a browser-only Vite + TypeScript + canvas game with one authoritative in-memory `GameState`. The repository is intentionally small, but the main gameplay loop has enough moving parts that boundaries need to stay explicit.

## Runtime Shape
- `src/main.ts` is a thin entrypoint that imports styles and mounts the app.
- `src/app/bootstrap.ts` owns the browser controller lifecycle, parses preview URLs, wires platform events and browser hooks, and disposes everything it installs.
- `src/app/loop.ts` owns requestAnimationFrame scheduling, fixed-step accumulation, deterministic automation carry, catch-up limits, and bounded spectator-skip batches.
- `src/app/menu.ts` presents mode-specific menu DOM and binds menu actions supplied by the controller.
- `src/app/performance.ts` provides a bounded, opt-in collector for timing samples and their simulation context; it does not alter gameplay decisions.
- `src/game/session.ts` owns state construction, preview-state creation, and Career Night mode transitions outside the per-frame loop.
- `src/game/career.ts` owns seeded five-round generation, placement resolution, points, and standings.
- `src/game/awards.ts` owns the pure rules that select Wreck Awards from a completed round.
- `src/game/roster.ts` owns lineup constants, AI roster data, and car construction helpers.
- `src/game/arena.ts` owns arena dimensions and materializes normalized authored mud, object, and lineup coordinates inside the wall-bounded playable rectangle.
- `src/game/upgrades.ts` owns upgrade bonuses and between-round condition servicing.
- `src/game/roundStats.ts` owns round-stat defaults and reset lifecycle.
- `src/game/events.ts` owns event-feed appends and capping.
- `src/game/runtime.ts` owns per-frame mutation: AI updates, physics/effects stepping, collision drama, event expiration, elimination handling, camera updates, and transitions into spectating or round results.
- `src/game/debug.ts` is the read-only serialization layer for `window.render_game_to_text()`.
- `src/game/preview.ts` owns URL parsing and validation for the hidden preview surface.
- `src/game/content.ts` is the source of truth for preset, arena, modifier, upgrade, Wreck Award, and preview ids plus their display content.

## State Authority
- `GameState.currentRoundPlan` is `null` in menu, car-selection, and preview states. Once Career Night begins it is the sole active-plan reference and must be present in every active runtime mode; runtime helpers fail clearly if that invariant is violated.
- The selected plan is also present in the blueprint-derived `session.roundPlans` schedule, but active gameplay and rendering do not copy plan metadata into the arena.
- `session.roundIndex` is zero-based because it addresses the schedule. A completed `RoundSummary.roundNumber` and each `RoundPlan.id` are one-based display/domain values.
- `GameState.arena` contains only dynamic arena state such as dimensions, mud zones, and movable objects. Arena variant, modifier, title, and intro content come from `currentRoundPlan`.
- Car system phases are derived from current system health. `Car` does not cache them; `RoundStats.lastPlayerSystemPhases` is only an event-transition cursor reset from the player at round start.
- Collision events preserve both active-at-impact and disabled-by-impact facts. Elimination credit follows the exact collision that disabled the victim; the recent-contact ledger is only the delayed non-collision fallback.
- Career standings are derived from `session.completedRounds`; there is no second mutable scoreboard.

## Career Night Flow
- `menu` → `car_select` creates a seeded five-round schedule, then `intro` → `running` starts each round.
- If the player is disabled while opponents remain, `running` → `spectating` leaves the hulk in play while the AI finish. The player may continue watching or run the same fixed-step simulation forward with **Skip to Results**.
- A completed round enters `round_results`, where placements, points, and Wreck Awards are visible.
- Non-final results continue through `upgrade` and the next `intro`, even after a player wreck. The fifth result continues to `career_over`.
- `career_over` derives the complete eight-driver standings and podium from the five stored round summaries. The entire session is in memory and a restart creates a new Career Night.

## Supporting Modules
- `src/game/physics.ts`, `damage.ts`, `ai.ts`: gameplay tuning and simulation rules
- `src/game/render.ts`: stable rendering façade
- `src/game/render/`: focused arena/cache, car, transient-effect, and overlay drawing
- `src/game/audio.ts`: procedural audio with idle graph preparation,
  gesture-time resume, and game-state-driven updates
- `src/game/conditions.ts`: shared condition cloning/capture helpers
- `src/game/selectors.ts`, `math.ts`, `debris.ts`, `dust.ts`, `smoke.ts`: reusable helpers and effect systems

## Boundary Rules
- Keep preview, Career Night, and Wreck Award ids and display content in `src/game/content.ts`. Other modules should consume those definitions, not restate them.
- Keep schedule composition, scoring, and tie-breaking in `src/game/career.ts`; do not duplicate authored round sequences in session, bootstrap, or tests.
- Keep award thresholds and priority in `src/game/awards.ts`; rendering consumes the selected ids and content definitions.
- Keep `render_game_to_text()` in `src/game/debug.ts` as a read-only view of current state. Do not hide state mutations inside debug helpers.
- Keep browser bootstrap concerns in `src/app/bootstrap.ts`. Simulation modules should not import from the browser entrypoint.
- Keep clocks, frame handles, catch-up policy, deterministic stepping carry, and spectator-skip batching in `src/app/loop.ts`; bootstrap supplies callbacks and owns DOM/audio/input presentation.
- Keep authored menu presentation in `src/app/menu.ts`; the controller supplies actions and owns their effects.
- Keep performance instrumentation bounded and diagnostic-only in `src/app/performance.ts`; callers own when to record and when to destroy it.
- Keep static arena caching inside rendering and key it from the authoritative
  active plan; simulation state must not depend on cached canvas resources.
- Keep arena geometry and coordinate materialization in `src/game/arena.ts`.
  `src/game/content.ts` owns normalized mud and object layouts, while roster
  owns normalized lineup slots, membership, orientation, and car-extent
  clamping.
- Keep audio graph preparation separate from user-gesture resume. Preparation
  may fail under browser policy, so the gesture path must retain its safe
  construction fallback.
- Treat controller startup as transactional: partial setup must be cleaned up on failure, and `destroy()` must remove hooks, platform listeners, animation work, and audio ownership.
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
