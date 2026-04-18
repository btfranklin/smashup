# Operations

## Setup
- Install dependencies with `npm install`.
- Start the game locally with `npm run dev`.

## Validation Commands
- `npm run check:repo`
  Verifies the repo map, required docs, validation scripts, and the post-refactor game module layout.
- `npm run validate`
  Runs `check:repo`, production build, and the coverage-gated Vitest suite.
- `npm run test:unit`
  Runs the fast Vitest suite once without coverage instrumentation.
- `npm run test:coverage`
  Runs the same suite with V8 coverage output and the calibrated per-surface coverage check.

## Runtime Inspection Surfaces
- Hidden preview mode: `/?preview=car&preset=<id>&scenario=<id>`
- Deterministic stepping hook: `window.advanceTime(ms)`
- Text-state hook: `window.render_game_to_text()`

See [Validation Surfaces](./references/validation-surfaces.md) for the contract details.

## Artifact Locations
- `dist/`: Vite production build output
- `output/web-game/`: manual or skill-driven browser inspection captures
- `coverage/`: coverage output when generated locally by Vitest
- `progress.md`: running implementation notes and validation outcomes

## Failure Recovery
- If `check:repo` fails, read the remediation text first; it tells you which file or link drifted.
- If `test:unit` or `test:coverage` fails on preview coverage, inspect `src/game/content.ts`, `src/game/preview.ts`, `tests/preview.spec.ts`, and `tests/bootstrap.spec.ts` together.
- If startup errors appear in preview mode, confirm the requested ids are present in `CAR_PRESET_IDS` and `CAR_PREVIEW_SCENARIO_IDS`.
