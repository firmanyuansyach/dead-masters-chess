// ui-test.mjs — drives the REAL app (src/app.js) inside jsdom and clicks it
// like a user would. Covers what the headless playtest cannot: the promotion
// modal, the ghost-reply timer race (New game / Resign clicked while the
// ghost is thinking), Play as Black, and a full random game to termination.
// No framework, plain node. Exits 0 only if every check passes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';
import { Chess } from '../src/chess.js';

const REPO = path.resolve(import.meta.dirname, '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The ghost's reply delay (700–1,400 ms) is pure theatre. Fast-forward any
// timer of 700 ms or more while fastTimers is on, so engine test games run
// in seconds instead of minutes; shorter waits (polls, guards) are
// untouched. Tests A and C need the REAL delay (they race the thinking
// ghost), so they run with fastTimers off.
const _setTimeout = global.setTimeout;
let fastTimers = false;
global.setTimeout = (fn, ms = 0, ...args) => _setTimeout(fn, ms >= 700 && fastTimers ? 10 : ms, ...args);

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log(`  PASS ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${extra ? ' — ' + extra : ''}`); }
}

const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
const jsErrors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => jsErrors.push(String(e && e.stack || e)));

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;
global.window = window;
global.document = window.document;
global.MouseEvent = window.MouseEvent;
// fetch: the app loads ./data/book.json + ./data/games.json
global.fetch = async (url) => {
  const file = path.join(REPO, url.replace(/^\.\//, ''));
  return { json: async () => JSON.parse(fs.readFileSync(file, 'utf8')) };
};

await import(pathToFileURL(path.join(REPO, 'src/app.js')).href);

// Wait for the book to load (book-count updates, then newGame runs).
for (let i = 0; i < 50 && !document.getElementById('book-count').textContent.includes('recorded games'); i++) await sleep(100);
check('book loads and board renders', document.querySelectorAll('#board .square').length === 64);
check('starting position has 32 pieces', document.querySelectorAll('#board .piece').length === 32);
check('no JS errors on load', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 300));

const $ = (id) => document.getElementById(id);
const sq = (name) => document.querySelector(`.square[data-square="${name}"]`);
const clickSq = (name) => sq(name).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const clickBtn = (id) => $(id).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
const moveSans = () => [...document.querySelectorAll('#moves .move-row span:not(.move-num)')]
  .map((s) => s.textContent).filter(Boolean);
const boardPieceCount = () => document.querySelectorAll('#board .piece').length;
const promoVisible = () => !$('promotion-modal').classList.contains('hidden');
const gameOverVisible = () => !$('game-over').classList.contains('hidden');

// Wait until it is the player's move again (or the game ended). Note the
// status reads "Check! Defend your king." while the player is in check —
// that IS the player's turn, not a stall.
async function waitForPlayerTurn(timeoutMs = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const s = $('status').textContent;
    if (gameOverVisible() || s === 'Your move.' || s.startsWith('Check!')) return true;
    await sleep(150);
  }
  return false;
}
// Rebuild a mirror Chess from the move list shown in the DOM.
function mirrorChess() {
  const c = new Chess();
  for (const san of moveSans()) c.move(san);
  return c;
}

// ---------- TEST A: stale ghost timer after New game ----------
console.log('== A. New game while the ghost is thinking ==');
clickSq('e2'); clickSq('e4');
await sleep(50); // ghost reply is scheduled ~700-1400ms out; hit New game now
clickBtn('new-game');
await sleep(2200);
check('no ghost move leaked into the fresh game', moveSans().length === 0, `moves: ${moveSans().join(' ')}`);
check('fresh board is the start position', boardPieceCount() === 32, `${boardPieceCount()} pieces`);
check('status is Your move', $('status').textContent === 'Your move.', $('status').textContent);

