# Smashup Derby

**Smashup Derby** is a browser-based demolition derby game built with TypeScript, Vite, and canvas.

Pick a car and fight through a five-round Career Night whose arenas and pressure escalate toward a Redline finale. Keep the machine running through pit choices, hazards, smoke, debris, engine damage, and AI drivers that would rather reverse into you than behave sensibly.

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

- Five-round Career Night with a seeded sequence of arenas and modifiers, between-round pit choices, and a Redline finale.
- Three player car presets and multiple arena variants.
- Physics-based impacts that follow each car's live deformed silhouette, with
  directional damage to engines, radiators, steering, lights, and body panels.
- Disabled cars remain in the arena as hulks; if the player is wrecked, the remaining fight can be watched or skipped to its result.
- Post-round Wreck Awards celebrate impact, survival, and style.
- All eight drivers earn placement points toward a final standings table and top-three podium.
- Procedural audio, smoke, debris, dust, screen shake, and hit callouts.
- Browser-only, in-memory runtime with no server or saved state.

## Development

Validated local and CI runtime: Node `26.x`.

```bash
npm ci
npx playwright install chromium
npm run typecheck
npm run build
npm run test:unit
npm run test:browser
npm run validate
npm run test:performance
```

`npm run validate` is the main regression command. It runs the repo legibility check, typecheck, builds the production bundle, runs the coverage-gated Vitest suite, verifies calibrated per-surface coverage thresholds, and exercises the focused Chromium integration suite. Install Chromium once with `npx playwright install chromium` before running browser validation locally.

`npm run test:performance` is a separate, hardware-sensitive production-build smoke. Run it for changes that can affect simulation, rendering, menus, or browser-controller responsiveness; it intentionally stays outside the ordinary validation command. See [Performance Validation](docs/references/performance-validation.md) for budgets and artifact policy.

## Project Layout

- `src/app/`: browser lifecycle, scheduling, menus, and diagnostic collection
- `src/game/`: content, simulation, Career Night rules, audio, and rendering
- `tests/`: Vitest rule/controller coverage plus focused real-browser checks
- `scripts/`: repository and coverage validation
- `docs/`: the complete architecture map, operations, quality, and validation references

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
