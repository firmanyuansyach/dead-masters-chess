// commentary.js — the ghost's voice.
//
// Era-flavoured, courteous, lightly theatrical. Pure functions of game
// state: given a situation, return one line. The ghost never claims an
// engine move is Morphy's — book lines name their game, engine lines say
// plainly that the move is the ghost's own.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function greeting(playerIsBlack) {
  return pick([
    'Ah — a visitor. The candles are lit, the board is set. Shall we play, as in the old days?',
    'Welcome to my hall. I have waited a hundred and sixty-eight years for a game. Do not keep me waiting longer.',
    'Sit. The pieces remember me, even if the world has forgotten. White or Black — the board does not mind.',
  ]) + (playerIsBlack ? ' You take Black, then — I shall open, as I did in Paris.' : ' You have White. The first move is yours, as it should be.');
}

export function bookLine(game, opening) {
  const where = game ? ` — ${game}` : '';
  const what = opening ? `, the ${opening}` : '';
  return pick([
    `This path I know. I walked it before${what}${where}.`,
    `Ah, an old road. I played this very move${where}.`,
    `The books remember this one${what}${where}. So do I.`,
    `I have sat at this board before${where}. The move plays itself.`,
  ]);
}

export function offBookLine() {
  return pick([
    'Here the old books end. From this square onward, I must think for myself — as I did in life, when the line ran out.',
    'You have led me off my recorded games. Very well. The ghost shall improvise.',
    'No book holds this position. Then we play living chess, you and I.',
  ]);
}

export function captureLine(pieceName, byGhost) {
  if (byGhost) {
    return pick([
      `Your ${pieceName} is mine. In my day, we called that development.`,
      `A ${pieceName} falls. The hall approves — listen, the candles flicker.`,
      `I take the ${pieceName}. Forgive the abruptness; the position demanded it.`,
    ]);
  }
  return pick([
    `Well taken. You play with spirit — I approve of spirit.`,
    `My ${pieceName} is gone. A fair exchange of courtesies, I suppose.`,
    `Bold. The old masters would have raised an eyebrow — then nodded.`,
  ]);
}

export function checkLine(byGhost) {
  if (byGhost) {
    return pick([
      'Check. Your king must answer — kings always must.',
      'Check, my friend. The net draws a little tighter.',
    ]);
  }
  return pick([
    'Check! Ha — you have the nerve. I shall answer with care.',
    'My king is called to account. Well played.',
  ]);
}

export function winLine() {
  return pick([
    'Checkmate. The hall falls silent, as it did in Paris in \u201958. You played bravely — the board simply remembered me better.',
    'Mate. Do not grieve: I once beat two noblemen at once while an opera sang behind me. You are in storied company.',
  ]);
}

export function loseLine() {
  return pick([
    'Checkmate — and against me! The candles burn a little brighter tonight. You have beaten a ghost, and ghosts do not forget such things.',
    'You win. A hundred and sixty-eight years, and still the game finds a way to surprise me. Bravo.',
  ]);
}

export function drawLine(reason) {
  return `A draw — ${reason}. Even ghosts must sometimes share the honours.`;
}

export function resignLine() {
  return 'You resign? The board will keep your secret. Come back when the candles are lit again.';
}

export function operaIntro() {
  return 'Paris, autumn 1858. In a box at the opera, I faced the Duke of Brunswick and Count Isouard — two noblemen, consulting together, against one American of twenty-one. The overture was playing. This is how it went.';
}
