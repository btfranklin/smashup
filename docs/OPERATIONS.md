# Operations

## Setup

- Use Node `26.x`, matching the validated local and CI runtime.
- Install dependencies with `npm install`.
- Install the supported browser once with `npx playwright install chromium`.
- Start the game locally with `npm run dev`.
- To mirror CI locally from a clean checkout, run `npm ci && npx playwright install chromium && npm run validate`.

## Validation Commands

- `npm run check:repo`
  Verifies public and agent entrypoints, resolvable local documentation links,
  package command wiring, license consistency, ignored generated artifacts, and
  the CI validation command.
- `npm run typecheck`
  Runs TypeScript against `src`, `tests`, and `vitest.config.ts` without emitting files.
- `npm run validate`
  Runs `check:repo`, typecheck, the production build, the coverage-gated Vitest suite, and the focused Chromium integration suite.
- `npm run test:unit`
  Runs the fast Vitest suite once without coverage instrumentation.
- `npm run test:coverage`
  Runs the same suite with V8 coverage output and the calibrated per-surface coverage check.
- `npm run test:browser`
  Builds the ordinary app plus its test-only controller fixture, serves that
  fresh production bundle on the repo-dedicated browser-test port, and runs
  the focused real-Chromium boot, Canvas, lifecycle, and Web Audio integration
  suite. It does not reuse an unrelated local Vite process.
- `npm run test:performance`
  Separately builds and serves an ignored production-mode multi-page bundle,
  then runs a single-worker, no-retry Chromium suite for deterministic clean,
  collision, damaged, audio-startup, spectator-skip, and 4x CPU workloads. The
  extra controller page is test-only and is not part of the normal production
  build. This hardware-sensitive check is intentionally not part of
  `npm run validate`.

## Runtime Inspection Surfaces

- Hidden preview mode: `/?preview=car&preset=<id>&scenario=<id>`
- Deterministic stepping hook: `window.advanceTime(ms)`
- Text-state hook: `window.render_game_to_text()`

The text-state payload exposes the in-memory Career Night seed and round schedule, placements, points, awards, and current standings alongside the active arena and cars. See [Validation Surfaces](./references/validation-surfaces.md) for the contract details.

## Artifact Locations

- `dist/`: Vite production build output
- `output/playwright/`: ignored Playwright reports and test results; ordinary
  browser failures may retain traces, screenshots, and videos, while the
  performance configuration disables trace/video and captures screenshots
  only on failure
- `output/browser-build/`: disposable production bundle used by the ordinary
  Chromium integration suite
- `output/playwright/performance-report/`: standalone performance HTML report
- `output/playwright/performance-results/`: performance result attachments and
  failure artifacts
- `output/performance-samples/`: latest bounded JSON metrics for each
  deterministic performance workload
- `output/performance-build/`: ignored production-mode app and test-fixture bundle used only by the performance smoke
- `output/`: other ignored local browser/manual inspection captures
- `coverage/`: coverage output when generated locally by Vitest

## Failure Recovery

- If `check:repo` fails, read the remediation text first; it tells you which file or link drifted.
- If `test:unit` or `test:coverage` fails on preview coverage, inspect `src/game/contentIds.ts`, `src/game/content.ts`, `src/game/preview.ts`, `tests/preview.spec.ts`, and the relevant `tests/bootstrap*.spec.ts` together.
- If Career Night generation, scoring, or award tests fail, inspect `src/game/contentIds.ts`, `src/game/content.ts`, `src/game/career.ts`, and `src/game/awards.ts` before changing session or browser code.
- If startup errors appear in preview mode, confirm the requested ids are present in `CAR_PRESET_IDS` and `CAR_PREVIEW_SCENARIO_IDS` in `src/game/contentIds.ts`.
- If `test:browser` cannot launch Chromium, rerun `npx playwright install chromium`; on Linux CI use `npx playwright install --with-deps chromium`.
- If `test:performance` fails, rerun it on an otherwise idle machine and inspect
  the relevant file in `output/performance-samples/` and the collector context
  before considering a budget change. Follow
  [Performance Validation](./references/performance-validation.md).
