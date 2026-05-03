# Tier 2 — Per-Game Registration & AI Tuning Notes (Phase 4 Task 29.7)

This file documents Tier 2 registration design decisions and the
discrepancies-resolution choices made during Task 29.7 implementation.

Authoritative references:
- `Documentation/Phase 4/Task 29/Task_29_7_PerGame_Registration_And_AI_Tuning_Implementation_Plan.md`
- `Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md` §6, §7.1, §13
- `Documentation/Playbooks/Crazy_Checkers_Classified_Integration_Master_Playbook.md` §3, §13

---

## 1. Threshold disambiguation — ≥65% vs. ≥70%

Per plan §1.1, Task 29.7's gate is **≥65% Hard-vs-Easy** (Phase 4 plan
acceptance). The Master Playbook §13 row C-12 demands ≥70% per-game; that
gate is the per-game subtask C-block's responsibility (29.G.1-A through
29.G.10-A).

The `validateTier2` script accepts `--threshold` so both gates can be
exercised with the same harness:
- `npm run validate:tier2` → default 0.65 (Task 29.7's bar)
- `npm run validate:tier2 -- --threshold 0.70` → per-game subtask + Task 29.9 bar

---

## 2. Wave anomaly — Harzdame

Per plan §4: the playbook §93 table + Tier 2 Review Checklist places
Harzdame in **wave 1**; the Phase 4 plan's per-game subtask 29.G.2-D
wording reads `wave: 2`. Plan §4 explicitly resolves this in favor of the
playbook + checklist authority.

`tier2/harzdame.ts` registers Harzdame with `wave: 1`.

---

## 3. Family naming — closed-union mismatches

The closed `ClassifiedFamily` union (`src/engine/classified/ClassifiedRuleSet.ts`)
does not include the playbook's `'Custodian'`, `'Connection/Capture Game'`,
or `'Chess/Draughts Hybrid'` literals. Task 29.7 maps each to the closest
closed-union match:

- **Mak-yek, Hasami Shogi, Rek**: `family: 'Capture Game'` — playbook
  framing of custodian capture as the dominant mechanic.
- **Dai Hasami Shogi**: `family: 'Connection Game'` — the 5-in-a-row
  alt-win-condition makes this game more connection-oriented than
  pure capture; per the placeholder data label "Connection/Capture
  Game". A future enum extension could add `'Connection/Capture'` as
  a hybrid label.
- **Cheskers**: `family: 'Abstract Strategy'` — sui generis hybrid
  with no clean fit in the closed union. The plan §4 wording
  `family: 'hybrid'` is a paraphrase.

Per plan §4: "Document in the per-task notebook" — done here.

---

## 4. Unlock codes — CLASSIFIED{NN} format

The plan §4 catalogue lists unlock codes as `DAMEO11`, `HARZ12`,
`LASCA13`, etc. The actual `UNLOCK_CODES` registry
(`src/data/unlockCodes.ts`) auto-generates per-game codes as
`CLASSIFIED{NN}` (`CLASSIFIED01`–`CLASSIFIED64`). Validation at
registration requires the `codeUnlockKey` to be present in
`UNLOCK_CODES`.

Task 29.7 uses `CLASSIFIED11`–`CLASSIFIED49` (matching the existing
auto-generated codes). The plan §4 catalogue's mnemonic codes
(`DAMEO11` etc.) would require a separate registration in
`unlockCodes.ts` — deferred to a future task if mnemonic codes
become a product requirement.

---

## 5. Worker-boundary integration — Option B

Per plan §7, two integration options:
- **Option A** (preferred): per-game registration calls
  `registerRuleSetFactory('classified-{gameId}', () => create{Game}RuleSet())`
  and the worker uses its existing dispatch.
- **Option B** (fallback): new entry point `getClassifiedTier2AIMove`.

Task 29.7 uses **Option B**. Rationale:
1. `RuleSetFactory.RuleSetFactoryFn` returns the Phase-1 `RuleSet` shape,
   not `ClassifiedRuleSet`. Tier 1 draughts side-steps this by inlining
   `createDraughtsRuleSet(config)` in `getClassifiedDraughtsAIMove`.
2. Adding a Tier 2 entry that follows the same inline-construction
   pattern is cleaner than retrofitting `RuleSetFactory` to support
   `ClassifiedRuleSet`.
3. The new `getClassifiedTier2AIMove` is symmetric with the existing
   `getClassifiedDraughtsAIMove` and dispatches via gameId through
   `getTier2Dispatch` — uniform across all 10 Tier 2 games.

A future Tier 1 → V2 migration is possible but is out of scope for 29.7.

---

## 6. Default Cogitate adapter dispatch — Harzdame stub override

The default Cogitate adapter (`createDefaultClassifiedAdapter`) dispatches
games with `ruleSetFamily: 'draughts'` to the Tier 1 draughts adapter. The
Tier 1 adapter then looks up Tier 1 evaluator weights for the gameId,
which fails with "No evaluation weights registered for draughts variant:
{gameId}" for any non-Tier-1 draughts game.

Harzdame's rule-set declares `ruleSetFamily: 'draughts'` (per Task 29.5
plan §3 — "Harzdame is bespoke draughts" — the family tag's purpose is
Cogitate dispatch coordination, but the dispatch's Tier 1 lookup is too
narrow). To work around this, `tier2/harzdame.ts` passes a custom
`adapter: createTier2StubAdapter(...)` to `registerClassifiedGame`. The
stub adapter mirrors the non-draughts branch of the default adapter
(stub evaluation provider, `throwNotSupported` for board ops).

