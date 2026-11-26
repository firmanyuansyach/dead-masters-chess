# Dead Master's Chess

Play chess against the ghost of **Paul Morphy (1837–1884)**, the great master of the
19th century, in a haunted hall. While your game follows a line Morphy actually
played, the ghost answers with **his own recorded moves** — drawn from 216 of his
real games (1857–1859, 6,020 book positions), each one validated move-by-move
against the rules of chess. Step off the book and the ghost falls back on its own
engine, still speaking in the voice of 1858.

Built with **Kiro** for the Kiroween 2026 hackathon (Costume Contest category).

## Play

Open `index.html` in a browser, or serve the folder with any static server:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

No build step, no backend, no account. Your move: click a piece, then a
highlighted square (or drag). The ghost replies after a suitably theatrical pause.

- **Play as White or Black** — the ghost plays Morphy's moves either way.
- **On-book indicator** — when the ghost plays a recorded Morphy move, the panel
  names the game it came from (e.g. *Morphy vs Anderssen, Paris 1858*), and the
  move list shows the same source under the move.
- **Replay the Opera Game** — watch Morphy's most famous 17-move victory,
  move by move, with the story told as it unfolds.
- **Ghost commentary** — era-flavoured remarks when the book is left, a piece
  falls, or check is given. The ghost never claims a move is Morphy's when it
  is not: off-book moves are marked as the ghost's own invention.
- **Haunted-hall presentation** — candlelit vignette, last-move and check
  highlights, capture flash, sound effects with a toggle (WebAudio, no
  assets), touch drag on phones as well as mouse drag and click.
- **Full rules** — legal move generation, check, checkmate, stalemate, draw by
  insufficient material / fifty moves / threefold repetition, castling,
  en passant, promotion.

## How the ghost works

1. **The book** (`data/book.json`): every position in Morphy's 216 validated
   games where it was Morphy's turn, keyed by FEN, with the move he played and
   the game it came from (7,004 game-move entries across 6,020 positions).
   The ghost **anchors to one game**: its first book reply picks a recorded
   game and it follows that game's line for as long as your moves stay on
   it, re-anchoring only when you leave the line. It never jumps between
   games mid-line. Built by `../build-book.mjs` from the Goossens
   compilation of Morphy's games (Tim Krabbé's collection, 1857–1859). Every
   game was replayed through `chess.js` and only games whose every move is
   legal entered the book; 123 records were rejected (odds games played from
   non-start positions, and a handful of corrupt old transcriptions).
2. **The engine** (`src/ghost.js`): when the position leaves the book, a
   small minimax search (alpha-beta, depth 2, material + piece-square
   evaluation, quiescence on captures) picks the ghost's move. It plays like
   a spirited amateur of the era, not a modern engine — by design.
3. **The rules** (`src/chess.js`): vendored `chess.js` 1.4.0 (MIT), the
   standard library for legal move generation and game state.

## Project layout

```
index.html            the haunted hall (board, ghost panel, move list)
styles.css            gothic styling, no external assets
src/
  chess.js            vendored chess.js 1.4.0 (MIT) — rules engine
  ghost.js            book lookup + fallback engine + commentary hooks
  app.js              UI controller: input, rendering, game flow
data/
  games.json          216 validated Morphy games (SAN)
  book.json           6,020 FEN -> Morphy move(s) with game references
tests/
  playtest.mjs        headless self-play: full games, book-hit rate, end states
  ui-test.mjs         jsdom UI test: drives the real app with clicks —
                      promotion modal, ghost-timer race, Play as Black,
                      full game to termination (needs `npm install`)
.kiro/
  specs/              Kiro spec: requirements, design, tasks
  steering/           product / tech / structure guidance for Kiro
  hooks/              dataset validation hook (see build-book.mjs)
```

## Kiro usage

See `docs/KIRO-USAGE.md` for the full write-up of how Kiro was used
(specs, steering, hooks, and the CLI sessions that shaped this build).

## Data provenance & license

- Morphy's games are 19th-century historical records (public domain). The
  compilation used is Jack Goossens', hosted by Tim Krabbé
  (timkr.home.xs4all.nl), offered there for download; the 1857–1859 scores
  were re-validated here and corrupt records dropped. The famous Opera Game
  score was cross-checked against Wikipedia's *Opera game* article.
- `chess.js` is MIT-licensed (see `src/chess.js` header).
- This project's own code and text are MIT-licensed (see `LICENSE`).
