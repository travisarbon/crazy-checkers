/**
 * Centralized, data-driven mode registry.
 *
 * Maps mode identifiers to display metadata, category groupings,
 * unlock track contributions, and extensibility properties.
 * The single extension point for adding new modes to Career,
 * Cogitate, the unlock system, and all mode-aware UI screens.
 *
 * Pure data module — no React dependency, no side effects, no I/O.
 */

import type { CrazyEvent } from '../engine/types';
import type { GameRecord } from './gameHistory';
import type { SerializedActiveEvent } from './serialization';
import { CHOICE_MODE_DATA } from './choiceModeData';
import type { TrackId } from './choiceModeData';
import { CLASSIFIED_PLACEHOLDER_DATA } from './classifiedPlaceholderData';

// Re-export TrackId for consumers
export type { TrackId } from './choiceModeData';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModeCategory =
  | 'classic'
  | 'crazy'
  | 'chaos'
  | 'choice'
  | 'challenge'
  | 'classified';

export interface ModeRegistryEntry {
  readonly id: string;
  readonly displayName: string;
  readonly category: ModeCategory;
  readonly wave: number | null;
  readonly family: string | null;
  readonly tracksContribution: readonly TrackId[];
  readonly excludeFromCareer: boolean;
  readonly unlockRequirement: string | null;
  readonly engineMode: string;
  readonly permanentEvent: CrazyEvent | null;
  readonly choiceDescription: string | null;
  readonly choiceNumber: number | null;
  readonly classifiedIndex: number | null;
  readonly boardGeometry: string | null;
  readonly implemented: boolean;
}

// ---------------------------------------------------------------------------
// Fallback entry for unknown modes
// ---------------------------------------------------------------------------

const UNKNOWN_MODE_ENTRY: ModeRegistryEntry = Object.freeze({
  id: 'unknown',
  displayName: 'Unknown Mode',
  category: 'classic' as ModeCategory,
  wave: null,
  family: null,
  tracksContribution: [],
  excludeFromCareer: true,
  unlockRequirement: null,
  engineMode: '',
  permanentEvent: null,
  choiceDescription: null,
  choiceNumber: null,
  classifiedIndex: null,
  boardGeometry: null,
  implemented: false,
});

// ---------------------------------------------------------------------------
// Registry construction
// ---------------------------------------------------------------------------

function buildRegistry(): Map<string, ModeRegistryEntry> {
  const map = new Map<string, ModeRegistryEntry>();

  // Core modes
  const coreModes: ModeRegistryEntry[] = [
    {
      id: 'classic', displayName: 'Classic', category: 'classic',
      wave: null, family: null, tracksContribution: [],
      excludeFromCareer: false, unlockRequirement: null,
      engineMode: 'CLASSIC', permanentEvent: null,
      choiceDescription: null, choiceNumber: null,
      classifiedIndex: null, boardGeometry: null, implemented: true,
    },
    {
      id: 'crazy', displayName: 'Crazy', category: 'crazy',
      wave: null, family: null, tracksContribution: ['chaos-veteran'],
      excludeFromCareer: false, unlockRequirement: null,
      engineMode: 'CRAZY', permanentEvent: null,
      choiceDescription: null, choiceNumber: null,
      classifiedIndex: null, boardGeometry: null, implemented: true,
    },
    {
      id: 'chaos', displayName: 'Chaos', category: 'chaos',
      wave: null, family: null, tracksContribution: [],
      excludeFromCareer: false,
      unlockRequirement: 'Unlock all 40 Choice modes, complete 100 challenges, and win all 60 Classified games vs. Hard CPU',
      engineMode: 'CHAOS', permanentEvent: null,
      choiceDescription: null, choiceNumber: null,
      classifiedIndex: null, boardGeometry: null, implemented: true,
    },
    {
      id: 'challenge', displayName: 'Challenge', category: 'challenge',
      wave: null, family: null, tracksContribution: ['puzzle-mastery'],
      excludeFromCareer: true, unlockRequirement: null,
      engineMode: '', permanentEvent: null,
      choiceDescription: null, choiceNumber: null,
      classifiedIndex: null, boardGeometry: null, implemented: true,
    },
    {
      id: 'free-play', displayName: 'Free Play', category: 'classic',
      wave: null, family: null, tracksContribution: [],
      excludeFromCareer: true, unlockRequirement: null,
      engineMode: 'CLASSIC', permanentEvent: null,
      choiceDescription: null, choiceNumber: null,
      classifiedIndex: null, boardGeometry: null, implemented: true,
    },
  ];

  for (const entry of coreModes) {
    map.set(entry.id, Object.freeze(entry));
  }

  // Choice modes (40 entries)
  for (const def of CHOICE_MODE_DATA) {
    const kebab: string = def.displayName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const entry: ModeRegistryEntry = {
      id: `choice-${kebab}`,
      displayName: def.displayName,
      category: 'choice',
      wave: null,
      family: null,
      tracksContribution: ['rule-bender'],
      excludeFromCareer: false,
      unlockRequirement: def.unlockThreshold,
      engineMode: 'CHOICE',
      permanentEvent: def.event,
      choiceDescription: def.description,
      choiceNumber: def.choiceNumber,
      classifiedIndex: null,
      boardGeometry: null,
      implemented: true,
    };
    map.set(entry.id, Object.freeze(entry));
  }

  // Classified placeholders (60 entries)
  for (const def of CLASSIFIED_PLACEHOLDER_DATA) {
    const entry: ModeRegistryEntry = {
      id: `classified-${String(def.index)}`,
      displayName: def.displayName,
      category: 'classified',
      wave: def.wave,
      family: def.family,
      tracksContribution: ['world-player'],
      excludeFromCareer: false,
      unlockRequirement: null,
      engineMode: `classified-${String(def.index)}`,
      permanentEvent: null,
      choiceDescription: null,
      choiceNumber: null,
      classifiedIndex: def.index,
      boardGeometry: def.boardGeometry,
      implemented: false,
    };
    map.set(entry.id, Object.freeze(entry));
  }

  return map;
}

