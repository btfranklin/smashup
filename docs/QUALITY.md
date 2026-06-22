# Quality

## Golden Rules
- The hidden preview contract must derive ids from `src/game/content.ts`, not from duplicated allowlists.
- `window.advanceTime(ms)` and `window.render_game_to_text()` are stable automation surfaces and must remain callable in normal gameplay.
- The runtime split is intentional: do not collapse session, runtime, preview, and debug logic back into one file.
- Documentation and repo navigation are part of correctness. When commands, boundaries, or validation surfaces change, update `AGENTS.md` and `docs/`.

## Mechanical Coverage
- `npm run check:repo` enforces the agent map, public entrypoints, docs presence, validation scripts, preview-source wiring, and ignored artifact hygiene through positive required surfaces.
- `npm run typecheck` verifies `src`, `tests`, and `vitest.config.ts` under strict TypeScript.
- `npm run test:coverage` verifies:
  - preview parsing matches source ids and fails visibly on invalid params
  - runtime/session/debug modules preserve the documented state contracts
  - roster, event, round-stat, and upgrade helpers preserve their current behavior
  - browser hooks survive bootstrap and deterministic stepping in `jsdom`
  - audio transition, countdown, crash cooldown, and mix helpers behave deterministically
  - render and effect systems stay branch-covered without browser-driving
- `scripts/check-test-coverage.mjs` enforces calibrated per-surface thresholds so pure rule modules stay near-complete while imperative bootstrap/runtime wrappers still have explicit floors.

## When To Extend Validation
- Add or update Vitest coverage when a change affects the preview URL contract, startup errors, browser hooks, round-start flow, or documented tuning regressions.
- Extend `check:repo` for required docs, command wiring, or positive module surfaces. Do not add checks whose only purpose is proving a removed file or old implementation has not returned.

## Recovery Guidance
- If you add a new top-level doc, link it from `docs/README.md` and, if it becomes a common entrypoint, from `AGENTS.md`.
- If `check:repo` fails because architecture files moved, update the script and the docs together instead of bypassing the check.
- If a rule repeatedly fails in review, promote it into a doc, helper, test, or repo check rather than leaving it as tribal knowledge.
