# Tier 2 — Notation & Serialization Notes (Phase 4 Task 29.8)

This file documents Tier 2 per-game notation grammars and the design
decisions made during Task 29.8 implementation.

Authoritative references:
- `Documentation/Phase 4/Task 29/Task_29_8_Notation_And_Serialization_Implementation_Plan.md`
- `Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md` §7.2, §7.3, §13 row T2-S3
- `Documentation/Playbooks/Crazy_Checkers_Classified_Integration_Master_Playbook.md` §13 row C-08

---

## 1. Per-game notation grammars

| # | gameId | adapterKey | Notation flavor | Sample text |
|---|--------|------------|-----------------|-------------|
| 1 | dameo | `dameo-pdn` | PDN with phalanx-arrow | `(a1,b2,c3)→d4` |
| 2 | harzdame | `harzdame-pdn` | PDN with `=K+` senior token | `12×7=K+` |
| 3 | lasca | `lasca-stacking-pdn` | T2-S3 stack-aware PDN | `c3×e5 [stacks: T[]→T[mb]]=K` |
| 4 | bashni | `bashni-stacking-pdn` | T2-S3 stack-aware PDN | `c3×e5 [stacks: T[]→T[mb]]=K` |
| 5 | zamma | `zamma-pdn` | PDN with `=M` Mullah token | `1-2=M` |
| 6 | mak-yek | `mak-yek-letter-number` | Algebraic + captures-list | `a1-a4 (captures: a3)` |
| 7 | hasami-shogi | `hasami-shogi-shogi-coords` | Shogi coords + captures-list | `9a-9e (captures: 9b, 9c)` |
| 8 | rek | `rek-letter-number` | Algebraic + King prefix + captures/immobilized | `Ka1-a4 (captures: a3)` |
| 9 | dai-hasami-shogi | `dai-hasami-shogi-shogi-coords` | Shogi coords + jump syntax + win tokens | `9a^9c`, `9a-9e (captures: 9b)#L5(...)` |
| 10 | cheskers | `cheskers-pdn` | PDN with piece-type prefix | `Pa3-b4`, `Cg1-h4=K` |

---

## 2. Invented annotations (TODO: source consultation)

Per plan §1.1 + §6.5: Mak-yek, Hasami Shogi, Rek, and Dai Hasami Shogi
have **no published move-text notation**. Task 29.8 invents the
`(captures: <list>)` annotation convention because their captures are
post-move side effects (custodian / intervention / immobilization), not
jump-mid-move. The `(immobilized: <list>)` variant for Rek's
immobilization mechanic is a Task-29.8 invention to disambiguate
custodian capture from immobilization capture.

**TODOs for per-game subtasks**:
- 29.G.6-C (Mak-yek): consult Burmese-checkers literature for established
  move notation; replace `(captures: ...)` if a documented form exists.
- 29.G.7-C (Hasami Shogi): consult Japanese-shogi literature; the
  `(captures: ...)` annotation may be stylistically out of place vs. the
  shogi-style `<piece><from>-<to>×<capture>` convention used in Western
  shogi notation.
- 29.G.8-C (Rek): consult Mak-yek-with-King sources; the `K` prefix and
  `(immobilized: ...)` annotation are best-effort.
- 29.G.9-C (Dai Hasami Shogi): consult Big-Hasami-Shogi sources for the
  `^` jump-syntax convention; the `#R5` and `#L5(...)` win-token
  conventions are invented.

---

## 3. T2-S3 stack-aware PDN — verbose vs. compressed (per plan §6.3)

Lasca + Bashni's `[stacks: <fromStack>→<toStack>]` annotation captures
the post-move stack composition explicitly. The format follows Task 29.1's
binary serializer (`T[<layer1><layer2>...]` with `m`/`M`/`b`/`B` for
white-man / white-king / black-man / black-king, bottom-first).

**Verbose form** (current): every capture move emits the annotation.
Verbose for typical play but unambiguous.

**Compressed form** (future, per-game-subtask 29.G.3-C / 29.G.4-C):
omit when stack composition is unchanged (e.g., a step that doesn't
disturb riders). Could reduce text length by ~50% in long games.

Task 29.8 ships the verbose form for clarity and round-trip safety.

---

## 4. Shogi-coord override (Hasami Shogi / Dai Hasami Shogi)

