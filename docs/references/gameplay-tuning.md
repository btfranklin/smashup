# Gameplay Tuning

This document captures the current intent behind the hand-tuned gameplay rules. Keep it short and update it when balancing changes alter what the game is trying to feel like.

## Physics
- Cars should feel heavy enough to commit to a line, but responsive enough that reverse attacks are intentional rather than random.
- Car, wall, and loose-object contact should closely follow each current
  deformed frame. Physics may flatten shallow concave dents into a convex hull
  for stable, predictable contact rather than returning to a fixed rectangle.
- Walls should trap and punish bad angles without creating permanent stuck states.
- Wall containment uses each rotated live frame's projected extents so every
  angle and deformation state meets the same visible boundary.
- Mud should reduce grip and make steering messier, not turn the round into a different control scheme.
- Lower ground grip or steering health removes less lateral speed each step.
  The car therefore keeps more of its sideways motion.
- Junkyard objects should add readable chaos while staying secondary to car-on-car collisions.
- An object embedded inside a car resolves toward the nearest local face, with
  a deterministic exact-center tie, so tunneling cannot silently skip contact.

## Damage
- Front impacts are the most dangerous to the striker because engine, radiator, transmission, and steering damage live there.
- Rear and side impacts should still matter, but the game should reward reverse attacks into exposed fronts and sides.
- The wheel mounts and cabin support the body. Repeated impacts must keep the
  wheelbase and most of the body footprint. Front and rear panels can crush
  farther than the supported fenders. A local dent must not pull the other
  side of the car inward to match it.
- Hood and rear panels fold over the structure below them. Creases have light
  and dark faces, and heavy front damage exposes the engine. Wrecks keep some
  body color. New and existing creases stay on the current shell as it bends.
- At equal severity, an impulse into a body panel must cause more frame
  deformation than a glancing impulse. Live impacts and preview damage use
  the same inward direction rule.
- Disabled cars stay in the arena as hulks; they should keep affecting space without continuing to fight.
- Disabling a car removes engine force immediately. A hulk keeps its motion
  from earlier movement or impacts.
- An inert player hulk cannot earn new player-collision or knockout credit.
- Collision facts retain whether each participant was active at that exact
  impact, so a player wrecked early in a same-step pileup cannot earn credit
  from the hulk's later contacts.
- Collision facts also retain which participant was disabled by that exact
  impact. Pileup credit follows the disabling collision even when an earlier
  non-disabling collision was more severe.
- Before a later round, towing raises a wrecked player's engine to 46% and
  radiator, transmission, and steering to 32%, caps overheat at 70%, then
  applies ordinary service and the chosen pit upgrade. Body and frame damage
  still carry forward.
- `lights_out` starts every car with all headlights and taillights dark, making
  its orientation harder to read without adding body damage.

## AI
- AI drivers are simple flock-like attackers, not perfect racers.
- They prefer reversing into exposed or wounded targets, separate from local crowding, and recover from wall pressure.
- Reverse wall recovery must turn the rear of the car toward the arena.
  Steering must account for the direction of travel.
- Archetypes should bias target choice and recovery behavior without making any driver feel like it belongs to a different ruleset.

## Thermal
- Normal rounds should let healthy cars cool meaningfully when off throttle.
- `hot_engines` should keep heat elevated and make damaged radiators dangerous under sustained throttle.
- The Hot Engines starting heat is a minimum. A hotter serviced car keeps its
  carried heat.
- `redline` is the fifth-round climax: cars begin hot, generate heat faster, cool slowly, and enter with damaged rear lights.
- Overheating should create pressure over time rather than instantly decide a round.

## Spectacle
- Screen shake, freeze time, "Huge Hit!" callouts, debris, dust, smoke, and audio should emphasize major moments only.
- Biggest-hit summaries should track damaging impacts rather than harmless shoves.
- Wreck Awards should reward player impact, survival, and style from recorded round facts rather than encourage passive stalling.
- Survival time starts when the countdown enters active play and stops when the
  player is eliminated, even while the AI finish in spectating.
- Delayed knockout credit keeps the latest damaging active-player hit per
  opponent for four seconds, so simultaneous fights do not overwrite one
  another.
- A player wreck should leave a physical hulk and let the AI finish; skipping must advance the same simulation to a bounded result.
- Smoke should escalate from light smoke to dark smoke and flame only near critical failure.
- The smoke pool keeps at most 180 puffs after emission. Keep the newest puffs.
- The dust pool keeps at most 180 puffs after slip or collision emission.
  Keep the newest puffs.
- Car panel lines should describe believable sheet-metal joins rather than cross the cabin, while each preset keeps one simple visual signature that remains legible under damage.
- Every car's wheels and axles stay below every chassis in the global paint
  order; overlapping cars must never show a wheel on top of another body.
