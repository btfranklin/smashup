# Smashup Derby Docs

`docs/` is the repo-local system of record for non-trivial repository knowledge. Start here when you need to understand where logic lives, how to run the game, or what invariants must stay enforced.

## Core Docs

- [Public README](../README.md): user-facing overview, controls, setup, and validation summary
- [Architecture](./ARCHITECTURE.md): complete code-ownership map, boundaries, and change guidance
- [Operations](./OPERATIONS.md): setup, local runtime, validation commands, and artifact locations
- [Quality](./QUALITY.md): architectural guardrails, validation coverage, and recovery guidance
- [Validation Surfaces](./references/validation-surfaces.md): preview endpoint and browser automation hooks
- [Gameplay Tuning](./references/gameplay-tuning.md): intent behind physics, damage, AI, thermal, and spectacle rules
- [Performance Validation](./references/performance-validation.md): deterministic production-build budgets, current measurements, Safari acceptance, and artifact policy
- [Legibility Audit](./LEGIBILITY-AUDIT.md): current strengths, remaining gaps, and next leverage points
- [License](../LICENSE): MIT license terms

## Maintenance

- [Tech Debt Tracker](./exec-plans/tech-debt-tracker.md): prioritized follow-on cleanup and legibility work

## Maintenance Rule

When repo navigation, commands, or validation surfaces change, update this index and the linked deep docs in the same change.