// ---------- TEST B: promotion modal, end to end ----------
// Deterministic at last: only two recorded Morphy-as-White games have a
// Black promotion (Morphy vs Alonzo Morphy 1849, G046, d1=Q at ply 81;
// Morphy vs Barnes 1859, G195, e1=Q+ at ply 57). Play as Black, read the
// anchored game from the source line, and follow that game's Black moves
// exactly — the ghost stays anchored and replays White's moves. Retry with
// a fresh anchor until one of the two promotion games is picked.
console.log('== B. Promotion picker ==');
fastTimers = true;
const gamesData = JSON.parse(fs.readFileSync(path.join(REPO, 'data/games.json'), 'utf8'));
const promoGames = gamesData.filter((g) => /morphy/i.test(g.white || '')
  && g.sans.some((s, i) => i % 2 === 1 && s.includes('=')));
const gameKey = (g) => `${g.white} vs ${g.black}, ${g.date}`;
let promoted = false;
for (let attempt = 0; attempt < 80 && !promoted; attempt++) {
  clickBtn('as-black');
  if (!(await waitForPlayerTurn(8000))) continue;
  const src = $('source-line').textContent.replace(/^Following /, '').split(' \u2014 ')[0].replace(/ \(.*\)$/, '');
  const candidates = promoGames.filter((g) => gameKey(g) === src);
  if (candidates.length === 0) continue;
  const game = candidates[0];
  let followed = true;
  for (let idx = 1; idx < game.sans.length && !promoted; idx += 2) {
    const san = game.sans[idx];
    const c = mirrorChess();
    const mv = c.moves({ verbose: true }).find((m) => m.san === san);
    if (!mv) { followed = false; break; }
    clickSq(mv.from); clickSq(mv.to);
    await sleep(60);
    if (san.includes('=')) {
      check('promotion modal opens on a pawn reaching the last rank', promoVisible(), `game ${game.id}, move ${san}`);
      if (!promoVisible()) { followed = false; break; }
      const before = moveSans().length;
      // Cancel must drop the move cleanly: modal hides, nothing recorded.
      $('promotion-cancel').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await sleep(60);
      check('Cancel closes the modal without recording a move',
        !promoVisible() && moveSans().length === before, moveSans().join(' '));
      check('the piece can still move after Cancel',
        document.querySelector(`.square[data-square="${mv.from}"] .piece`) !== null);
      // Now promote for real, same pawn.
      clickSq(mv.from); clickSq(mv.to);
      await sleep(60);
      check('modal re-opens for the same promotion move', promoVisible());
      document.querySelector('#promotion-modal button[data-piece="q"]')
        .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await sleep(60);
      check('choosing Queen closes the modal', !promoVisible());
      // The ghost replies within ~10 ms under fastTimers, so by now the
      // list may already hold its reply too — check the promotion sits at
      // the index where it was recorded, not the total count.
      check('the promotion move is recorded', moveSans()[before] === san, moveSans().join(' '));
      promoted = true;
      break;
    }
    if (!(await waitForPlayerTurn())) { followed = false; break; }
    // The ghost must still be following this game's White moves; if its
    // reply diverges, the anchor was the other same-named game — retry.
    const ghostSan = moveSans()[moveSans().length - 1];
    if (ghostSan !== game.sans[idx + 1]) { followed = false; break; }
  }
  if (!promoted && followed) console.log(`   attempt ${attempt}: followed ${game.id} but no promotion reached`);
}
check('a promotion was reached and completed in the test games', promoted);

fastTimers = false;
// ---------- TEST C: stale ghost timer after Resign ----------
console.log('== C. Resign while the ghost is thinking ==');
clickBtn('new-game');
await sleep(200);
clickSq('e2'); clickSq('e4');
await sleep(50);
clickBtn('resign');
await sleep(2200);
check('no ghost move after resign', moveSans().length === 1, `moves: ${moveSans().join(' ')}`);
check('resign overlay shown', gameOverVisible() && $('game-over-text').textContent.includes('resigned'));

// ---------- TEST D: Play as Black ----------
console.log('== D. Play as Black ==');
clickBtn('game-over-new'); // dismiss overlay via New game
await sleep(200);
clickBtn('as-black');
const opened = await waitForPlayerTurn(8000);
check('ghost opens as White', opened && moveSans().length === 1, `moves: ${moveSans().join(' ')}`);
check('ghost opening is a book move', $('source-line').textContent.startsWith('Following'), $('source-line').textContent);

