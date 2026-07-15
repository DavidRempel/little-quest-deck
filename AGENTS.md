# AGENTS.md - Little Quest Deck

## Project
Little Quest Deck is a tiny browser card-battler prototype for fast family playtesting.

The current app is a static Cloudflare Workers assets site. The playable build lives in `public/index.html`.

## Priorities
1. Keep the game playable after every change.
2. Preserve the current rules unless the task explicitly changes balance or mechanics.
3. Prefer small, reviewable changes over large rewrites.
4. Make mobile/touch play work well.
5. Keep the runtime deterministic and client-side unless a specific AI/game-service feature is requested.

## Current Architecture
- `public/rules.js` contains tuning constants and pure combo/scoring rules.
- `public/game-state.js` owns seeded randomness, game state, combat, rewards, and progression without DOM access.
- `public/game.js` owns browser events, modals, and rendering.
- `public/index.html` and `public/styles.css` contain the page structure and presentation.
- `public/scoring-tests.html` runs browser-based rules and state-transition regression tests.
- `wrangler.jsonc` configures Cloudflare static assets deployment.
- No package manager or build step is required.

## Local Preview
Run:

```bash
cd public
python3 -m http.server 8765
```

Then open:

```text
http://localhost:8765
```

## Deployment
Follow the workspace standing rule for hobby-site deployment. A requested change normally includes commit, push, deploy, and live verification. Cloudflare's GitHub auto-deploy has been unreliable for this repo, so verify the live build label and use Wrangler when needed.

## Coding Guidance
- Do not add frameworks unless the task needs them.
- Preserve the rules/state/rendering boundaries; do not move DOM access into `rules.js` or `game-state.js`.
- Keep card/rule constants easy to inspect and tune.
- Avoid decorative complexity. This is a playtest prototype first.
- When changing gameplay, update the visible rules text if behavior changes.
- When changing UI, verify desktop and mobile layout.

## Good Next Tasks
1. Add deck-editing reward choices, since the current rules mention that they are not implemented yet.
2. Add tests alongside any new rule or state transition.
3. Tune enemy curves only after another family playtest.
