# Tech Debt Tracker

## Highest Priority

| Priority | Area | Debt | Next Concrete Step |
| --- | --- | --- | --- |
| P3 | Decision history | Current architectural choices fit the architecture, quality, and tuning docs, but there is no chronological record for competing alternatives. | Add a lightweight decision log only when multiple durable tradeoffs need historical context. |

## Rule
If a debt item repeatedly affects agent autonomy or causes the same review comment twice, either move it up in priority or encode it mechanically.
