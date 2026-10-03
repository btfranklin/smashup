# Quality

## Architectural Guardrails

- Keep `npm run validate` green before handoff. It is the authoritative repo, type, build, coverage, and real-browser regression path.
- Derive preview, Career Night, and Wreck Award ids and guards from `src/game/contentIds.ts`, with display and tuning data in `src/game/content.ts`; never add duplicated allowlists or authored copies.
- Keep `window.advanceTime(ms)` and `window.render_game_to_text()` stable and callable throughout normal gameplay, including spectating and final results.
- Preserve the dedicated gameplay split: session transitions, per-frame runtime, career generation/scoring, award selection, preview parsing, debug serialization, roster construction, upgrades, events, and round stats belong in their named modules rather than a catch-all file.
- Generate Career Night schedules through `src/game/career.ts`; do not duplicate authored round-plan sequences in session, bootstrap, fixtures, or tests.
- Derive Career Night count from the canonical round blueprint; UI and tests must not maintain an independent round-count constant.
- Treat active Career Night work without `currentRoundPlan`, a selected player
  build, persisted player condition, or a player car as invalid. Required-state
  helpers fail clearly; setup and upgrade paths must not synthesize fallbacks.
  Pre-career debug round and arena-plan fields remain explicit `null`, not
  placeholder content.
- Derive car phases from system health. Only the per-round player transition cursor may persist phase history.
- Treat documentation and repo navigation as part of correctness. When commands, boundaries, or validation surfaces change, update `AGENTS.md` and `docs/` in the same change.
- Keep a drive action active while either of its keyboard aliases is held.
  Blur, hidden visibility, and controller destruction release all held keys
  and player controls.
- Keep the game frame and menus inside the viewport. Long menus must scroll
  so that all controls stay reachable in portrait and landscape.
- On user input, resume the owned audio context from suspended or interrupted
  state. Do not resume a closed context or one released by its controller.

## Mechanical Coverage

- `npm run check:repo` enforces public and agent entrypoints, resolvable local Markdown links, package command wiring, license consistency, ignored artifact directories, and the CI validation command. It deliberately does not inventory leaf modules, test files, or required prose fragments.
- `npm run typecheck` verifies `src`, `tests`, and `vitest.config.ts` under strict TypeScript.
- `npm run test:coverage` verifies:
  - preview parsing matches source ids and fails visibly on invalid params
  - Career Night generation, placements, points, standings, and Wreck Award rules stay deterministic
  - runtime/session/debug modules preserve the documented state contracts across running, spectating, round results, and final results
  - menu states expose null round metadata while every active runtime mode retains a coherent current plan
  - live-frame wall containment, embedded arena objects, and causal disabling-impact attribution remain covered
  - live-frame car collision hulls reject empty rectangular-corner overlap for
    cars and loose objects, honor crushed body extents, and deliberately bridge
    shallow concavities
  - repeated and asymmetric impacts keep the wheelbase and body footprint;
    folds stay on the shell through service and condition carry-over, and
    rendered end panels stay inside the damaged body
  - arena layouts and complete rotated-car extents remain inside the
    wall-bounded playable rectangle at alternate dimensions
  - roster, event, round-stat, and upgrade helpers preserve their current behavior
  - browser hooks survive bootstrap and deterministic stepping in `jsdom`
  - audio transition, countdown, crash cooldown, and mix helpers behave deterministically
  - render and effect systems stay branch-covered without browser-driving,
    including presentation coalescing, reusable car/fragment paths, bounded
    smoke sprites, global wheel-before-chassis ordering, and a deterministic
    maximum-density command workload
  - bounded performance collection preserves sample ordering, context, capacity,
    optional timeline evidence, phase summaries, presentation counts, and
    teardown behavior
  - the production session/runtime path carries five completed summaries into
    exact eight-driver scoring, final standings, and populated debug output
- `npm run test:browser` verifies in real Chromium:
  - a fresh production bundle is built and served for the ordinary suite
  - the served application boots and accepts pointer and keyboard menu/gameplay input through Career Night start
  - representative spectating and final-standings layouts remain usable at desktop and mobile widths
  - start, car selection, round results, and upgrade menus fit phone viewports
    in portrait and landscape, with their final controls reachable by scrolling
  - native Canvas 2D paints normal and representative preview states without page, console, or request errors
  - browser resize, fullscreen, and requestAnimationFrame lifecycles remain functional
  - native Web Audio starts under user activation, resumes from suspension, and closes during controller teardown/recreation
- `scripts/check-test-coverage.mjs` assigns each executable source file to a
  named `strict`, `gameplay`, `rendering`, `orchestration`, or
  `browser-composition` profile, with sparse per-file overrides where the
  surface genuinely differs. The effective line, statement, function, branch,
  and overall floors remain explicit.
- Every `src/**/*.ts` file must have either a named coverage profile or an
  explicit durable exclusion. New source files therefore cannot silently
  escape the coverage gate.
- `npm run test:performance` is a separate production-build Chromium smoke with
  deterministic scene, percentile, long-task, audio-startup, spectator-skip,
  and 4x CPU gates. It is hardware-sensitive and must not be folded into
  `npm run validate`; use it for performance-affecting handoffs.

## When To Extend Validation

- Add or update Vitest coverage when a change affects the preview URL contract, startup errors, browser hooks, round-start flow, Career Night generation/scoring, Wreck Awards, or documented tuning regressions.
- Keep rendering-performance unit assertions structural: operation counts,
  cache reuse, cache capacity, and state immutability are stable; elapsed-time
  thresholds belong only in the standalone controlled performance suite.
- Add or update focused browser coverage only when a change affects native DOM, Canvas, layout/fullscreen/RAF, Web Audio, or controller ownership behavior.
- Keep `tests/career-lifecycle.spec.ts` on the production session/runtime path;
  it must not inject completed summaries or derive expected placement points
  from the implementation constant it is meant to verify.
- Update the standalone performance workload or budget only under the
  recalibration policy in
  `docs/references/performance-validation.md`.
- Keep native Safari audio acceptance human-observed unless a non-invasive,
  repeatable tracing path is available. Playwright WebKit and UI-driven
  Inspector capture are not substitutes.
- Extend `check:repo` only when a root entrypoint, documentation-link rule,
  package command, license declaration, ignored artifact class, or CI command
  becomes part of the durable repository contract. Enforce source behavior and
  module boundaries through types and tests instead.

## Recovery Guidance

- If you add a new top-level doc, link it from `docs/README.md` and, if it becomes a common entrypoint, from `AGENTS.md`.
- If `check:repo` fails because architecture files moved, update the script and the docs together instead of bypassing the check.
- If a rule repeatedly fails in review, promote it into a doc, helper, test, or repo check rather than leaving it as tribal knowledge.
