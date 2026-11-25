# Requirements — Dead Master's Chess

## 1. Core Gameplay

**REQ-1** The system shall provide a single-page chess game where the human
player faces the ghost of Paul Morphy.

*Acceptance:* A new game starts with a valid initial board position; the human
moves first as White by default; moves are validated by chess.js 1.4.0.

**REQ-2** The system shall enforce all FIDE rules of chess through chess.js.
No move-legality logic shall exist in application code.

*Acceptance:* Illegal moves are rejected; check, checkmate, stalemate, the
fifty-move rule, threefold repetition, and insufficient material are all
detected via chess.js methods (`isCheckmate`, `isStalemate`, `isDraw`,
`isThreefoldRepetition`, `isInsufficientMaterial`).

**REQ-3** When a pawn reaches the back rank, the UI shall prompt the player to
choose a promotion piece before the move is committed.

*Acceptance:* A promotion selector appears; only queen, rook, bishop, and
knight are offered; the game resumes after the choice; the resulting position
is legal per chess.js.

**REQ-4** The player shall be able to move pieces by clicking (select then
click destination) and by drag-and-drop.

*Acceptance:* Both input methods produce the same legal-move outcome; legal
destination squares are highlighted on piece selection.

**REQ-5** The system shall provide New Game and Resign controls.

*Acceptance:* New Game resets board and state at any point; Resign ends the
current game, displaying a "You resigned" result.

**REQ-6** The player shall be able to choose to play as Black before starting
a game.

*Acceptance:* A "Play as Black" toggle is available on the new-game screen or
controls bar; when active, Morphy makes the first move as White.

---

## 2. The Ghost and Book Moves

**REQ-7** When the current position matches a FEN key in `data/book.json`,
the ghost shall respond with one of Morphy's recorded moves for that position.

*Acceptance:* The ghost's move is drawn from `data/book.json`; the move is
legal per chess.js; at least one book hit is observed in a typical game
opening.

**REQ-8** Every book move shall carry its source game attribution (White vs
Black, date). The UI shall display this attribution when the ghost plays a
book move.

*Acceptance:* The move list shows the source game label (e.g.
"Morphy vs Duke of Brunswick & Count Isouard, Paris 1858") alongside the book
move; the label is derived from the game metadata in `data/book.json`.

**REQ-9** When the position is not in the book, the ghost shall fall back to
its own minimax engine (`src/ghost.js`): alpha-beta search, depth 3, with
material and piece-square evaluation and capture quiescence.

*Acceptance:* The ghost always produces a move when legal moves exist; the
fallback engine completes within a perceptible delay at depth 3 (a short
`setTimeout` keeps the UI from freezing).

**REQ-10** The UI shall clearly distinguish engine moves from book moves.
An engine move shall be labelled as the ghost's own reasoning, never as
"Morphy's move."

*Acceptance:* Book moves display the source game attribution; engine moves
display a label such as "The ghost contemplates…" or equivalent; the two
labels are visually distinct.

---

## 3. Opera Game Replay Mode

**REQ-11** The application shall include a dedicated "Replay the Opera Game"
mode that steps through Morphy vs Duke of Brunswick & Count Isouard
(Paris, 1858) — 17 moves, result 1-0 — using the validated SAN in
`data/games.json`.

*Acceptance:* The mode is accessible from the UI; all 17 moves play in
sequence; the final position matches the recorded checkmate; the score
matches the cross-checked Wikipedia reference.

**REQ-12** In replay mode, forward/back navigation shall allow the player to
step through any move of the Opera Game.

*Acceptance:* "Next" and "Previous" buttons advance and retreat one move;
the board and move list update correctly at each step.

---

## 4. User Interface

**REQ-13** The board and ghost panel shall be visible immediately on load with
a gothic haunted-hall aesthetic: dark wood tones, candlelight palette, gold-
leaf accents, Unicode chess glyphs for pieces.

*Acceptance:* No image assets are required; the app renders correctly on any
static host (including GitHub Pages) with no external network calls beyond the
initial page load.

**REQ-14** A scrollable move list shall display the full game history in
standard algebraic notation.

*Acceptance:* Each entry shows the move number, White's move, and Black's
move on the same row; the list auto-scrolls to the latest move.

**REQ-15** The on-book indicator shall appear in the ghost's panel whenever the
ghost plays from the book, naming the source game.

*Acceptance:* The panel text changes between book-move attribution and engine-
move attribution with each ghost reply; the panel is always visible.

**REQ-16** The game-end state (checkmate, stalemate, draw, resign) shall be
clearly communicated in the UI with the result and reason.

*Acceptance:* An overlay or banner appears on game end; it names the result
(e.g. "Checkmate — the ghost wins") and provides a "New Game" button.

---

## 5. Data Integrity

**REQ-17** `data/games.json` shall contain exactly the 216 validated Morphy
games produced by `../build-book.mjs`; `data/book.json` shall contain exactly
6,020 FEN-keyed positions derived from those games.

*Acceptance:* Running `node ../build-book.mjs` from the repo root regenerates
both files deterministically; the game and position counts match.

**REQ-18** The source compilation is the Goossens collection of Morphy's games
(via Tim Krabbe's site); 123 records were rejected as corrupt or odds games.
This provenance shall be documented in README.md.

*Acceptance:* README.md contains a "Data Provenance" section naming the source
and rejection count.

---

## 6. Static-Site Constraint

**REQ-19** The application shall run as a static site with no build step and
no backend. `index.html`, `styles.css`, and `src/*.js` shall be directly
servable by any HTTP file server or GitHub Pages.

*Acceptance:* Opening `index.html` via `file://` or a plain HTTP server
produces a fully functional game with no network errors.

**REQ-20** The `.kiro/` directory shall exist at the repository root and shall
not be listed in `.gitignore`.

*Acceptance:* `.kiro/` is tracked by git; opening the repo in Kiro IDE loads
all steering and spec files.

**REQ-21** `LICENSE` (MIT) shall be present at the repository root.

*Acceptance:* The file exists and contains the MIT license text.

---

## 7. Tests

**REQ-22** `tests/playtest.mjs` shall run with plain `node` (no test
framework) and cover: full legal self-play games reach a terminal state,
book-hit rate is reported, checkmate/stalemate/draw detection produces the
correct chess.js result, and the Opera Game replays move-for-move exactly.

*Acceptance:* `node tests/playtest.mjs` exits 0; output reports book-hit rate;
no assertion fails.
