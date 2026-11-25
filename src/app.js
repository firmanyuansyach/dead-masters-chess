// app.js — UI controller for Dead Master's Chess.
// All rules go through chess.js. All ghost decisions go through ghost.js.
// The UI never invents a Morphy attribution: book moves show their game,
// engine moves are labelled as the ghost's own.
import { Chess } from './chess.js';
import { ghostMove } from './ghost.js';
import * as say from './commentary.js';

const GLYPH = {
  w: { k: '\u2654', q: '\u2655', r: '\u2656', b: '\u2657', n: '\u2658', p: '\u2659' },
  b: { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' },
};
const PIECE_NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

const $ = (id) => document.getElementById(id);
const boardEl = $('board');
const statusEl = $('status');
const commentEl = $('commentary');
const sourceEl = $('source-line');
const movesEl = $('moves');
const ghostStateEl = $('ghost-state');
const capturedEl = $('captured');

let book = null;
let games = [];
let chess = new Chess();
let playerColor = 'w';
let mode = 'play'; // 'play' | 'replay'
let selected = null;
let legalTargets = [];
let ghostThinking = false;
let ghostTimer = null; // pending setTimeout(ghostReply); cleared on New game /
// Resign / replay so a stale reply can never fire against a reset board.
let offBookAnnounced = false;
let pendingPromotion = null;
let replayGame = null;
let replayIndex = 0;
let replayTimer = null;
let resigned = false;
let operaFinaleSpoken = false;
let savedGame = null; // live game preserved across an Opera replay
let ghostAnchor = { gameId: null }; // the recorded game the ghost follows

// ---------- data ----------
async function loadData() {
  const [b, g] = await Promise.all([
    fetch('./data/book.json').then(r => r.json()),
    fetch('./data/games.json').then(r => r.json()),
  ]);
  book = b;
  games = g;
}

function operaGame() {
  return games.find(g => /Brunswick|Isouard|Braunschweig/i.test(g.black || '')) || null;
}

// ---------- rendering ----------
function render() {
  const b = chess.board();
  const rows = playerColor === 'w' ? b : [...b].reverse();
  boardEl.innerHTML = '';
  rows.forEach((row, ri) => {
    const cols = playerColor === 'w' ? row : [...row].reverse();
    cols.forEach((sq, ci) => {
      const rank = playerColor === 'w' ? 8 - ri : ri + 1;
      const file = playerColor === 'w' ? 'abcdefgh'[ci] : 'abcdefgh'[7 - ci];
      const name = file + rank;
      const div = document.createElement('div');
      div.className = 'square ' + ((ri + ci) % 2 === 0 ? 'light' : 'dark');
      div.dataset.square = name;
      if (selected === name) div.classList.add('selected');
      if (legalTargets.includes(name)) div.classList.add('legal');
      if (chess.isCheck()) {
        const kingSq = findKing(chess.turn());
        if (kingSq === name) div.classList.add('in-check');
      }
      if (sq) {
        const span = document.createElement('span');
        span.className = 'piece ' + (sq.color === 'w' ? 'white-piece' : 'black-piece');
        span.textContent = GLYPH[sq.color][sq.type];
        span.draggable = mode === 'play' && !ghostThinking && sq.color === playerColor && chess.turn() === playerColor;
        span.dataset.square = name;
        div.appendChild(span);
      }
      div.addEventListener('click', () => onSquareClick(name));
      div.addEventListener('dragover', (e) => e.preventDefault());
      div.addEventListener('drop', (e) => {
        e.preventDefault();
        const from = e.dataTransfer.getData('text/plain');
        if (from && from !== name) tryPlayerMove(from, name);
      });
      div.addEventListener('dragstart', (e) => {
        if (e.target.dataset.square) e.dataTransfer.setData('text/plain', e.target.dataset.square);
      });
      boardEl.appendChild(div);
    });
  });
  renderMoves();
  renderCaptured();
  updateStatus();
}

function findKing(color) {
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq && sq.type === 'k' && sq.color === color) return sq.square;
    }
  }
  return null;
}

function renderMoves() {
  const hist = chess.history({ verbose: true });
  movesEl.innerHTML = '';
  for (let i = 0; i < hist.length; i += 2) {
    const num = i / 2 + 1;
    const row = document.createElement('div');
    row.className = 'move-row';
    row.innerHTML = `<span class="move-num">${num}.</span><span>${hist[i].san}</span><span>${hist[i + 1] ? hist[i + 1].san : ''}</span>`;
    movesEl.appendChild(row);
  }
  movesEl.scrollTop = movesEl.scrollHeight;
}

