# Smashup Derby Deferred Roadmap

The main roadmap batch is implemented. What remains is the optional follow-on work that adds extra spectacle or longer-term retention without destabilizing the current core game.

## Engineering Prerequisites

Before replay/highlight or meta-progression work lands, keep these hardening steps in place:
- Preserve the shared preview contract from `src/game/content.ts` so the hidden validation surface stays aligned with live content ids.
- Keep `npm run validate` green so browser hooks and preview flows remain under executable regression coverage.
- Extend the separated session/runtime/debug modules instead of rebuilding a catch-all state file.

## 1. Replay and Highlight Moments

### Goal
Turn the best wrecks into a reward in themselves.

### Why this increases fun
The game now produces strong hits, eliminations, smoke, debris, and readable outcomes. Replays would let the player relive the best moments instead of just noticing them in real time and moving on.

### What to add
- Very short instant replay for major eliminations or extreme impacts.
- Optional slow-motion finish for the last-two-cars phase or a player knockout hit.
- End-of-round highlight callout for the biggest impact or final wreck.

### How it might work
- Keep a rolling in-memory ring buffer of recent car and effect snapshots.
- Trigger replay only for major events so it stays special.
- Make replay skippable and brief.

## 2. Tournament Meta That Stays Light

### Goal
Add long-term motivation without burying the derby under management.

### Why this increases fun
The current three-round tournament is fun within one browser session. A light meta layer would give players a reason to come back for multiple runs, but only if it stays fast and supports bold play instead of adding bookkeeping.

### What to add
- Unlockable cars, arenas, and rulesets.
- Small milestone rewards for stylish outcomes:
  - survive while nearly dead
  - land a brutal knockout
  - win with heavy front-end damage
- Optional short “career night” runs with escalating pressure.

### How it might work
- Favor unlocks and milestones over currencies and shops.
- Reward aggressive or stylish play, not passive stalling.
- Keep all between-match flow quick so the player gets back to crashing fast.
