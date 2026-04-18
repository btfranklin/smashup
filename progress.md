Original prompt: We are building a graphical browser-based game. We want to use canvas for rendering.

The game is called "Smashup Derby". It's a demolition derby game, using simple 2D graphics. The arena is viewed from above. The player controls 1 car, and there are 7 others controlled by AI.

The cars all start on the left and right, 4 per side, their fronts facing away from the center of the area. Controls are to steer, accelerate forward, and accelerate backward.

Each car is physics-based, and has realistic damage tracking based on where it impacts other cars. Headlights can be smashed out, as can taillights. Impacts on the front of the car can damage the engine, including the radiator, transmission, and steering. An engine damaged too much takes the car out of the game (it loses, but the hulk of the car remains on the arena).

The AIs of the cars should be modeled using a simple flock-like system, where they try to reverse at the highest possible speed into a car that has its front or side facing them.

The game should run completely in-browser, with no server needed or saved state.

Current state
- Vite + TypeScript + canvas game is implemented and playable in-browser with no server state.
- `window.advanceTime(ms)` and `window.render_game_to_text()` are wired for deterministic browser testing.
- The match ends immediately when the player car is destroyed. If the player loses, the UI lists the drivers who outlasted them.
- Disabled cars remain as physical hulks and lose all lights.

Gameplay rules and tuning that matter
- Steering uses a wheel-angle model. Cars cannot turn in place.
- AI uses reverse-attack behavior with separation and explicit wall-escape logic. Corner escape now uses a combined inward vector from pressured walls.
- Collision damage uses a hard low-speed floor. A contact can have nonzero visual/audio severity while still having `damageSeverity: 0`.
- Front-end drivetrain damage depends on direct received load into the nose. Rear impacts are much softer so backing into cars behaves like using the rear as a weapon.

Effects and presentation
- Smoke puffs are world-space effects emitted from the hood area.
- Smoke renders above cars, not below them.
- Smoke communicates damage phase:
- lighter smoke for moderate damage
- darker smoke for worse damage
- orange-core flame fading to black smoke when a car is very close to death
- Debris particles appear only on hard impacts.
- End-state audio uses a happy melody on player win and a sad melody on player loss.

Useful validation already done
- Deterministic stepping no longer races `requestAnimationFrame`.
- Wall-hugging AI no longer tends to freeze on the arena rail in the sampled long idle runs.
- Harmless collisions were confirmed through text state with `severity > 0` and `damageSeverity: 0`.
- Flame-phase smoke was confirmed in deterministic browser testing with player systems heavily degraded.

Files worth checking first if more tuning is needed
- `src/game/game.ts`: state transitions, text-state output
- `src/game/physics.ts`: car movement, wall response, collision severity/damage floor
- `src/game/damage.ts`: impact-to-subsystem damage mapping and disable rules
- `src/game/ai.ts`: reverse-attack targeting, separation, wall escape
- `src/game/smoke.ts`: smoke phase thresholds and puff spawning
- `src/game/render.ts`: layer order and visual readability

Current watchpoints
- Damage tuning is intentionally conservative at low speed; if kills feel too rare, adjust high-speed/direct-hit scaling instead of weakening the no-damage floor.
- Smoke phase thresholds are now readable, but if visual clutter grows, tune spawn rate before changing z-order or removing phase cues.
- Flame-phase smoke is now intentionally stricter than generic smoke. It is tied to critical subsystem collapse rather than general damage pressure, so flames should not appear while the main health bars are still comfortably above mid-range.
