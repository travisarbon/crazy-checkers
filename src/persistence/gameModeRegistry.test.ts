import { describe, it, expect } from 'vitest';
import { CrazyEvent } from '../engine/types';
import type { GameRecord } from './gameHistory';
import {
  getMode,
  getModeOrFallback,
  getModesByCategory,
  getClassifiedByWave,
  getModesContributingToTrack,
  getCareerEligibleModes,
  getImplementedModes,
  getAllModes,
  findChoiceEntryByEvent,
  extractPermanentEvent,
  resolveGameRecord,
} from './gameModeRegistry';

// ---------------------------------------------------------------------------
// Helper to build a minimal GameRecord for testing
// ---------------------------------------------------------------------------

function makeRecord(overrides: Partial<GameRecord>): GameRecord {
  return {
    id: 'test',
    mode: 'CLASSIC',
    playerWhite: 'human',
    playerBlack: 'cpu-hard',
    result: 'WHITE_WIN',
    reason: 'CAPTURE_ALL',
    moves: [],
    boardStates: [],
    startedAt: 0,
    completedAt: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 8.1 Registry Completeness
// ---------------------------------------------------------------------------

describe('Registry Completeness', () => {
  it('registers all 105 modes', () => {
    expect(getAllModes()).toHaveLength(105);
  });

  it('registers 5 core modes', () => {
    expect(getMode('classic')).toBeDefined();
    expect(getMode('crazy')).toBeDefined();
    expect(getMode('chaos')).toBeDefined();
    expect(getMode('challenge')).toBeDefined();
    expect(getMode('free-play')).toBeDefined();
  });

  it('registers all 40 Choice modes', () => {
    expect(getModesByCategory('choice')).toHaveLength(40);
  });

  it('registers all 60 Classified placeholders', () => {
    expect(getModesByCategory('classified')).toHaveLength(60);
  });

  it('all Choice modes have unique IDs', () => {
    const ids = getModesByCategory('choice').map((e) => e.id);
    expect(new Set(ids).size).toBe(40);
  });

  it('all Classified placeholders have unique IDs', () => {
    const ids = getModesByCategory('classified').map((e) => e.id);
    expect(new Set(ids).size).toBe(60);
  });
});

// ---------------------------------------------------------------------------
// 8.2 Lookup Functions
// ---------------------------------------------------------------------------

describe('Lookup Functions', () => {
  it('getMode returns entry for valid ID', () => {
    expect(getMode('classic')?.displayName).toBe('Classic');
  });

  it('getMode returns undefined for invalid ID', () => {
    expect(getMode('nonexistent')).toBeUndefined();
  });

  it('getModeOrFallback returns fallback for invalid ID', () => {
    const entry = getModeOrFallback('nonexistent');
    expect(entry.displayName).toBe('Unknown Mode');
    expect(entry.implemented).toBe(false);
  });

  it('getModeOrFallback returns real entry for valid ID', () => {
    expect(getModeOrFallback('classic').displayName).toBe('Classic');
  });
});

// ---------------------------------------------------------------------------
// 8.3 Category Queries
// ---------------------------------------------------------------------------

describe('Category Queries', () => {
  it('getModesByCategory returns correct count per category', () => {
    // classic category includes Classic + Free Play
    expect(getModesByCategory('classic')).toHaveLength(2);
    expect(getModesByCategory('crazy')).toHaveLength(1);
    expect(getModesByCategory('chaos')).toHaveLength(1);
    expect(getModesByCategory('choice')).toHaveLength(40);
    expect(getModesByCategory('challenge')).toHaveLength(1);
    expect(getModesByCategory('classified')).toHaveLength(60);
  });

  it('Choice modes sorted by choiceNumber', () => {
    const choices = getModesByCategory('choice');
    for (let i = 0; i < choices.length; i++) {
      expect(choices[i].choiceNumber).toBe(i + 1);
    }
  });

  it('Classified modes sorted by classifiedIndex', () => {
    const classified = getModesByCategory('classified');
    for (let i = 0; i < classified.length; i++) {
      expect(classified[i].classifiedIndex).toBe(i + 1);
    }
  });
});

// ---------------------------------------------------------------------------
// 8.4 Wave Queries
// ---------------------------------------------------------------------------

describe('Wave Queries', () => {
  it('getClassifiedByWave returns correct counts', () => {
    expect(getClassifiedByWave(1)).toHaveLength(14);
    expect(getClassifiedByWave(2)).toHaveLength(13);
    expect(getClassifiedByWave(3)).toHaveLength(10);
    expect(getClassifiedByWave(4)).toHaveLength(5);
    expect(getClassifiedByWave(5)).toHaveLength(5);
    expect(getClassifiedByWave(6)).toHaveLength(5);
    expect(getClassifiedByWave(7)).toHaveLength(5);
    expect(getClassifiedByWave(8)).toHaveLength(3);
  });

  it('getClassifiedByWave returns empty for invalid wave', () => {
    expect(getClassifiedByWave(0)).toHaveLength(0);
    expect(getClassifiedByWave(9)).toHaveLength(0);
  });

  it('wave entries are sorted by classifiedIndex', () => {
    for (let w = 1; w <= 8; w++) {
      const entries = getClassifiedByWave(w);
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].classifiedIndex).toBeGreaterThan(entries[i - 1].classifiedIndex ?? 0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 8.5 Track Queries
// ---------------------------------------------------------------------------

describe('Track Queries', () => {
  it('getModesContributingToTrack puzzle-mastery includes Challenge', () => {
    const modes = getModesContributingToTrack('puzzle-mastery');
    expect(modes.some((m) => m.id === 'challenge')).toBe(true);
  });

  it('getModesContributingToTrack chaos-veteran includes Crazy', () => {
    const modes = getModesContributingToTrack('chaos-veteran');
    expect(modes.some((m) => m.id === 'crazy')).toBe(true);
  });

  it('getModesContributingToTrack rule-bender includes all Choice modes', () => {
    const modes = getModesContributingToTrack('rule-bender');
    const choiceCount = modes.filter((m) => m.category === 'choice').length;
    expect(choiceCount).toBe(40);
  });

  it('getModesContributingToTrack world-player includes all Classified', () => {
    const modes = getModesContributingToTrack('world-player');
    const classifiedCount = modes.filter((m) => m.category === 'classified').length;
    expect(classifiedCount).toBe(60);
  });

  it('getModesContributingToTrack lifer returns empty', () => {
    expect(getModesContributingToTrack('lifer')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8.6 Career Eligibility
// ---------------------------------------------------------------------------

describe('Career Eligibility', () => {
  it('getCareerEligibleModes excludes Free Play', () => {
    const modes = getCareerEligibleModes();
    expect(modes.some((m) => m.id === 'free-play')).toBe(false);
  });

  it('getCareerEligibleModes excludes Challenge', () => {
    const modes = getCareerEligibleModes();
    expect(modes.some((m) => m.id === 'challenge')).toBe(false);
  });

  it('getCareerEligibleModes includes Classic, Crazy, Chaos, all Choice, all Classified', () => {
    const modes = getCareerEligibleModes();
    // 3 core (Classic, Crazy, Chaos) + 40 Choice + 60 Classified = 103
    expect(modes).toHaveLength(103);
  });
});

// ---------------------------------------------------------------------------
// 8.7 Implementation Filter
// ---------------------------------------------------------------------------

describe('Implementation Filter', () => {
  it('getImplementedModes returns only implemented entries', () => {
    const modes = getImplementedModes();
    // 5 core + 40 Choice = 45
    expect(modes).toHaveLength(45);
    expect(modes.every((m) => m.implemented)).toBe(true);
  });

  it('Classified placeholders have implemented: false', () => {
    const classified = getModesByCategory('classified');
    expect(classified.every((m) => !m.implemented)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8.8 GameRecord Resolution
// ---------------------------------------------------------------------------

describe('GameRecord Resolution', () => {
  it('resolves CLASSIC record to classic entry', () => {
    expect(resolveGameRecord(makeRecord({ mode: 'CLASSIC' })).displayName).toBe('Classic');
  });

  it('resolves CRAZY record to crazy entry', () => {
    expect(resolveGameRecord(makeRecord({ mode: 'CRAZY' })).displayName).toBe('Crazy');
  });

  it('resolves CHAOS record to chaos entry', () => {
    expect(resolveGameRecord(makeRecord({ mode: 'CHAOS' })).displayName).toBe('Chaos');
  });

  it('resolves CHOICE record with activeEventsPerPly to correct Choice mode', () => {
    const record = makeRecord({
      mode: 'CHOICE',
      activeEventsPerPly: [
        [{ type: 'KING_FOR_A_DAY', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }],
      ],
    });
    expect(resolveGameRecord(record).displayName).toBe('Revolution');
  });

  it('resolves CHOICE record with OppositeDay to Mirror World', () => {
    const record = makeRecord({
      mode: 'CHOICE',
      activeEventsPerPly: [
        [{ type: 'OPPOSITE_DAY', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }],
      ],
    });
    expect(resolveGameRecord(record).displayName).toBe('Mirror World');
  });

  it('resolves CHOICE record without activeEventsPerPly to fallback', () => {
    const record = makeRecord({ mode: 'CHOICE' });
    expect(resolveGameRecord(record).displayName).toBe('Unknown Mode');
  });

  it('resolves classified-1 record to Russian Draughts', () => {
    const record = makeRecord({ mode: 'classified-1' });
    expect(resolveGameRecord(record).displayName).toBe('Russian Draughts');
  });

  it('resolves unknown mode string to fallback', () => {
    const record = makeRecord({ mode: 'SOME_FUTURE_MODE' });
    expect(resolveGameRecord(record).displayName).toBe('Unknown Mode');
  });
});

// ---------------------------------------------------------------------------
// 8.9 findChoiceEntryByEvent
// ---------------------------------------------------------------------------

describe('findChoiceEntryByEvent', () => {
  it('maps each CrazyEvent with a Choice mode to the correct entry', () => {
    // Spot-check several
    expect(findChoiceEntryByEvent(CrazyEvent.KingForADay)?.displayName).toBe('Revolution');
    expect(findChoiceEntryByEvent(CrazyEvent.LiveGrenade)?.displayName).toBe('Boom Box');
    expect(findChoiceEntryByEvent(CrazyEvent.StepBack)?.displayName).toBe('Moonwalk');
    expect(findChoiceEntryByEvent(CrazyEvent.CrownThief)?.displayName).toBe('Pickpocket');
    expect(findChoiceEntryByEvent(CrazyEvent.Ricochet)?.displayName).toBe('Pinball');
    expect(findChoiceEntryByEvent(CrazyEvent.TimeBomb)?.displayName).toBe('Ticking Clock');
    expect(findChoiceEntryByEvent(CrazyEvent.MarchingOrders)?.displayName).toBe('Rank and File');
    expect(findChoiceEntryByEvent(CrazyEvent.ShrinkingBoard)?.displayName).toBe('Pressure Cooker');
  });

  it('returns undefined for DoubleTrouble', () => {
    expect(findChoiceEntryByEvent(CrazyEvent.DoubleTrouble)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 8.10 extractPermanentEvent
// ---------------------------------------------------------------------------

describe('extractPermanentEvent', () => {
  it('extracts event from valid activeEventsPerPly', () => {
    const record = makeRecord({
      activeEventsPerPly: [
        [{ type: 'KING_FOR_A_DAY', remainingPlies: -1, triggeredBy: 'WHITE', triggeredAtPly: 0 }],
      ],
    });
    expect(extractPermanentEvent(record)).toBe(CrazyEvent.KingForADay);
  });

  it('returns null for missing activeEventsPerPly', () => {
    expect(extractPermanentEvent(makeRecord({}))).toBeNull();
  });

  it('returns null for empty activeEventsPerPly array', () => {
    expect(extractPermanentEvent(makeRecord({ activeEventsPerPly: [] }))).toBeNull();
  });

  it('returns null for empty initial ply events', () => {
    expect(extractPermanentEvent(makeRecord({ activeEventsPerPly: [[]] }))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 8.11 Extensibility
// ---------------------------------------------------------------------------

describe('Extensibility', () => {
  it('Classified placeholder returns graceful fallback data', () => {
    const entry = getMode('classified-1');
    expect(entry).toBeDefined();
    expect(entry?.displayName).toBe('Russian Draughts');
    expect(entry?.wave).toBe(1);
    expect(entry?.family).toBe('Draughts');
    expect(entry?.implemented).toBe(false);
  });

  it('all entries are frozen (immutable)', () => {
    const entry = getMode('classic');
    expect(() => {
      (entry as Record<string, unknown>).displayName = 'Modified';
    }).toThrow();
  });

  it('registry is deterministic across calls', () => {
    const first = getAllModes();
    const second = getAllModes();
    expect(first.length).toBe(second.length);
    for (let i = 0; i < first.length; i++) {
      expect(first[i].id).toBe(second[i].id);
    }
  });
});

// ---------------------------------------------------------------------------
// 8.12 Edge Cases
// ---------------------------------------------------------------------------

describe('Edge Cases', () => {
  it('Extra Crazy has null permanentEvent', () => {
    const extraCrazy = getModesByCategory('choice').find((m) => m.displayName === 'Extra Crazy');
    expect(extraCrazy).toBeDefined();
    expect(extraCrazy?.permanentEvent).toBeNull();
  });

  it('Track 4 (lifer) has no direct mode contributions', () => {
    expect(getModesContributingToTrack('lifer')).toHaveLength(0);
  });

  it('Chaos has empty tracksContribution', () => {
    expect(getMode('chaos')?.tracksContribution).toEqual([]);
  });

  it('Free Play has excludeFromCareer: true', () => {
    expect(getMode('free-play')?.excludeFromCareer).toBe(true);
  });
});
