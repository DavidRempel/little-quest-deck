# Little Quest Deck Playtest Checklist

Before deployment:

- Open `scoring-tests.html` and confirm every automated check passes.
- Start a fixed seed and confirm the opening hand and enemy repeat after Restart Same Seed.
- Play a non-lethal attack and confirm every played card is replaced, Temper rises, and retaliation occurs.
- Select a non-combo one-card and two-card attack and confirm they preview and deal 1 and 2 base damage.
- Spend a banked Regroup and confirm it swaps exactly one card, consumes one token, takes a half-strength hit, and does not raise Temper.
- Finish an enemy with its weakness and confirm the lethal animation stacks with the weakness animation and banks one Regroup token.
- Defeat an enemy with 4+ excess damage and confirm Big Overkill gives +1 gold and shows the 15% to 30% equipment chance.
- Defeat a normal enemy and confirm loot, refill, and the next encounter appear.
- Reach the final boss with Clean Victories and confirm Crown Cracks remove 2 HP each, capped at 12, with the reduction shown in the enemy panel and run log.
- Reach 0 HP and confirm the Run Over modal offers same-seed and new-seed restarts.
- In a boss shop, buy one offer and confirm the remaining stock does not change; reroll and confirm its price rises from 4 to 6 gold.
- Confirm Bigger Backpack has its own 🎒 card and explicitly changes Hand by +1.
- Check the game at a narrow mobile viewport and confirm cards and combat controls remain usable.
- Confirm the live build label matches the deployed release.
