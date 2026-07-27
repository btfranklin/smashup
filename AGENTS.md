# AGENTS.md

Start here before changing code.

## Repo Map
- `README.md`: public project overview, controls, setup, and validation summary
- `docs/README.md`: index of the repo-local system of record
- `docs/ARCHITECTURE.md`: gameplay/runtime boundaries and where new logic belongs
- `docs/OPERATIONS.md`: run, validate, and inspect the game locally
- `docs/QUALITY.md`: golden rules, validation expectations, and recovery paths
- `docs/references/validation-surfaces.md`: hidden preview contract and browser hook reference
- `docs/references/gameplay-tuning.md`: intent behind physics, damage, AI, thermal, and spectacle tuning
- `docs/LEGIBILITY-AUDIT.md`: current legibility strengths, gaps, and next investments
- `LICENSE`: public license terms
- `docs/exec-plans/tech-debt-tracker.md`: technical future-work tracker

## Common Commands
- `npm run dev`: start the local Vite app
- `npm run check:repo`: verify the repo map, docs, and architecture guardrails
- `npm run typecheck`: run TypeScript without emitting files
- `npm run test:unit`: run the fast Vitest suite once
- `npm run test:coverage`: run the coverage-gated Vitest suite plus the per-surface coverage check
- `npm run test:browser`: run the focused real-Chromium integration suite
- `npm run validate`: repo checks + typecheck + build + Vitest coverage + Chromium integration

## Task Routing
- Gameplay flow and round transitions: `src/game/session.ts`
- Career Night plan generation, placements, scoring, and standings: `src/game/career.ts`
- Wreck Award qualification: `src/game/awards.ts`
- Roster setup and car construction: `src/game/roster.ts`
- Upgrade effects and condition servicing: `src/game/upgrades.ts`
- Per-round stat lifecycle: `src/game/roundStats.ts`
- Event feed appends: `src/game/events.ts`
- Per-frame simulation, event expiration, eliminations: `src/game/runtime.ts`
- Text/debug payloads for automation: `src/game/debug.ts`
- Preview URL parsing and contract errors: `src/game/preview.ts`
- Browser bootstrap, menus, and browser hook wiring: `src/app/bootstrap.ts`
- Thin browser entrypoint and CSS import: `src/main.ts`

## Working Rules
- Do not rebuild a catch-all gameplay module; extend the dedicated split modules instead.
- Keep preview, Career Night, and Wreck Award ids and display content sourced from `src/game/content.ts`; do not duplicate authored content in bootstrap, session, or tests.
- Treat `docs/` as the durable system of record for architecture, operations, and quality expectations. Update docs when commands, boundaries, or validation surfaces change.
