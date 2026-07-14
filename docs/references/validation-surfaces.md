# Validation Surfaces

This document is the durable reference for the repo's browser automation contract.

## Hidden Preview URL
- Entry point: `/?preview=car&preset=<id>&scenario=<id>`
- Valid preset ids come from `CAR_PRESET_IDS` in `src/game/content.ts`.
- Valid preview scenarios come from `CAR_PREVIEW_SCENARIO_IDS` in `src/game/content.ts`.
- Invalid ids must fail loudly with a visible startup error. They must not silently coerce to defaults.

## Browser Hooks
- `window.advanceTime(ms)`
  Deterministically advances the game loop for automation.
- `window.render_game_to_text()`
  Returns a JSON snapshot of the current visible/runtime-relevant state.

## Expected Preview Behavior
- Preview mode returns `mode: "car_preview"` from `render_game_to_text()`.
- The preview payload must echo the requested preset/scenario pair.
- Preview mode uses the same content tables as live gameplay setup for presets and conditions.

## Expected Runtime Behavior
- The runtime hook coverage starts a tournament, selects a preset, advances into gameplay, and inspects the running-state payload.
- The running payload must include the selected preset, round metadata, player state, and current arena metadata.

## Enforcement
- `tests/preview.spec.ts` covers preview matrix alignment and invalid preview failures.
- `tests/bootstrap.spec.ts` covers jsdom controller wiring, supplied-platform routing, and deterministic stepping through tournament start.
- `tests/render-game-to-text.spec.ts` covers payload shape and truncation without browser-driving.
- `tests/browser/app-flow.spec.ts` covers served-app boot, live hooks, and trusted pointer/keyboard flow in Chromium.
- `tests/browser/canvas-lifecycle.spec.ts` covers native Canvas painting plus real resize, fullscreen, and RAF behavior.
- `tests/browser/audio-lifecycle.spec.ts` covers native AudioContext activation, suspended-context resume, disposal, and controller ownership transfer.
- `src/game/preview.ts` owns preview parsing and validation.
- `scripts/check-test-coverage.mjs` keeps the fast suite coverage-gated as part of `npm run test:coverage`.
- `npm run validate` combines the static, unit/controller, production-build, coverage, and Chromium integration layers for these surfaces.
