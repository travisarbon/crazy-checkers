# Linear Movement Engine — Rules Notes (Task 29.2)

Authoritative rules for Dameo live in
`Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md`
(§3.4 engine architecture, §4.1 Dameo full rule table, §15.2 Open Question 7).
This file documents engine-level decisions where the implementation departs
from the playbook's prose, and pins the citations that back the hand-verified
fixtures.

---

## 1. Open Question 7 — diagonal phalanxes

The playbook's §3.4 originally described phalanxes only along ranks; §15.2's
Open Question 7 surfaces the question of whether sideways and diagonal
linear-group movement is also legal in canonical Dameo. The published
Dameo rules (Christian Freeling, 2000; mindsports.nl) explicitly allow
**rank, file, AND forward-diagonal** phalanx slides.

This engine encodes the decision as `LinearMovementConfig.groupAdvanceAxes
= ['rank', 'file', 'diagonal']`. If a future authoritative source contradicts
the diagonal allowance, flipping the config (drop `'diagonal'`) is a
one-line change with no engine refactor. Document any such change here.

`groupAdvanceForwardOnly: true` codifies the second resolution: phalanxes
slide only **forward** (toward the opponent's back row). Sideways and
backward slides are not legal Dameo moves.

## 2. Forward direction by color

Per `squareGeometry({ size: 8, indexing: 'squares' })`, NodeId 0..7 are row 0
(algebraic rank 8, black's back row) and NodeId 56..63 are row 7 (rank 1,
white's back row).

- **White moves forward** = toward row 0 (algebraic rank 8). Forward
  directions: N (rank/file phalanxes), NW + NE (diagonal phalanxes).
- **Black moves forward** = toward row 7 (rank 1). Forward directions: S,
  SW + SE.

Promotion rows: white = 0, black = 7.

## 3. Kings excluded from phalanxes

Per playbook §3.4: "linear movement applies only to men, never to kings."
The phalanx detector treats a king as a break in the run, so a column like
`m m K m m` produces TWO phalanxes (the bottom two men + the top two men),
not one.

This is enforced in `Phalanx.ts::isFriendlyMan`, which only returns true for
`piece.kind === 'man'`. The unit suite covers this directly.

## 4. Promotion on group-advance

The playbook §4.1 Dameo entry says "Standard: man reaching the opponent's
back row promotes to king" without distinguishing between step moves and
group-advance moves. We treat both uniformly:

- A step move's destination on the promotion row promotes the moving man.
- A group-advance move whose **head** lands on the promotion row promotes
  the head only. Members behind the head do not promote even if they
  advance to a square one rank short of the king row (they are not on the
  promotion row themselves).

This is the natural reading. If a future authoritative source contradicts
it, the change lives in `applyMove.ts::applyGroupAdvance` (one branch).

## 5. Capture mechanics

Per playbook §3.4 + §4.1:

- **Men** capture **orthogonally only** — N/S/E/W. They DO capture
  backward orthogonally, unlike standard checkers men which capture only
  forward. This is encoded in `LinearMovementConfig.menCaptureDirections`
  as the full orthogonal set.
- **Kings** capture **flying** in all 8 directions (4 orthogonal + 4
  diagonal). The flying capture finds the first occupied square along a
  ray; if it's an opponent commander, every empty square beyond it is a
  legal landing. After landing, the king may continue the chain from the
  new position.
- **Captured pieces are removed only after the entire multi-jump chain
  commits** (`capturesRemovedAt: 'chain-end'`). During exploration the
  victims stay on the board and act as blockers; the same victim cannot
  be jumped twice (enforced via `frame.capturedSet`).

## 6. Capture obligation + max-mandatory

Per playbook §4.1: capture is obligatory AND maximum-capture is mandatory
(the player MUST take the chain that captures the most pieces). Per the
playbook "a man and a king both count as one piece" — so the count is just
`captures.length`, with no king weighting.

When captures exist, simple steps and group-advance moves are dropped from
the legal-move list. After collecting all chains, only those whose
`captures.length` equals the maximum survive.

## 7. Group-advance collision detection

A phalanx of `n` men can advance only if every member's destination square
is on-board AND either empty OR occupied by another member of the SAME
phalanx (lockstep slide). The detector returns every maximal phalanx; the
move generator filters by collision. This handles the case where the head's
forward square is empty but a mid-phalanx member's forward square is
blocked by an opponent piece — such a phalanx cannot slide.

## 8. 50-move rule — not implemented

Playbook §4.1 does not define a 50-move rule. The engine deliberately does
not implement one. `LinearMeta.halfMoveClock` exists for diagnostics but
does not contribute to `gameOver`.

## 9. Reuse target — Tier 5 Epaminondas, Tier 9 Bushka

The engine modules import `LinearMovementConfig` only — no `if
(config.gameId === 'dameo')` branches. Adding Epaminondas (12×14 board,
group-vs-group capture, side-connection victory) at Tier 5 is expected to
be additive: new fields on `LinearMovementConfig`, new helpers for
group-vs-group capture and side-connection victory in a Tier-5-specific
module that imports the engine.

The `kingType: 'flying'` field is currently fixed to 'flying' for Dameo;
future variants that want short-king kings would extend the union.

## 10. Citations

- Christian Freeling, *Dameo* (2000) — full rule reference at mindsports.nl.
- Tier 2 Classified Playbook §3.4 (LinearMovementEngine architecture),
  §4.1 (Dameo rule table), §15.2 (Open Question 7 resolution).

---

## Tricky positions covered by hand-verified fixtures

| ID | Scenario |
|---|---|
| D-T1 | Rank phalanx of size 4 — every member slides forward in lockstep |
| D-T2 | File phalanx blocked by friendly king mid-line — line splits at king |
| D-T3 | Diagonal phalanx of size 3 — all three slide forward by one square |
| D-T4 | Phalanx blocked by opponent piece head-on |
| D-T5 | Phalanx blocked by board edge |
| D-T6 | Head of phalanx promotes when it lands on opponent back row |
| D-T7 | Man captures backward orthogonally |
| D-T8 | Multi-jump man chain (orthogonal) — max-mandatory selects 3-jump over 2-jump |
| D-T9 | Flying king ray jump — multiple landing squares enumerated |
| D-T10 | King chain crosses through origin square (origin treated as empty) |
| D-T11 | Trapezoid starting position legal-move count = N (deterministic spot-check) |
| D-T12 | Capture-obligation suppresses all step + group-advance moves when captures exist |
