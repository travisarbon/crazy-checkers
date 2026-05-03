# Harzdame — Rules Notes (Task 29.5)

Authoritative rules for Harzdame (Harz Draughts, Benedikt Rosenau, 2010)
live in `Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md`
(§3.7 engine architecture, §4.2 Harzdame rule table, §13.1 unit-test
catalog). The Phase 4 Implementation Plan §Task 29.5 + §29.G.2 add the
senior-king mechanic + max-capture default override. This file documents
engine-level decisions where the implementation departs from the
playbook's prose, and pins citations that back the hand-verified fixtures.

---

## 1. "Straight on diagonal" interpretation

Per Task 29.5 plan §1.1 (locked decision):

Harzdame is a **diagonal-movement game on the standard 8×8 dark-squares-
only geometry** (the same geometry used by American Rules and every other
Tier 1 draughts variant). The "straight on diagonal" paradigm in the
playbook §3.7/§4.2 is a **player-perspective relabeling**, not a
geometric transformation.

From a player's frame:
- "Straight forward" = the diagonal toward the opponent's home edge (NE
  for white, SW for black).
- "Straight right" = the diagonal toward the player's own right edge (SE
  for white, NW for black).
- "Straight backward" = opposite of forward (SW for white, NE for black).
- "Straight left" = opposite of right (NW for white, SE for black).

Engine-internal direction vocabulary uses the standard `'nw' | 'ne' |
'sw' | 'se'` `DraughtsDirection` enum. Player-frame relabeling is the
renderer's responsibility (per-game subtask 29.G.2-B). This decision keeps
the engine layer fully consistent with every other draughts variant in
the codebase.

## 2. Asymmetric men movement

Per playbook §4.2: a man may move to one of **exactly two** of the four
diagonal directions:
- White: NE ("straight forward") + SE ("straight right").
- Black: SW + NW (mirrored).

Backward and leftward MOVEMENT are forbidden for men. **However**, men
CAPTURE in all 4 diagonal directions (forward, backward, left, right).
This move/capture asymmetry is unique in the Harzdame engine.

Encoded in `HarzdameConfig.menMovementDirections` (per-side 2-of-4 set)
and `menCaptureDirections` (full 4-set).

## 3. 11-square promotion area (default placeholder)

Per Task 29.5 plan §1.3:

Playbook §4.2 says "a defined set of 11 squares adjacent to one edge of
the board" without enumerating them. **Default placeholder** (locked
in `harzdameConfig.ts`; Task 29.G.2-A's source-validation pass revisits):

- **White:** PDN squares {1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11} (back row +
  second row + first three squares of third row).
- **Black:** mirror PDN squares {22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32}.

Each set has cardinality 11. The central 10 squares (12..21) are
"promotion-neutral" for both sides.

**TODO:** per-game subtask 29.G.2-A consults Rosenau 2010's authoritative
Harz Draughts rules and replaces these placeholders with the canonical
11-square sets. The plan's defaults are not authoritative; they exist
only to make the engine compilable and testable.

## 4. Promotion denied on capture-arrival

Per playbook §4.2 + Task 29.5 plan §1.3:

A man that **lands on a promotion-area square via a capture chain** does
NOT promote, even if the destination is in the promotion set. Promotion
fires ONLY when the move kind is a non-capturing step (`'move'`).

This is a structural departure from every other draughts variant in the
codebase (American Rules, Tier 1, Tier 2 stacking) — those promote on
either kind of arrival. Encoded in `applyMove.ts::applyCapture` by NOT
running the promotion check, and in `applyMove.ts::applyStep` by running
it only on `move.kind === 'move'`.

## 5. Senior-king mechanic (default ON)

Per Task 29.5 plan §1.2 + Phase 4 Implementation Plan §Task 29.5:

