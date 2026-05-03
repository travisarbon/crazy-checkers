# Stacking Draughts — Engine Rules Notes (Task 29.1)

Authoritative rules for Lasca and Bashni live in
`Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md`
(§3.2, §4.3, §4.4). This file documents engine-level decisions where the
implementation departs from the playbook's prose, and pins the citations that
back the hand-verified fixtures.

---

## 1. Array convention — bottom-first

Towers are stored as `readonly StackingPiece[]` with `pieces[0]` = the
deepest prisoner and `pieces[length - 1]` = the commander. This convention
matches `src/ui/piece/StackPiece.tsx`, which already reads
`stack[stack.length - 1]` as the top piece.

The Tier 2 playbook §3.2 nominally describes the opposite ordering ("index 0
= top"). Per the Task 29.1 plan §3 we align engine to renderer, not vice
versa: the renderer is shipped UI surface and re-orienting it would ripple
through `PieceRegistry`, `describePiece`, `StackPieceProps`, and the test
suite for Task 27.5. The engine's array convention is the cheaper side to
flex.

A future `StackPiece` evolution that flips the renderer convention would
require flipping the constants here as well — a single source of truth.

## 2. Promotion on capture-arrival

Both Lasca and Bashni promote a man whose chain ends on its promotion row,
regardless of whether the move was a step or a capture. The playbook §4.3
and §4.4 do not carve out an exception, and Lasca/Bashni canonical rule
sources (Lasker, "Lasca: The Game" 1911; Bashni — Russian regional draughts
tradition) are consistent with this reading. Therefore:

- A man that lands on its promotion row via step → promote.
- A man that lands on its promotion row at the end of a capture chain →
  promote.
- A man that crosses through (but does not end on) its promotion row mid
  Bashni capture chain → promote mid-chain (Bashni `midCapturePromotion:
  true`), then continues with king mechanics. The promotion square is
  recorded in `move.meta.promotionSquare`.
- Lasca has `midCapturePromotion: false`: a Lasca commander that crosses
  the king row mid-chain stays a man. Promotion only fires when the
  chain's terminal landing is on the king row.

## 3. Zobrist commander-only approximation

`stackingZobrist.ts` hashes only the commander (top piece) at each square.
Prisoners are intentionally ignored (playbook §5.5). Consequence: two
positions with identical commanders but different prisoner stacks collide
under the same Zobrist key, and the threefold-repetition check treats them
as the same position.

We accept the approximation because the alternative — hashing the full tower
composition — would explode the table size to `4^maxHeight` per square. In
the corner case where a contrived sequence reaches the same commander-only
key three times with different prisoner makeup, the engine will declare a
draw even though the positions are tactically distinct.

A unit test (`stackingZobrist.test.ts`) explicitly asserts the conflation so
maintainers see the limit in coverage. If a future tier task requires exact
repetition, the seam is `hashPosition`/`incrementRepetition` only — swap in
a tower-aware hash without touching consumers.

## 4. Stack-aware capture mechanics

When a tower captures another tower:

1. The captured tower's commander is **lifted** (removed from its top).
2. The lifted piece is **attached to the bottom** of the capturing tower as
   a prisoner. Bottom-first array means
   `capturing.pieces = [capturedCommander, ...capturing.pieces]`.
3. The captured-square's **remainder** keeps the rest of the tower at the
   square; the new commander is the next piece down. The square's owner
   may now differ from the previous owner — this is the unique
   "allegiance switching" mechanic of stacking draughts.
4. If the captured tower had height 1, the square becomes empty.

The capturing tower then moves from `from` to the chain's final landing.
For multi-jump chains, every leg follows the same lift/attach/reform pattern,
in chain order.

## 5. 50-move rule — not implemented

Neither Lasca nor Bashni canonical rule sources cite a 50-move rule. The
engine deliberately does not implement one. `StackingMeta.halfMoveClock`
exists for diagnostics but does not contribute to `gameOver`. If a Tier 2
re-review concludes a 50-move rule is appropriate, the seam is
`gameOver.ts`'s `checkStackingGameOver` only.

## 6. 7×7 board — handcrafted geometry

Lasca uses a 7×7 board with 25 dark squares (parity 0: bottom-left corner
is dark/playable). The shared `SquareAdjacency` and `SquareCoordinates`
helpers in `src/engine/adjacency/` and `src/engine/coordinates/` hardcode
parity 1 (matching American/Russian/International dark-square layouts on
even-sized boards). Rather than retrofit those helpers (out of scope for
Task 29.1), the stacking module hand-builds Lasca's geometry in
`boardGeometry.ts`. Bashni's 8×8 reuses the shared `squareGeometry` helper
unchanged.

A future Task 29.G.3-B (Lasca per-game subtask) may choose to lift the
hand-built 7×7 geometry into `boardGeometry.ts` proper if other 7×7 boards
ever join the library.

## 7. Forward-compatibility for Tier 4 Tak (Task 31.4)

Task 31.4 plans to extend `StackState` for Tak's stacking (with
`flat | wall | capstone` piece types). Task 29.1 keeps the `StackingPiece`
shape open: the layer kind is `'man' | 'king'` for v1, but the `StackState`
container is a generic `readonly StackingPiece[]`. Extending the layer type
to `'flat' | 'wall' | 'capstone'` is a structural addition (a new type
union) rather than a refactor — `StackState` itself need not change.

## 8. Citations

- Lasker, Emanuel. *Lasca: The Game.* 1911. Lasca rules summary; man-only
  back-line forfeit not implemented (Tier 2 playbook §4.3 does not require
  it).
- Tier 2 Classified Playbook §4.3 (Lasca), §4.4 (Bashni), §5.5 (Zobrist
  approximation), §7.2 (tower text serialization).
- Russian Draughts canonical rule set (mid-capture promotion + flying king)
  — Bashni inherits these on top of the stacking mechanic.
- StackPiece.tsx (Task 27.5) — the renderer ships with the bottom-first
  array convention.

---

## Tricky positions covered by hand-verified fixtures

Per Task 29.1 acceptance, fixtures cover ≥200 positions (100+ Lasca, 100+
Bashni). The "tricky" subset that exercises the engine's seams:

| ID | Game | Scenario |
|---|---|---|
| L-T1 | Lasca | Tower of height 4 with mixed allegiance — capturing the top liberates a black-led remainder |
| L-T2 | Lasca | Mandatory-maximum forces choosing a triple over a single |
| L-T3 | Lasca | Man cannot capture backward — backward-jump candidate is suppressed |
| L-T4 | Lasca | Promotion fires at terminal landing of a capture chain |
| L-T5 | Lasca | King's omnidirectional capture from a corner |
| L-T6 | Lasca | Capturing tower itself becomes a height-2 tower of mixed allegiance after the move |
| B-T1 | Bashni | Backward-capture by a man |
| B-T2 | Bashni | Mid-chain promotion: man → king mid-leg, then captures with flying range on the next leg |
| B-T3 | Bashni | Flying-king ray jump: jumps a tower seven squares away, lands two squares past it |
| B-T4 | Bashni | Player chooses a non-maximal sub-chain (allowed because `maximumCaptureMandatory: false`) |
| B-T5 | Bashni | Capture chain returns to origin square (flying king loop) |
| B-T6 | Bashni | Tower switches allegiance, then becomes a re-capture target on opponent's turn |
