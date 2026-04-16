# Tier 1 `DraughtsConfig` — Authoritative Notes

**Task 28.1** — Phase 4 Tier 1 (Standard Draughts Variants).

This document is the authoritative field-by-field reference for
`DraughtsConfig`, the pure-data shape that parameterises every Tier 1
Classified draughts variant. Read this before editing any per-game factory in
`DraughtsConfig.ts`.

The companion implementation files live in this directory:

- `DraughtsConfig.ts` — type definitions, ten per-game factories, helpers,
  validator.
- `startingPositions.ts` — deterministic `generateStartingPosition(config)`.
- `startingPositions.snapshots.ts` — authoritative piece-map snapshots.
- `configToNotation.ts` — routing from `DraughtsConfig` to a PDN-family
  `NotationAdapter` instance.

---

## 1. Parameter Catalog

Every field on `DraughtsConfig`, the authoritative reference in the Tier 1
Playbook, and the role it plays in Task 28.2's `ParameterizedDraughtsRules`.

| Field | Type | Authoritative source | Role in rule engine |
|---|---|---|---|
| `gameId` | `DraughtsGameId` (10 values) | Library Playbook §Wave 1 ids | Identity only. Task 28.2 must not branch on this for behaviour. |
| `displayName` | `string` | Library Playbook §Wave 1 labels | Debug/telemetry only. |
| `boardGeometry` | `BoardGeometry` | Task 27.2 | Renderer registry key, adjacency lookup, coordinate labels. |
| `piecesPerSide` | `number` (5/12/16/20/30) | Tier 1 Playbook §4 | Starting-count sanity check. |
| `startingLayout` | `StartingLayout` (5 values) | Tier 1 Playbook §4 diagrams | Starting-position generator arm. |
| `menMoveDirections` | `DraughtsDirection[]` | Tier 1 Playbook §4 rules | Pawn move-generation direction set. |
| `kingType` | `'short' \| 'flying'` | Tier 1 Playbook §3.4 | Single-square vs. ray-based king. |
| `kingMoveDirections` | `DraughtsDirection[]` | Tier 1 Playbook §4 rules | King move-generation direction set. |
| `menCaptureDirections` | `DraughtsDirection[]` | Tier 1 Playbook §4 rules | Pawn capture direction set. |
| `kingCaptureDirections` | `DraughtsDirection[]` | Tier 1 Playbook §4 rules | King capture direction set. |
| `capturedPieceRemovalTiming` | `'immediate' \| 'end-of-sequence'` | Turkish Playbook §4.10 | Chain-capture semantics (Turkish removes mid-chain). |
| `menCanCaptureKings` | `boolean` | Italian Playbook §4.3 | Italian exclusion flag. |
| `kingOrthogonalCaptureIsLimited` | `boolean` | Frisian/Frysk! Playbook §4.5, §4.6 | Single-square-landing restriction on orthogonal king captures. |
| `captureObligatory` | `boolean` | Per-game §4 | Mandatory-capture flag. |
| `maximumCaptureMandatory` | `boolean` | Per-game §4 | Tiebreaker for chain length. |
| `capturePriorityRules` | `CapturePriorityRule[]` | Per-game §4 | Ordered sequence-preference list. |
| `promotionBehavior` | `'standard' \| 'mid-capture' \| 'end-of-turn'` | Per-game §4 | When to flip man → king. |
| `huffingMechanism` | `HuffingMechanism` enum | Malaysian Playbook §4.7 + Task 28.1.2 | `'self-piece-forfeit'` / `'opponent-chooses'` / `'immediate-loss'` / `'none'`; Malaysian uses `'self-piece-forfeit'`. |
| `kingConsecutiveMoveLimit` | `number \| null` | Frisian/Frysk! Playbook §4.5, §4.6 | Anti-drift cap on consecutive king moves. |

Cross-references for sub-types:

- `DraughtsDirection` = `'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se'`.
- `DIAGONAL_DIRECTIONS` = `['nw', 'ne', 'sw', 'se']`.
- `ORTHOGONAL_DIRECTIONS` = `['n', 's', 'e', 'w']`.
- `CapturePriorityRule` — 5 kebab-case string literals, see `DraughtsConfig.ts`.

---

## 2. Parameter-Interaction Matrix

Row = game, column = field. Condensed for readability; fields whose value is
constant across Tier 1 (`capturedPieceRemovalTiming: 'end-of-sequence'` for
everyone except Turkish) are listed separately below the matrix.

