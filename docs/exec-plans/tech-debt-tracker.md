# Tech Debt Tracker

## Highest Priority

| Priority | Area | Debt | Next Concrete Step |
| --- | --- | --- | --- |
| P2 | Design decision memory | Larger architectural tradeoffs still live mostly in roadmap and tech-debt notes. | Add a lightweight decision log once there is a second durable tradeoff to preserve. |
| P2 | Visual smoke workflow | UI polish depends on human inspection plus unit-level render coverage, with no committed browser screenshot smoke path. | Add an optional browser smoke command if future UI changes start producing review-only regressions. |

## Rule
If a debt item repeatedly affects agent autonomy or causes the same review comment twice, either move it up in priority or encode it mechanically.
