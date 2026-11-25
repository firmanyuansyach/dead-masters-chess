// ghost.js — the ghost of Paul Morphy.
//
// Two minds in one spirit:
//   1. THE BOOK: while the position matches one of Morphy's recorded games,
//      the ghost plays Morphy's own move (book.json, keyed by FEN) — and it
//      ANCHORS to one game: the first book reply picks a game, and the ghost
//      follows that game's line while the player's moves stay on it,
//      re-anchoring only when the player leaves the line. The ghost never
//      jumps between games mid-line.
//   2. THE ENGINE: off-book, a small minimax search (alpha-beta, depth 2,
//      material + piece-square evaluation, capture quiescence) picks the
//      ghost's move. It plays like a spirited amateur of 1858, not a
//      modern engine — by design. A node/time budget (~800 ms) keeps the
//      ghost answering promptly even in wild middlegames.
//
// The caller must label the source honestly: a book move carries its game,
// an engine move carries source 'engine' and must be presented as the
// ghost's own invention, never as Morphy's.

const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

// Piece-square tables, white's perspective, a1 = index 0 of the flat board
// array used by chess.js (board()[0] is rank 8). Tables are written rank 8
// first so they index directly into chess.board() rows.
const PST = {
  p: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [50, 50, 50, 50, 50, 50, 50, 50],
    [10, 10, 20, 30, 30, 20, 10, 10],
    [5, 5, 10, 25, 25, 10, 5, 5],
    [0, 0, 0, 20, 20, 0, 0, 0],
    [5, -5, -10, 0, 0, -10, -5, 5],
    [5, 10, 10, -20, -20, 10, 10, 5],
    [0, 0, 0, 0, 0, 0, 0, 0],
  ],
  n: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20, 0, 0, 0, 0, -20, -40],
    [-30, 0, 10, 15, 15, 10, 0, -30],
    [-30, 5, 15, 20, 20, 15, 5, -30],
    [-30, 0, 15, 20, 20, 15, 0, -30],
    [-30, 5, 10, 15, 15, 10, 5, -30],
    [-40, -20, 0, 5, 5, 0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  b: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 10, 10, 5, 0, -10],
    [-10, 5, 5, 10, 10, 5, 5, -10],
    [-10, 0, 10, 10, 10, 10, 0, -10],
    [-10, 10, 10, 10, 10, 10, 10, -10],
    [-10, 5, 0, 0, 0, 0, 5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  r: [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [5, 10, 10, 10, 10, 10, 10, 5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [-5, 0, 0, 0, 0, 0, 0, -5],
    [0, 0, 0, 5, 5, 0, 0, 0],
  ],
  q: [
    [-20, -10, -10, -5, -5, -10, -10, -20],
    [-10, 0, 0, 0, 0, 0, -10],
    [-10, 0, 5, 5, 5, 5, 0, -10],
    [-5, 0, 5, 5, 5, 5, 0, -5],
    [0, 0, 5, 5, 5, 5, 0, -5],
    [-10, 5, 5, 5, 5, 5, 0, -10],
    [-10, 0, 5, 0, 0, 0, 0, -10],
    [-20, -10, -10, -5, -5, -10, -10, -20],
  ],
  k: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20, 20, 0, 0, 0, 0, 20, 20],
    [20, 30, 10, 0, 0, 10, 30, 20],
  ],
};

export function bookKey(fen) {
  return fen.split(' ').slice(0, 4).join(' ');
}

function evaluate(chess) {
  // Score from White's perspective; the search negates as needed.
  const board = chess.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const sq = board[r][c];
      if (!sq) continue;
      const table = PST[sq.type][sq.color === 'w' ? r : 7 - r][c];
      const val = PIECE_VALUE[sq.type] + table;
      score += sq.color === 'w' ? val : -val;
    }
  }
  return score;
}

function orderMoves(moves) {
  // Captures first, most valuable victim first (MVV-LVA).
  return moves.sort((a, b) => {
    const va = a.captured ? PIECE_VALUE[a.captured] - PIECE_VALUE[a.piece] / 100 : -1;
    const vb = b.captured ? PIECE_VALUE[b.captured] - PIECE_VALUE[b.piece] / 100 : -1;
    return vb - va;
  });
}

// Search budget: the ghost must answer in about a second, even in a wild
// middlegame. chess.js generates SAN for every verbose move, so raw node
// count is the honest limiter; the deadline is the backstop.
const NODE_BUDGET = 60000;
const TIME_BUDGET_MS = 800;
let nodes = 0;
let deadline = 0;

class SearchTimeout extends Error {}

