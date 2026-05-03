# Alquerque Engine — Rules Notes (Task 29.3)

Authoritative rules for Zamma live in
`Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md`
(§3.5 engine architecture, §4.5 Zamma rule table, §5.2 alquerque topology,
§5.5 Zobrist sizing). This file documents engine-level decisions where the
implementation departs from the playbook's prose, and pins citations that
back the hand-verified fixtures.

---

## 1. Diagonal pattern — alternating

Per playbook §5.2, Zamma's alquerque grid carries diagonal lines only at
nodes where `(r + c) % 2 === 0` (the "alternating" pattern). Parity is
preserved across diagonal moves (`(r ± 1) + (c ± 1) ≡ r + c (mod 2)`), so
testing the predicate on a single endpoint suffices.

This engine encodes the decision as
`AlquerqueConfig.diagonalPattern = 'alternating'` and the underlying
adjacency module is keyed by the same flag. If a future authoritative source
mandates full diagonals everywhere, flip the config to `'full'` — both the
adjacency builder and the move generator already support it.

The alternative-source reading is preserved at the adjacency layer for
downstream consumers (Bagh-Chal, hypothetical full-diag Zamma variants).

## 2. Forward-only man movement and capture

Per playbook §4.5: men move "forward along connected lines: orthogonally
forward or diagonally forward." Engine encoding:
- `menMovementDirections = ['N', 'NE', 'NW']` (white; mirrored for black via
  `mirrorForOwner`).
- `menCaptureDirections = ['N', 'NE', 'NW']` (default; some Zamma sources
  allow backward captures, hence the field is parameterised).

The forward-only default keeps the engine aligned with the simpler reading
of playbook §4.5. A future source-driven swap is one config-line change.

## 3. Mullah promotion — terminal landing only

Per playbook §4.5: "Man reaching the opponent's back row promotes to
Mullah." The playbook does not specify whether mid-chain landings on the
king row trigger promotion mid-chain (Bashni / Russian Draughts style) or
only on terminal landing (Lasca / American Rules style). We default to
**terminal-only promotion** per the simpler reading and `Lasca`-alignment.

Engine encoding: `AlquerqueConfig.midChainPromotion = false`. The flag is
parameterised so a future source flips one field rather than refactoring
the engine.

A man who lands on its promotion row at the END of a chain (terminal
landing) DOES promote, regardless of the mid-chain-promotion flag.

## 4. Mullah movement — short-range default

Per playbook §4.5: "Mullah (flying piece that can move in any direction
along connected lines)." The "flying" qualifier in parenthesis suggests
Mullahs may slide any distance along a single incident line; the more
general reading "moves in any direction along connected lines" without
"flying" suggests short-range single-step movement.

This engine defaults to **short-range Mullahs**: a Mullah moves exactly one
intersection per move (in any of 8 directions, subject to the diagonal
pattern). Encoded as `AlquerqueConfig.mullahFlying = false`. A future
flying-Mullah variant flips the flag; the move generator already walks rays
when the flag is true.

Mullahs DO ignore the men's forward-only movement constraint — they can
step (and capture) backward.

## 5. Capture obligation + max-mandatory

Per playbook §4.5: capture is obligatory. The playbook is silent on
maximum-capture-mandatory.

Engine encoding:
- `captureObligatory = true` — when captures exist, simple steps are
  dropped from the legal-move list.
- `maximumCaptureMandatory = false` (default for Zamma; flippable). The
  player may pick any legal capture chain.

When the knob is on, the move generator prunes to chains whose
`capture.length` equals the maximum. Per the playbook "a man and a Mullah
both count as one piece" — so capture weight is just `capture.length`.

## 6. Deferred victim removal

Per playbook §3.5 + §4.5: captured pieces are removed only after the entire
multi-jump chain commits. The engine tracks already-jumped intersections in
`frame.capturedSet` during exploration; the same victim cannot be jumped
twice. Victims remain in `state.pieces` during exploration, which means
they naturally block any landing attempt past them.

