# Tech steering — Dead Master's Chess

## Stack
- Static site, no build step, no framework, no backend. `index.html` +
  `styles.css` + `src/*.js`, ES modules.
- Rules engine: vendored `chess.js` 1.4.0 (MIT) in `src/chess.js`. Never
  re-implement move legality by hand; chess.js is the authority for legal
  moves, check, mate, stalemate, draws.
- Ghost: `src/ghost.js` — (1) book lookup in `data/book.json` keyed by FEN
  (first 4 fields), (2) minimax fallback, alpha-beta, depth 2, material +
  piece-square evaluation, capture quiescence, node/time budget (~800 ms).
  No Web Worker needed at depth 2; keep the UI responsive with a short
  setTimeout before replying.
- Data: `data/games.json` (216 validated games, SAN) and `data/book.json`
  (6,020 positions). Both are build artifacts of `../build-book.mjs`, which
  replays every source game through chess.js and drops any game with an
  illegal move. Never hand-edit the data files; fix the builder instead.

## Conventions
- Vanilla JS, no dependencies beyond chess.js. Pieces are Unicode chess
  glyphs styled with CSS — no image assets, no webfonts required (serif
  system stack; an optional Google Fonts link degrades gracefully).
- Every user-visible ghost claim must be traceable: a book move always
  carries its source game (white vs black, date); an engine move is labelled
  as the ghost's own.
- All game-state transitions go through chess.js (`move`, `isCheckmate`,
  `isStalemate`, `isDraw`, `isThreefoldRepetition`, `isInsufficientMaterial`).
  Never infer mate/draw from material counts in app code.
