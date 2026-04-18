# Operations

## Setup
- Install dependencies with `npm install`.
- Start the game locally with `npm run dev`.
- The default local browser runtime for tests is `http://127.0.0.1:4173`.

## Validation Commands
- `npm run check:repo`
  Verifies the repo map, required docs, validation scripts, and the post-refactor game module layout.
- `npm run validate`
  Runs `check:repo`, production build, and Playwright smoke coverage.
- `npm run test:e2e`
  Runs Playwright smoke tests directly.

## Runtime Inspection Surfaces
- Hidden preview mode: `/?preview=car&preset=<id>&scenario=<id>`
- Deterministic stepping hook: `window.advanceTime(ms)`
- Text-state hook: `window.render_game_to_text()`

See [Validation Surfaces](./references/validation-surfaces.md) for the contract details.

## Artifact Locations
- `dist/`: Vite production build output
- `output/playwright/test-results/`: Playwright artifacts from failing smoke tests
- `output/web-game/`: manual or skill-driven browser inspection captures
- `progress.md`: running implementation notes and validation outcomes

## Failure Recovery
- If `check:repo` fails, read the remediation text first; it tells you which file or link drifted.
- If `test:e2e` fails on preview coverage, inspect `src/game/content.ts`, `src/game/preview.ts`, and `tests/game-smoke.spec.ts` together.
- If startup errors appear in preview mode, confirm the requested ids are present in `CAR_PRESET_IDS` and `CAR_PREVIEW_SCENARIO_IDS`.
