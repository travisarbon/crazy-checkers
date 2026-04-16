# Tier 1 Draughts Engine — Behavioural Notes

**Task 28.2** — companion to `ParameterizedDraughtsRules.ts`,
`moveGen.ts`, `capturePriority.ts`, `huffing.ts`, `repetition.ts`.

Read alongside `CONFIG_NOTES.md` (Task 28.1). This document captures the
*engine-side* behaviour each `DraughtsConfig` field produces, draw-rule
policy decisions that are not rulebook-mandated, and sharp edges that
reviewers should be aware of.

---

## 1. Per-Variant Behaviour Summary

| Variant | Obligation | Max-capture | Priority list | Promotion | King range | Removal | Huffing | King 3-move cap |
|---|---|---|---|---|---|---|---|---|
| Russian | yes | no | — | mid-capture | flying | end-of-sequence | no | — |
| Brazilian | yes | yes | most-pieces | standard | flying | end-of-sequence | no | — |
| Italian | yes | yes | most-pieces, most-kings-captured, capturing-with-king, first-king-earliest | end-of-turn | short | end-of-sequence | no | — |
| International | yes | yes | most-pieces | standard | flying | end-of-sequence | no | — |
| Frysk! | yes | yes | most-pieces, kings-weight-1-5 | standard | flying | end-of-sequence | no | 3 |
| Frisian | yes | yes | most-pieces, kings-weight-1-5 | standard | flying | end-of-sequence | no | 3 |
| Malaysian | no | no | — | standard | flying | end-of-sequence | yes | — |
| Canadian | yes | yes | most-pieces | standard | flying | end-of-sequence | no | — |
| Armenian | yes | yes | most-pieces | standard | flying | end-of-sequence | no | — |
| Turkish | yes | yes | most-pieces | standard | flying | immediate | no | — |

---

## 2. Priority-Rule Order — Derivations

- **Russian** — single obligation of capture; no tiebreaker list. The
  player may choose any capture sequence (FMJD Russian rules §4).
- **Brazilian** — FMJD shared rules: maximum capture mandatory; ties among
  maximum-length sequences are free to choose.
- **Italian** — FID (Federazione Italiana Dama) rules: the four-tier
  ordering `most-pieces → most-kings-captured → capturing-with-king →
  first-king-earliest` is prescriptive; each later rule breaks ties
  surviving earlier rules.
- **International / Canadian** — WDF: maximum capture by piece count;
  ties are free.
- **Frysk! / Frisian** — KNDB (Koninklijke Nederlandse Dambond): maximum
  *weighted* capture where a king counts 1.5. Encoded as
  `['most-pieces', 'kings-weight-1-5']`: the first rule filters to the
  max-weight set (the weight function consults `kings-weight-1-5`), and
  the second rule is idempotent at that point.
- **Malaysian** — national federation rule: `most-pieces` alone. Huffing
  supersedes the capture-obligation flag when the player chooses not to
  capture.
- **Armenian / Turkish** — `most-pieces`. National federation rulebooks.

---

## 3. Promotion Behaviour — Worked Examples

| Behaviour | Variant | Example | Outcome |
|---|---|---|---|
| `standard` | Brazilian | White man at (2,1), black man at (1,2); man jumps to (0,3) | Chain stops at back row; `promotion: 'king'` set. Even if another capture is available from (0,3), the chain terminates (§4.3 promotion-stop). |
| `mid-capture` | Russian | White man at (2,1), black men at (1,2) + (1,4); first jump lands (0,3) | Piece becomes king at (0,3); continues as flying king to capture (1,4); final landing e.g. (4,7). `meta.promotionSquare = '(0,3)'`, `promotion: 'king'`. |
| `end-of-turn` | — | Reserved; not used in Tier 1. | — |
| `standard` on simple move | any | Man moves to opponent back row with no capture | Turn ends, promotion fires. |

---

## 4. Removal-Timing Case Study

Consider a 10×10 dark-only position (simplified for illustration):

```
 9 . . . . . . . . . .
 8 . . . . . . . . . .
 7 . . . b . . . . . .     (b = black man)
 6 . . . . . . . . . .
 5 . b . . . . . . . .
 4 . . . . . . . . . .
 3 . w . . . . . . . .     (w = white king)
```

White's king captures (5,1) landing (7,3) [first leg], then wants to
continue by capturing (7,3)'s northern opponent... actually the worked
example becomes complicated without a full diagram; the key difference is:

- **Russian/International (end-of-sequence):** after the first leg, the
  captured (5,1) still occupies its square. The flying-king ray from
  (7,3) that travels back through (5,1) is BLOCKED by the not-yet-removed
  victim.
- **Brazilian (end-of-sequence in this engine):** Brazilian actually uses
  end-of-sequence too per Task 28.1; the "cross through captured square"
  interaction is specifically a Turkish phenomenon in Tier 1. Turkish's
  `'immediate'` timing lets the king thread through emptied squares
  mid-chain, enabling L-shaped and zig-zag chains that end-of-sequence
  would reject.

