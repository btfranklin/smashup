Original prompt: We are building a graphical browser-based game. We want to use canvas for rendering.

The game is called "Smashup Derby". It's a demolition derby game, using simple 2D graphics. The arena is viewed from above. The player controls 1 car, and there are 7 others controlled by AI.

The cars all start on the left and right, 4 per side, their fronts facing away from the center of the area. Controls are to steer, accelerate forward, and accelerate backward.

Each car is physics-based, and has realistic damage tracking based on where it impacts other cars. Headlights can be smashed out, as can taillights. Impacts on the front of the car can damage the engine, including the radiator, transmission, and steering. An engine damaged too much takes the car out of the game (it loses, but the hulk of the car remains on the arena).

The AIs of the cars should be modeled using a simple flock-like system, where they try to reverse at the highest possible speed into a car that has its front or side facing them.

The game should run completely in-browser, with no server needed or saved state.

Current state
- Browser-only Vite + TypeScript + canvas derby is implemented.
- `window.advanceTime(ms)` and `window.render_game_to_text()` are stable and used for browser validation.
- The game now runs as a three-round session with car select, intros, upgrades, round results, and tournament end.
- Three player presets, three arena variants, AI archetypes, hazards, smoke/debris/dust, and procedural audio are in place.
- The round ends immediately when the player is destroyed. Disabled cars remain as hulks and all lights go out.

Visual and polish rules that matter
- Car numbers are painted on the hood/body, not floated beside the car.
- Damage overlays are clipped to the body silhouette so they stay inside the car art.
- Smoke renders above cars and escalates from light smoke to dark smoke to flames only near critical failure.
- Screen shake is now reserved for huge hits and decays quickly.
- Multi-option selection screens use square choice cards; the single primary CTA buttons stay pill-shaped.

Developer/testing surfaces
- Hidden preview endpoint: `/?preview=car&preset=<id>&scenario=<id>`
- Valid preview ids are defined in `src/game/content.ts` via `CAR_PRESET_IDS` and `CAR_PREVIEW_SCENARIO_IDS`.
- Preview mode returns `mode: "car_preview"` from `render_game_to_text()` with preset/scenario and visible car state.
- Validation entrypoint: `npm run validate` runs the repo legibility check, production build, and coverage-gated Vitest suite for preview contracts, runtime hooks, audio transitions, and core rule modules.

Useful files
- `src/game/session.ts`: state setup, round progression, car factory, preview-state creation
- `src/game/runtime.ts`: per-frame advancement, event feed, camera, eliminations, round transitions
- `src/game/debug.ts`: `render_game_to_text()` payload generation
- `src/game/render.ts`: car art, damage overlays, preview rendering, HUD
- `src/app/bootstrap.ts`: menu flow, preview parsing, startup error handling, browser hooks
- `src/main.ts`: thin browser entrypoint and CSS import
- `src/game/content.ts`: presets, rounds, upgrades, preview scenarios, preview id helpers
- `src/game/physics.ts`, `src/game/damage.ts`, `src/game/ai.ts`: gameplay tuning

Latest validation
- `npm run build` passes.
- `npm run test:unit` passes with the fast Vitest/jsdom suite.
- Preview parsing now validates the full preset/scenario matrix directly from `CAR_PRESET_IDS` and `CAR_PREVIEW_SCENARIO_IDS`.
- Bootstrap coverage now checks visible startup errors, deterministic `window.advanceTime(ms)`, `window.render_game_to_text()`, resize math, fullscreen toggling, and keyboard mapping without browser-driving.
- Render/debug coverage now checks preview payload echoing, running payload truncation, intro/non-running overlays, and smoke ordering with a recording canvas context.
- Thermal and damage retune pass validated through direct module probes on the Vite dev server:
- `hot_engines` idle heat stayed around `0.38` after five seconds from a `0.4` start instead of collapsing toward zero
- a damaged radiator under sustained throttle reached `overheat: 1`
- a healthy car still cooled from `0.5` to about `0.39` over eight seconds off-throttle in a normal round
- front-hit damage now separates medium and extreme impacts again (`damageSeverity` about `0.56` vs `1`)
- front-into-rear hits are now much softer on the striker (`engine` about `0.99` after a 100-speed rear-end hit, `0.92` at 180-speed)
- Preview screenshots were rechecked after the decal pass; the number now sits on the roof-center panel and is no longer covered by the windshield/cabin art.
- Cooling was rebalanced again after user feedback that it had become too weak:
- healthy off-throttle cooling now drops `overheat` from `0.5` to about `0.248` over eight seconds in a normal round
- `hot_engines` still stays elevated at about `0.38` after five idle seconds from a `0.4` start
- damaged-radiator sustained throttle in `hot_engines` still reaches terminal overheat
- Preview contract is now sourced from `CAR_PRESET_IDS` and `CAR_PREVIEW_SCENARIO_IDS`; invalid preview ids render a visible startup error instead of coercing to defaults.
- Runtime logic is split across `src/game/session.ts`, `src/game/runtime.ts`, and `src/game/debug.ts`; shared condition helpers live in `src/game/conditions.ts`.
- End-of-round audio cues now key off the real `running -> round_results` transition through `src/game/audioTransitions.ts`.
- `npm run validate` passes and covers:
- preview matrix alignment against source ids
- invalid preview startup failures
- bootstrap hook installation and deterministic stepping
- deterministic audio transition, countdown, crash cooldown, and mix selection
- session/runtime/debug/render/effects rule coverage through fast unit tests
- calibrated per-surface coverage thresholds through `scripts/check-test-coverage.mjs`
- Agent-legibility pass added:
- `AGENTS.md` as a short repo map
- indexed `docs/` system of record for architecture, operations, quality, validation surfaces, and audit notes
- `scripts/check-repo-legibility.mjs` plus `npm run check:repo`
- `npm run validate` now includes the repo legibility check before build + coverage-gated Vitest validation

Remaining roadmap
- Only deferred items remain in `ROADMAP.md`: replay/highlight work and a light long-term meta layer.

Current fix pass
- Investigating user-reported derby flow issues around "Huge Hit!" copy, kill credit, and biggest-hit carryover.
- Confirmed the hit event and biggest-hit summary were using raw collision severity, so moderate bumper shoves could read as huge despite low damage severity.
- Confirmed knockout credit only looked at same-frame collisions, so delayed failures from recent player damage could miss player credit.
- Confirmed round stats reset in `prepareRound`, but the previous `lastRoundSummary` stayed populated into the next round and could make debug/output surfaces look stale.
- Fixed those by scoring impact callouts/summaries on damage severity, retaining a short recent-player-hit credit window for delayed KOs, and clearing stale round summaries when preparing a new heat.
- `npm run validate` passes after the fix; in-app browser verification reached the Round 1 intro at `http://127.0.0.1:5173/` with only the pre-existing missing favicon request in the console.
