# Little Quest Deck Roadmap

## Near-Term Goal
Turn the current one-file prototype into a cleaner Codex-friendly project without slowing playtesting.

## Phase 1 - Make The Code Easier To Work On
- Split HTML, CSS, and JavaScript into separate files.
- Keep behavior identical during the split.
- Add a manual smoke-test checklist.
- Add a short `CHANGELOG.md` entry pattern for gameplay changes.

## Phase 2 - Improve Testability
- Isolate scoring/combo logic from DOM rendering.
- Add a simple browser-console test harness or tiny no-build test page for:
  - match scoring
  - sequence scoring
  - flush scoring
  - stacked combo scoring
  - final boss curse scoring
- Add seeded RNG for repeatable playtest runs.

## Phase 3 - Improve The Game Loop
- Add deck-editing rewards: add card, remove card, upgrade card, or skip for gold.
- Improve reward pacing so normal fights, bosses, shops, and final boss feel distinct.
- Tune enemy HP/damage curves after a few family playtests.
- Add an optional simpler mode for younger players if needed.

## Phase 4 - Presentation Polish
- Improve touch targets and mobile layout.
- Add card suit/colour symbols so cards are easier to scan.
- Add clearer enemy state feedback after attacks.
- Add a compact start/new-run screen only if it improves actual play.

## Recommended First Codex Prompt
```text
In the Little Quest Deck repo, make a behavior-preserving refactor that splits public/index.html into public/index.html, public/styles.css, and public/game.js. Do not change gameplay rules or UI text except for script/link tags. After refactoring, run a local static server smoke check and report any issues.
```

## Guardrails
- Do not add React/Vite/build tooling yet.
- Do not add OpenAI API calls to gameplay yet.
- Do not rewrite rules while refactoring structure.
- Do not deploy unless explicitly asked.