function renderCaptured() {
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const have = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq && sq.type !== 'k') have[sq.color][sq.type]++;
    }
  }
  const lost = { w: [], b: [] };
  for (const color of ['w', 'b']) {
    for (const t of ['q', 'r', 'b', 'n', 'p']) {
      for (let i = 0; i < start[t] - have[color][t]; i++) lost[color].push(GLYPH[color][t]);
    }
  }
  // lost[c] = pieces of colour c that are gone from the board. Pieces of
  // the player's colour that are gone were taken by the ghost, and vice
  // versa — so the labels flip when the player is Black.
  const ghostColor = playerColor === 'w' ? 'b' : 'w';
  capturedEl.textContent =
    (lost[playerColor].length ? `Ghost has taken: ${lost[playerColor].join(' ')}   ` : '') +
    (lost[ghostColor].length ? `You have taken: ${lost[ghostColor].join(' ')}` : '');
}

function updateStatus() {
  $('resign').disabled = mode !== 'play' || chess.isGameOver() || resigned;
  if (resigned) {
    statusEl.textContent = 'You resigned. The ghost wins.';
    return;
  }
  if (chess.isCheckmate()) {
    statusEl.textContent = mode === 'replay'
      ? 'Checkmate.'
      : chess.turn() === playerColor
        ? 'Checkmate — the ghost wins.'
        : 'Checkmate — you win!';
  } else if (chess.isStalemate()) {
    statusEl.textContent = 'Stalemate — a draw.';
  } else if (chess.isDraw()) {
    statusEl.textContent = 'Draw.';
  } else if (chess.isCheck()) {
    statusEl.textContent = chess.turn() === playerColor ? 'Check! Defend your king.' : 'Check! The ghost king is in danger.';
  } else {
    statusEl.textContent = chess.turn() === playerColor ? 'Your move.' : 'The ghost is thinking…';
  }
}

function speak(text) {
  const p = document.createElement('p');
  p.textContent = text;
  commentEl.appendChild(p);
  commentEl.scrollTop = commentEl.scrollHeight;
}

function setSource(text, isBook) {
  sourceEl.textContent = text;
  sourceEl.className = isBook ? 'source-book' : 'source-engine';
}

// ---------- input ----------
function onSquareClick(sq) {
  if (mode !== 'play' || ghostThinking || resigned || chess.turn() !== playerColor || chess.isGameOver()) return;
  const piece = chess.get(sq);
  if (selected && legalTargets.includes(sq)) {
    tryPlayerMove(selected, sq);
    return;
  }
  if (piece && piece.color === playerColor) {
    selected = sq;
    legalTargets = chess.moves({ square: sq, verbose: true }).map(m => m.to);
  } else {
    selected = null;
    legalTargets = [];
  }
  render();
}

function tryPlayerMove(from, to) {
  const piece = chess.get(from);
  if (!piece || piece.color !== playerColor) return;
  if (piece.type === 'p' && (to[1] === '8' || to[1] === '1')) {
    pendingPromotion = { from, to };
    $('promotion-modal').classList.remove('hidden');
    return;
  }
  commitPlayerMove(from, to, 'q');
}

function commitPlayerMove(from, to, promotion) {
  let mv;
  try {
    mv = chess.move({ from, to, promotion });
  } catch {
    selected = null;
    legalTargets = [];
    render();
    return;
  }
  selected = null;
  legalTargets = [];
  if (mv.captured) speak(say.captureLine(PIECE_NAME[mv.captured], false));
  if (chess.isCheckmate()) { afterMove(null); return; }
  if (mv.san.includes('+')) speak(say.checkLine(false));
  afterMove(mv);
}

function afterMove(playerMv) {
  render();
  if (chess.isGameOver()) return endGame();
  if (mode === 'play' && chess.turn() !== playerColor) {
    ghostThinking = true;
    ghostStateEl.textContent = 'The ghost is thinking…';
    render();
    ghostTimer = setTimeout(ghostReply, 700 + Math.random() * 700);
  }
}

function clearGhostTimer() {
  if (ghostTimer) { clearTimeout(ghostTimer); ghostTimer = null; }
}

