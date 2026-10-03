# Performance Validation

Performance validation is a separate, hardware-sensitive check. It is not part
of `npm run validate`; run it explicitly when simulation, rendering, audio,
menu presentation, or browser-controller work could affect responsiveness.

`src/app/performance.ts` provides the bounded, opt-in diagnostic collector. It
records frame interval and callback duration; simulation, audio, render, menu,
and spectator-skip phases; fixed-step and dropped-wall-time counts; gameplay
mode; collisions and hit-stop state; effect, scar, and audio-voice counts; and
heap or timeline evidence where the browser exposes it. Sample and timeline
rings have hard capacity limits. Pure summary helpers report per-phase
percentiles, peak rendering load, and zero-step presentation counts without
adding browser work. The collector is injected by tests or development callers
and is never exposed through a production browser hook.

## Command

```bash
npm run test:performance
```

The command creates an ignored production-mode bundle in
`output/performance-build/` and runs only
`tests/browser/performance.spec.ts` in Chromium. Its Playwright configuration
uses one worker, no retries, a fresh preview server, no trace or video capture,
and screenshots only on failure. The normal production build does not ship the
test controller fixture.

## Deterministic Workloads and Gates

| Workload | Enforced gate |
| --- | --- |
| Clean seeded eight-car round, repeated heavy collisions, and a representative late damaged round with persistent fragments and scars | Combined fixed-step p95 below 12 ms, p99 below 16.7 ms, no post-warmup application long task at or above 50 ms |
| Idle audio preparation followed by a real menu gesture | A prepared-audio sample with at least three voices exists before the gesture; next-menu paint, resolved on the second animation frame after the interaction, stays below 50 ms; audio-off run creates none |
| Spectator skip | Batches below 12 ms unless one indivisible step exceeds it, UI heartbeat remains active, no more than 5,400 fixed steps, completion within 5 seconds |
| Damaged round under Chromium 4x CPU throttling | Fixed-step p95 below 25 ms and no post-warmup application long task at or above 50 ms |

Unit coverage separately verifies collector bounds, phase summaries,
presentation invalidation, the exact 5,400-step/90-second spectator cap, and a
maximum-density fake-canvas render containing the production caps for smoke,
dust, debris, fragments, and scars. These structural checks assert cache reuse
and command budgets without introducing wall-clock noise or a browser launch.
The browser workload may end naturally before the spectator cap.

Scene measurements have a start and end time. The long-task gate checks every
task that overlaps this interval, including a task that starts before the
start marker but continues into the first measured batch. A collector snapshot
drains queued observer entries before it copies the timeline rings. A separate
Chromium probe adds a stall to the first and final measured tasks and checks
that both are detected. Its warmup stall stays outside the measured interval.

## Reference Profile: 2026-07-26

Reference machine: MacBook Pro `Mac15,7`, Apple M3 Pro, 18 GB RAM, macOS
26.5.2 (`25F84`). Browsers: Safari 26.5.2 and Chrome 150.0.7871.182.

| Measurement | Result |
| --- | ---: |
| Desktop scenes, combined p95 / p99 | 0.8 ms / 1.5 ms |
| Clean scene p95 / p99 / max | 0.5 ms / 1.6 ms / 14.1 ms |
| Collision scene p95 / p99 / max | 0.4 ms / 1.0 ms / 1.3 ms |
| Damaged scene p95 / p99 / max | 0.9 ms / 2.1 ms / 3.1 ms |
| Chromium 4x p95 / p99 / max | 6.0 ms / 8.6 ms / 9.2 ms |
| Spectator skip wall time / batches / heartbeat | 571 ms / 59 / 66 |
| Spectator skip p95 / max | 3.6 ms / 5.7 ms |
| Cold idle audio prepare / gesture-to-paint | 199.8 ms / 34.9 ms |
| Warm idle audio prepare / gesture-to-paint | 80.0 ms / 4.3 ms |

No post-warmup 50 ms application long task appeared in the final scripted
Chrome scenes.

