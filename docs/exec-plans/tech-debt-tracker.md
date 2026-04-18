# Tech Debt Tracker

## Highest Priority

| Priority | Area | Debt | Next Concrete Step |
| --- | --- | --- | --- |
| P1 | CI / enforcement | `npm run validate` is local-only today. | Add a CI workflow that runs `npm run validate` on pushes and pull requests. |
| P1 | Session setup | `src/game/session.ts` still mixes progression logic with car/roster factory details. | Extract roster/build helpers into a dedicated module before replay/meta work expands state setup. |
| P2 | Gameplay design memory | Physics/damage/thermal tuning rationale is mostly in `progress.md` and code. | Add a design note under `docs/` that explains intended tuning goals and known invariants. |
| P2 | Artifact hygiene | `output/` contains useful captures but no documented retention policy. | Decide which artifacts are long-lived references and which are disposable validation residue. |

## Rule
If a debt item repeatedly affects agent autonomy or causes the same review comment twice, either move it up in priority or encode it mechanically.
