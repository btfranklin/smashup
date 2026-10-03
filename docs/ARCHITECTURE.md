# Architecture

Smashup Derby is a browser-only Vite + TypeScript + canvas game with one authoritative in-memory `GameState`. The repository is intentionally small, but the main gameplay loop has enough moving parts that boundaries need to stay explicit.

## Runtime Shape

- `src/main.ts` is a thin entrypoint that imports styles and mounts the app.
- `src/app/bootstrap.ts` owns the browser controller lifecycle, parses preview URLs, wires platform events and browser hooks, and disposes everything it installs.
- `src/app/loop.ts` owns requestAnimationFrame scheduling, coalesced presentation invalidation, fixed-step accumulation, deterministic automation carry, catch-up limits, and bounded spectator-skip batches.
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
- `src/game/runtime.ts` owns per-frame mutation: AI updates, physics/effects stepping, collision drama, event expiration, elimination handling, camera updates, and transitions into spectating or round results. After object and car contacts, it reapplies car wall containment.
- `src/game/debug.ts` is the read-only serialization layer for `window.render_game_to_text()`.
- `src/game/preview.ts` owns URL parsing and validation for the hidden preview surface.
- `src/game/contentIds.ts` is the source of truth for preset, arena, modifier, upgrade, Wreck Award, and preview id tuples, types, and guards.
- `src/game/content.ts` owns the authored display and tuning catalogs keyed by those ids.

## State Authority

- `GameState.currentRoundPlan` is `null` in menu, car-selection, and preview states. Once Career Night begins it is the sole active-plan reference and must be present in every active runtime mode; runtime helpers fail clearly if that invariant is violated.
- Active Career Night work also requires an explicit player build, persisted player condition, and player car. Callers use the required-state guards in `src/game/selectors.ts`; round setup and upgrades do not invent fallback state.
- `GameState.roundTick` resets for each prepared round, while `GameState.sessionElapsed` advances across the session. Per-advance system-event scratch data remains local to runtime rather than entering authoritative state.
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

- `src/game/types.ts`: authoritative in-memory state, domain-object, and runtime event shapes
- `src/game/selectors.ts`: state lookup, active-career predicates, and required-state guards
- `src/game/physics.ts`, `damage.ts`, `ai.ts`: vehicle motion, live-frame
  convex collision hulls, collision damage, and driver behavior
- `src/game/deformation.ts`: persistent car-frame deformation and impact scars
- `src/game/debris.ts`, `dust.ts`, `smoke.ts`, `fragments.ts`: transient spectacle state and stepping
- `src/game/render.ts`: stable rendering façade
- `src/game/render/`: focused arena/cache, car, transient-effect, and overlay drawing; canvas caches remain rendering-owned and never enter `GameState`
- `src/game/audio.ts`: procedural audio with idle graph preparation, gesture-time resume, and game-state-driven updates
- `src/game/audioTransitions.ts`: pure mode-transition cue selection
- `src/game/conditions.ts`: shared condition cloning/capture helpers
- `src/game/math.ts`: shared scalar, vector, angle, and deterministic pseudo-random helpers

## Boundary Rules

- Keep preview, Career Night, and Wreck Award ids and guards in `src/game/contentIds.ts`, with their display and tuning catalogs in `src/game/content.ts`. Other modules should consume those definitions, not restate them.
- Keep schedule composition, scoring, and tie-breaking in `src/game/career.ts`; do not duplicate authored round sequences in session, bootstrap, or tests.
- Keep award thresholds and priority in `src/game/awards.ts`; rendering consumes the selected ids and content definitions.
- Keep `render_game_to_text()` in `src/game/debug.ts` as a read-only view of current state. Do not hide state mutations inside debug helpers.
- Keep browser bootstrap concerns in `src/app/bootstrap.ts`. Simulation modules should not import from the browser entrypoint.
- Keep clocks, frame handles, presentation invalidation, catch-up policy, deterministic stepping carry, and spectator-skip batching in `src/app/loop.ts`; bootstrap supplies callbacks and owns DOM/audio/input presentation. A completed fixed-step batch or explicit invalidation may present once, while zero-step RAF callbacks continue scheduling without repainting.
- Keep authored menu presentation in `src/app/menu.ts`; the controller supplies actions and owns their effects.
- Keep performance instrumentation bounded and diagnostic-only in `src/app/performance.ts`; callers own when to record and when to destroy it.
- Keep static arena caching inside rendering and key it from the authoritative
  active plan; simulation state must not depend on cached canvas resources.