After a king-led capture chain commits, compare its `capture.length` to
the maximum capture-chain length available in the **pre-move state** for
the active side (across **all** of the active side's pieces, not just the
king's options). If the chain length equals the maximum, the king is
flipped to senior class (`promoted: true`). Senior status is permanent
for that piece.

Movement and capture for senior kings are identical to regular kings —
the senior class is a metadata flag, not a movement modifier. Its purpose:
1. Support the per-game subtask 29.G.2-A evaluator's `senior-king bonus
   (1.5× king value)`.
2. Surface in PDN via `K+` (Task 29.8).
3. Drive the per-game subtask 29.G.2-B flip-to-senior animation.

Encoded as `HarzdameConfig.seniorKing = { enabled: boolean; trigger:
'max-chain' }`. Default `enabled: true` (matches Phase 4 plan + 29.G.2).
Setting to `false` disables senior promotion; kings stay regular
regardless of chain length. The playbook §4.2 is silent on this mechanic.

The pre-move max chain length is cached on `state.meta.maxCaptureChainLength`
by the rule-set's `getLegalMoves` wrapper (`HarzdameRules.ts`); `applyMove`
reads it and falls back to recomputation if absent.

## 6. Max-capture obligation (default OFF)

Per Task 29.5 plan §1.4:

The Tier 2 playbook §4.2 says "Maximum capture IS mandatory." The Phase 4
Implementation Plan §Task 29.5 says "No max-capture obligation, but
capture is mandatory." Per-game subtask 29.G.2-A says
"mandatory-capture (no max-obligation) selection." Two of three sources
agree; the playbook is the outlier.

**Default:** `maximumCaptureMandatory: false` (Phase 4 plan + 29.G.2).
Capture is obligatory (slides dropped when captures exist) but the
player may choose any available capture chain. Setting the knob to
`true` reproduces the playbook §4.2 wording (longest-chain prune).

## 7. Captured-piece removal: IMMEDIATE

Per playbook §4.2 row "Captured piece removal: Immediate":

Victims are removed from the working state at each leg, BEFORE recursion
continues. This is a structural departure from Tier 2 siblings (Tasks
29.2 / 29.3 / 29.4) which all defer victim removal to chain end.

Implementation: `moveGen.ts::walkChain` clones the working pieces map and
removes the victim before recursing. The mover is also moved within the
working map so subsequent legs see the correct state.

Practical implication: a victim that has been jumped is immediately
removed, so the geometry naturally prevents re-jumping the same piece
(no `forbidden` set needed in addition to the working-state mutation).

## 8. Zobrist table sizing — 192 entries (deviation from playbook §5.5)

Per Task 29.5 plan §7:

Playbook §5.5 says "32 × 4 = 128 entries" for an 8×8 dark-only game with
a man/king vocabulary. Harzdame's senior-king mechanic adds a third piece
state per side, so the table is **32 × 6 = 192 entries**:
- white-man, white-king (regular), white-king (senior),
- black-man, black-king (regular), black-king (senior).

When `seniorKing.enabled === false`, the senior-king entries are still
allocated (~64 extra `bigint`; trivial cost) — keeps determinism simple
across config flips.

## 9. 50-move rule — not implemented

Playbook §4.2 does not define a 50-move rule. The engine deliberately
does not implement one. `HarzdameMeta.halfMoveClock` exists for
diagnostics but does not contribute to `gameOver`.

## 10. Stalemate is a loss

Per project-wide convention. `HarzdameConfig.stalemateIsLoss: true` is
locked at the type level.

## 11. Citations

- Tier 2 Classified Playbook §3.7 (Eccentric Regional Engine), §4.2
  (Harzdame rule table), §5.5 (Zobrist sizing), §13.1 (unit-test
  catalog), §15 (risk row "Harzdame rule accuracy").
- Phase 4 Implementation Plan §Task 29.5 (engine deliverable + senior-king
  + max-capture default override) + §Task 29.G.2 (per-game wiring + PDN
  `K+` extension + `gameSpecificMetadata.harzdame.seniorKings`).
- Rosenau, Benedikt. *Harz Draughts*, 2010. (External authoritative source
  pending consultation by Task 29.G.2-A for the 11-square promotion area
  + senior-king + max-capture interpretations.)

---

## Tricky positions covered by hand-verified fixtures

| ID  | Scenario |
|---  |---|
| HD-T1 | White man at d4 has 2 forward moves (NE/SE only — no SW/NW) |
| HD-T2 | Black man at e5 has 2 forward moves (SW/NW only — no NE/SE) |
| HD-T3 | Man captures in all 4 directions (NE, NW, SE, SW) — even though only 2 are legal moves |
| HD-T4 | Flying king moves any distance along all 4 diagonals |
| HD-T5 | Flying king captures along ray; multiple landings beyond enemy enumerate |
| HD-T6 | Capture-arrival on promotion area: man stays a man (denial) |
| HD-T7 | Step-arrival on promotion area: man becomes a king |
| HD-T8 | Default `maximumCaptureMandatory: false` — both 1-jump and 2-jump chains surface |
| HD-T9 | Knob-flipped `maximumCaptureMandatory: true` — only longest chain surfaces |
| HD-T10 | Senior-king flip on max-chain — regular king becomes senior |
| HD-T11 | Senior-king does NOT flip on shorter chain |
| HD-T12 | `seniorKing.enabled: false` — no king ever becomes senior |
| HD-T13 | Immediate-removal: a deferred-removal interpretation would allow a re-jump that immediate removal prevents |
| HD-T14 | Stalemate-as-loss: white has pieces but no legal moves — loss for white |
| HD-T15 | Threefold repetition draws |