Per-game subtask 29.G.2-C ships the bespoke Harzdame Cogitate adapter,
which supersedes this stub.

---

## 7. AI evaluator weight tables — initial baseline

Each per-engine evaluator weight table is the initial baseline derived
from playbook §6.2 row text. Key per-game choices:

- **Stacking (Lasca/Bashni)**: Bashni's king is heavier than Lasca's
  (350 vs. 250) reflecting flying kings inside towers (playbook §3.1).
- **Linear (Dameo)**: phalanx bonus for same-row friendly pairs (proxy
  for Dameo's signature linear-formation strength).
- **Alquerque (Zamma)**: Mullah (king) value is 4× man value reflecting
  extra mobility on the alquerque graph.
- **Custodian**: Rek king value is 1500 (15× man) reflecting
  capture-the-king instant-win semantics.
- **Custodian (Dai Hasami Shogi)**: distinctive `lineFormationBonus: 6`
  for the 5-in-a-row alt-win condition.
- **Harzdame**: senior king is `1.5 * regularKingValue` per playbook
  explicit ratio.
- **Cheskers**: King most valuable (500), then Camel (350), then Bishop
  (300), then Pawn (100) per playbook ordering.

Per-game subtasks 29.G.x-A's 500-game self-play tuning will refine
these. The current weights are sufficient for the engine acceptance
("AI plays recognizably; ≥50% win rate vs. random") and aim toward the
Phase 4 plan's ≥65% Hard-vs-Easy threshold.

---

## 8. Out of scope for Task 29.7

Per plan §1.1:
- Per-game UI surfaces (board renderers, piece visuals, animations,
  ARIA, mobile QA) → per-game subtask B-blocks.
- Per-game Cogitate adapters (Replay flavor, Free Play position editors,
  Training motif extractors) → per-game subtask C-blocks.
- Per-game audio packs + theme audits → per-game subtask D-blocks.
- Per-game `GameModeRegistry` entries → per-game subtask D-blocks.
- 200-game self-play hand-QA documentation → per-game subtask D-blocks.
- 500-game Cheskers piece-value tuning (Camel ≈ 3.5 etc.) → 29.G.10-A.
- Notation-extension PDN serializers (stack-aware, senior-king,
  piece-prefix) → Task 29.8.
- Tier 2 completion gate (full §13 row sweep at ≥70% gate) → Task 29.9.
- Bundle-budget gate enforcement → Task 29.9.

Task 29.7 ships the rule-set registry plumbing + AI evaluator scaffolds
+ self-play harness only.
