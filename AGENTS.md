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
- `ROADMAP.md`: product-facing deferred work
- `progress.md`: current implementation state and recent validation notes

## Common Commands
- `npm run dev`: start the local Vite app
- `npm run check:repo`: verify the repo map, docs, and architecture guardrails
- `npm run test:unit`: run the fast Vitest suite once
- `npm run test:coverage`: run the coverage-gated Vitest suite plus the per-surface coverage check
- `npm run validate`: repo checks + build + Vitest coverage

## Task Routing
- Gameplay flow, roster setup, round transitions: `src/game/session.ts`
- Per-frame simulation, event feed, eliminations: `src/game/runtime.ts`
- Text/debug payloads for automation: `src/game/debug.ts`
- Preview URL parsing and contract errors: `src/game/preview.ts`
- Browser bootstrap, menus, and browser hook wiring: `src/app/bootstrap.ts`
- Thin browser entrypoint and CSS import: `src/main.ts`

## Working Rules
- Do not reintroduce `src/game/game.ts`; extend the split session/runtime/debug modules instead.
- Keep preview ids sourced from `src/game/content.ts`; do not hardcode duplicate allowlists in the bootstrap path.
- Treat `docs/` as the durable system of record for architecture, operations, and quality expectations. Update docs when commands, boundaries, or validation surfaces change.