| Game | Board | Pieces | Layout | Men mv | King | Men cap | King cap | Obl. | Max | Priority | Promo | Huff | KCML |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Russian | 8×8 dark | 12 | 3-rows | nw,ne | flying | diag | diag | ✓ | ✗ | — | mid-capture | ✗ | — |
| Brazilian | 8×8 dark | 12 | 3-rows | nw,ne | flying | diag | diag | ✓ | ✓ | most-pieces | standard | ✗ | — |
| Italian | 8×8 dark | 12 | 3-rows | nw,ne | short | nw,ne | diag | ✓ | ✓ | full chain* | end-of-turn | ✗ | — |
| International | 10×10 dark | 20 | 4-rows | nw,ne | flying | diag | diag | ✓ | ✓ | most-pieces | standard | ✗ | — |
| Frysk! | 10×10 dark | 5 | back-row | nw,ne | flying | diag+ortho | diag+ortho | ✓ | ✓ | most-pieces + 1.5× | standard | ✗ | 3 |
| Frisian | 10×10 dark | 20 | 4-rows | nw,ne | flying | diag+ortho | diag+ortho | ✓ | ✓ | most-pieces + 1.5× | standard | ✗ | 3 |
| Malaysian | 12×12 dark | 30 | 5-rows | nw,ne | flying | diag | diag | ✗ | ✗ | — | standard | ✓ | — |
| Canadian | 12×12 dark | 30 | 5-rows | nw,ne | flying | diag | diag | ✓ | ✓ | most-pieces | standard | ✗ | — |
| Armenian | 8×8 full | 16 | rows-2-3 | nw,ne | flying | nw,ne,e,w | diag+ortho | ✓ | ✓ | most-pieces | standard | ✗ | — |
| Turkish | 8×8 full | 16 | rows-2-3 | n,e,w | flying | n,e,w | n,s,e,w | ✓ | ✓ | most-pieces | standard | ✗ | — |

\* Italian's priority is the four-tier ordering: most-pieces →
most-kings-captured → capturing-with-king → first-king-earliest.

**Fields constant across all Tier 1 games** (recorded here instead of the
matrix for compactness):

- `capturedPieceRemovalTiming`: `'end-of-sequence'` for every game **except
  Turkish**, which is `'immediate'`.
- `menCanCaptureKings`: `true` for every game **except Italian**.
- `kingOrthogonalCaptureIsLimited`: `true` for Frysk! and Frisian only.

**Diff-against-Russian view.** Russian is the archetype; each column below
names the single-field deltas that the per-game factory applies on top of the
Russian template.

| Game | Deltas vs. Russian |
|---|---|
| Brazilian | `maximumCaptureMandatory: true`, `capturePriorityRules: ['most-pieces']`, `promotionBehavior: 'standard'`. |
| Italian | `kingType: 'short'`, `menCaptureDirections: ['nw','ne']`, `menCanCaptureKings: false`, `maximumCaptureMandatory: true`, `capturePriorityRules: [full chain]`, `promotionBehavior: 'end-of-turn'`. |
| International | `boardGeometry: 10×10`, `piecesPerSide: 20`, `startingLayout: '4-rows'`, `maximumCaptureMandatory: true`, `capturePriorityRules: ['most-pieces']`, `promotionBehavior: 'standard'`. |
| Frysk! | `boardGeometry: 10×10`, `piecesPerSide: 5`, `startingLayout: 'back-row-only'`, `kingMoveDirections: diag+ortho`, `menCaptureDirections: diag+ortho`, `kingCaptureDirections: diag+ortho`, `kingOrthogonalCaptureIsLimited: true`, `maximumCaptureMandatory: true`, `capturePriorityRules: ['most-pieces','kings-weight-1-5']`, `promotionBehavior: 'standard'`, `kingConsecutiveMoveLimit: 3`. |
| Frisian | Same as Frysk! except `piecesPerSide: 20`, `startingLayout: '4-rows'`. |
| Malaysian | `boardGeometry: 12×12`, `piecesPerSide: 30`, `startingLayout: '5-rows'`, `captureObligatory: false`, `huffingMechanism: 'self-piece-forfeit'`, `promotionBehavior: 'end-of-turn'`. |
| Canadian | `boardGeometry: 12×12`, `piecesPerSide: 30`, `startingLayout: '5-rows'`, `maximumCaptureMandatory: true`, `capturePriorityRules: ['most-pieces']`, `promotionBehavior: 'standard'`. |
| Armenian | `boardGeometry: 8×8 full`, `piecesPerSide: 16`, `startingLayout: 'rows-2-3'`, `kingMoveDirections: diag+ortho`, `menCaptureDirections: ['nw','ne','e','w']`, `kingCaptureDirections: diag+ortho`, `maximumCaptureMandatory: true`, `capturePriorityRules: ['most-pieces']`, `promotionBehavior: 'standard'`. |
| Turkish | `boardGeometry: 8×8 full`, `piecesPerSide: 16`, `startingLayout: 'rows-2-3'`, `menMoveDirections: ['n','e','w']`, `kingMoveDirections: ['n','s','e','w']`, `menCaptureDirections: ['n','e','w']`, `kingCaptureDirections: ['n','s','e','w']`, `capturedPieceRemovalTiming: 'immediate'`, `maximumCaptureMandatory: true`, `capturePriorityRules: ['most-pieces']`, `promotionBehavior: 'standard'`. |

