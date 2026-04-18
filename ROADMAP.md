# Smashup Derby Roadmap

This roadmap is ordered by expected fun-per-effort. The goal is not to add complexity for its own sake. Each item should make the game feel more readable, more dramatic, more varied, or more replayable.

## 1. Impact Feel Pass

### Goal
Make every meaningful hit feel satisfying and memorable.

### Why this increases fun
The core fantasy of a demolition derby game is violent contact. If collisions feel big, crunchy, and legible, the whole game becomes more exciting even before adding new content. This is the highest-leverage improvement because it strengthens the main action the player repeats constantly.

### What to add
- Stronger screen shake for severe collisions, scaled by impact severity and reduced for lighter taps.
- Short directional camera nudge or hit-freeze on major impacts so the player feels the force transfer.
- Sharper crash audio layering: body slam, metal crunch, skid/scrub, and a deeper “engine got hurt” tone for direct nose hits.
- Tire scrub and dust/smear effects during hard steering or sliding.
- More visible car deformation cues at the impact zone, especially on the front corners and rear bumper.

### How it might work
- Use `recentCollisions` to drive a short-lived camera impulse system in render.
- Add a small hit-stop duration only above a high severity threshold so the game stays responsive.
- Split audio triggers by collision type: glancing scrape, heavy body hit, direct front hit.
- Render transient impact decals or bent-panel overlays aligned to the struck zone.

## 2. Damage Readability and Failure States

### Goal
Make it obvious when a car is healthy, wounded, failing, or about to die.

### Why this increases fun
Players enjoy making decisions off readable danger. If they can instantly tell “that car is almost finished” or “my steering is getting wrecked,” the derby becomes more tactical and dramatic. Clear failure states also make victories feel earned instead of random.

### What to add
- More distinct subsystem symptoms:
- steering damage causes visible wandering, slower wheel response, or a slight pull under load
- transmission damage causes slipping, delayed acceleration, and weaker reverse launches
- radiator damage creates steam first, then darker smoke, then flames near death
- engine damage changes engine sound character and top speed more noticeably
- Better HUD signals:
- subsystem warning colors that intensify at meaningful thresholds
- brief text callouts for major damage events like “steering bent” or “radiator hit”
- More visible chassis state:
- one-sided crumple, broken trim, hanging bumper look, dimmed shell for near-dead cars

### How it might work
- Define three or four named thresholds per subsystem and drive both visuals and handling from the same thresholds.
- Use the existing smoke system as one part of the damage language, but coordinate it with HUD color shifts and sound changes so everything tells the same story.
- Add lightweight per-car event messages for the player only, triggered when a subsystem crosses a threshold for the first time.

## 3. AI Personality Variety

### Goal
Make each round feel less predictable by giving cars different behavioral styles.

### Why this increases fun
The current AI is coherent, but once the player understands it, matches can start to feel samey. Personality differences create rivalries, surprising situations, and stories: one car keeps hunting your weak side, one lurks and opportunistically finishes off smoking cars, one keeps shoving hulks around.

### What to add
- Distinct AI archetypes:
- `Bruiser`: commits hard to reverse attacks, tolerates crowding, chases wounded cars
- `Circler`: stays mobile, avoids dense clusters, looks for side hits
- `Scavenger`: prioritizes smoking or disabled-adjacent targets
- `Panic Driver`: gets sloppy and overly evasive once badly damaged
- `Wedge Bully`: uses hulks and walls strategically to pin rivals
- A small amount of per-match variation so the same archetype is not perfectly identical every time.

### How it might work
- Add personality parameters to target weighting, separation tolerance, wall escape bias, and jam recovery.
- Keep the same underlying AI structure, but vary the weights instead of creating totally separate AI codepaths.
- Show personality through car names and maybe intro/result flavor text.

## 4. Match Structure and Progression

### Goal
Give the player a reason to play “one more round.”

### Why this increases fun
A good core loop becomes much more compelling when rounds connect to each other. Progression adds anticipation, stakes, and variety. The important rule is that progression should create new situations, not turn the game into grind.

### What to add
- A short tournament format: survive several derby rounds with only partial repair between them.
- Lightweight car selection with different handling identities:
- stable heavy car
- agile but fragile car
- strong reverse-ram specialist
- balanced all-rounder
- Arena variants:
- tighter bowl
- wide oval
- cluttered yard with movable junk
- muddy arena with more sliding
- Simple match modifiers:
- “hot engines” means faster overheating
- “lights out” means everyone starts partially damaged
- “sudden wreck” means more hulks earlier

