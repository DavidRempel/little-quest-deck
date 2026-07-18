# Balance evaluator spike

## Questions

1. Can the balance evaluator execute the production scoring and game-state code directly rather than manually mirroring it?
2. How different are random-valid, maximum-immediate-score, heuristic, and one-step-lookahead policies?
3. Do Crown Cracks or boss deck editing improve progression without erasing the value of better decisions?

## Run

From the repository root:

```bash
node spikes/001-balance-evaluator/simulate.js
```

Useful focused runs:

```bash
node spikes/001-balance-evaluator/simulate.js --runs 1000 --variants baseline,crown-2 --policies max-score,heuristic
node spikes/001-balance-evaluator/simulate.js --runs 100 --json
```

The evaluator imports `public/rules.js` and `public/game-state.js` directly. It uses separate deterministic randomness for policy decisions so the game seed is not consumed by the bot.

## Policies

- `random-valid`: chooses a random valid attack, sometimes using the free Regroup.
- `max-score`: always plays the legal subset with the highest immediate damage.
- `heuristic`: prioritizes lethal Clean Victories, efficient damage, and a free Regroup when the current hand is weak.
- `lookahead`: compares a bounded set of attacks and discards using immediate damage, survival, and sampled next-hand potential.

## Variants

- `baseline`: current production mechanics.
- `crown-1`: each Clean Victory removes 1 HP from the final boss, capped at 8.
- `crown-2`: each Clean Victory removes 2 HP from the final boss, capped at 12.
- `boss-edit`: after bosses 5, 10, and 15, apply the deck edit with the largest proxy improvement: remove one non-hand card, recolour one card, or shift one rank by ±1.
- `boss-remove`, `boss-recolor`, and `boss-shift`: isolate each edit family to expose dominant or weak choices.

The deck editor is intentionally an optimistic automated player. Its result is an upper-bound signal, not a final UI or reward design.

## Status

Production build evaluated: `v4.26-structure-refactor`.

### Main comparison

The first three policies used 1,000 matched seeds per row. Lookahead used 200 matched seeds per row because it samples future hands and is materially more expensive.

| Variant | Random-valid | Max score | Heuristic | Lookahead |
|---|---:|---:|---:|---:|
| Baseline | 2.9% | 12.5% | 19.5% | 27.0% |
| Crown Cracks, 2 HP / Clean Victory, cap 12 | 4.2% | 14.0% | 24.2% | 37.0% |
| Best boss deck edit | 4.5% | 14.2% | 26.5% | 42.0% |

Baseline final-boss reach rates were 25.9% random-valid, 42.2% max-score, 51.7% heuristic, and 63.0% lookahead. Crown Cracks left those rates exactly unchanged on matched seeds and only altered the final encounter. Under heuristic play it reduced average final-boss starting HP from 72 to 61.8 and final-boss deaths from 32.2% of all runs to 27.5%.

Boss editing improved heuristic final-boss reach from 51.7% to 58.3%. The proxy optimizer selected rank shift for every edit, so the edit families were also isolated:

| Boss edit | Max-score win rate | Heuristic win rate |
|---|---:|---:|
| Remove one card | 14.1% | 24.2% |
| Recolour one card | 14.4% | 23.9% |
| Shift one rank ±1 | 14.2% | 26.5% |

The edit families are in the same broad power range, although rank shifting is strongest for the heuristic bot. The optimizer's one-choice behaviour is partly a limitation of its deck-quality proxy and should not be treated as proof that human players would always choose rank shift.

### Stress finding

The first lookahead implementation allowed repeated post-Regroup discards. Some seeds produced long discard loops and eventually exhausted Node's heap. The policy now considers discard only for the first free Regroup (or when no attack exists), matching sensible play. A regression assertion covers that edge case, and the 200-seed lookahead run completes normally.

## Verdict: VALIDATED — production-linked evaluator

Question: Can balance runs use the actual game rules and state transitions while comparing distinct player policies?

Evidence: the CLI imports `public/rules.js` and `public/game-state.js`, reports the imported build version, passes its self-tests, and completed the matched-seed runs above.

Recommendation: keep this as the balance harness. Use max-score as the immediate-score baseline, heuristic as the main tuning policy, random-valid as a floor, and bounded lookahead as a smaller-sample skill ceiling.

## Verdict: PARTIAL — Crown Cracks

The mechanic is targeted and skill-linked. It improves final-boss conversion without changing the path to the boss, but the 2-HP version gives the lookahead bot a large 10-point absolute lift. Recommend a live playtest of 2 HP per Clean Victory capped at 12, with 1 HP capped at 8 as the fallback if it feels too generous.

## Verdict: PARTIAL — boss deck editing

All three edit families improve outcomes without making random play strong. The mechanic is promising, but the automated proxy always picks rank shift and does not model whether the choice is understandable or fun. Recommend designing the actual boss reward choice and playtesting it before changing production balance around these simulated win rates.
