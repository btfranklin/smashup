# AGENTS.md

Start here before changing code.

## Repo Map

- `README.md`: public project overview, controls, setup, and validation summary
- `docs/README.md`: index of the repo-local system of record
- `docs/ARCHITECTURE.md`: complete code-ownership map and boundary guidance
- `docs/OPERATIONS.md`: run, validate, and inspect the game locally
- `docs/QUALITY.md`: architectural guardrails, validation expectations, and recovery paths
- `docs/references/validation-surfaces.md`: hidden preview contract and browser hook reference
- `docs/references/gameplay-tuning.md`: intent behind physics, damage, AI, thermal, and spectacle tuning
- `docs/references/performance-validation.md`: isolated production-build performance smoke and artifact policy
- `docs/LEGIBILITY-AUDIT.md`: current legibility strengths, gaps, and next investments
- `LICENSE`: public license terms
- `docs/exec-plans/tech-debt-tracker.md`: technical future-work tracker

## Common Commands

- `npm run dev`: start the local Vite app
- `npm run check:repo`: verify entrypoints, documentation links, command wiring, license metadata, and ignored artifacts
- `npm run check:docs`: run `perfect-doc check . --offline --no-banner` with `perfect-doc.toml`; install Perfect Doc before validation
- `npm run typecheck`: run TypeScript without emitting files
- `npm run test:unit`: run the fast Vitest suite once
- `npm run test:coverage`: run the coverage-gated Vitest suite plus the per-surface coverage check
- `npm run test:browser`: run the focused real-Chromium integration suite
- `npm run test:performance`: run the separate single-worker production-build performance smoke
- `npm run validate`: repo and documentation checks + typecheck + build + Vitest coverage + Chromium integration

## Task Routing

- Content ids and guards: `src/game/contentIds.ts`; authored display and tuning catalogs: `src/game/content.ts`
- Gameplay flow and round transitions: `src/game/session.ts`
- Career Night plan generation, placements, scoring, and standings: `src/game/career.ts`
- Wreck Award qualification: `src/game/awards.ts`
- Roster setup and car construction: `src/game/roster.ts`
- Arena geometry and authored-layout materialization: `src/game/arena.ts`
- Upgrade effects and condition servicing: `src/game/upgrades.ts`
- Per-round stat lifecycle: `src/game/roundStats.ts`
- Event feed appends: `src/game/events.ts`
- State lookup, active-career predicates, and required-state guards: `src/game/selectors.ts`
- Per-frame simulation, event expiration, eliminations: `src/game/runtime.ts`
- Text/debug payloads for automation: `src/game/debug.ts`
- Preview URL parsing and contract errors: `src/game/preview.ts`
- Browser controller lifecycle and browser hook wiring: `src/app/bootstrap.ts`
- Fixed-step scheduling, deterministic advancement, and spectator skip: `src/app/loop.ts`
- Menu presentation and menu event binding: `src/app/menu.ts`
- Bounded diagnostic timing and runtime-context collection: `src/app/performance.ts`
- Stable render façade: `src/game/render.ts`; focused drawing internals: `src/game/render/`
- Controller test setup and teardown: `tests/helpers/controller-harness.ts`
- Controller behavior: `tests/bootstrap*.spec.ts`; runtime behavior: `tests/runtime-*.spec.ts`; rendering behavior: `tests/render*.spec.ts`
- Thin browser entrypoint and CSS import: `src/main.ts`

## Working Rules

- Do not rebuild a catch-all gameplay module; extend the dedicated split modules instead.
- Keep preview, Career Night, and Wreck Award ids in `src/game/contentIds.ts` and display/tuning content in `src/game/content.ts`; do not duplicate either in bootstrap, session, or tests.
- Treat `docs/` as the durable system of record for architecture, operations, and quality expectations. Update docs when commands, boundaries, or validation surfaces change.
- Publish only `dist/` through GitHub Pages after validation passes on `main`. Keep test fixtures in the separate ignored build directories.
