// playtest.mjs — headless self-play tests for Dead Master's Chess.
// Plain node, no framework. Exit code 0 = all pass.
// Checks: Opera Game replays exactly; full legal self-play games terminate;
// book lookup works on-book; engine finds mate-in-1; draw detection works.
import { Chess } from '../src/chess.js';
import { ghostMove, bookKey } from '../src/ghost.js';
import fs from 'node:fs';

const book = JSON.parse(fs.readFileSync(new URL('../data/book.json', import.meta.url), 'utf8'));
const games = JSON.parse(fs.readFileSync(new URL('../data/games.json', import.meta.url), 'utf8'));

let passed = 0;
let failed = 0;
function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('== 1. Opera Game replays exactly ==');
{
  const opera = games.find(g => /Brunswick|Isouard|Braunschweig/i.test(g.black || ''));
  check('opera game found in dataset', !!opera);
  const c = new Chess();
  let ok = true;
  for (const san of opera.sans) {
    try { c.move(san); } catch { ok = false; console.log('   illegal at:', san); break; }
  }
  check('all 33 plies legal', ok);
  check('opera ends in checkmate', c.isCheckmate(), `isCheckmate=${c.isCheckmate()}`);
  check('opera result is 1-0', opera.result === '1-0');
  check('opera last move is Rd8#', opera.sans[opera.sans.length - 1] === 'Rd8#');
}

console.log('== 2. Book lookup ==');
{
  const c = new Chess();
  c.move('e4'); c.move('e5');
  const key = bookKey(c.fen());
  check('position after 1.e4 e5 is in the book', Array.isArray(book[key]) && book[key].length > 0);
  const d = ghostMove(c, book);
  check('ghost answers from the book', d && d.source === 'book', `source=${d && d.source}`);
  check('book move carries its game', !!(d && d.game && /Morphy/.test(d.game)), `game=${d && d.game}`);
  check('book move carries a game id', !!(d && d.gameId), `gameId=${d && d.gameId}`);
  // Off-book position: 1.a3 a6 2.h3 h6 3.a4 a5 — unlikely in Morphy's book
  const c2 = new Chess();
  for (const m of ['a3', 'a6', 'h3', 'h6', 'a4', 'a5']) c2.move(m);
  const d2 = ghostMove(c2, book);
  check('ghost falls back to engine off-book', d2 && d2.source === 'engine', `source=${d2 && d2.source}`);
}

console.log('== 3. Engine finds mate in 1 (fool\u2019s mate) ==');
{
  const c = new Chess();
  c.move('f3'); c.move('e5'); c.move('g4');
  const d = ghostMove(c, book);
  check('ghost plays Qh4#', d && d.san === 'Qh4#', `san=${d && d.san}`);
  c.move(d.san);
  check('position is checkmate', c.isCheckmate());
}

console.log('== 4. Draw detection ==');
{
  const c = new Chess('8/8/4k3/8/8/4K3/8/8 w - - 0 1');
  check('bare kings = insufficient material draw', c.isDraw() && c.isInsufficientMaterial());
  const s = new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
  check('stalemate detected', s.isStalemate());
}

console.log('== 5. Self-play: 6 full games, random player vs ghost ==');
{
  let bookHits = 0;
  let ghostMoves = 0;
  let finished = 0;
  for (let g = 0; g < 6; g++) {
    const c = new Chess();
    const anchor = { gameId: null }; // same anchor object the app uses
    let plies = 0;
    while (!c.isGameOver() && plies < 120) {
      if (c.turn() === 'w') {
        const moves = c.moves();
        // Game 0 opens 1.e4 on purpose: the ghost's reply is then a book
        // move by construction, so the book-hit check below is
        // deterministic instead of depending on random play stumbling
        // into a Morphy line (which happens ~1% of the time).
        const mv = (g === 0 && plies === 0) ? 'e4' : moves[Math.floor(Math.random() * moves.length)];
        c.move(mv);
      } else {
        const before = c.fen();
        const d = ghostMove(c, book, anchor);
        if (c.fen() !== before) { failed++; console.log(`   FAIL game ${g} ghost corrupted the board`); }
        if (!d) break;
        ghostMoves++;
        if (d.source === 'book') bookHits++;
        c.move({ from: d.from, to: d.to, promotion: d.promotion });
      }
      plies++;
    }
    if (c.isGameOver()) finished++;
    else console.log(`   game ${g} reached the 120-ply cap without terminating (${c.isDraw() ? 'drawish' : 'still playing'})`);
  }
  console.log(`   games terminated: ${finished}/6`);
  check('at least half the games terminated', finished >= 3, `finished=${finished}`);
  console.log(`   ghost moves: ${ghostMoves}, book hits: ${bookHits} (${(100 * bookHits / Math.max(1, ghostMoves)).toFixed(0)}% on-book)`);
  check('ghost played at least one book move', bookHits > 0);
  check('ghost played at least one engine move', ghostMoves - bookHits > 0);
}

