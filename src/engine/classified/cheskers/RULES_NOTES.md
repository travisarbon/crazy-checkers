# Cheskers — Engine Rules Notes (Phase 4 Task 29.6)

This file documents Tier 2 #49 Cheskers (Solomon Golomb, 1948) engine
decisions, deviations from playbook wording, and the four Open Question
resolutions committed by Task 29.6.

Authoritative references:
- `Documentation/Phase 4/Task 29/Task_29_6_CheskersRules_Implementation_Plan.md`
- `Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md` §3.6, §4.10, §13.1, §15
- `Documentation/Phase 4/Phase_4_Implementation_Plan.md` §Task 29.6, §Task 29.G.10

---

## 1. Open Question 1 — Camel movement: (3, 1) leaper (default)

The Phase 4 plan §Task 29.6 paraphrases Camel movement as "moves as a chess
knight (L-jump)." The playbook §3.6 + §4.10 specify "extended knight's move:
one square diagonal then two squares straight" / "one diagonal + 2 straight"
— a (3, 1) leaper, NOT a (2, 1) chess knight.

**Resolution (per plan §1.1):** Camel is a `(3, 1)` leaper by default. From
`(r, c)` it reaches the eight squares `(r ± 3, c ± 1)` and `(r ± 1, c ± 3)`.

**Dark-square parity:** every (3, 1) leap changes `(r + c)` by ±2 or ±4
(always even), so a Camel on a dark square always lands on a dark square.
The standard `darkSquaresOnly` mask correctly admits all 8 destinations.

**Knob:** `camelLeaper: '(3,1)' | '(2,1)'`. The `'(2,1)'` value produces a
standard chess knight which on a dark-only board lands on light squares
(parity flips); the implementation lifts the dark-square restriction under
this knob for source-comparison testing only. Default `'(3,1)'`.

---

## 2. Open Question 2 — Pawn promotion target: King (default)

Playbook §4.10 hedges: "Promotion: Pawns reaching the far row promote
(piece choice to be determined — likely to King)."

**Resolution (per plan §1.2):** default is **King**. Knob
`pawnPromotion: { target: 'king' | 'choice', choices: CheskersPieceKind[] }`
exposes a chess-style underpromotion mode where the move generator emits
one promotion move per choice in `choices`. Per-game subtask 29.G.10-A
revisits if Golomb's 1948 paper surfaces an explicit choice rule.

---

## 3. Open Question 3 — Mid-chain pawn promotion: terminal-only (default)

Playbook §4.10 doesn't specify whether a Pawn that lands on the back rank
mid-capture-chain promotes immediately and gains King movement, or stays a
Pawn for the rest of the chain.

**Resolution (per plan §1.3):** default is `midChainPromotion: false`
(American-style — Pawn completes its chain as a Pawn and promotes at
terminal arrival). Aligns with playbook §4.10's "Pawn = standard draughts
man" framing.

**Knob:** `midChainPromotion: boolean`. When `true`, Russian-style
promote-and-continue: the Pawn becomes a King mid-chain and may extend the
chain along the King's 4-direction diagonals. The move generator commits
the chain as a `'king-jump'` in this case (the moving piece's identity
changed during the chain).

---

## 4. Open Question 4 — Win condition: eliminate-all-kings (default)

Playbook §4.10 says "Capture BOTH opponent Kings." A strict reading is "the
original two Kings"; a looser reading is "all current Kings (including
Pawn-promoted ones)."

**Resolution (per plan §1.4):** default is **eliminate-all-kings** (the
looser reading, count-zero). The moment opponent's count of `kind: 'king'`
pieces reaches zero, the side that just moved wins.

This is internally consistent with Pawn promotion creating new Kings: a
Pawn promotion can save a side from imminent loss; under the
"original-two-Kings-only" reading it could not.

**Knob:** `winCondition: { kind: 'eliminate-all-kings' | 'eliminate-original-kings' }`.
The `'eliminate-original-kings'` branch is currently a type-level option
without an implementation; engaging it would require tracking which Kings
were on the board at game start (via stable per-piece IDs). Deferred until
a future authoritative source demands it.

---

## 5. Black-moves-first convention (locked decision)

Playbook §4.10 explicitly states "Black moves first." This is the opposite
of standard chess (white moves first) but matches American Checkers
convention (Black/Red moves first). The engine commits this in
`config.startingTurn = 'black'` and `state.turn === 'black'` after
`buildStartingState`.

The renderer (per-game subtask 29.G.10-B) is responsible for surfacing the
convention clearly in the UI.

---

## 6. Captured-piece removal: IMMEDIATE (default)