function quiescence(chess, alpha, beta, color, ply) {
  if (++nodes > NODE_BUDGET || Date.now() > deadline) throw new SearchTimeout();
  const standPat = color * evaluate(chess);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (ply >= 6) return alpha;
  for (const mv of orderMoves(chess.moves({ verbose: true }))) {
    if (!mv.captured) continue;
    let applied = false;
    let score;
    try {
      chess.move(mv);
      applied = true;
      score = -quiescence(chess, -beta, -alpha, -color, ply + 1);
    } finally {
      if (applied) chess.undo();
    }
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function search(chess, depth, alpha, beta, color) {
  if (++nodes > NODE_BUDGET || Date.now() > deadline) throw new SearchTimeout();
  if (depth === 0) return quiescence(chess, alpha, beta, color, 0);
  if (chess.isCheckmate()) return -100000 - depth; // mated: prefer slower mate
  if (chess.isStalemate() || chess.isDraw()) return 0;
  for (const mv of orderMoves(chess.moves({ verbose: true }))) {
    let applied = false;
    let score;
    try {
      chess.move(mv);
      applied = true;
      score = -search(chess, depth - 1, -beta, -alpha, -color);
    } finally {
      if (applied) chess.undo();
    }
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function engineMove(chess, depth = 2) {
  const color = chess.turn() === 'w' ? 1 : -1;
  const moves = orderMoves(chess.moves({ verbose: true }));
  if (moves.length === 0) return null;
  // Mate in one? Take it at once. Without this the time budget can cut the
  // root search off before a late-ordered mating move is ever tried.
  for (const mv of moves) {
    let applied = false;
    try {
      chess.move(mv);
      applied = true;
      if (chess.isCheckmate()) return mv;
    } finally {
      if (applied) chess.undo();
    }
  }
  // Try checking moves first in the search: that is where tactics live.
  const ordered = moves
    .map((mv) => {
      let applied = false;
      let givesCheck = 0;
      try {
        chess.move(mv);
        applied = true;
        givesCheck = chess.isCheck() ? 1 : 0;
      } finally {
        if (applied) chess.undo();
      }
      return { mv, givesCheck };
    })
    .sort((a, b) => b.givesCheck - a.givesCheck)
    .map((s) => s.mv);
  let best = ordered[0];
  let bestScore = -Infinity;
  nodes = 0;
  deadline = Date.now() + TIME_BUDGET_MS;
  for (const mv of ordered) {
    try {
      chess.move(mv);
      let score;
      try {
        score = -search(chess, depth - 1, -Infinity, Infinity, -color);
      } finally {
        chess.undo();
      }
      // Small random tie-break so the ghost does not repeat itself.
      const jitter = (Math.random() - 0.5) * 4;
      if (score + jitter > bestScore) {
        bestScore = score + jitter;
        best = mv;
      }
    } catch (e) {
      if (e instanceof SearchTimeout) break; // keep the best move found so far
      throw e;
    }
    if (Date.now() > deadline) break;
  }
  return best;
}

// Main entry: decide the ghost's move in the current position.
// `anchor` is a caller-owned object { gameId } that persists across the
// game. The ghost ANCHORS to one recorded game: its first book reply picks
// a game and the ghost follows that game's line for as long as the player's
// moves stay on it. When the player leaves the anchored game's line, the
// ghost re-anchors to another game that reached the new position — still a
// real Morphy game, never a jump between games mid-line. Off-book, the
// anchor clears and the engine replies.
// Returns { san, from, to, promotion, source: 'book'|'engine',
//           game?, gameId?, result?, opening? } or null if no legal move.
export function ghostMove(chess, book, anchor) {
  const key = bookKey(chess.fen());
  const entries = book ? book[key] : null;
  if (entries && entries.length > 0) {
    let pick = null;
    if (anchor && anchor.gameId) {
      pick = entries.find(e => e.gameId === anchor.gameId) || null;
    }
    if (!pick) {
      pick = entries[Math.floor(Math.random() * entries.length)];
      if (anchor) anchor.gameId = pick.gameId;
    }
    const mv = chess.moves({ verbose: true }).find(m => m.san === pick.san);
    if (mv) {
      return {
        san: mv.san, from: mv.from, to: mv.to, promotion: mv.promotion,
        source: 'book', game: pick.game, gameId: pick.gameId,
        result: pick.result, opening: pick.opening,
      };
    }
    // Book entry did not match a legal move (should not happen: the book
    // was built from validated games). Fall through to the engine.
    if (anchor) anchor.gameId = null;
  } else if (anchor) {
    anchor.gameId = null;
  }
  const mv = engineMove(chess);
  if (!mv) return null;
  return {
    san: mv.san, from: mv.from, to: mv.to, promotion: mv.promotion || 'q',
    source: 'engine', gameId: null,
  };
}
