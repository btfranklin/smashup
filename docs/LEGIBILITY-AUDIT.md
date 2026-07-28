# Legibility Audit

## Current Strengths
- The public front door is now versioned in-repo through `README.md`, `LICENSE`, and package license metadata.
- The core gameplay runtime now has named seams: session setup, roster construction, upgrade servicing, round stats, event feed helpers, per-frame runtime, debug serialization, and preview parsing.
- Arena geometry, browser-loop scheduling, menu lifecycle, performance
  collection, and rendering sub-surfaces now have dedicated boundaries instead
  of accumulating in session, bootstrap, or one drawing module.
- Career Night schedule generation, placement/scoring, and Wreck Award selection have focused modules instead of adding more policy to session or rendering code.
- Browser automation surfaces, native Canvas/Web Audio integration, strict TypeScript, production build, and enumerated per-source coverage gates are mechanically exercised through `npm run validate`.
- The production-path five-round lifecycle has a focused integration test, while
  a separate production-build performance smoke retains measurements and
  failure artifacts without making ordinary validation hardware-sensitive.
- Technical follow-on work is kept in `docs/exec-plans/tech-debt-tracker.md`; current runtime boundaries and invariants live in architecture and quality docs.
- CI now runs the same validation path on pushes and pull requests.
- Gameplay tuning intent has a dedicated reference note for physics, damage, AI, thermal, and spectacle behavior.

## Highest-Leverage Gaps Closed
- Added a short `AGENTS.md` that routes agents to deeper sources instead of making them rediscover the repo from source files.
- Added an indexed `docs/` area so architecture, operations, quality expectations, and validation surfaces are versioned inside the repo.
- Added `check:repo` so the repo map, public README/license metadata, docs, validation scripts, ignored artifact hygiene, and required positive module surfaces do not drift silently.
- Documented `output/` as ignored, disposable local inspection residue instead of ambiguous project state.
- Extracted roster/build helpers, upgrade servicing, event pushing, and round-stat lifecycle out of broader runtime/session files.
- Added strict typechecking to the documented validation path.
- Added a focused real-Chromium suite for application boot/input, native Canvas painting, resize/fullscreen/RAF, Web Audio activation/resume, and controller cleanup/recreation.
- Added a literal-points lifecycle test spanning five production round
  completions and a separate, documented single-worker Chromium performance
  smoke.
- Replaced placeholder pre-career plans and cached car phases with explicit
  state invariants, and encoded rotated-wall, embedded-object, causal-impact,
  post-destroy menu, and alternate-arena regressions mechanically.

## Remaining Gaps
- The repository has no chronological decision record; current durable choices still fit cleanly in the architecture, quality, and tuning docs.
- Pixel-perfect visual baselines remain intentionally deferred; the browser suite checks native painting and retains screenshots/traces on failure without committing brittle golden images.
- Native Safari's audio-stall acceptance remains human-observed because
  UI-driven Inspector recording perturbs the session and is not a reliable
  profiling surface.

## Next Investments
1. Add a lightweight decision log only if multiple durable tradeoffs need historical context beyond the existing architecture, quality, and tuning docs.
2. Add selective screenshot baselines only if repeated visual regressions show that native painting checks and failure artifacts are insufficient.

## What Still Lives Outside The Repo
- Human taste around “fun” balancing still mostly lives in user feedback and validation notes rather than dedicated design docs.
