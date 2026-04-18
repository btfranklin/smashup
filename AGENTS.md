# AGENTS.md

Start here before changing code.

## Repo Map
- `docs/README.md`: index of the repo-local system of record
- `docs/ARCHITECTURE.md`: gameplay/runtime boundaries and where new logic belongs
- `docs/OPERATIONS.md`: run, validate, and inspect the game locally
- `docs/QUALITY.md`: golden rules, validation expectations, and recovery paths
- `docs/references/validation-surfaces.md`: hidden preview contract and browser hook reference
- `docs/LEGIBILITY-AUDIT.md`: current legibility strengths, gaps, and next investments
- `ROADMAP.md`: product-facing deferred work
- `progress.md`: current implementation state and recent validation notes

## Common Commands
- `npm run dev`: start the local Vite app
- `npm run check:repo`: verify the repo map, docs, and architecture guardrails
- `npm run validate`: repo checks + build + Playwright smoke coverage

## Task Routing
- Gameplay flow, roster setup, round transitions: `src/game/session.ts`
- Per-frame simulation, event feed, eliminations: `src/game/runtime.ts`
- Text/debug payloads for automation: `src/game/debug.ts`
- Preview URL parsing and contract errors: `src/game/preview.ts`
- Browser bootstrap and menus: `src/main.ts`

## Working Rules
- Do not reintroduce `src/game/game.ts`; extend the split session/runtime/debug modules instead.
- Keep preview ids sourced from `src/game/content.ts`; do not hardcode duplicate allowlists in the bootstrap path.
- Treat `docs/` as the durable system of record for architecture, operations, and quality expectations. Update docs when commands, boundaries, or validation surfaces change.