Cheskers is closer to American Checkers than to Tier 2 siblings on the
capture-removal axis. The plan locks **immediate** removal (default
`capturedPieceRemoval: 'immediate'`) for Pawn/King multi-jump chains.

Differs structurally from Tier 2 siblings:
- Tasks 29.2 (Linear / Dameo), 29.3 (Alquerque / Zamma), 29.4 (Custodian
  family) — defer victim removal to chain end.
- Tasks 29.1 (Stacking Draughts), 29.5 (Harzdame), 29.6 (Cheskers) —
  immediate removal during chain.

The implementation maintains a `workingPieces` map per chain frame, mutating
the clone as legs commit and using it as the obstruction view for
subsequent legs. Mirrors Task 29.5's pattern.

Bishop/Camel displacement captures are single-piece — there is no chain
and the immediate-vs-deferred distinction does not apply.

---

## 7. Dual capture-obligation regime — Cheskers's structural signature

The **defining mechanic** of Cheskers among Tier 2 engines is its dual
capture-obligation regime (per playbook §4.10):

- **Pawn + King:** draughts-style mandatory jump captures with multi-jump
  chains. If any Pawn or King has a legal capture, the player MUST move a
  Pawn or King AND must take a capture.
- **Bishop + Camel:** chess-style optional displacement captures. They are
  only available when no Pawn/King capture exists.

When a Pawn/King capture exists, **all Bishop/Camel moves are dropped from
the legal set** — including their non-capturing slides/leaps. The player
cannot decline a Pawn/King capture by moving a Bishop instead. This is the
authoritative rule per playbook §4.10.

Implemented as a top-level partition in `moveGen.ts::computeLegalMoves`:

```ts
const mandatoryCaptures = [...pawnCaptures, ...kingCaptures];
if (mandatoryCaptures.length > 0) {
  return sortMoves(filterMaximumCapture(mandatoryCaptures, config));
}
return sortMoves([...pawnSteps, ...kingSteps, ...bishopMoves, ...camelMoves]);
```

Multiple test positions verify the boundary: "Pawn capture exists AND
Bishop displacement-capture exists" → only Pawn capture surfaces.

---

## 8. Zobrist sizing — 256 entries (vs. playbook §5.5's 384)

Playbook §5.5 quotes "32 dark × 12 piece-states = 384 entries" for chess-
family games on a dark-only board. That figure assumed the full 6-type
chess piece set (pawn, knight, bishop, rook, queen, king).

Cheskers uses only 4 piece types (pawn, king, bishop, camel) so the table
needs `32 × 4 × 2 = 256` entries. Plus a 1-bit side-to-move parity. The
deviation is intentional and documented here.

Fixed splitmix64 seed: `0xc4e5f607182a3b4c`. Mirrors Phase 1 +
Tasks 29.1/29.2/29.3/29.4/29.5.

---

## 9. Eliminate-all-kings + GameEndReason mapping

The engine's `GameEndReason` enum has no `'no-kings'` literal. The closest
existing reason is `NoPiecesLeft` — Cheskers's `gameOver.ts` returns
`NoPiecesLeft` for the king-elimination case with the rationale documented
in code comments. A future engine-wide enum extension could add a more
specific `NoKingsLeft` reason; deferred to keep the change set scoped.

---

## 10. Capability flags

Cheskers sets only `hasPiecesOfDistinctTypes: true` (4 distinct piece
types: pawn, king, bishop, camel). All other 5 capability flags are false:

- `hasPlacementPhase: false`
- `hasPiecesInHand: false`
- `hasStacks: false`
- `isAsymmetric: false`
- `hasMutableGeometry: false`
- `hasPiecesOfDistinctTypes: true`

`ruleSetFamily: 'other'` — Cheskers is sui generis (neither pure draughts
nor pure chess). The `'hybrid'` `ClassifiedFamily` label is surfaced at the
per-game registration layer in Task 29.G.10.

---

## 11. Out of scope for Task 29.6

Per Phase 4 Plan + plan §1:

- Worker registration + Cogitate adapter wiring → Tasks 29.7 + 29.G.10.
- Evaluator weights tuned via 500-game self-play → Task 29.G.10-A.
- Bespoke Bishop + Camel piece visuals → Task 29.G.10-B.
- Audio pack (camel-jump arc whoosh, bishop-glide diagonal slide,
  bishop-promotion chime) → Task 29.G.10-D.
- PDN-extended notation with prefix tokens (`P`, `K`, `B`, `C`) → Task 29.8.
- Persistence schema bump → Task 36.

Task 29.6 ships the headless rule set only.
