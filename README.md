# Smashup Derby

![Smashup Derby banner](https://raw.githubusercontent.com/btfranklin/smashup/main/.github/social%20preview/smashup_social_preview.jpg "Smashup Derby")

[![Validate and Deploy](https://github.com/btfranklin/smashup/actions/workflows/validate.yml/badge.svg)](https://github.com/btfranklin/smashup/actions/workflows/validate.yml)

Smashup Derby is a demolition derby game that runs in your browser. Choose a
car, compete against seven AI drivers, and keep it running through five rounds
of Career Night. Earn points, repair damage between rounds, and reach the
Redline finale.

The game uses TypeScript, Vite, and Canvas 2D. It needs no account, application
server, or database. All game state stays in memory; reloading the page starts
a new session.

## Features

- **Five-round Career Night.** Compete across a seeded sequence of arenas and
  round conditions. All eight drivers earn points toward the final standings.
- **Three car choices.** Select a car and make pit decisions between rounds.
- **Visible damage.** Impacts change the car's shape and damage its engine,
  radiator, steering, lights, and body panels.
- **Arena hazards.** Drive through mud, avoid obstacles, and work around wrecks
  that stay on the track.
- **Wreck Awards.** Earn awards for impact, survival, and style after each round.
- **Spectator mode.** If your car stops running, watch the remaining drivers or
  skip to the results.
- **Procedural sound and effects.** Engine audio, smoke, dust, sparks, and debris
  respond to the action.

## Play Locally

Use Node.js `26.x` and npm. From the project directory, run:

```sh
npm ci
npm run dev
```

Open the address that Vite prints, usually `http://localhost:5173/`. Use a
keyboard to drive. Select a car and start Career Night from the game menu.

## Controls

| Key | Action |
| --- | --- |
| `W` or `ArrowUp` | Drive forward |
| `S` or `ArrowDown` | Drive backward |
| `A` or `ArrowLeft` | Steer left |
| `D` or `ArrowRight` | Steer right |
| `Enter` | Continue through menus |
| `F` | Enter or leave fullscreen |

## Build a Static Site

```sh
npm run build
npm run preview
```

Open the preview address that Vite prints. The production files are in `dist/`.
A static host can serve these files without a Node.js process. Node.js is
required only for development and the build.

## Development

Install [Perfect Doc](https://github.com/btfranklin/perfect-doc#build-and-install)
for documentation checks. Install Chromium once before browser tests:

```sh
npx playwright install chromium
npm run validate
```

`npm run validate` checks repository structure and documentation, checks types,
builds the game, runs unit tests with coverage checks, and runs the Chromium
integration tests. CI runs the same command.

For focused checks:

| Command | Purpose |
| --- | --- |
| `npm run check:repo` | Check repository structure, local links, and command setup |
| `npm run check:docs` | Check Markdown with Perfect Doc, without network access |
| `npm run typecheck` | Check TypeScript types |
| `npm run test:unit` | Run unit tests |
| `npm run test:coverage` | Run unit tests and check coverage limits |
| `npm run test:browser` | Test the production build in Chromium |
| `npm run test:performance` | Run the separate production performance check |

The documentation command runs `perfect-doc check . --offline --no-banner`.
The performance check depends on machine load and stays outside
`npm run validate`. See [Performance Validation](docs/references/performance-validation.md)
for its limits and output files.

## Documentation

Start with the [documentation index](docs/README.md), or use these guides:

- [Architecture](docs/ARCHITECTURE.md): module ownership and game-state rules.
- [Operations](docs/OPERATIONS.md): setup, validation, and failure recovery.
- [Gameplay Tuning](docs/references/gameplay-tuning.md): physics, damage, AI,
  and effects.
- [Validation Surfaces](docs/references/validation-surfaces.md): preview URLs
  and browser test hooks.

## License

[MIT](LICENSE). Created by [B.T. Franklin](https://btfranklin.info).
