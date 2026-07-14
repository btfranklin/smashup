# Operations

## Setup
- Use Node `26.x`, matching the validated local and CI runtime.
- Install dependencies with `npm install`.
- Install the supported browser once with `npx playwright install chromium`.
- Start the game locally with `npm run dev`.
- To mirror CI locally from a clean checkout, run `npm ci && npx playwright install chromium && npm run validate`.

## Validation Commands
- `npm run check:repo`
  Verifies the repo map, required docs, validation scripts, and positive module/documentation surfaces.
- `npm run typecheck`
  Runs TypeScript against `src`, `tests`, and `vitest.config.ts` without emitting files.
- `npm run validate`
  Runs `check:repo`, typecheck, production build, and the coverage-gated Vitest suite.
- `npm run test:unit`
  Runs the fast Vitest suite once without coverage instrumentation.
- `npm run test:coverage`
  Runs the same suite with V8 coverage output and the calibrated per-surface coverage check.
- `npm run test:browser`
  Starts Vite and runs the focused real-Chromium boot, Canvas, lifecycle, and Web Audio integration suite.

## Runtime Inspection Surfaces
- Hidden preview mode: `/?preview=car&preset=<id>&scenario=<id>`
- Deterministic stepping hook: `window.advanceTime(ms)`
- Text-state hook: `window.render_game_to_text()`

See [Validation Surfaces](./references/validation-surfaces.md) for the contract details.

## Artifact Locations
- `dist/`: Vite production build output
- `output/playwright/`: ignored Playwright reports, traces, screenshots, videos, and test results; failure artifacts are disposable validation residue
- `output/`: other ignored local browser/manual inspection captures
- `coverage/`: coverage output when generated locally by Vitest

## Failure Recovery
- If `check:repo` fails, read the remediation text first; it tells you which file or link drifted.
- If `test:unit` or `test:coverage` fails on preview coverage, inspect `src/game/content.ts`, `src/game/preview.ts`, `tests/preview.spec.ts`, and `tests/bootstrap.spec.ts` together.
- If startup errors appear in preview mode, confirm the requested ids are present in `CAR_PRESET_IDS` and `CAR_PREVIEW_SCENARIO_IDS`.
- If `test:browser` cannot launch Chromium, rerun `npx playwright install chromium`; on Linux CI use `npx playwright install --with-deps chromium`.