This aligns Zamma with Tier 2's Dameo (Task 29.2) deferred-removal
convention. Tier 1's American/Russian draughts removes during exploration;
the difference is documented in each engine's RULES_NOTES.

## 7. Stalemate = loss

Per the project-wide convention (American Rules, Tier 1 Russian/Italian/
International, Tier 2 Lasca/Bashni/Dameo): a side that has pieces but no
legal moves on its turn loses. Encoded directly in
`gameOver.checkAlquerqueGameOver`.

## 8. 50-move rule — not implemented

Playbook §4.5 does not define a 50-move rule for Zamma. The engine
deliberately does not implement one. `AlquerqueMeta.halfMoveClock` exists
for diagnostics but does not contribute to `gameOver`.

## 9. Zobrist table — 81 × 4 = 324 entries

Per playbook §5.5: Zamma's Zobrist table sizes to "81 × 4 = 324 entries."
The engine matches: 81 intersections × {white-man, white-mullah, black-man,
black-mullah}. Plus a single side-to-move parity bit. Fixed splitmix64
seed; rebuilding the AI worker reconstructs identical tables.

## 10. Reuse target — Bagh-Chal, Morabaraba

The engine modules import `AlquerqueConfig` only — no `if (config.gameId
=== 'zamma')` branches. Adding Bagh-Chal at Expansion Tier 9 is expected to
be additive: new fields on `AlquerqueConfig` for Tigers/Goats roles and
Goat placement-phase, a 5×5 board geometry via the same
`alquerqueGeometry()` factory, and a new helper for the 5-Goat capture-win
condition.

Morabaraba (Wave 3 Mill family) imports the
`buildAlquerqueAdjacency`'s diagonal-pattern logic to layer corner
diagonals onto the NMM ring topology. The adjacency module is intentionally
scoped narrowly so Morabaraba can call into the alternating-diagonal
predicate (`alternatingDiagonalAt`) without depending on the full Zamma
stack.

## 11. Citations

- Tier 2 Classified Playbook §3.5 (AlquerqueGeometry concept), §4.5 (Zamma
  rule table), §5.2 (alquerque topology with the alternating-diagonal
  pattern), §5.5 (Zobrist sizing).
- Murray, *History of Board-Games Other Than Chess* — Zamma chapter;
  consulted for the "forward-only" reading of men movement and the
  "Mullah" terminology.
- `src/engine/adjacency/RectangleAdjacency.ts::fanoronaDiagonalsMask` —
  precedent for an alternating-diagonal predicate inside a square-ish
  adjacency builder.

---

## Tricky positions covered by hand-verified fixtures

| ID  | Scenario |
|---  |---|
| Z-T1 | Center intersection (4, 4) — 4 orthogonal + 4 diagonal incident lines |
| Z-T2 | Corner intersection (0, 0) — 2 orthogonal + 1 diagonal |
| Z-T3 | "No-diagonals" interior intersection (2, 3) — 4 orthogonal + 0 diagonal |
| Z-T4 | Man at no-diagonal node attempting diagonal jump → 0 captures |
| Z-T5 | Man at has-diagonals node performing a diagonal jump → 1 capture |
| Z-T6 | Multi-jump chain along orthogonal line (2 jumps) |
| Z-T7 | Multi-jump chain mixing orthogonal + diagonal legs |
| Z-T8 | Capture chain forbidden from re-jumping a previously-jumped victim |
| Z-T9 | Promotion at terminal step-arrival on opponent's back row |
| Z-T10 | Promotion at terminal capture-arrival on opponent's back row |
| Z-T11 | No promotion mid-chain (default `midChainPromotion: false`) |
| Z-T12 | Capture obligation suppresses simple steps when captures exist |
| Z-T13 | Mullah moves backward (Mullah ignores men's forward-only constraint) |
| Z-T14 | Mullah captures backward |
| Z-T15 | Trapezoid starting position legal-move count (deterministic spot-check) |