function ghostReply() {
  ghostTimer = null;
  // Belt and braces: a reply must only ever land in a live game, on the
  // ghost's turn. (The timer is also cleared on every state change, so a
  // stale reply should never reach here.)
  if (mode !== 'play' || resigned || chess.isGameOver() || chess.turn() === playerColor) {
    ghostThinking = false;
    return;
  }
  ghostThinking = false;
  let decision = null;
  try {
    decision = ghostMove(chess, book, ghostAnchor);
  } catch {
    decision = null; // fall through to the legal-move fallback below
  }
  if (!decision) {
    // Last resort: any legal move keeps the game alive; none means the game
    // is over (mate/stalemate), which endGame() will announce.
    const legal = chess.moves({ verbose: true });
    if (legal.length === 0) return endGame();
    const mv0 = legal[Math.floor(Math.random() * legal.length)];
    decision = { san: mv0.san, from: mv0.from, to: mv0.to, promotion: mv0.promotion || 'q', source: 'engine' };
  }
  let mv;
  try {
    mv = chess.move({ from: decision.from, to: decision.to, promotion: decision.promotion });
  } catch {
    const legal = chess.moves({ verbose: true });
    if (legal.length === 0) return endGame();
    mv = chess.move(legal[0]);
    decision = { ...decision, source: 'engine' };
  }
  if (decision.source === 'book') {
    ghostStateEl.textContent = 'On book — a move Morphy himself played';
    setSource(`Following ${decision.game}${decision.opening ? ` (${decision.opening})` : ''} — ${decision.san}`, true);
    speak(say.bookLine(decision.game, decision.opening));
  } else {
    ghostStateEl.textContent = 'Off book — the ghost improvises';
    setSource('Off the book: the ghost\u2019s own move, not Morphy\u2019s.', false);
    if (!offBookAnnounced) {
      offBookAnnounced = true;
      speak(say.offBookLine());
    }
  }
  if (mv.captured) speak(say.captureLine(PIECE_NAME[mv.captured], true));
  if (chess.isCheckmate()) { render(); return endGame(); }
  if (mv.san.includes('+')) speak(say.checkLine(true));
  render();
}

function endGame() {
  render();
  let overText = '';
  if (chess.isCheckmate()) {
    speak(chess.turn() === playerColor ? say.winLine() : say.loseLine());
    overText = chess.turn() === playerColor ? 'Checkmate — the ghost wins.' : 'Checkmate — you win!';
  } else if (chess.isStalemate()) {
    speak(say.drawLine('stalemate'));
    overText = 'Stalemate — a draw.';
  } else if (chess.isInsufficientMaterial()) {
    speak(say.drawLine('neither side has mating material'));
    overText = 'Draw — neither side has mating material.';
  } else if (chess.isThreefoldRepetition()) {
    speak(say.drawLine('the same position appeared three times'));
    overText = 'Draw — the same position appeared three times.';
  } else if (chess.isDraw()) {
    speak(say.drawLine('the fifty-move rule'));
    overText = 'Draw — the fifty-move rule.';
  }
  if (overText) showGameOver(overText);
}

function showGameOver(text) {
  $('game-over-text').textContent = text;
  $('game-over').classList.remove('hidden');
}

// ---------- controls ----------
function newGame(asBlack) {
  clearGhostTimer();
  stopReplay();
  chess = new Chess();
  playerColor = asBlack ? 'b' : 'w';
  mode = 'play';
  selected = null;
  legalTargets = [];
  ghostThinking = false;
  offBookAnnounced = false;
  pendingPromotion = null;
  resigned = false;
  savedGame = null;
  ghostAnchor.gameId = null;
  $('promotion-modal').classList.add('hidden');
  $('game-over').classList.add('hidden');
  $('replay-bar').classList.add('hidden');
  ghostStateEl.textContent = 'The ghost awaits…';
  setSource('', true);
  commentEl.innerHTML = '';
  speak(say.greeting(asBlack));
  render();
  if (asBlack) {
    ghostThinking = true;
    ghostTimer = setTimeout(ghostReply, 900);
  }
}

