# Product steering — Dead Master's Chess

## What it is
A single-page web game: play chess against the ghost of Paul Morphy
(1837–1884) in a haunted hall. Costume Contest entry for Kiroween 2026.

## The one idea that must survive
The ghost is not a generic engine. While the game follows a line Morphy
actually played, the ghost plays **Morphy's own recorded moves** from his
real games, and the UI says which game each move came from. Off-book, the
ghost falls back to its own small engine and the UI says so honestly — it
never passes an engine move off as Morphy's.

## Audience
Casual chess players and hackathon judges. Most will play 5–15 moves.
The first 10 seconds must show: a beautiful board, the ghost, and the fact
that its moves are real history.

## Tone
Gothic but warm, not horror. Candlelight, dark wood, gold leaf. The ghost
speaks like a courteous 19th-century gentleman, lightly theatrical, never
mocking the player. Era-flavoured, plain English, no fake archaic "thee/thou".

## Non-goals
- No accounts, no backend, no multiplayer, no timers/clocks.
- No sound by default (a toggle may come later; never autoplay).
- No external assets at runtime: the app must work from a static host with
  no network beyond the page itself.
