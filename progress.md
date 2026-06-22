Original prompt: Implement realistic visual car destruction with impact-specific car polygon deformation, persistent car frame state, and car-colored fragments from huge hits that can be pushed around without changing main car collision hitboxes.

Progress:
- Starting implementation from a clean worktree.
- Added typed frame state and wired frame cloning, capture, repair, preview seeding, and impact deformation.
- Added persistent car fragment state, severe-hit spawning, movement, bounds, car push behavior, and debug summaries.
- Replaced car rendering with deformed frame polygon paths, contour player halo, crumple scars, exposed crush shading, and car fragment rendering.
- First typecheck exposed expected fixture and collision-contract updates; adjusted condition typing and test helpers.
- Added deformation, fragment, condition, upgrade, and render coverage for the new destructibility model.
- Updated legacy damage/render expectations to match disabled visual deformation and existing HUD rectangle usage.
- `npm run test:unit` passes with the new deformation and fragment tests.
- First `npm run validate` reached coverage but failed calibrated thresholds for new roster and physics branches; added targeted coverage tests.
- `npm run validate` passes after targeted roster/physics coverage additions.
- Visual preview inspection showed the new body deformation, then tightened old circular lights into smaller top-view lenses.
- Live browser smoke verified start flow, deterministic stepping, `render_game_to_text`, frame damage summaries, and capped car fragments in a gameplay screenshot.
- Final `npm run validate` passes after artifact cleanup and render refinements.
- Reduced car-fragment spawn counts and changed fragment spawning to use per-car damage taken rather than global collision severity alone.
- Cut car-fragment emission roughly in half again by raising local damage/deformation thresholds and lowered per-hit counts; constrained frame deformation so vertices cannot expand beyond their original hull positions.