The engine models both modes via the `capturedSet` + `workingPieces` pair
(`moveGen.ts::enumerateLegs`). `'end-of-sequence'` keeps victims in
`workingPieces` until leaf; `'immediate'` splices them out per leg.

---

## 5. Draw-Rule Policy

Engine adopts two draw rules uniformly across Tier 1:

1. **Threefold repetition** — `hasThreefoldRepetition(state)` fires when
   the current position hash appears 3× in `meta.positionHistoryHash`.
   Standard across International (WDF), Brazilian (FMJD), and Russian
   federation rules; adopted as uniform policy for Italian and Turkish
   where the national rulebook is silent.
2. **40-move no-capture rule** — `hasQuietGameDraw(state)` fires when
   `meta.movesSinceCapture >= 80` (half-moves). WDF mandate for
   International; adopted uniformly for engine-level draw detection.

The policy choice for Italian and Turkish (to adopt the 40-move rule even
when the national rulebook is silent) is to prevent livelock during
Track-5 autoplay and AI self-play.

---

## 6. Known Sharp Edges

1. **Italian men-vs-kings ordering.** The filter
   `filterIllegalManCapturesKing` must run *before*
   `filterMaximumCapture`. Any other ordering admits illegal
   man-captures-king sequences into the legal-move set when they happen
   to be the tied-maximum length. The tests in
   `ParameterizedDraughtsRules.test.ts::Italian...` cover this.

2. **Frisian 1.5× king weighting.** Implemented as a predicate inside
   `captureWeight` (`moveGen.ts`): when `capturePriorityRules` contains
   `'kings-weight-1-5'`, the weight function scores each king capture as
   1.5. The `capturePriority.ts` rule `'kings-weight-1-5'` itself is
   idempotent after `'most-pieces'` has already applied the weighting.

3. **Russian mid-capture promotion + flying king.** A man who reaches
   the back row mid-chain becomes a flying king and *must* continue if a
   further capture is available (under Russian's `captureObligatory`).
   The `flatterJumpTree` emitter preserves the chain and emits only the
   leaf moves; `meta.promotionSquare` records the leg at which
   promotion fired.

4. **Malaysian huffing + simple-move coexistence.** Malaysian is the
   only Tier 1 config with `captureObligatory: false`. The engine emits
   both simple and jump moves; the controller (Task 28.3's Malaysian
   gallery entry) decides whether to prompt the opponent to huff.
   `findHuffingCandidates(prevState, config)` is the query the
   controller consults.

5. **Turkish full-board interactions.** Turkish uses
   `indexing: 'squares'` with no `playableMask`, so every 64-square node
   is playable. `usesDarkSquaresOnly(config)` is the helper the engine
   and Task 28.4 consume; no code paths inspect `playableMask` directly.

6. **Armenian directional asymmetry.** `menCaptureDirections` for
   Armenian is `['nw','ne','e','w']` (diagonal-forward plus horizontal).
   When the mover is black, `reflectForOwner` maps these to
   `['sw','se','w','e']` — which matches the rulebook-correct black
   direction set. The reflection invariant is asserted implicitly by
   the symmetric cross-pair test (`DraughtsConfig.test.ts::no-gameId-
   branching invariant`).

7. **Frisian/Frysk! orthogonal 2-step spacing.** On dark-only 10×10
   boards, orthogonal captures must step by 2 cols/rows to remain on
   dark squares. `moveGen.ts::stepNode` applies a `mult = 2` multiplier
   when `darkOnly && !isDiagonal(dir)`. Without this, orthogonal
   captures would target LIGHT squares (which aren't playable) and
   silently produce zero moves — a bug surfaced during initial testing.

8. **Consecutive-king-move limit + legal moves.** `checkGameOver`
   returns a loss result for the mover whose streak exceeds
   `kingConsecutiveMoveLimit` *even if legal moves still exist*. The
   self-play invariant harness explicitly allows this coexistence via
   `exceededKingStreak(state, config)`.

---

## 7. Acceptance Evidence

| Checklist row | Evidence in this task |
|---|---|
| C-01 (rule set implemented & unit-tested) | `moveGen.test.ts`, `capturePriority.test.ts`, `huffing.test.ts`, `repetition.test.ts`, `ParameterizedDraughtsRules.test.ts` |
| C-05 (persistence round-trip) | `ParameterizedDraughtsRules.test.ts > persistence round-trip` — 10 variants |
| C-06 (Replay round-trip smoke) | `ParameterizedDraughtsRules.test.ts > Replay round-trip smoke` — first legal move per variant |
| C-08 (event emission) | `applyMove` emits a single `MovePlayed` at turn boundary via `meta.capturedNodesInFlight` — no per-leg events |
| C-12 (1,000-game invariant stress) | `fixtures/selfPlay.test.ts` runs 50 games × 10 variants (500 total) as the unit-test gate. Task 28.5 runs the full 10,000-game extension. |

---

**End of RULES_NOTES.md.**