const registry = buildRegistry();

// ---------------------------------------------------------------------------
// Lookup event → Choice entry index (built once)
// ---------------------------------------------------------------------------

const eventToChoiceEntry = new Map<string, ModeRegistryEntry>();
for (const [, entry] of registry) {
  if (entry.category === 'choice' && entry.permanentEvent !== null) {
    eventToChoiceEntry.set(entry.permanentEvent, entry);
  }
}

// ---------------------------------------------------------------------------
// Query API
// ---------------------------------------------------------------------------

/** Look up a single entry by its registry ID. */
export function getMode(id: string): ModeRegistryEntry | undefined {
  return registry.get(id);
}

/** Look up a single entry, returning a fallback for unrecognized IDs. */
export function getModeOrFallback(id: string): ModeRegistryEntry {
  return registry.get(id) ?? UNKNOWN_MODE_ENTRY;
}

/** Return all entries matching the given category, in stable order. */
export function getModesByCategory(category: ModeCategory): readonly ModeRegistryEntry[] {
  const results: ModeRegistryEntry[] = [];
  for (const [, entry] of registry) {
    if (entry.category === category) results.push(entry);
  }
  if (category === 'choice') {
    results.sort((a, b) => (a.choiceNumber ?? 0) - (b.choiceNumber ?? 0));
  } else if (category === 'classified') {
    results.sort((a, b) => (a.classifiedIndex ?? 0) - (b.classifiedIndex ?? 0));
  }
  return results;
}

/** Return all Classified entries in the given wave (1–8), sorted by index. */
export function getClassifiedByWave(wave: number): readonly ModeRegistryEntry[] {
  const results: ModeRegistryEntry[] = [];
  for (const [, entry] of registry) {
    if (entry.category === 'classified' && entry.wave === wave) {
      results.push(entry);
    }
  }
  results.sort((a, b) => (a.classifiedIndex ?? 0) - (b.classifiedIndex ?? 0));
  return results;
}

/** Return all entries contributing to the given track. */
export function getModesContributingToTrack(trackId: TrackId): readonly ModeRegistryEntry[] {
  const results: ModeRegistryEntry[] = [];
  for (const [, entry] of registry) {
    if (entry.tracksContribution.includes(trackId)) {
      results.push(entry);
    }
  }
  return results;
}

/** Return all entries eligible for Career aggregates. */
export function getCareerEligibleModes(): readonly ModeRegistryEntry[] {
  const results: ModeRegistryEntry[] = [];
  for (const [, entry] of registry) {
    if (!entry.excludeFromCareer) results.push(entry);
  }
  return results;
}

/** Return all fully implemented (playable) entries. */
export function getImplementedModes(): readonly ModeRegistryEntry[] {
  const results: ModeRegistryEntry[] = [];
  for (const [, entry] of registry) {
    if (entry.implemented) results.push(entry);
  }
  return results;
}

/** Return all entries in stable order: core, Choice by number, Classified by index. */
export function getAllModes(): readonly ModeRegistryEntry[] {
  const coreOrder = ['classic', 'crazy', 'chaos', 'challenge', 'free-play'];
  const core: ModeRegistryEntry[] = [];
  for (const id of coreOrder) {
    const entry = registry.get(id);
    if (entry) core.push(entry);
  }
  const choice = getModesByCategory('choice');
  const classified = getModesByCategory('classified');
  return [...core, ...choice, ...classified];
}

/** Look up the Choice mode entry associated with a CrazyEvent. */
export function findChoiceEntryByEvent(event: CrazyEvent): ModeRegistryEntry | undefined {
  return eventToChoiceEntry.get(event);
}

/** Extract the permanently active event from a Choice mode GameRecord. */
export function extractPermanentEvent(record: GameRecord): CrazyEvent | null {
  if (!record.activeEventsPerPly || record.activeEventsPerPly.length === 0) {
    return null;
  }
  const initialEvents = record.activeEventsPerPly[0];
  if (!initialEvents || initialEvents.length === 0) return null;
  return initialEvents[0].type as CrazyEvent;
}

/** Map a GameRecord to its corresponding registry entry. */
export function resolveGameRecord(record: GameRecord): ModeRegistryEntry {
  switch (record.mode) {
    case 'CLASSIC':
      return getModeOrFallback('classic');
    case 'CRAZY':
      return getModeOrFallback('crazy');
    case 'CHAOS':
      return getModeOrFallback('chaos');
    case 'CHOICE': {
      const permanentEvent = extractPermanentEvent(record);
      if (permanentEvent !== null) {
        const choiceEntry = findChoiceEntryByEvent(permanentEvent);
        if (choiceEntry) return choiceEntry;
      }
      return UNKNOWN_MODE_ENTRY;
    }
    default:
      return getModeOrFallback(record.mode.toLowerCase());
  }
}
