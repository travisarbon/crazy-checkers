# Custodian-Capture Engine — Rules Notes (Task 29.4)

Authoritative rules for Mak-yek, Hasami Shogi, Rek, and Dai Hasami Shogi
live in `Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md`
(§3.3 engine architecture, §4.6/4.7/4.8/4.9 per-game rule tables, §5.5
Zobrist sizing, §13.1 unit-test catalog). This file documents engine-level
decisions where the implementation departs from the playbook's prose, and
pins citations that back the hand-verified fixtures.

---

## 1. Capture-mode resolution order

When a move triggers multiple capture modes simultaneously, the engine
resolves them in the following order:

1. **custodian** (or **line** if `lineCapture: 'whole-line'`) — single-piece
   sandwich pattern (ABA) or whole enemy line between two friendlies.
2. **intervention** — two-axis BFB pattern; both opposing-direction
   neighbors are opponents.
3. **corner** — opponent in one of the four geometric corners with both
   orthogonal neighbors friendly.
4. (Stage-2 victims removed atomically.)
5. **immobilization** — runs against the post-stage-2 state.

Steps 1–3 (and the alternate `'whole-line'` step 1) read the post-move
state and resolve simultaneously — their victims are unioned and removed
in one batch. Immobilization (Rek) runs AFTER that batch to capture
opponent groups that are now fully blocked. This matches the natural
reading "captures resolve first, then check who's now stuck."

## 2. Mak-yek line-capture interpretation

The Phase 4 plan and the Tier 2 playbook §4.6 disagree on the meaning of
"line capture":

- **Playbook §4.6 (default):** custodian = one piece (ABA), intervention =
  two pieces (BFB). Maximum 3 captures per move.
- **Plan §1.1 alternate:** "any contiguous line of enemies sandwiched
  between two friendlies is captured."

The engine encodes the choice as `CustodianConfig.capture.lineCapture:
'single-piece' | 'whole-line'`. Default for Mak-yek is `'single-piece'`
per the playbook. Both branches are unit-tested independently. A future
authoritative source flips the field.

## 3. Rek immobilization-scope interpretation

Playbook §4.8 + Open Question 3 surface ambiguity over per-piece vs.
per-group immobilization:

- **Playbook §4.8 (default):** group-aware. A connected component of
  same-color pieces with zero legal moves across the entire group is
  captured atomically.
- **Open Question 3 alternate:** per-piece. A piece is captured iff its
  individual legal-moves count is zero.

The engine encodes the choice as `CustodianConfig.capture.immobilizationScope:
'piece' | 'group'`. Default for Rek is `'group'` per the playbook. Both
branches are unit-tested.

The flood-fill helper that defines connected components (
`connectedComponents.ts::findConnectedComponents`) is exposed under a
stable name so per-game subtask 29.G.8-B can reuse it for the
immobilization-warning overlay.

## 4. Dai Hasami line-formation excludes own starting ranks

Per playbook §4.9: "the 5-in-a-row must lie entirely OUTSIDE the player's
own starting two rows to count as a win." Encoded as
`CustodianConfig.winCondition.excludeOwnStartingRanks: 2`.

For white (starts at rows 0..1), valid 5-in-a-row lines must lie in rows
2..8. For black (starts at rows 7..8 on the 9×9 board), valid lines must
lie in rows 0..6. A line that straddles the boundary (one square inside,
four outside) IS counted because at least one square is non-excluded. Only
lines whose every square is excluded are dropped.

The `nInARow.ts` helper is local to Task 29.4 and earmarked for
de-duplication with Tier 4 Task 31.2's Gomoku-grade implementation
(`@dedupe-with` comment in the helper).

## 5. No capture obligation

All four custodian games omit capture obligation. `getLegalMoves` returns
the union of all slides and (for Dai Hasami) jumps regardless of whether
captures are available.

This is a structural difference from draughts-family games (Tier 1, Tasks
29.1, 29.2, 29.3) which all enforce capture obligation. The custodian
engine never invokes a "capture-or-step" filter.

## 6. Dai Hasami's non-capturing single-jump