fastTimers = true;
// ---------- TEST E: full random game to termination, no errors ----------
console.log('== E. Random game to termination ==');
clickBtn('new-game');
await sleep(200);
let ended = false;
for (let ply = 0; ply < 400; ply++) {
  if (gameOverVisible()) { ended = true; break; }
  const c = mirrorChess();
  if (c.turn() !== 'w') { if (!(await waitForPlayerTurn())) break; continue; }
  const legal = c.moves({ verbose: true });
  if (legal.length === 0) break;
  const mv = legal[Math.floor(Math.random() * legal.length)];
  clickSq(mv.from); clickSq(mv.to);
  await sleep(60);
  if (promoVisible()) {
    document.querySelector('#promotion-modal button[data-piece="q"]')
      .dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await sleep(60);
  }
  if (!(await waitForPlayerTurn())) break;
}
check('game terminated with an overlay', ended && gameOverVisible(), `moves played: ${moveSans().length}`);

// ---------- TEST F: drag and drop + Opera replay restores the live game --
console.log('== F. Drag and drop + Opera replay restore ==');
clickBtn('new-game');
await sleep(200);
if (typeof window.DragEvent === 'function' && typeof window.DataTransfer === 'function') {
  const piece = document.querySelector('.square[data-square="e2"] .piece');
  const dt = new window.DataTransfer();
  piece.dispatchEvent(new window.DragEvent('dragstart', { bubbles: true, dataTransfer: dt }));
  const target = document.querySelector('.square[data-square="e4"]');
  target.dispatchEvent(new window.DragEvent('dragover', { bubbles: true, dataTransfer: dt }));
  target.dispatchEvent(new window.DragEvent('drop', { bubbles: true, dataTransfer: dt }));
  await sleep(60);
  check('drag e2-e4 moves the pawn', moveSans().includes('e4'), moveSans().join(' '));
  check('ghost replies after a drag', await waitForPlayerTurn(), `status: ${$('status').textContent}`);
} else {
  // jsdom has no DragEvent/DataTransfer, so drive the same handlers with
  // plain Events carrying a fake dataTransfer — this still exercises the
  // app's dragstart/drop wiring end to end (the browser's native DnD
  // gesture itself needs a real mouse; see the live playthrough notes).
  const dt = { _d: null, setData(_k, v) { this._d = v; }, getData() { return this._d; } };
  const piece = document.querySelector('.square[data-square="e2"] .piece');
  const start = new window.Event('dragstart', { bubbles: true });
  start.dataTransfer = dt;
  piece.dispatchEvent(start);
  const target = document.querySelector('.square[data-square="e4"]');
  const over = new window.Event('dragover', { bubbles: true });
  over.dataTransfer = dt;
  target.dispatchEvent(over);
  const drop = new window.Event('drop', { bubbles: true });
  drop.dataTransfer = dt;
  target.dispatchEvent(drop);
  await sleep(60);
  check('drag e2-e4 moves the pawn', moveSans().includes('e4'), moveSans().join(' '));
  check('ghost replies after a drag', await waitForPlayerTurn(), `status: ${$('status').textContent}`);
}
const commentBefore = $('commentary').innerHTML;
const sourceBefore = $('source-line').textContent;
const movesBefore = moveSans().join(' ');
clickBtn('replay-opera');
await sleep(100);
for (let i = 0; i < 33; i++) clickBtn('replay-next');
await sleep(100);
check('replay steps through to Rd8#', moveSans().join(' ').includes('Rd8#'), moveSans().join(' '));
check('replay ends in checkmate status', $('status').textContent === 'Checkmate.', $('status').textContent);
clickBtn('replay-exit');
await sleep(100);
check('exit replay restores the live moves', moveSans().join(' ') === movesBefore, moveSans().join(' '));
check('exit replay restores the commentary', $('commentary').innerHTML === commentBefore);
check('exit replay restores the source line', $('source-line').textContent === sourceBefore);

check('no JS errors during the whole UI run', jsErrors.length === 0, jsErrors.join(' | ').slice(0, 300));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
