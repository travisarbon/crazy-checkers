/**
 * Task 28.7 — shared row status constants for the Tier 1 completion gate.
 *
 * Maps each §13 Review Checklist row ID (C-01..C-15) to the execution pass
 * that ticks it. The tier1 runner ticks rows whose status is `'mechanical'`;
 * `'reviewer'` rows are stubbed in ReviewerNotes/<gameId>.md and ticked only
 * after a human countersign; `'mixed'` rows combine mechanical evidence
 * (run by the harness) with a reviewer walkthrough that the evidence cell
 * records separately.
 *
 * Keeping this table in-code — not just in the Markdown checklist — lets the
 * summary report regenerator reason about "did this pass cover all its rows"
 * without having to parse Markdown.
 */

export type ChecklistRowId =
  | 'C-01'
  | 'C-02'
  | 'C-03'
  | 'C-04'
  | 'C-05'
  | 'C-06'
  | 'C-07'
  | 'C-08'
  | 'C-09'
  | 'C-10'
  | 'C-11'
  | 'C-12'
  | 'C-13'
  | 'C-14'
  | 'C-15';

export type RowStatusKind = 'mechanical' | 'reviewer' | 'mixed';

export interface RowStatusEntry {
  readonly id: ChecklistRowId;
  readonly kind: RowStatusKind;
  /** One-line description reused in summary reports. */
  readonly description: string;
  /** Severity per Master Playbook §13 / Classified_Review_Checklist_Template. */
  readonly severity: 'Blocking' | 'Conditional-Blocking' | 'Non-blocking';
}

/** Canonical row status table. Order matches the §13 table. */
export const TIER_1_ROW_STATUS: readonly RowStatusEntry[] = Object.freeze([
  {
    id: 'C-01',
    kind: 'mechanical',
    description: 'ClassifiedRuleSet implemented; ≥95% coverage (aggregated from 28.2 suites)',
    severity: 'Blocking',
  },
  {
    id: 'C-02',
    kind: 'mechanical',
    description: 'Registered in GameModeRegistry + per-tier index',
    severity: 'Blocking',
  },
  {
    id: 'C-03',
    kind: 'reviewer',
    description: 'Board geometry + renderer verified desktop + mobile',
    severity: 'Blocking',
  },
  {
    id: 'C-04',
    kind: 'reviewer',
    description: 'Piece vocabulary registered; renders under all themes',
    severity: 'Blocking',
  },
  {
    id: 'C-05',
    kind: 'mechanical',
    description: 'Persistence round-trip byte-identical across sample states',
    severity: 'Blocking',
  },
  {
    id: 'C-06',
    kind: 'mixed',
    description: 'CogitateGameAdapter registered; Replay byte-identical on 50-game corpus',
    severity: 'Blocking',
  },
  {
    id: 'C-07',
    kind: 'mixed',
    description: 'EvaluationProvider registered; Analysis + Training verified',
    severity: 'Conditional-Blocking',
  },
  {
    id: 'C-08',
    kind: 'mixed',
    description: 'NotationAdapter round-trip / explicit fallback note',
    severity: 'Non-blocking',
  },
  {
    id: 'C-09',
    kind: 'mechanical',
    description: 'Audio pack declared + resolves via AudioPackRegistry (or tier fallback)',
    severity: 'Blocking',
  },
  {
    id: 'C-10',
    kind: 'reviewer',
    description: 'Accessibility: ARIA, keyboard, touch ≥44×44, contrast',
    severity: 'Blocking',
  },
  {
    id: 'C-11',
    kind: 'mixed',
    description: 'Code Mode entry wired; decoding note + manual walkthrough',
    severity: 'Blocking',
  },
  {
    id: 'C-12',
    kind: 'mechanical',
    description: 'AI: Hard beats Easy ≥70% in 200-game self-play; no crash in 1000-game stress',
    severity: 'Blocking',
  },
  {
    id: 'C-13',
    kind: 'reviewer',
    description: 'Gallery card + detail screen render correctly',
    severity: 'Blocking',
  },
  {
    id: 'C-14',
    kind: 'mixed',
    description: 'Career statistics aggregate correctly for this game',
    severity: 'Blocking',
  },
  {
    id: 'C-15',
    kind: 'mixed',
    description: 'Track 5 counter + Classified Library flavor text',
    severity: 'Blocking',
  },
]);

/** Indexable lookup: rowId → status entry. */
export const TIER_1_ROW_STATUS_BY_ID: ReadonlyMap<ChecklistRowId, RowStatusEntry> = new Map(
  TIER_1_ROW_STATUS.map((r) => [r.id, r] as const),
);

/** Row IDs whose ticking is the tier1ChecklistRunner's job (Pass 1 machine-only). */
export const TIER_1_MECHANICAL_ROW_IDS: readonly ChecklistRowId[] = Object.freeze(
  TIER_1_ROW_STATUS.filter((r) => r.kind === 'mechanical').map((r) => r.id),
);

/** Row IDs awaiting reviewer countersign in Pass 2. */
export const TIER_1_REVIEWER_ROW_IDS: readonly ChecklistRowId[] = Object.freeze(
  TIER_1_ROW_STATUS.filter((r) => r.kind === 'reviewer' || r.kind === 'mixed').map((r) => r.id),
);
