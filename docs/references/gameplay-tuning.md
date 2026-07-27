# Gameplay Tuning

This document captures the current intent behind the hand-tuned gameplay rules. Keep it short and update it when balancing changes alter what the game is trying to feel like.

## Physics
- Cars should feel heavy enough to commit to a line, but responsive enough that reverse attacks are intentional rather than random.
- Walls should trap and punish bad angles without creating permanent stuck states.
- Mud should reduce grip and make steering messier, not turn the round into a different control scheme.
- Junkyard objects should add readable chaos while staying secondary to car-on-car collisions.

## Damage
- Front impacts are the most dangerous to the striker because engine, radiator, transmission, and steering damage live there.
- Rear and side impacts should still matter, but the game should reward reverse attacks into exposed fronts and sides.
- Frame deformation should preserve asymmetric dents and accumulated crush without letting any structural axis or mirrored body rail collapse far enough to turn the car into a wedge or teardrop.
- Disabled cars stay in the arena as hulks; they should keep affecting space without continuing to fight.
- Light breakage is part of visible damage readability, especially in the `lights_out` round.

## AI
- AI drivers are simple flock-like attackers, not perfect racers.
- They prefer reversing into exposed or wounded targets, separate from local crowding, and recover from wall pressure.
- Archetypes should bias target choice and recovery behavior without making any driver feel like it belongs to a different ruleset.

## Thermal
- Normal rounds should let healthy cars cool meaningfully when off throttle.
- `hot_engines` should keep heat elevated and make damaged radiators dangerous under sustained throttle.
- Overheating should create pressure over time rather than instantly decide a round.

## Spectacle
- Screen shake, freeze time, "Huge Hit!" callouts, debris, dust, smoke, and audio should emphasize major moments only.
- Biggest-hit summaries should track damaging impacts rather than harmless shoves.
- Smoke should escalate from light smoke to dark smoke and flame only near critical failure.
- Car panel lines should describe believable sheet-metal joins rather than cross the cabin, while each preset keeps one simple visual signature that remains legible under damage.
