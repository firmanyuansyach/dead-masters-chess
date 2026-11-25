# Design — Dead Master's Chess

## 1. File Responsibilities

```
index.html          Shell: board grid, ghost panel, move list, controls,
                    promotion selector, game-end overlay, replay controls.
                    Loads ES modules; no inline scripts.

styles.css          Gothic haunted-hall theme: dark wood (#1a0f07), candlelight
                    amber (#c8922a), gold-leaf accent (#d4a843). Piece glyphs
                    sized and coloured with CSS; no image assets.

src/chess.js        Vendored chess.js 1.4.0 (MIT). Authoritative for all move
                    legality, check, checkmate, stalemate, and draw detection.
                    Never modified.

src/ghost.js        Ghost move selection:
                    1. Book lookup in data/book.json (keyed by FEN, 4-field).
                    2. Minimax fallback (alpha-beta, depth 3, material +
                       piece-square eval, quiescence on captures).
                    Exports: ghostMove(chess) → {san, attribution}

src/app.js          UI controller and game-flow state machine.
                    Handles click/drag input, promotion flow, move list,
                    game-end overlay, replay mode, play-as-Black toggle.
                    Imports Chess from src/chess.js, ghostMove from src/ghost.js,
                    commentary from src/commentary.js.

src/commentary.js   Pure functions mapping game state to era-flavoured ghost
                    lines. No side effects; no DOM access.
                    Exports: openingLine(fen), bookMoveLine(attribution),
                    engineMoveLine(), gameEndLine(result)

data/games.json     Array of 216 game objects. Each game:
                    { id, white, black, date, event, result, moves: [SAN…] }
                    Produced by ../build-book.mjs; never hand-edited.

data/book.json      Object keyed by FEN (first 4 fields, space-joined).
                    Each value is an array of move objects:
                    { san, gameId, white, black, date }
                    Produced by ../build-book.mjs; never hand-edited.
```

---

## 2. Ghost Move-Selection Algorithm

```
ghostMove(chess, book, anchor):   // anchor = { gameId } owned by the caller,
                                  // persists across the game
  fen4 = chess.fen().split(' ').slice(0,4).join(' ')
  candidates = book[fen4]            // O(1) lookup; entries are (game, SAN)
                                     // pairs — the same SAN from different
                                     // games stays as separate entries

  if candidates is non-empty:
    pick = candidates.find(e => e.gameId == anchor.gameId)
    if pick is null:                 // first book reply, or the player left
                                     // the anchored game's line: re-anchor
      pick = candidates[random index]
      anchor.gameId = pick.gameId
    return { san: pick.san,
             attribution: { white: pick.white, black: pick.black,
                            date:  pick.date },
             source: 'book', gameId: pick.gameId }

  anchor.gameId = null               // off-book: the anchor clears
  // Off-book: minimax fallback
  result = alphaBeta(chess, depth=2, -Infinity, +Infinity, maximising=true)
  return { san: result.san, attribution: null, source: 'engine' }
```

The ghost ANCHORS to one recorded game: its first book reply picks a game
and it follows that game's line while the player's moves stay on it. It
never jumps between games mid-line. (Amended 2026-11-25: the original spec
said "pure random" per position, which let the ghost answer 1.e4 with Nc6
from one game and then e5 from another. The anchored version is what the
playtest now enforces — test 7a replays a full 160-ply recorded game with
a fixed anchor, 7b proves no mid-line switching in free play.)

**Evaluation function** (material + piece-square tables, side-relative):

| Piece  | Value |
|--------|-------|
| Pawn   |   100 |
| Knight |   320 |
| Bishop |   330 |
| Rook   |   500 |
| Queen  |   900 |
| King   | 20000 |

Piece-square tables are standard Simplified Evaluation tables (Chessprogramming
Wiki). The side-relative sign ensures the engine always maximises for the
ghost's colour.

**Quiescence search:** after depth 0, search all capture moves one additional
ply (stand-pat with beta cutoff) to avoid the horizon effect on obvious
exchanges.

**Responsiveness:** `ghostMove` is called inside a `setTimeout(..., 150)` from
`app.js` so the browser can repaint the human's move before the ghost replies.

---

## 3. Data Formats

### data/games.json