---

## 3. Starting-Layout Diagrams

ASCII diagrams show `B` (black man), `W` (white man), `.` (empty dark square
on dark-only boards), `·` (empty light square, not a playable node on
dark-only boards). Row 0 is the top row; white plays up the board (decreasing
row).

### 3.1 `dark-squares-3-rows` — Russian / Brazilian / Italian (8×8)

```
  0 1 2 3 4 5 6 7
0 · B · B · B · B
1 B · B · B · B ·
2 · B · B · B · B
3 · · · · · · · ·
4 · · · · · · · ·
5 W · W · W · W ·
6 · W · W · W · W
7 W · W · W · W ·
```

- Black men: 12 (rows 0–2).
- White men: 12 (rows 5–7).

### 3.2 `dark-squares-4-rows` — International / Frisian (10×10)

```
   0 1 2 3 4 5 6 7 8 9
0  · B · B · B · B · B
1  B · B · B · B · B ·
2  · B · B · B · B · B
3  B · B · B · B · B ·
4  · · · · · · · · · ·
5  · · · · · · · · · ·
6  · W · W · W · W · W
7  W · W · W · W · W ·
8  · W · W · W · W · W
9  W · W · W · W · W ·
```

- Black men: 20. White men: 20.

### 3.3 `dark-squares-5-rows` — Malaysian / Canadian (12×12)

```
    0 1 2 3 4 5 6 7 8 9 10 11
0   · B · B · B · B · B · B
1   B · B · B · B · B · B ·
2   · B · B · B · B · B · B
3   B · B · B · B · B · B ·
4   · B · B · B · B · B · B
5   · · · · · · · · · · · ·
6   · · · · · · · · · · · ·
7   W · W · W · W · W · W ·
8   · W · W · W · W · W · W
9   W · W · W · W · W · W ·
10  · W · W · W · W · W · W
11  W · W · W · W · W · W ·
```

- Black men: 30. White men: 30.

### 3.4 `dark-squares-back-row-only` — Frysk! (10×10)

```
   0 1 2 3 4 5 6 7 8 9
0  · B · B · B · B · B
1  · · · · · · · · · ·
...
8  · · · · · · · · · ·
9  W · W · W · W · W ·
```

- Black men: 5 (on the 5 dark squares of row 0).
- White men: 5 (on the 5 dark squares of row 9).

### 3.5 `full-board-rows-2-and-3` — Armenian / Turkish (8×8 full)

All 64 squares are playable; no `playableMask`. Pieces occupy the second and
seventh ranks (rows 1,2 Black / rows 5,6 White). Back ranks (0 and 7) are
**empty** — distinctive to these two games.

```
  0 1 2 3 4 5 6 7
0 . . . . . . . .
1 B B B B B B B B
2 B B B B B B B B
3 . . . . . . . .
4 . . . . . . . .
5 W W W W W W W W
6 W W W W W W W W
7 . . . . . . . .
```

- Black men: 16. White men: 16.

---

## 4. Direction-Array Derivations

For each game the `menMoveDirections` / `menCaptureDirections` /
`kingMoveDirections` / `kingCaptureDirections` arrays are derived from the
Tier 1 Playbook's plain-English rules as follows. (Rows that are identical to
Russian are omitted unless the derivation differs in subtle ways.)

- **Russian, Brazilian, International, Frysk! (pawns only), Frisian (pawns only), Malaysian, Canadian, Armenian (pawns only)** — pawns move forward-diagonal: `['nw','ne']`; kings are flying long-range on all four diagonals: `[...DIAGONAL_DIRECTIONS]`.
- **Russian pawns capture diagonal both ways** — encoded as `[...DIAGONAL_DIRECTIONS]` for `menCaptureDirections`. Forward-only capture is incorrect for Russian; the playbook §4.1 explicitly permits backward man captures.
- **Italian pawns** — forward-only diagonal captures: `['nw','ne']`. Captures are blocked against kings (`menCanCaptureKings: false`).
- **Frysk! / Frisian** — kings and men may additionally capture orthogonally: `[...DIAGONAL_DIRECTIONS, ...ORTHOGONAL_DIRECTIONS]`. The `kingOrthogonalCaptureIsLimited` flag signals that the landing square for orthogonal king captures must be the immediate square beyond the jumped piece (Task 28.2 enforces this).
- **Armenian** — men move diagonally forward (`['nw','ne']`) and capture diagonally forward OR horizontally (`['nw','ne','e','w']`). Kings move and capture in all 8 directions: `[...DIAGONAL_DIRECTIONS, ...ORTHOGONAL_DIRECTIONS]`.
- **Turkish** — men move and capture orthogonally forward + sideways: `['n','e','w']`. Kings add backward movement: `['n','s','e','w']`. **No diagonals** anywhere in Turkish.

