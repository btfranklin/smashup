# Quality

## Golden Rules
- The hidden preview contract must derive ids from `src/game/content.ts`, not from duplicated allowlists.
- `window.advanceTime(ms)` and `window.render_game_to_text()` are stable automation surfaces and must remain callable in normal gameplay.
- The runtime split is intentional: do not collapse session, runtime, preview, and debug logic back into one file.
- Documentation and repo navigation are part of correctness. When commands, boundaries, or validation surfaces change, update `AGENTS.md` and `docs/`.

## Mechanical Coverage
- `npm run check:repo` enforces the agent map, docs presence, validation scripts, preview-source wiring, and the absence of the old `src/game/game.ts` catch-all.
- `npm run test:e2e` verifies:
- the preview matrix matches source ids
- invalid preview params fail visibly
- runtime hooks survive a real tournament-start flow
- the round-result audio cue helper behaves deterministically

## When To Extend Validation
- Add or update Playwright smoke coverage when a change affects the preview URL contract, startup errors, browser hooks, or round-start flow.
- Extend `check:repo` when a repeated agent mistake can be detected cheaply through file layout, doc links, or command wiring.

## Recovery Guidance
- If you add a new top-level doc, link it from `docs/README.md` and, if it becomes a common entrypoint, from `AGENTS.md`.
- If `check:repo` fails because architecture files moved, update the script and the docs together instead of bypassing the check.
- If a rule repeatedly fails in review, promote it into a doc, helper, test, or repo check rather than leaving it as tribal knowledge.