### How it might work
- Keep each match short and readable.
- Use between-round choice screens that offer one fun decision at a time: repair engine, improve reverse torque, reinforce steering, or gamble on a risky modifier.
- Avoid permanent complexity creep. A small number of strong choices is better than a lot of weak upgrade clutter.

## 5. Player Expression Through Car Identity

### Goal
Let the player develop a preferred style and feel ownership over how they play.

### Why this increases fun
Fun increases when players can say “this is my car” or “this is my strategy.” Identity makes success feel personal. It also encourages experimentation because different setups support different derby fantasies.

### What to add
- Selectable starter cars with clear tradeoffs.
- Cosmetic identity:
- paint patterns
- number decals
- simple roof signage or derby nicknames
- Mechanical identity tied to playstyle:
- stronger reverse acceleration
- tougher front clip
- better steering recovery
- higher top speed but weaker body

### How it might work
- Start with a small roster of 3 to 5 meaningful presets instead of a full garage builder.
- Keep the stats easy to understand. Each choice should clearly change how the round feels.
- Make cosmetic identity visible in replays, menus, and end-of-round results.

## 6. Arena Hazards and Interactive Obstacles

### Goal
Create more surprising and playful match situations without overwhelming the core driving.

### Why this increases fun
Good hazards generate “did you see that?” moments. They also prevent every match from collapsing into the same center-cluster behavior. The best hazards add opportunities and chaos, not annoyance.

### What to add
- Movable junk piles or tires that can be shoved into traffic.
- Slick mud patches that affect grip and make reverse attack lines riskier.
- Weak fence sections or destructible arena props for dramatic impacts.
- Optional hazard arenas with one headline gimmick, not many at once.

### How it might work
- Treat obstacles as simple physical actors or terrain modifiers.
- Keep hazard count low and readable.
- Design each arena around one memorable behavior change so it feels intentional rather than noisy.

## 7. Better Round Presentation

### Goal
Make rounds feel like events, not just simulations.

### Why this increases fun
Presentation creates emotional payoff. Start countdowns, rivalry moments, big win/loss framing, and results screens make the action feel like a proper sport spectacle instead of a raw prototype.

### What to add
- Stronger start-of-match presentation with lineup reveal or quick countdown.
- Short result screen with standout stats:
- who you eliminated
- biggest hit
- how long you survived
- what killed you
- Simple announcer-style text splashes for dramatic moments:
- “front clip wrecked”
- “down to the last two”
- “engine gone”

### How it might work
- Reuse existing game state events instead of inventing a big narrative system.
- Add lightweight result summaries derived from collisions, eliminations, and subsystem damage history.
- Keep text sparse and punchy so it supports the action instead of cluttering it.

## 8. Replay and Highlight Moments

### Goal
Turn great wrecks into a reward in themselves.

### Why this increases fun
A demolition game produces natural highlight moments. Replays let the player re-experience a brutal knockout, laugh at a huge pileup, or understand how they died. This turns the physics into entertainment beyond pure competition.

### What to add
- Very short instant replay for major eliminations or especially heavy collisions.
- End-of-round highlight clip for biggest impact or final knockout.
- Optional slow-motion finish when only two cars remain or when the player lands a huge hit.

### How it might work
- Keep a short rolling history of recent state snapshots.
- Trigger replay only for major events so it stays special.
- Make replay skippable and brief.

## 9. Tournament Meta That Stays Light

### Goal
Add long-term motivation without turning the game into bookkeeping.

### Why this increases fun
Players enjoy working toward something, but too much management can dilute the derby fantasy. A light meta layer can make wins and losses matter more while keeping the action front and center.

### What to add
- Unlockable cars, arenas, and rule variants.
- Small post-match rewards tied to style:
- survive longest
- score a brutal knockout
- win while heavily damaged
- Optional “career nights” with a few linked events and increasing pressure.

### How it might work
- Favor unlocks and milestones over currencies and shops.
- Reward bold or stylish play, not just passive survival.
- Keep menus quick so the player gets back into a derby fast.

## Suggested Implementation Order

1. Impact feel pass
2. Damage readability and failure states
3. AI personality variety
4. Match structure and progression
5. Player expression through car identity
6. Arena hazards and interactive obstacles
7. Better round presentation
8. Replay and highlight moments
9. Tournament meta that stays light
