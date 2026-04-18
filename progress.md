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
- Hidden preview endpoint: `/?preview=car&preset=<bulldozer|darter|backstab>&scenario=<pristine|front_light|front_heavy|left_heavy|rear_heavy|critical|disabled>`
- Preview mode returns `mode: "car_preview"` from `render_game_to_text()` with preset/scenario and visible car state.

Useful files
- `src/game/game.ts`: state flow, camera/event logic, preview-state creation, text-state output
- `src/game/render.ts`: car art, damage overlays, preview rendering, HUD
- `src/main.ts`: menu flow, query-param preview entry, browser hooks
- `src/game/content.ts`: presets, rounds, upgrades, preview scenarios
- `src/game/physics.ts`, `src/game/damage.ts`, `src/game/ai.ts`: gameplay tuning

Latest validation
- `npm run build` passes.
- Preview endpoint validated through the required Playwright client with `front_heavy` state.
- `render_game_to_text()` in preview mode reports the expected preset/scenario payload.
- Car-select UI was checked in-browser and the square choice cards fit their text cleanly.
- A direct Playwright camera probe confirmed a huge-hit event can occur while low-severity follow-up frames no longer retain meaningful camera shake (`lowAfterHuge: null`).

Remaining roadmap
- Only deferred items remain in `ROADMAP.md`: replay/highlight work and a light long-term meta layer.
