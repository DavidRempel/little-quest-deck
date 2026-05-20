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
- `public/index.html` contains HTML, CSS, and JavaScript.
- `wrangler.jsonc` configures Cloudflare static assets deployment.
- No package manager, build step, or test runner is currently required.

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
Cloudflare appears to auto-deploy from pushes to `main`.

Do not assume manual `wrangler deploy` is required unless auto-deploy fails or Dave asks for it.

## Coding Guidance
- Do not add frameworks unless the task needs them.
- If refactoring, first split game state/rules from rendering before changing behavior.
- Keep card/rule constants easy to inspect and tune.
- Avoid decorative complexity. This is a playtest prototype first.
- When changing gameplay, update the visible rules text if behavior changes.
- When changing UI, verify desktop and mobile layout.

## Good First Codex Tasks
1. Split `public/index.html` into:
   - `public/index.html`
   - `public/styles.css`
   - `public/game.js`
2. Extract pure-ish rule helpers for combos/scoring into a separate module or clearly marked section.
3. Add a simple manual playtest checklist.
4. Add seeded/random debug mode so balance changes can be tested repeatably.
5. Add deck-editing reward choices, since the current rules mention that they are not implemented yet.