function startOperaReplay() {
  clearGhostTimer();
  replayGame = operaGame();
  if (!replayGame) {
    speak('The Opera Game could not be found in the book. The ghost apologises.');
    return;
  }
  stopReplay();
  if (mode === 'play') {
    savedGame = {
      sans: chess.history(),
      playerColor,
      resigned,
      offBookAnnounced,
      ghostAnchor: ghostAnchor.gameId,
      commentaryHtml: commentEl.innerHTML,
      sourceText: sourceEl.textContent,
      sourceIsBook: sourceEl.className === 'source-book',
      ghostState: ghostStateEl.textContent,
    };
  }
  chess = new Chess();
  mode = 'replay';
  replayIndex = 0;
  operaFinaleSpoken = false;
  playerColor = 'w';
  selected = null;
  legalTargets = [];
  ghostThinking = false;
  $('replay-bar').classList.remove('hidden');
  $('opera-title').textContent = `${replayGame.white} vs ${replayGame.black}, ${replayGame.date || '1858'} — ${replayGame.result}`;
  commentEl.innerHTML = '';
  speak(say.operaIntro());
  setSource('Replay — every move is Morphy\u2019s own, as recorded.', true);
  ghostStateEl.textContent = 'Replaying the Opera Game';
  render();
}

function replayStep(dir) {
  if (!replayGame) return;
  if (dir > 0 && replayIndex < replayGame.sans.length) {
    chess.move(replayGame.sans[replayIndex]);
    replayIndex++;
    if (replayIndex === replayGame.sans.length && !operaFinaleSpoken) {
      operaFinaleSpoken = true;
      speak('17. Rd8# — mate. The Duke and the Count resign; the opera sings on. The most famous finish in chess.');
    }
  } else if (dir < 0 && replayIndex > 0) {
    chess.undo();
    replayIndex--;
  }
  render();
}

function exitReplay() {
  clearGhostTimer();
  stopReplay();
  $('replay-bar').classList.add('hidden');
  if (!savedGame) return newGame(false);
  chess = new Chess();
  for (const san of savedGame.sans) chess.move(san);
  playerColor = savedGame.playerColor;
  resigned = savedGame.resigned;
  offBookAnnounced = savedGame.offBookAnnounced;
  ghostAnchor.gameId = savedGame.ghostAnchor;
  commentEl.innerHTML = savedGame.commentaryHtml || '';
  setSource(savedGame.sourceText || '', savedGame.sourceIsBook !== false);
  ghostStateEl.textContent = savedGame.ghostState || 'The ghost awaits…';
  mode = 'play';
  selected = null;
  legalTargets = [];
  ghostThinking = false;
  savedGame = null;
  render();
  if (!resigned && !chess.isGameOver() && chess.turn() !== playerColor) {
    ghostThinking = true;
    ghostTimer = setTimeout(ghostReply, 900);
  }
}

function stopReplay() {
  if (replayTimer) { clearInterval(replayTimer); replayTimer = null; }
  $('replay-auto').textContent = 'Auto-play';
}

function toggleAutoReplay() {
  if (!replayGame) return;
  if (replayTimer) { stopReplay(); return; }
  $('replay-auto').textContent = 'Stop';
  replayTimer = setInterval(() => {
    if (replayIndex >= replayGame.sans.length) { stopReplay(); return; }
    replayStep(1);
  }, 1400);
}

// ---------- wiring ----------
function init() {
  $('new-game').addEventListener('click', () => newGame(false));
  $('as-black').addEventListener('click', () => newGame(true));
  $('resign').addEventListener('click', () => {
    if (mode !== 'play' || chess.isGameOver() || resigned) return;
    clearGhostTimer();
    resigned = true;
    speak(say.resignLine());
    render();
    showGameOver('You resigned. The ghost wins.');
  });
  $('replay-opera').addEventListener('click', startOperaReplay);
  $('replay-prev').addEventListener('click', () => replayStep(-1));
  $('replay-next').addEventListener('click', () => replayStep(1));
  $('replay-auto').addEventListener('click', toggleAutoReplay);
  $('replay-exit').addEventListener('click', exitReplay);
  $('game-over-new').addEventListener('click', () => newGame(false));
  document.querySelectorAll('#promotion-modal button[data-piece]').forEach(btn => {
    btn.addEventListener('click', () => {
      $('promotion-modal').classList.add('hidden');
      if (pendingPromotion) {
        const { from, to } = pendingPromotion;
        pendingPromotion = null;
        commitPlayerMove(from, to, btn.dataset.piece);
      }
    });
  });
  $('promotion-cancel').addEventListener('click', () => {
    $('promotion-modal').classList.add('hidden');
    pendingPromotion = null;
  });
  loadData()
    .then(() => {
      const n = Object.keys(book).length;
      $('book-count').textContent = `${games.length} recorded games · ${n.toLocaleString()} book positions`;
      newGame(false);
    })
    .catch(() => {
      statusEl.textContent = 'The book could not be loaded. Serve this folder with a static server (e.g. python3 -m http.server) instead of opening the file directly.';
    });
}

init();