---

## 5. Known Sharp Edges

1. **Italian's `menCanCaptureKings: false` combined with
   `maximumCaptureMandatory: true`.** The "men cannot capture kings" rule can
   suppress the absolute-longest chain and force a shorter sequence. Task
   28.2's capture generator must filter illegal man-to-king jumps **before**
   applying the maximum-length filter; the correct ordering is
   *enumerate → filter → maximise*.
2. **Frisian/Frysk! `'kings-weight-1-5'` ordering.** The `'kings-weight-1-5'`
   entry in `capturePriorityRules` is a *weighting* of the preceding
   `'most-pieces'` rule, not an independent tiebreaker. The validator
   enforces ordering: `'kings-weight-1-5'` may only appear after
   `'most-pieces'`.
3. **Turkish mid-chain removal.** Turkish uses
   `capturedPieceRemovalTiming: 'immediate'` — captured pieces vanish from
   the board as the chain is traversed, not at the end. This matters when an
   opponent piece blocks a subsequent leg; Task 28.2's chain search must
   rewrite the occupancy map between legs for Turkish.
4. **Frysk! Back-row-only start with 5 pieces.** Frysk! is the *only* Tier 1
   game with a single-row starting layout. Tests that iterate Tier 1 games
   must treat this as its own fixture row; the symmetry check for Frysk! is
   dominated by its 5-piece configuration rather than by a dense band.
5. **Armenian/Turkish full-board vs. dark-only.** Callers that conflate
   "no `playableMask`" with "8×8 American Rules" will silently break on
   Armenian and Turkish. Use `usesDarkSquaresOnly(config)` as the single
   branching helper; **do not** inspect `config.boardGeometry.playableMask`
   directly.
6. **Malaysian `huffingMechanism: 'self-piece-forfeit'`.** Malaysian is the only Tier 1 game with
   `captureObligatory: false`. The validator guarantees the two flags are
   never both `true` (huffing *replaces* obligatory capture). Task 28.2 wires
   huffing into the post-move UI prompt; the engine itself does not enforce
   capture legality beyond legality-of-target.

---

## 6. Invalid Parameter Combinations (Rejected by Validator)

The `validateDraughtsConfig(config)` helper throws
`DraughtsConfigInvariantError` for each of these combinations. Every factory
runs the validator on its frozen output at module-load time, so a violating
factory would fail the Tier 1 test suite immediately.

1. `piecesPerSide` inconsistent with the count implied by
   `(startingLayout, boardGeometry.size)`.
2. `kingMoveDirections` empty.
3. `kingType: 'flying'` with `menMoveDirections ⊄ kingMoveDirections`
   (flying kings must at minimum cover all pawn directions).
4. `'kings-weight-1-5'` without a preceding `'most-pieces'` entry in
   `capturePriorityRules`.
5. `kingConsecutiveMoveLimit: number` with `kingType: 'short'`.
6. `menCanCaptureKings: false` with `captureObligatory: false`.
7. `hasHuffing(config) === true` with `captureObligatory: true`.

---

## 7. Notation-Adapter Routing

`configToNotation(config)` returns a `NotationAdapter<ClassifiedGameState,
ClassifiedMove>` cached per `gameId`. The routing table:

| Games | Adapter key | Implementation |
|---|---|---|
| Russian, Brazilian, Italian | `pdn-8` | `createPdnNotationAdapter` with 8×8 dark geometry. |
| International | `pdn-10` | `createPdnNotationAdapter` with 10×10 dark geometry. |
| Frysk!, Frisian | `pdn-frisian` | Overrides capture separator: `×⊥` on orthogonal legs, `×/` on diagonal. |
| Malaysian, Canadian | `pdn-12` | `createPdnNotationAdapter` with 12×12 dark geometry. |
| Armenian | `pdn-8-armenian` | Overrides capture separator: `×−` on orthogonal legs, `×` on diagonal. |
| Turkish | `pdn-8-turkish` | Uniform `×` separator (all legs orthogonal by construction). |

---

## 8. Change Control

The `DraughtsConfig` shape is **frozen** as of this task. Any additive
parameter (e.g. an Expansion-tier variant that requires a new flag) requires
a Task 28.1 amendment plan and a review pass across Tier 2 composition
callers (Cheskers, Lasca, Bashni) — those consumers
`Pick<DraughtsConfig, ...>` sub-records, and widening the shape ripples
through their compile surface.