console.log('== 6. Ghost as White (player takes Black) ==');
{
  const c = new Chess();
  const d = ghostMove(c, book);
  check('ghost opens from the book as White', d && d.source === 'book' && d.san === 'e4', `san=${d && d.san} source=${d && d.source}`);
}

console.log('== 7a. Anchored: ghost follows the recorded Lowenthal game ==');
{
  // The ghost anchors to ONE recorded game (G018, Lowenthal vs Morphy,
  // Paris 1858, 160 plies) and must play that game's move on every reply.
  // This is the strict test: the anchor is fixed before the first reply.
  const game = games
    .filter(g => g.morphyColor === 'b')
    .sort((a, b) => b.plies - a.plies)[0];
  const c = new Chess();
  const anchor = { gameId: game.id };
  let replies = 0;
  let ok = true;
  for (let i = 0; i < game.sans.length; i++) {
    if (i % 2 === 0) {
      try { c.move(game.sans[i]); } catch { ok = false; console.log('   recorded white move illegal:', game.sans[i]); break; }
    } else {
      const d = ghostMove(c, book, anchor);
      if (!d || d.source !== 'book' || d.san !== game.sans[i] || d.gameId !== game.id || anchor.gameId !== game.id) {
        ok = false;
        console.log(`   ghost deviated at ply ${i}: played ${d && d.san} (${d && d.source}, game ${d && d.gameId}), record says ${game.sans[i]} (${game.id})`);
        break;
      }
      replies++;
      try { c.move({ from: d.from, to: d.to, promotion: d.promotion }); } catch { ok = false; console.log('   ghost move illegal:', d.san); break; }
    }
  }
  check('ghost played the recorded move on every reply', ok && replies === game.plies / 2, `replies=${replies}/${game.plies / 2}`);
  console.log(`   game: ${game.white} vs ${game.black}, ${game.date}, ${game.plies} plies, result ${game.result}`);
}

console.log('== 7b. Free play: ghost never switches games mid-line ==');
{
  // No anchor given: the ghost picks a game on its first book reply, then
  // must stay on that game's line. It may re-anchor ONLY when the player's
  // move leaves the anchored game's line. The player replays the Lowenthal
  // game's White moves while they are legal.
  const game = games
    .filter(g => g.morphyColor === 'b')
    .sort((a, b) => b.plies - a.plies)[0];
  const byId = (id) => games.find(g => g.id === id);
  // The anchored game's continuation from a position (by FEN): which SAN
  // does that game play next from here, or null if it never reached here.
  const continuationOf = (g, fen4) => {
    const cc = new Chess();
    for (let j = 0; j < g.sans.length; j++) {
      if (bookKey(cc.fen()) === fen4) return g.sans[j];
      cc.move(g.sans[j]);
    }
    return null;
  };
  const c = new Chess();
  const anchor = { gameId: null };
  let prevGameId = null;
  let fenBeforeWhite = '';
  let sanWhite = '';
  let replies = 0;
  let ok = true;
  for (let i = 0; i < game.sans.length && !c.isGameOver(); i++) {
    if (i % 2 === 0) {
      if (!c.moves().includes(game.sans[i])) break; // player left every line
      fenBeforeWhite = bookKey(c.fen());
      sanWhite = game.sans[i];
      c.move(sanWhite);
    } else {
      const d = ghostMove(c, book, anchor);
      if (!d) break;
      replies++;
      if (d.source !== 'book') break; // off-book: streak ends, not a failure
      if (prevGameId && d.gameId !== prevGameId) {
        const cont = continuationOf(byId(prevGameId), fenBeforeWhite);
        if (cont === sanWhite) {
          ok = false;
          console.log(`   ghost switched games while still on ${prevGameId}'s line at ply ${i}: ${prevGameId} -> ${d.gameId}`);
          break;
        }
        // else: the player left the anchored line — re-anchor is legitimate
      }
      prevGameId = d.gameId;
      try { c.move({ from: d.from, to: d.to, promotion: d.promotion }); } catch { ok = false; console.log('   ghost move illegal:', d.san); break; }
    }
  }
  check('ghost stayed on one game until the player left its line', ok && replies > 0, `book replies=${replies}, final game=${prevGameId}`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
