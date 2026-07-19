# Little Quest Deck Roadmap

## Near-Term Goal
Use the cleaner no-build structure to keep family playtesting fast while adding mechanics safely.

## Completed Foundation
- Split HTML, CSS, browser rendering, pure rules, and game state into separate files.
- Added seeded runs for repeatable playtests.
- Added browser regression tests for scoring and core combat transitions.
- Added Crown Cracks: each pre-final Clean Victory removes 2 final-boss HP, capped at 12.
- Added Basic Hits, Weakness Finish Swap banking, Big Overkill rewards, stacked finisher feedback, persistent shops, and escalating paid rerolls.
- Added visual equipment cards, explicit upgrade/trade-off comparisons, prominent gold, and a dedicated Bigger Backpack Hand +1 card.

## Next - Improve The Game Loop
- Add deck-editing rewards: add card, remove card, upgrade card, or skip for gold.
- Use `spikes/001-balance-evaluator/` to compare balance changes against random-valid, max-score, heuristic, and bounded-lookahead policies on matched seeds.
- Improve reward pacing so normal fights, bosses, shops, and final boss feel distinct.
- Tune enemy HP/damage curves after a few family playtests.
- Add an optional simpler mode for younger players if needed.

## Later - Presentation Polish
- Continue improving touch targets and mobile layout from family playtest feedback.
- Add card suit/colour symbols so cards are easier to scan.
- Tune the stacked weakness/finisher animations after family playtesting.
- Add a compact start/new-run screen only if it improves actual play.

## Guardrails
- Do not add React/Vite/build tooling yet.
- Do not add OpenAI API calls to gameplay yet.
- Do not rewrite rules while refactoring structure.
- Follow the workspace standing rule for hobby-site deployment.
