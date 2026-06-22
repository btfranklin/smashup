# Smashup Derby

**Smashup Derby** is a browser-based demolition derby game built with TypeScript, Vite, and canvas.

Pick a car, survive three themed rounds, and keep the machine running through upgrades, hazards, smoke, debris, engine damage, and AI drivers that would rather reverse into you than behave sensibly.

## Quick Start

```bash
npm install
npm run dev
```

Open the local Vite URL shown in the terminal, usually `http://localhost:5173/`.

## Controls

- `W` / `ArrowUp`: accelerate forward
- `S` / `ArrowDown`: accelerate backward
- `A` / `ArrowLeft`: steer left
- `D` / `ArrowRight`: steer right
- `Enter`: advance menu flow
- `F`: toggle fullscreen

## Game Features

- Three-round tournament flow with car select, intros, upgrade choices, round results, and tournament end.
- Three player car presets and multiple arena variants.
- Physics-based impacts with directional damage to engines, radiators, steering, lights, and body panels.
- Disabled cars remain in the arena as hulks.
- Procedural audio, smoke, debris, dust, screen shake, and hit callouts.
- Browser-only runtime with no server or saved state.

## Development

Validated local and CI runtime: Node `26.x`.

```bash
npm ci && npm run validate
npm run typecheck
npm run build
npm run test:unit
npm run validate
```

`npm run validate` is the main regression command. It runs the repo legibility check, typecheck, builds the production bundle, runs the coverage-gated Vitest suite, and verifies calibrated per-surface coverage thresholds.

## Project Layout

- `src/app/bootstrap.ts`: browser bootstrap, menus, startup errors, and runtime hooks
- `src/main.ts`: thin browser entrypoint and CSS import
- `src/game/session.ts`: state creation, preview state, and round/tournament progression
- `src/game/roster.ts`: lineup data and car construction helpers
- `src/game/upgrades.ts`: upgrade bonuses and condition servicing
- `src/game/roundStats.ts`: round stat defaults and reset lifecycle
- `src/game/events.ts`: event-feed appends and capping
- `src/game/runtime.ts`: per-frame simulation, event expiration, eliminations, and camera updates
- `src/game/debug.ts`: `window.render_game_to_text()` payload generation
- `src/game/render.ts`: canvas drawing
- `tests/`: Vitest unit coverage, jsdom bootstrap coverage, and deterministic transition checks
- `docs/`: architecture, operations, quality, and validation-surface references

## Automation Surfaces

The game exposes a small browser-validation contract:

- Hidden preview URL: `/?preview=car&preset=<id>&scenario=<id>`
- Deterministic stepping hook: `window.advanceTime(ms)`
- Text-state hook: `window.render_game_to_text()`

See `docs/references/validation-surfaces.md` for the full contract.

## Notes

This is a toy demolition derby game, not a realistic vehicle simulator. The physics and damage model are tuned for readable arcade chaos.

## License

MIT. See `LICENSE`.
