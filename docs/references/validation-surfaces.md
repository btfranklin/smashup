# Validation Surfaces

This document is the durable reference for the repo's browser automation contract.

## Hidden Preview URL

- Entry point: `/?preview=car&preset=<id>&scenario=<id>`
- Valid preset ids come from `CAR_PRESET_IDS` in `src/game/contentIds.ts`.
- Valid preview scenarios come from `CAR_PREVIEW_SCENARIO_IDS` in `src/game/contentIds.ts`.
- Invalid ids must fail loudly with a visible startup error. They must not silently coerce to defaults.

## Browser Hooks

- `window.advanceTime(ms)`
  Deterministically advances the game loop for automation.
- `window.render_game_to_text()`
  Returns a JSON snapshot of the current visible/runtime-relevant state.

Performance collection is not a browser hook. Tests and development callers
may inject the bounded collector through controller construction, and the
test-only controller fixture may expose its snapshot inside the fixture page.
The production app adds no performance global.

## Expected Preview Behavior

- Preview mode returns `mode: "car_preview"` from `render_game_to_text()`.
- The preview payload must echo the requested preset/scenario pair.
- Preview mode uses the same content tables as live gameplay setup for presets and conditions.

## Expected Runtime Behavior

- Runtime hook coverage starts a Career Night, selects a preset, advances into gameplay, and inspects the running-state payload.
- The session payload includes the generated seed and all five round plans. Completed-round payloads include placements, points, Wreck Award ids, and standings derived from those summaries.
- The running and spectating payloads include the selected preset, current round and arena metadata, player state, remaining drivers, and visible outcome state.
- `advanceTime(ms)` remains deterministic in `spectating`; the **Skip to Results** control uses the same fixed-step runtime rather than a separate result path.
- `advanceTime(ms)` accepts finite millisecond values from `0` through `120000`
  inclusive and throws `RangeError` otherwise. Zero is a no-op for `GameState`.
  Fractional fixed-step remainder is controller-local so partitioned calls and
  one equivalent aggregate call produce the same game-state result.
- The current-plan payload is serialized from `GameState.currentRoundPlan`.
  `session.roundIndex` is zero-based; plan ids and completed-summary
  `roundNumber` values are one-based.
- In `menu` and `car_select`, `currentRoundPlan` is absent and the session
  payload reports `roundNumber`, `roundTitle`, and `modifierLabel` as `null`;
  arena `variant`, `modifier`, and `title` are also `null`, with
  `totalRounds: 0`. Preview mode keeps its smaller preview-specific payload.
- `running`, `spectating`, `round_results`, and `career_over` retain a coherent
  non-null current plan. The debug contract is asserted for each mode.
- At `career_over`, the debug payload retains all five complete summaries and
  exposes the derived eight-driver standings rather than dropping final data.

## Enforcement

- `tests/preview.spec.ts` covers preview matrix alignment and invalid preview failures.
- `tests/bootstrap-core-menus.spec.ts` covers jsdom controller wiring, hooks, deterministic stepping through Career Night start, and menu flow.
- `tests/bootstrap-input-platform.spec.ts` covers supplied-platform routing and browser input behavior.
- `tests/bootstrap-audio-performance.spec.ts` covers injected audio and bounded performance collection.
- `tests/bootstrap-lifecycle.spec.ts` covers transactional startup and full teardown.
- `tests/loop.spec.ts` covers fractional stepping, wall-clock catch-up, frame cancellation, and bounded spectator-skip scheduling.
- `tests/render-game-to-text.spec.ts` covers payload shape and truncation without browser-driving.
- `tests/career-lifecycle.spec.ts` completes all five rounds through production
  session/runtime APIs and verifies literal placement points, summaries,
  standings, tow recovery, and final debug output.
- `tests/browser/app-flow.spec.ts` covers served-app boot, live hooks, and trusted pointer/keyboard flow in Chromium.
- `tests/browser/canvas-lifecycle.spec.ts` covers native Canvas painting plus real resize, fullscreen, and RAF behavior.
- `tests/browser/audio-lifecycle.spec.ts` covers native AudioContext activation, suspended-context resume, disposal, and controller ownership transfer.
- `src/game/preview.ts` owns preview parsing and validation.
- `scripts/check-test-coverage.mjs` keeps the fast suite coverage-gated as part of `npm run test:coverage`.
- `npm run validate` combines the static, unit/controller, production-build,
  coverage, and fresh production-bundle Chromium integration layers for these
  surfaces.
- `npm run test:performance` exercises hardware-sensitive production-build
  responsiveness separately; its contract lives in
  [Performance Validation](./performance-validation.md).
