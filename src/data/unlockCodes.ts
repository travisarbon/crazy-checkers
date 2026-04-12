/**
 * Static mapping from human-entered unlock codes to unlock target IDs.
 *
 * Powers the Code mode screen: users type a code (e.g. "REVOLUTION"), the
 * lookup resolves it to a set of registry IDs, and each ID is fed into
 * `addCodeUnlock` so the UnlockEvaluator exposes the corresponding mode.
 *
 * Pure data module — no I/O, no React dependency.
 */

import { CHOICE_MODE_DATA } from '../persistence/choiceModeData';
import { CLASSIFIED_PLACEHOLDER_DATA } from '../persistence/classifiedPlaceholderData';
import { getAllModes } from '../persistence/gameModeRegistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UnlockCodeCategory =
  | 'choice'
  | 'classified'
  | 'chaos'
  | 'master'
  | 'track'
  | 'debug';

export interface UnlockCodeEntry {
  /** Target registry IDs to add. 'ALL' expands to every registered mode ID. */
  readonly targets: readonly string[] | 'ALL';
  /** Human-readable description shown in redemption history and success message. */
  readonly description: string;
  /** Category for grouping in UI (future use). */
  readonly category: UnlockCodeCategory;
}

export type CodeLookupResult =
  | {
      readonly found: true;
      readonly entry: UnlockCodeEntry;
      readonly resolvedTargets: readonly string[];
    }
  | { readonly found: false };

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize user input: trim, uppercase, strip non-alphanumeric characters.
 */
export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// ID helpers
// ---------------------------------------------------------------------------

function toKebab(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function choiceIdFromDisplayName(displayName: string): string {
  return `choice-${toKebab(displayName)}`;
}

function choiceCodeFromDisplayName(displayName: string): string {
  return normalizeCode(displayName);
}

function classifiedId(index: number): string {
  return `classified-${String(index)}`;
}

// ---------------------------------------------------------------------------
// Mapping table construction
// ---------------------------------------------------------------------------

const TRACK_SIZE = 8;
const CLASSIFIED_COUNT = 64;

function buildTrackBatchTargets(trackIndex: number): string[] {
  const start = (trackIndex - 1) * TRACK_SIZE;
  const end = start + TRACK_SIZE;
  return CHOICE_MODE_DATA.slice(start, end).map((m) =>
    choiceIdFromDisplayName(m.displayName),
  );
}

function buildUnlockCodesTable(): Record<string, UnlockCodeEntry> {
  const table: Record<string, UnlockCodeEntry> = {};

  // 40 per-Choice codes
  for (const def of CHOICE_MODE_DATA) {
    const code = choiceCodeFromDisplayName(def.displayName);
    table[code] = {
      targets: [choiceIdFromDisplayName(def.displayName)],
      description: `Choice Mode: ${def.displayName}`,
      category: 'choice',
    };
  }

  // 5 track batch codes: TRACK1ALL .. TRACK5ALL
  const trackNames = [
    'Puzzle Mastery',
    'Chaos Veteran',
    'Rule Bender',
    'Lifer',
    'World Player',
  ];
  for (let i = 1; i <= 5; i += 1) {
    table[`TRACK${String(i)}ALL`] = {
      targets: buildTrackBatchTargets(i),
      description: `Track ${String(i)} (${trackNames[i - 1] ?? ''}) — all 8 Choice modes`,
      category: 'track',
    };
  }

  // All Choice
  table['ALLCHOICE'] = {
    targets: CHOICE_MODE_DATA.map((m) => choiceIdFromDisplayName(m.displayName)),
    description: 'All 40 Choice modes',
    category: 'choice',
  };

  // Classified menu
  table['CLASSIFIED'] = {
    targets: ['classified'],
    description: 'Classified menu',
    category: 'classified',
  };

  // Per-Classified-game codes CLASSIFIED01 .. CLASSIFIED64
  for (let i = 1; i <= CLASSIFIED_COUNT; i += 1) {
    const code = `CLASSIFIED${String(i).padStart(2, '0')}`;
    const def = CLASSIFIED_PLACEHOLDER_DATA.find((c) => c.index === i);
    const displayName = def ? def.displayName : `Classified ${String(i)}`;
    table[code] = {
      targets: [classifiedId(i)],
      description: `Classified: ${displayName}`,
      category: 'classified',
    };
  }

  // All Classified
  table['ALLCLASSIFIED'] = {
    targets: CLASSIFIED_PLACEHOLDER_DATA.map((c) => classifiedId(c.index)),
    description: 'All 64 Classified games',
    category: 'classified',
  };

  // Chaos
  table['CHAOS'] = {
    targets: ['chaos'],
    description: 'Chaos mode',
    category: 'chaos',
  };

  // Master
  table['UNLOCKALL'] = {
    targets: 'ALL',
    description: 'Everything — master unlock',
    category: 'master',
  };

  return table;
}

export const UNLOCK_CODES: Readonly<Record<string, UnlockCodeEntry>> =
  Object.freeze(buildUnlockCodesTable());

// ---------------------------------------------------------------------------
// Registry expansion for the master unlock
// ---------------------------------------------------------------------------

function getAllRegisteredModeIds(): string[] {
  const ids = new Set<string>();
  // Master marker — activates `masterUnlockActive` in UnlockEvaluator.
  ids.add('all');
  // Menu-level markers.
  ids.add('choice');
  ids.add('classified');
  ids.add('chaos');
  for (const entry of getAllModes()) {
    ids.add(entry.id);
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

/**
 * Look up a raw user input string against the mapping table.
 * Returns resolved target IDs or a not-found result.
 */
export function lookupCode(rawInput: string): CodeLookupResult {
  const normalized = normalizeCode(rawInput);
  if (normalized.length === 0) return { found: false };

  const entry = UNLOCK_CODES[normalized];
  if (!entry) return { found: false };

  const resolvedTargets =
    entry.targets === 'ALL' ? getAllRegisteredModeIds() : [...entry.targets];

  return { found: true, entry, resolvedTargets };
}