```jsonc
[
  {
    "id": "morphy-001",
    "white": "Morphy",
    "black": "Duke of Brunswick & Count Isouard",
    "date": "1858.11.02",
    "event": "Paris Opera",
    "result": "1-0",
    "moves": ["e4", "e5", "Nf3", "d6", "d4", "Bg4", "dxe5", "Bxf3",
              "Qxf3", "dxe5", "Bc4", "Nf6", "Qb3", "Qe7", "Nc3",
              "c6", "Bg5", "b5", "Nxb5", "cxb5", "Bxb5+", "Nbd7",
              "O-O-O", "Rd8", "Rxd7", "Rxd7", "Rd1", "Qe6", "Bxd7+",
              "Nxd7", "Qb8+", "Nxb8", "Rd8#"]
  },
  ...
]
```

### data/book.json

```jsonc
{
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3": [
    {
      "san": "e5",
      "gameId": "morphy-001",
      "white": "Morphy",
      "black": "Duke of Brunswick & Count Isouard",
      "date": "1858.11.02"
    },
    ...
  ],
  ...
}
```

FEN key: first four fields of `chess.fen()` joined by spaces (board, turn,
castling rights, en-passant square). The move-number and halfmove-clock fields
are dropped so transpositions that reach the same position via different move
orders map to the same key.

---

## 4. UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  DEAD MASTER'S CHESS               [New Game] [As Black] │
├──────────────────────────────┬──────────────────────────┤
│                              │  GHOST PANEL             │
│         BOARD (8×8)          │  ─────────────────────── │
│                              │  Ghost portrait (CSS art) │
│   rank labels  (1–8)         │                          │
│   file labels  (a–h)         │  Move attribution or     │
│                              │  engine label appears    │
│                              │  here after each ghost   │
│                              │  reply.                  │
├──────────────────────────────┤                          │
│  [Resign]  [Replay Opera]    │  Commentary line         │
├──────────────────────────────┴──────────────────────────┤
│  MOVE LIST                                              │
│  1. e4   e5    2. Nf3  Nc6   ...  (auto-scroll)        │
└─────────────────────────────────────────────────────────┘
```

**Responsive breakpoint:** below 600 px, the ghost panel collapses below the
board; the move list scrolls independently.

---

## 5. UI States

| State            | Description                                              |
|------------------|----------------------------------------------------------|
| `idle`           | Waiting for the player to select a piece.                |
| `piece-selected` | A piece is selected; legal destinations are highlighted. |
| `promotion`      | A pawn reached rank 8/1; promotion selector is shown.   |
| `ghost-thinking` | Ghost's turn; board is locked; spinner shown.            |
| `replay`         | Opera Game replay; normal moves disabled.                |
| `game-over`      | Overlay shown with result; board locked.                 |

Transitions:

```
idle → piece-selected  (click own piece)
piece-selected → idle  (click same piece again, or empty non-destination)
piece-selected → promotion  (pawn reaches back rank)
piece-selected → ghost-thinking  (legal move made, not promotion)
promotion → ghost-thinking  (piece chosen)
ghost-thinking → idle  (ghost move committed)
any → game-over  (chess.js signals terminal state)
idle → replay  (Replay Opera clicked)
replay → idle  (exit replay)
any → idle  (New Game)
```

---

## 6. Edge Cases

**Promotion:** `app.js` intercepts any move where a pawn lands on rank 1 or 8,
suspends ghost-thinking, shows the promotion selector, then calls
`chess.move({ from, to, promotion: piece })`. The ghost may also promote;
ghost.js always promotes to queen.

**Leaving the book:** When the player's move leaves the anchored game's
line, the ghost re-anchors: if the new position is in `data/book.json`
under another game, it follows that game from there (still a real Morphy
move, labelled with its game). Only when the position matches no recorded
game at all does the ghost fall back to the engine, labelled as its own
move. (Amended 2026-11-25: the original spec said there was no
re-entering the book after a deviation; the anchored design re-enters via
a new anchor.)

**Threefold repetition / fifty-move draw:** Detected after every move via
`chess.isDraw()`; the game-over overlay shows "Draw — repetition" or
"Draw — fifty-move rule" as appropriate.

**Insufficient material:** `chess.isInsufficientMaterial()` checked after
every move; overlay shows "Draw — insufficient material".

**Play-as-Black:** When this mode is active, `app.js` calls `ghostMove`
immediately after `New Game` to place Morphy's first move; the player then
responds as Black.

**Replay mode:** A separate `Chess` instance is created from the Opera Game's
moves array in `data/games.json`. The live game instance is preserved; exiting
replay restores the board to the live game state.

**No legal moves for ghost:** Should not occur in a legal game, but if
`chess.moves()` returns an empty array and the position is not terminal,
`ghost.js` returns `null` and `app.js` falls back to a random legal move,
then to `endGame()` if none exists (added after Kiro review burst 2).