The engine's `BoardGeometry.coordinateLabels` for 9×9 full-board
geometry emits `a1..i9` algebraic. Per playbook §7.2's shogi-style
naming convention, the notation adapter overrides with shogi-style
`<file-digit><rank-letter>` (file 9..1 left-to-right; rank a..i
top-to-bottom) via the `shogiCoordinateLabeler(9)` helper.

**Two coordinate conventions for the same 9×9 board** is intentional —
the override lives in the **notation adapter only**. The engine's
geometry stays unchanged. The disconnect mirrors how Tier 1 American
Checkers uses PDN-numeric notation while the engine internally uses
NodeIds — different surfaces, same underlying geometry.

---

## 5. Cheskers piece-type prefix — disambiguator (per plan §6.9)

Cheskers's four piece types (Pawn, King, Bishop, Camel) share dark-square
trajectories. Without the prefix, `c1-d2` is ambiguous (could be a Pawn
step, a King step, or a Bishop one-square slide). The prefix is
**mandatory** — every Cheskers move emits a prefix.

The prefix occupies position 0 of the token; the promotion suffix
occupies the trailing `=X` characters. No positional ambiguity.

---

## 6. Round-trip semantics — what survives parse → notate

Per plan §14 risk row + §16 example: notation captures only the
**structural** fields needed for replay:
- `kind`, `from`, `to`, `piece`, `capture`, `promotion` — structural;
  preserved across round-trip.
- `meta.path`, `meta.directions`, `meta.fromNode`, `meta.toNode`,
  `meta.camelOffset`, `meta.owner`, `meta.maxChainLength`, etc. —
  **engine-derived**; not encoded in notation. The engine recomputes
  these on `applyMove` if needed for animation routing.

The round-trip harness compares only the structural fields; engine-
computed meta is excluded from the equality check. This matches
Tier 1's notation behavior.

---

## 7. Bridge integration

Per plan §10.2: each Tier 2 adapter slots into Phase 3's
`createClassifiedNotationBridge` without modification. The bridge is
generic in `(state, move) → (Phase3 board, Phase1 move)` conversion;
Tier 2 adapters reuse it as-is.

Verified by `__tests__/classifiedBridge.test.ts` — every Tier 2 adapter
exposes the Phase 3 contract surface (`moveToString`, `stringToMove`,
`formatMoveNumber`).

---

## 8. Out of scope for Task 29.8

Per plan §1:
- Cogitate Replay UI surface (move-list rendering, hover-highlighting,
  click-to-jump-to-ply) — already exists from Phase 3.
- Per-game audio packs, theme audits, GameModeRegistry entries → 29.G.x-D.
- 200-game self-play tuning of evaluator weights → Task 29.7 + 29.G.x-A.
- Binary state serializers (`<game>Serializer.ts`) — already shipped by
  Tasks 29.1–29.6.
- Re-notation of historic save files — no migration needed because
  `moveHistory[]` already stores structured `<Game>Move` records.
- PDN-export functionality for entire game records — potentially Phase 5.

---

## 9. Tier 2 Review Checklist amendment (deferred)

Per plan §1.1: T2-S3 row should scope to Lasca/Bashni only, with new
T2-N1 (PDN-base), T2-N2 (shogi-coords), T2-N3 (custodian letter-number),
T2-N4 (Cheskers piece-prefix) rows for the other notation flavors.
Task 29.8 ships the adapter implementations but **defers the
Review_Checklist_Tier2.md amendment** as a process change for Task 29.9
(Tier 2 Completion Gate) to coordinate. The amendment scope is
documented here so Task 29.9's row sweep can sign off the new rows
correctly.

---

## 10. Test coverage

`src/cogitate/notation/tier2/**`:
- 6 test suites (98 tests total).
- Per-game adapter tests: notate + parse + round-trip on first 5 legal moves.
- shogiCoords helper: round-trip every 0..80 nodeId + edge cases.
- Aggregator: dispatch correctness for all 10 games + unknown rejection +
  unique adapter keys.
- notationRoundTrip: 10-move scripted self-play per game, notate→parse→
  re-notate identity.
- notationEdgeCases: hand-authored Cheskers prefix, Harzdame senior `=K+`,
  Mak-yek captures-list, Dameo phalanx-arrow, Zamma `=M`.
- classifiedBridge: each adapter lifts cleanly into the Phase 3 bridge.