## Findings and Remediation

- Cold Web Audio graph construction was a real 150-243 ms main-thread task in
  preliminary Chromium runs. Audio now separates idle-time `prepare()` from
  gesture-time `resume()`, with a safe gesture fallback. The cold task remains
  measurable during idle preparation but is no longer on the Career Night
  interaction path, and audio activation completes before “Go.”
- The menu interaction gate requires both a real idle-preparation sample and
  two animation frames after the gesture. The measured endpoint therefore
  represents a paint opportunity for the new menu rather than completion of
  the first pre-paint callback.
- The initial 4x damaged-scene trace showed repeated 50-67 ms long tasks.
  Static arena paint was the correlated render cost. Caching that layer by
  canvas dimensions and active arena plan reduced the same targeted scene from
  p95 5.7 ms, p99 8.9 ms, and max 25.8 ms to p95 5.1 ms, p99 7.3 ms, and max
  13.3 ms, with no long tasks. The final full 4x run is recorded above.
- Spectator skip now performs sequential fixed steps until 60 steps or a 2 ms
  target budget is reached, then yields through `requestAnimationFrame`. It
  retains one render/audio update per batch and the exact simulation cap.
- The normal RAF remains live for scheduling and lifecycle behavior, but a
  zero-step frame no longer redraws unless browser or session work explicitly
  invalidated presentation. Completed fixed-step batches still present once.
- Car drawing reuses one body/roof/hood path per car presentation, disabled
  cars skip discarded gradients, immutable fragment polygons use weak path
  caches, and smoke uses bounded normalized shell/flame sprite caches. The
  maximum-density Vitest workload protects these construction budgets without
  changing effect simulation or adding a second browser benchmark.
- Crash-voice pooling, fragment settling/spatial bounds, and AI/particle
  allocation rewrites remain intentionally unapplied because they would cross
  into unrelated or gameplay-sensitive work.

The existing one-tick heavy-impact hit-stop is unchanged.

## Native Safari Acceptance

The reported symptom is an audible sub-250 ms browser/audio stall, not
intentional hit-stop. It did not recur in the deterministic Chrome runs.

An automated native-Safari Web Inspector recording was rejected because the
UI-driving capture loop interfered with the inspection session and produced no
reliable trace. A system trace was also unavailable with only Xcode Command
Line Tools installed. Do not treat Playwright WebKit as a Safari substitute,
and do not repeat UI-driven Inspector recording as an acceptance method.

The remaining native-Safari gate is therefore a human-observed run:

1. Play one complete Career Night with audio enabled, including heavy
   collisions, late-round damage, spectating/skip, and transitions.
2. Continue a representative stress round until the total session reaches ten
   minutes.
3. Repeat a short heavy-collision scene with audio muted.
4. Record whether any audible buffer repetition occurs and whether the same
   moment has a visible application stall.

Until that listening run passes, the Safari-specific audible symptom should be
reported as unverified rather than claimed fixed.

## Artifacts

- `output/performance-samples/*.json`: latest bounded metrics
- `output/playwright/performance-report/`: disposable HTML report
- `output/playwright/performance-results/`: disposable result attachments
- `output/performance-build/`: disposable production-mode fixture bundle

All are ignored. Preserve JSON only when a regression needs comparison or
handoff evidence; remove screenshots, videos, traces, reports, and fixture
builds after inspection when a clean artifact state is required.

Scene JSON includes whole-step timing plus post-warmup per-phase summaries and
peak effect/scar context. Render-phase values measure JavaScript and Canvas
command submission; they do not claim native raster, composite, or display
presentation time.

## Interpreting and Recalibrating

First rerun a failure on an otherwise idle machine. If it repeats, inspect the
scene JSON and collector context before changing code or a budget. Change a
threshold only for an intentional workload change or an explicitly adopted
hardware baseline, and record the reason plus before/after evidence here. Never
loosen a threshold merely to make one noisy run pass.
