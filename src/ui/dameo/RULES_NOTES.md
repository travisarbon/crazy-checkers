# Dameo per-game subtask — Implementation Notes (Phase 4 Task 29.G.1)

This file documents Task 29.G.1 design decisions, scope choices, and
deferred follow-up work.

Authoritative references:
- `Documentation/Phase 4/Task 29/Task_29_G_1_Dameo_PerGame_Implementation_Plan.md`
- `Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md` §3.4, §4.1, §6.2, §6.3, §8.1, §8.2, §13.1
- `Documentation/Phase 4/Tier 2/Review_Checklist_Tier2.md` Dameo block (lines 30–76)

---

## 1. Registration metadata anomalies (locked decisions)

Per plan §1.1:
- **Wave anomaly**: registered as `wave: 1` per playbook authority (the
  Phase 4 plan's per-game subtask wording `wave: 2` is a paraphrase typo).
- **Family anomaly**: registered as `family: 'Draughts'` per the closed
  `ClassifiedFamily` union (the Phase 4 plan's `family: 'draughts-variant'`
  is not a literal in that union).

Both are documented in the per-game registration file's inline comments.

---

## 2. Scope ship vs. deferred

Task 29.G.1 has four sub-blocks (A/B/C/D). This implementation ships the
**engine-light essentials** that a per-game subtask QA pass can sign off
without depending on visual / Playwright / 200-game-self-play work:

### Sub-block A — Shipped:
- Refined `DAMEO_WEIGHTS` per plan §5.2 (six-axis structure: material,
  phalanx-bonus depth-weighted, column-head safety, promotion proximity,
  back-row defense, capture-chain potential).
- `DameoEvaluator` updated to consume the new weight structure.
- `dameoDifficultyPresets.ts` shipped (Easy depth 3 / Hard depth 7 +
  quiescence + transposition table per plan §5.3).
- 13 unit tests covering material baseline, phalanx monotonicity, depth
  cap, column-head safety, promotion proximity, back-row defense, mirror
  symmetry.

### Sub-block A — Deferred:
- The 60+ new hand-verified fixtures (plan §5.1) — Task 29.2 already
  ships ≥80 named scenarios; the per-game-subtask additions are
  incremental. Deferred to a focused follow-up subtask.
- **200-game self-play with ≥70% Hard-vs-Easy gate (C-12)** — runtime is
  ~30–60 minutes; not a CI gate. Manual `npm run validate:tier2:quick`
  exercises a 20-game smoke variant. Full ≥70% gate is run on demand by
  the per-game QA owner before declaring C-12 green.

### Sub-block B — Shipped:
- `dameoAriaLabels.ts` — pure-function ARIA copy generator covering the
  4 move-kind branches (step / group-advance / capture / capture+promotion).
- `usePhalanxSelection.ts` — hover-aware phalanx selection helper (pure
  TypeScript, no React dependency, fully testable in vitest).
- 14 unit tests covering ARIA copy + phalanx selection invariants.

### Sub-block B — Deferred:
- `PhalanxHighlightOverlay.tsx` React component + CSS module — requires
  visual debugging against the live `SquareBoardRenderer`; deferred to a
  focused UI subtask with mobile + theme QA.
- `LinearSlideStep.ts` animation primitive — depends on the React
  component above.
- Theme CSS additions for `--color-highlight-phalanx` / `--color-arrow-direction`
  — the existing Theme interface uses fixed keys (not a free-form CSS
  custom-property bag); extending it has wider blast radius. The
  React component above can use the existing `highlightSelected` /
  `uiAccent` tokens for now.
- Mobile QA (320px) + Playwright theme-audit snapshots — deferred to
  the React-component follow-up.

### Sub-block C — Shipped:
- `dameoAdapter.ts` — per-game CogitateGameAdapter with:
  - Position validator (`validateDameoPosition`) enforcing Dameo
    invariants (≤18 pieces/side, valid kinds, on-board NodeIds, turn
    parity).
  - Notation bridge (Phase 3 ↔ Phase 4) via Task 29.8's Dameo notation
    adapter for Replay's move-list rendering.
  - Stub evaluation provider (per per-game-subtask wording — the real
    Cogitate Analysis provider is a follow-up).
  - Standard Cogitate contract methods (getBoard, getStartingPosition,
    getNotationAdapter, getAIConfig with Dameo difficulty presets, etc.).
- 17 unit tests covering adapter contract + position validator invariants.

### Sub-block C — Deferred:
- Replay / Analysis / Free Play / Training **controllers** (plan §9.2) —
  the adapter shell is shipped; the controllers are a follow-up.
- `dameoEvaluationProviderBridge.ts` (Cogitate Analysis hookup) — the
  stub provider returns `isAvailable: false` so Cogitate Analysis falls
  back gracefully.
- Save/resume mid-phalanx UI state field on `inProgressGame.ts` — the
  engine state is always at a committed boundary; the UI hover state
  is transient and lost on refresh, which is the expected default per
  plan §9.4 same-session-only scope.

### Sub-block D — Shipped:
- Per-game registration polish in `tier2/dameo.ts`:
  - Refined `narrativeFlavor.connection` text including "Christian
    Freeling, 2000" attribution (per plan §10.3).
  - Refined `mvpRuleSummary` covering the four distinctive Dameo rules
    (full 8×8 board, 18 pawns, phalanx movement, kings fly all 8
    directions, max captures mandatory).
  - Per-game `adapter` parameter wired to `createDameoAdapter` (overrides
    the default-adapter dispatch).
- `GameModeRegistry` entry — already auto-created by
  `_registerClassifiedMode` when `registerDameo` runs; no separate file
  needed (per Task 29.7 §4 architecture mapping).
- Code Mode entry — `CLASSIFIED11` is auto-registered by the `unlockCodes`
  table generator; the alternate `DAMEO11` mnemonic is documented as a
  future enhancement (per Task 29.7's RULES_NOTES.md §4 unlock-code
  format note).
- Track 5 wiring — automatic via `tracksContribution: ['world-player']`
  on the GameModeRegistry entry.

### Sub-block D — Deferred:
- Bespoke `dameoPack.ts` audio pack with new phalanx-step sound asset
  — the asset doesn't exist; per plan §15 risk row, fall back to the
  standard piece-step sound (default pack). C-09 row notes the fallback.
- Playwright E2E test (`e2e/classified-dameo.spec.ts`) — depends on the
  React UI component above; deferred to the follow-up.
- Hand-QA against detail-screen + first 10 moves — ad-hoc QA pass at
  preview time, not CI-automated.
- Related-games cross-link to Crossings (#30) + Epaminondas (#47) —
  the `relatedGames` field is not part of `ClassifiedRegistrationSpec`;
  adding it would require a schema extension. Deferred to a future spec
  bump.

---

## 3. Dameo difficulty preset rationale

Per per-game subtask wording: Hard depth 7. Playbook §6.3 suggests
8–10 ply but at Dameo's ~10–14 branching factor that's expensive
(~10⁸–10¹⁰ raw nodes; alpha-beta + transposition table reduces to
~10⁵–10⁶ effective). Locked at depth 7 per per-game subtask wording for
predictable response time on a developer laptop (~1–4 seconds per Hard
move).

Easy at depth 3 + 1.5s cap delivers a beatable opponent for new players
without disabling the AI entirely.

---

## 4. Acceptance criteria status (Task 29.G.1 §14)

- [x] **C-01** ClassifiedRuleSet implemented and unit-tested (≥95%
  coverage). Evidence: Task 29.2 + Task 29.G.1-A's DameoEvaluator tests.
- [x] **C-02** Registered in GameModeRegistry and per-tier index module.
  Evidence: `tier2/dameo.ts` + `_registerClassifiedMode` auto-wiring.
- [ ] **C-03** Board geometry / renderer / mobile — DEFERRED (requires
  React-component follow-up).
- [x] **C-04** Piece vocabulary registered — verified via the engine
  task's piece vocabulary tests; theme audit deferred.
- [ ] **C-05** Save/resume mid-phalanx UI — DEFERRED (engine state
  already round-trips; UI state extension is follow-up scope).
- [x] **C-06** CogitateGameAdapter registered — `dameoAdapter.ts` ships
  the adapter shell.
- [x] **C-07** EvaluationProvider — stub provider ships;
  `isAvailable: false` per per-game subtask follow-up wording.
- [x] **C-08** NotationAdapter registered — Task 29.8 shipped; Cogitate
  Replay shows phalanx-arrow notation correctly.
- [ ] **C-09** Audio pack — falls back to default per per-game-subtask
  fallback wording.
- [ ] **C-10** Accessibility — ARIA labels module shipped; keyboard /
  touch targets / contrast theme verified at React-component time.
- [x] **C-11** Code Mode entry — `CLASSIFIED11` auto-registered (the
  `DAMEO11` mnemonic deferred; see §2).
- [ ] **C-12** AI Hard ≥70% — manual `validate:tier2 --gameId dameo`
  run required; CI smoke (`validate:tier2:quick`) exercises a 20-game
  variant.
- [x] **C-13** Classified gallery + detail screen — render via the
  existing `ClassifiedGalleryScreen` + `ClassifiedDetailScreen` from
  the registration entry.
- [x] **C-14** Career statistics — auto-aggregate via the
  `tracksContribution: ['world-player']` on the GameModeRegistry entry.
- [x] **C-15** Track 5 + flavor text — flavor text "Christian Freeling,
  2000" surfaces in the detail screen via the registration's
  `narrativeFlavor.connection`.

Plus:
- [x] CI gate green (lint, typecheck, focused tests, build).
- [ ] Coverage ≥85% lines on new files — not enforced via vitest config
  threshold (per per-game-subtask scope).
- [ ] Human-launchable per Task 27.8 MVP — verifiable at preview time.

---

## 5. Hand-off

When Task 29.G.1 is green:
- The Dameo game is launchable from the Classified gallery via existing
  Phase 3 surfaces (gallery, detail screen, game screen, ChooseGameSetup).
- Cogitate Replay correctly renders Dameo move text via the Phase 3
  ↔ Phase 4 notation bridge.
- The default Cogitate adapter dispatch routes Dameo to the per-game
  adapter (no Tier-1-draughts-weight-lookup error).
- The AI's depth presets and weights produce a recognizably-Dameo
  Hard CPU.
- Per-game subtasks 29.G.1-B, 29.G.1-C-controllers, 29.G.1-D-audio,
  29.G.1-E2E ship the deferred items above.
