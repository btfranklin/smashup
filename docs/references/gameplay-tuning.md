# Gameplay Tuning

This document captures the current intent behind the hand-tuned gameplay rules. Keep it short and update it when balancing changes alter what the game is trying to feel like.

## Physics
- Cars should feel heavy enough to commit to a line, but responsive enough that reverse attacks are intentional rather than random.
- Walls should trap and punish bad angles without creating permanent stuck states.
- Wall containment uses each rotated car's projected extents so every angle
  meets the same visible boundary.
- Mud should reduce grip and make steering messier, not turn the round into a different control scheme.
- Junkyard objects should add readable chaos while staying secondary to car-on-car collisions.
- An object embedded inside a car resolves toward the nearest local face, with
  a deterministic exact-center tie, so tunneling cannot silently skip contact.

## Damage
- Front impacts are the most dangerous to the striker because engine, radiator, transmission, and steering damage live there.
- Rear and side impacts should still matter, but the game should reward reverse attacks into exposed fronts and sides.
- Frame deformation should preserve asymmetric dents and accumulated crush without letting any structural axis or mirrored body rail collapse far enough to turn the car into a wedge or teardrop.
- Disabled cars stay in the arena as hulks; they should keep affecting space without continuing to fight.
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
- Light breakage is part of visible damage readability, especially in the `lights_out` round.

## AI
- AI drivers are simple flock-like attackers, not perfect racers.
- They prefer reversing into exposed or wounded targets, separate from local crowding, and recover from wall pressure.
- Archetypes should bias target choice and recovery behavior without making any driver feel like it belongs to a different ruleset.

## Thermal
- Normal rounds should let healthy cars cool meaningfully when off throttle.
- `hot_engines` should keep heat elevated and make damaged radiators dangerous under sustained throttle.
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
- Car panel lines should describe believable sheet-metal joins rather than cross the cabin, while each preset keeps one simple visual signature that remains legible under damage.
