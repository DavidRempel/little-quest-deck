# Little Quest Deck

Tiny browser card-battler prototype for quick playtesting.

Hosted via Cloudflare Workers static assets.

Development notes:

- Repo instructions for Codex/agents: `AGENTS.md`
- Current staged roadmap: `ROADMAP.md`
- Playable app: `public/index.html`

Local preview:

```bash
cd public
python3 -m http.server 8765
```

Then open <http://localhost:8765>.

Rules and state-transition tests:

```bash
cd public
python3 -m http.server 8765
```

Then open <http://localhost:8765/scoring-tests.html>. The page tests scoring, partial-attack refill, Temper, Regroup, defeat state, and reward frequency. It prints pass/fail results and exposes `window.__LQD_TEST_RESULTS__` in the browser console.

Runtime structure:

- `public/rules.js` — pure scoring and tuning constants
- `public/game-state.js` — seeded state transitions and progression
- `public/game.js` — DOM events and rendering
