# Quality

## Architectural Guardrails
- Keep `npm run validate` green before handoff. It is the authoritative repo, type, build, coverage, and real-browser regression path.
- Derive preview, Career Night, and Wreck Award ids and display content from `src/game/content.ts`, never duplicated allowlists or authored copies.
- Keep `window.advanceTime(ms)` and `window.render_game_to_text()` stable and callable throughout normal gameplay, including spectating and final results.
- Preserve the dedicated gameplay split: session transitions, per-frame runtime, career generation/scoring, award selection, preview parsing, debug serialization, roster construction, upgrades, events, and round stats belong in their named modules rather than a catch-all file.
- Generate Career Night schedules through `src/game/career.ts`; do not duplicate authored round-plan sequences in session, bootstrap, fixtures, or tests.
- Treat documentation and repo navigation as part of correctness. When commands, boundaries, or validation surfaces change, update `AGENTS.md` and `docs/` in the same change.

## Mechanical Coverage
- `npm run check:repo` enforces the agent map, public entrypoints, docs presence, validation scripts, preview-source wiring, and ignored artifact hygiene through positive required surfaces.
- `npm run typecheck` verifies `src`, `tests`, and `vitest.config.ts` under strict TypeScript.
- `npm run test:coverage` verifies:
  - preview parsing matches source ids and fails visibly on invalid params
  - Career Night generation, placements, points, standings, and Wreck Award rules stay deterministic
  - runtime/session/debug modules preserve the documented state contracts across running, spectating, round results, and final results
  - roster, event, round-stat, and upgrade helpers preserve their current behavior
  - browser hooks survive bootstrap and deterministic stepping in `jsdom`
  - audio transition, countdown, crash cooldown, and mix helpers behave deterministically
  - render and effect systems stay branch-covered without browser-driving
- `npm run test:browser` verifies in real Chromium:
  - the served application boots and accepts pointer and keyboard menu/gameplay input through Career Night start
  - representative spectating and final-standings layouts remain usable at desktop and mobile widths
  - native Canvas 2D paints normal and representative preview states without page, console, or request errors
  - browser resize, fullscreen, and requestAnimationFrame lifecycles remain functional
  - native Web Audio starts under user activation, resumes from suspension, and closes during controller teardown/recreation
- `scripts/check-test-coverage.mjs` enforces calibrated per-surface thresholds so pure rule modules stay near-complete while imperative bootstrap/runtime wrappers still have explicit floors.

## When To Extend Validation
- Add or update Vitest coverage when a change affects the preview URL contract, startup errors, browser hooks, round-start flow, Career Night generation/scoring, Wreck Awards, or documented tuning regressions.
- Add or update focused browser coverage only when a change affects native DOM, Canvas, layout/fullscreen/RAF, Web Audio, or controller ownership behavior.
- Extend `check:repo` for required docs, command wiring, or positive module surfaces. Do not add checks whose only purpose is proving a removed file or old implementation has not returned.

## Recovery Guidance
- If you add a new top-level doc, link it from `docs/README.md` and, if it becomes a common entrypoint, from `AGENTS.md`.
- If `check:repo` fails because architecture files moved, update the script and the docs together instead of bypassing the check.
- If a rule repeatedly fails in review, promote it into a doc, helper, test, or repo check rather than leaving it as tribal knowledge.