- Keep reusable car paths, smoke sprites, and fragment paths inside rendering.
  Cache lifetimes must be bounded or weakly keyed by canvas/effect ownership,
  and render caches must not annotate simulation objects.
- Render cars through the single `drawCars` collection operation. It paints
  every undercarriage and wheel before beginning the chassis pass, so car array
  order can never place one car's wheels above another car's body.
- Derive the car physics hull from the current frame vertices and use it for
  wall containment, loose-object contact, and car-to-car contact. Cache each
  local convex hull weakly by frame, verify its live vertex coordinates when
  physics requests it, and refresh it immediately after deformation so later
  contacts in the same pileup use the new shape. Runtime reapplies wall
  containment after contact solvers move cars.
- Fragment creation produces one convex outline per piece. Rendering and
  contact use those same points. `fragments.ts` uses the live car hull through
  `getCarPolygonContact`; it must not restore the original car rectangle.
- Keep arena geometry, junk outlines, and coordinate materialization in
  `src/game/arena.ts`. Drawing and car contact use the same local junk outline.
  `src/game/content.ts` owns normalized mud and object layouts, while roster
  owns normalized lineup slots, membership, orientation, and car-extent
  clamping.
- Keep audio graph preparation separate from user-gesture resume. Preparation
  may fail under browser policy, so the gesture path must retain its safe
  construction fallback.
- Treat controller startup as transactional: partial setup must be cleaned up on failure, and `destroy()` must remove hooks, platform listeners, animation work, and audio ownership.
- If session and runtime need to share more helpers than they already do, extract a dedicated shared module instead of rebuilding a catch-all `game.ts`.

## Change Guidance

- Adding an arena, modifier, award, car preset, or preview scenario starts with the canonical tuple in `src/game/contentIds.ts` and its authored catalog entry in `src/game/content.ts`.
- Changing Career Night composition, placement, points, or standings belongs in `src/game/career.ts`.
- Changing award qualification belongs in `src/game/awards.ts`.
- Changing mode transitions or round preparation belongs in `src/game/session.ts`.
- Changing roster construction belongs in `src/game/roster.ts`.
- Changing upgrade mechanics belongs in `src/game/upgrades.ts`, while labels and descriptions stay in `src/game/content.ts`.
- Changing how a running round behaves belongs in `src/game/runtime.ts` plus the relevant simulation module.
- Changing the hidden preview URL, startup errors, or browser hooks requires updates to `docs/references/validation-surfaces.md`, `tests/preview.spec.ts`, the relevant `tests/bootstrap*.spec.ts`, the relevant `tests/browser/` spec, and `docs/QUALITY.md`.

## Test Ownership

- `tests/helpers/controller-harness.ts` owns reusable controller construction, DOM setup, capability defaults, instance tracking, and teardown.
- `tests/bootstrap-core-menus.spec.ts` covers core controller wiring, hooks, and menus.
- `tests/bootstrap-input-platform.spec.ts` covers keyboard, visibility, fullscreen, and supplied-platform behavior.
- `tests/bootstrap-audio-performance.spec.ts` covers audio ownership and diagnostic collection.
- `tests/bootstrap-lifecycle.spec.ts` covers transactional startup, destruction, recreation, and cleanup.
- `tests/runtime-flow.spec.ts` covers round flow, system events, and runtime state transitions.
- `tests/runtime-collision-credit.spec.ts` covers impact causality and collision credit.
- `tests/render-orchestration.spec.ts` covers the render façade, cars, overlays, and orchestration.
- `tests/render-effects-cache.spec.ts` covers transient effects, caches, and related rendering limits.
- Focused rule specs remain beside these orchestration suites; `tests/browser/` owns production-bundle DOM, Canvas, Web Audio, and lifecycle evidence.