Per playbook §4.9: "Multiple jumps in a single turn are NOT allowed." The
move generator emits at most one `'jump'` move per origin (one per direction)
and never recurses. After a `'jump'` move's `applyMove`, the resulting
state has no further jump available from the new landing for the same
turn — turn ownership has already toggled.

## 7. Rek's King hashes distinctly from a Man

Per playbook §5.5 + Task 29.4 plan §8: the Zobrist table allocates
`{white-man, white-king, black-man, black-king}` slots per square. Rek's
King hashes to a different table entry from a Man at the same square —
this is **deliberate** for repetition correctness.

Two positions identical except that one has a King at e4 and the other
has a Man at e4 are NOT structurally equivalent (the King's identity
matters for the `'capture-king'` win condition). They MUST hash
differently or threefold-repetition would mis-fire.

## 8. Rek King column convention

Playbook §4.8: "Kings are placed crosswise on the 2nd and 7th ranks (each
player places their King on the rank behind their Men, to the left or
right — exact column varies by convention)."

Per Task 29.4 plan §19.3 the engine defaults to:
- White King at row 1 (rank between rows 0 and 2 of Men), file 0 (a-file).
- Black King at row 6, file 7.

Encoded in `rekConfig.startingPosition.kings`. A future authoritative
Cambodian-source consultation can flip the placement via a single config
edit (a TODO note exists in `rekConfig.ts`).

A man slot must be reserved (not filled with a Man) to make room for the
King in the men-rank zone — encoded via `menGapsForKing`.

## 9. 50-move rule — not implemented

None of the four games defines a 50-move rule. The engine does not
implement one. `CustodianMeta.halfMoveClock` exists for diagnostics but
does not contribute to `gameOver`.

## 10. Stalemate is a loss

Per project-wide convention. Encoded as
`CustodianConfig.stalemateIsLoss: true` (locked at the type level). All
four games inherit this.

## 11. Citations

- Tier 2 Classified Playbook §3.3 (engine architecture), §4.6 (Mak-yek),
  §4.7 (Hasami Shogi), §4.8 (Rek), §4.9 (Dai Hasami Shogi), §5.5
  (Zobrist), §15 (Open Question 3 Rek immobilization scope).
- Phase 4 Implementation Plan §Task 29.4 (engine deliverable definition).
- `src/engine/classified/{stacking,linear,alquerque}/*` — Tier 2 engine-
  author template precedent.

---

## Tricky positions covered by hand-verified fixtures

| ID  | Game | Scenario |
|---  |---|---|
| MY-T1 | Mak-yek | Single-direction custodian capture (ABA) |
| MY-T2 | Mak-yek | Two-direction custodian capture from a single move (max 2 + intervention 0) |
| MY-T3 | Mak-yek | Custodian + intervention combined for 3 captures in one move |
| MY-T4 | Mak-yek | Sandwich blocked by friendly-not-opponent (no capture) |
| MY-T5 | Mak-yek | `'whole-line'` knob captures the full enemy line between two friendlies |
| HS-T1 | Hasami Shogi | Custodian capture |
| HS-T2 | Hasami Shogi | Corner capture (each of the four corners) |
| HS-T3 | Hasami Shogi | Reduce-to-1 win condition |
| RE-T1 | Rek | Intervention capture (Rek's namesake) |
| RE-T2 | Rek | Single-piece immobilization (`'group'` scope, group of 1) |
| RE-T3 | Rek | Connected-group immobilization (group of 2 or 3) |
| RE-T4 | Rek | Group with one mobile piece (no capture) |
| RE-T5 | Rek | King captured (`'capture-king'` win) |
| DH-T1 | Dai Hasami Shogi | Non-capturing single-jump over friendly |
| DH-T2 | Dai Hasami Shogi | Non-capturing single-jump over enemy |
| DH-T3 | Dai Hasami Shogi | 5-in-a-row outside own starting ranks (win) |
| DH-T4 | Dai Hasami Shogi | 5-in-a-row entirely inside own starting ranks (NO win) |
| DH-T5 | Dai Hasami Shogi | Reduce-to-≤4 win |
