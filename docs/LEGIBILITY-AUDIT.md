# Legibility Audit

## Current Strengths
- The public front door is now versioned in-repo through `README.md`, `LICENSE`, and package license metadata.
- The core gameplay runtime now has named seams: session setup, roster construction, upgrade servicing, round stats, event feed helpers, per-frame runtime, debug serialization, and preview parsing.
- Browser automation surfaces, native Canvas/Web Audio integration, strict TypeScript, production build, and coverage gates are mechanically exercised through `npm run validate`.
- Product-facing deferred work lives in `ROADMAP.md`; technical future work lives in `docs/exec-plans/tech-debt-tracker.md`.
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

## Remaining Gaps
- Broader design decisions still live mostly in roadmap and tech-debt notes rather than a dedicated decision log.
- Pixel-perfect visual baselines remain intentionally deferred; the browser suite checks native painting and retains screenshots/traces on failure without committing brittle golden images.

## Next Investments
1. Add a lightweight decision log when architectural tradeoffs outgrow the roadmap and tech-debt tracker.
2. Add selective screenshot baselines only if repeated visual regressions show that native painting checks and failure artifacts are insufficient.

## What Still Lives Outside The Repo
- Human taste around “fun” balancing still mostly lives in user feedback and validation notes rather than dedicated design docs.
- There is no in-repo decision log yet for larger architectural tradeoffs beyond the roadmap and tech-debt tracker.
