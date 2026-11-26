# How Kiro was used — Dead Master's Chess

Kiroween 2026 requires the project to be built with Kiro and the repo to
carry `/.kiro` (specs, hooks, steering) at its root. This file is the
running log of genuine Kiro use. Kiro Free tier is 50 credits/month, so
every CLI session was short, scoped, and logged here.

## What Kiro produced

- **`.kiro/specs/dead-masters-chess/`** — requirements.md (22 EARS-style
  requirements), design.md (architecture, ghost algorithm, data schemas,
  state machine), tasks.md (12-item checklist). Authored by Kiro CLI in a
  single non-interactive session (burst 1, 2026-11-25), from a brief that
  stated the verified facts (216 validated games, 6,020 book positions,
  hard gates, file layout). The build then followed that spec item by item.
- **`.kiro/steering/`** — product.md, tech.md, structure.md. Written by
  hand before burst 1 so Kiro's spec matched the intended product; Kiro
  read them when authoring the spec.
- **`.kiro/hooks/dataset-validation.json`** — hook config: the Morphy
  dataset must be re-validated by replaying every game through chess.js
  (`../build-book.mjs`) whenever the data is regenerated. The validator
  itself was written by hand; the hook declares the rule Kiro enforces.

## Kiro CLI sessions (all on Firman's account, firmanyuansyach123@gmail.com)

| # | When (WIB) | What was asked | What Kiro did |
|---|------------|----------------|---------------|
| 1 | 2026-11-25 ~17:05 | `--effort low`, non-interactive: write requirements.md, design.md, tasks.md from the verified brief | Wrote all three files (492 lines). No other file touched. |
| 2 | 2026-11-25 ~17:20 | `--effort low`, non-interactive: review src/ghost.js + src/app.js for bugs (board corruption, promotion, game-end, replay, IDs, GitHub Pages) | Verdict FIX-FIRST, 2 blockers + 3 minors. Blockers: (a) move/undo discipline in search/quiescence — a throw mid-search could leave the board advanced; (b) unguarded `chess.move()` in `ghostReply` — a throw would strand the game on the ghost's turn. Both fixed the same day and re-tested (18/18 playtest pass). Minors fixed too: replay-finale commentary repeating, redundant render, resign button staying enabled after game over. |

## What Kiro did NOT do

- The game code (`src/ghost.js`, `src/commentary.js`, `src/app.js`,
  `index.html`, `styles.css`), the dataset builder (`../build-book.mjs`),
  and the playtest suite (`tests/playtest.mjs`) were written by hand and
  tested headlessly (18/18 assertions pass, including a full 160-ply
  recorded game verified move-by-move against the book). Kiro's role was
  specification and independent review — the two places where a second
  mind changes the outcome most.
- No Kiro Crew, MCP servers, or custom agents were used. No Kiro IDE:
  the sandbox has no desktop surface; all Kiro use went through the CLI.
- The game-anchoring fix (2026-11-25 ~17:50, after Firman's "lanjut
  kiroween") was built and tested by hand, no Kiro session: the book now
  carries per-game entries, `ghostMove` anchors to one recorded game, and
  the playtest enforces it (7a/7b). The design.md algorithm section was
  amended by hand to match.
- The evening polish round (2026-11-25 ~21:00, Firman's "poles sekarang")
  was built and tested by hand — vignette/candle glow, last-move and
  check highlights, capture flash, touch drag, sound toggle, move-list
  Morphy sources — and then given one short low-effort CLI review burst
  (burst 3). Kiro's verdict was FIX-FIRST on one point (moveSources
  pushed before chess.move), which turned out to be a misread on
  re-check: the push sits after the successful move, inside the
  try/catch's success path. No code change came out of burst 3 except a
  small mobile button-width tidy it also flagged. UI suite grew to 36
  checks for the polish; headless suite unchanged at 20/20.

## Credit note

Built on the Kiro Free tier (50 credits/month). Three short low-effort CLI
sessions; no credit request was filed (per Firman's decision, 2026-11-20).
