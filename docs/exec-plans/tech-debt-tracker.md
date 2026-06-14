# Tech Debt Tracker

## Highest Priority

| Priority | Area | Debt | Next Concrete Step |
| --- | --- | --- | --- |
| P1 | Session setup | `src/game/session.ts` still mixes progression logic with car/roster factory details. | Extract roster/build helpers into a dedicated module before replay/meta work expands state setup. |
| P2 | Artifact hygiene | `output/` contains useful captures but no documented retention policy. | Decide which artifacts are long-lived references and which are disposable validation residue. |
| P2 | Design decision memory | Larger architectural tradeoffs still live mostly in roadmap/progress narrative. | Add a lightweight decision log once there is a second durable tradeoff to preserve. |

## Rule
If a debt item repeatedly affects agent autonomy or causes the same review comment twice, either move it up in priority or encode it mechanically.
