# Structure steering — Dead Master's Chess

```
index.html            board, ghost panel, move list, controls
styles.css            gothic styling
src/
  chess.js            vendored chess.js 1.4.0 (MIT) — do not modify
  ghost.js            book lookup + fallback engine
  commentary.js       era-flavoured ghost lines (pure functions of game state)
  app.js              UI controller and game flow
data/
  games.json          validated Morphy games (builder output)
  book.json           FEN -> Morphy moves (builder output)
tests/
  playtest.mjs        headless self-play + book coverage + end-state checks
.kiro/
  specs/dead-masters-chess/   requirements.md, design.md, tasks.md
  steering/                   this guidance
  hooks/                      dataset validation hook config
docs/
  KIRO-USAGE.md       how Kiro was used (specs, steering, hooks, CLI log)
```

## Rules
- `data/*.json` are generated: edit `../build-book.mjs`, re-run it, commit
  the regenerated files.
- `src/chess.js` is vendored: never edit; upgrades replace the whole file
  and update the version note in README.
- Tests live in `tests/` and run with plain `node` — no test framework.
- Keep the app dependency-free so any static host (GitHub Pages) serves it.
