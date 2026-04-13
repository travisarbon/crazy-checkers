/* eslint-disable @typescript-eslint/no-non-null-assertion */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isChoiceUnlocked,
  isClassifiedUnlocked,
  isChaosUnlocked,
  evaluateUnlocks,
  evaluateFullUnlockState,
  TRACK_1_THRESHOLDS,
  TRACK_2_THRESHOLDS,
  TRACK_3_THRESHOLDS,
  TRACK_5_THRESHOLDS,
  getTrack1UnlockedCount,
  getTrack1Progress,
  getTrack2UnlockedCount,
  getTrack3UnlockedCount,
  getTrack4UnlockedCount,
  getTrack5UnlockedCount,
  loadCodeUnlocks,
  saveCodeUnlocks,
  addCodeUnlock,
  clearCodeUnlocks,
  isUnlocked,
  getTrackProgress,
} from './unlockEvaluator';
import type { UnlockEvaluation, TrackId } from './unlockEvaluator';
import type { CareerSnapshot, Track4MilestoneStatus } from './careerStatsEngine';
import { CHOICE_MODE_DATA } from './choiceModeData';
import {
  recordChallengeAttempt,
  clearChallengeHistory,
  getChallengesCompletedCount,
} from './challengeRecords';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const CODE_UNLOCKS_KEY = 'crazy-checkers-code-unlocks';

function makeMilestone(
  choiceNumber: number,
  met: boolean,
  currentValue = 0,
  requiredValue = 1,
): Track4MilestoneStatus {
  return {
    choiceNumber,
    description: `Milestone ${String(choiceNumber)}`,
    condition: `test >= ${String(requiredValue)}`,
    met,
    currentValue,
    requiredValue,
  };
}

function makeDefaultMilestones(metCount = 0): Track4MilestoneStatus[] {
  return Array.from({ length: 8 }, (_, i) =>
    makeMilestone(25 + i, i < metCount),
  );
}

/**
 * Build a minimal CareerSnapshot for testing evaluateFullUnlockState.
 * Overridable fields for tracks, milestones, challenges, chaos gate data.
 */
function makeCareerSnapshot(overrides: {
  puzzlesCompleted?: number;
  track1Value?: number;
  track2Value?: number;
  track3Value?: number;
  track4MilestonesMet?: number;
  track5Value?: number;
  classifiedHardWins?: number;
  totalGames?: number;
} = {}): CareerSnapshot {
  const {
    puzzlesCompleted = 0,
    track1Value,
    track2Value = 0,
    track3Value = 0,
    track4MilestonesMet = 0,
    track5Value = 0,
    classifiedHardWins = 0,
    totalGames = 0,
  } = overrides;

  // Use puzzlesCompleted as the default Track 1 value if not specified
  const t1Val = track1Value ?? puzzlesCompleted;

  const track4Milestones = makeDefaultMilestones(track4MilestonesMet);
  const track4ThresholdArr = [1, 2, 3, 4, 5, 6, 7, 8];

  function buildTrack(
    trackId: string,
    trackName: string,
    currentValue: number,
    thresholds: readonly number[],
  ) {
    let completedMilestones = 0;
    for (const t of thresholds) {
      if (currentValue >= t) completedMilestones++;
      else break;
    }
    const nextThreshold =
      completedMilestones < thresholds.length
        ? thresholds[completedMilestones] ?? null
        : null;
    return {
      trackId,
      trackName,
      currentValue,
      thresholds: [...thresholds],
      completedMilestones,
      totalMilestones: thresholds.length,
      nextThreshold,
    };
  }

  // Track 4: value is count of met milestones
  const t4MetCount = track4Milestones.filter((m) => m.met).length;

  // Compute choice modes unlocked across all tracks for chaosGate
  const t1Unlocked = countMet(t1Val, [...TRACK_1_THRESHOLDS]);
  const t2Unlocked = countMet(track2Value, [...TRACK_2_THRESHOLDS]);
  const t3Unlocked = countMet(track3Value, [...TRACK_3_THRESHOLDS]);
  const t4Unlocked = t4MetCount;
  const t5Unlocked = countMet(track5Value, [...TRACK_5_THRESHOLDS]);
  const choiceModesUnlocked =
    t1Unlocked + t2Unlocked + t3Unlocked + t4Unlocked + t5Unlocked;

  return {
    summary: {
      totalGames,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      longestWinStreak: 0,
      currentWinStreak: 0,
      totalPlayTimeMs: 0,
      averageGameLengthPlies: 0,
      averagePlayTimeMs: 0,
    },
    perOpponent: {
      vsEasy: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
      vsHard: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
      passAround: { gamesPlayed: 0, whiteWins: 0, blackWins: 0, draws: 0 },
    },
    perMode: new Map(),
    tracks: [
      buildTrack('puzzle-mastery', 'Puzzle Mastery', t1Val, [...TRACK_1_THRESHOLDS]),
      buildTrack('chaos-veteran', 'Chaos Veteran', track2Value, [...TRACK_2_THRESHOLDS]),
      buildTrack('rule-bender', 'Rule Bender', track3Value, [...TRACK_3_THRESHOLDS]),
      buildTrack('lifer', 'Lifer', t4MetCount, track4ThresholdArr),
      buildTrack('world-player', 'World Player', track5Value, [...TRACK_5_THRESHOLDS]),
    ],
    track4Milestones,
    chaosGate: {
      challengesCompleted: puzzlesCompleted,
      choiceModesUnlocked,
      classifiedUnlocked: puzzlesCompleted >= 100,
      classifiedHardWins,
    },
    challengeStats: {
      puzzlesCompleted,
      averageRating: 0,
      bestTimeMs: null,
      currentStreak: 0,
      totalAttempts: 0,
    },
    classifiedWaves: [],
    eventStats: new Map(),
  } as CareerSnapshot;
}

function countMet(value: number, thresholds: number[]): number {
  let count = 0;
  for (const t of thresholds) {
    if (value >= t) count++;
    else break;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Direct condition evaluator tests (backward compatibility)
// ---------------------------------------------------------------------------

describe('isChoiceUnlocked', () => {
  it('returns false when 0 challenges completed', () => {
    expect(isChoiceUnlocked(0)).toBe(false);
  });

  it('returns true when 1 challenge completed', () => {
    expect(isChoiceUnlocked(1)).toBe(true);
  });

  it('returns true when many challenges completed', () => {
    expect(isChoiceUnlocked(50)).toBe(true);
  });
});

describe('isClassifiedUnlocked', () => {
  it('returns false when 99 challenges completed', () => {
    expect(isClassifiedUnlocked(99)).toBe(false);
  });

  it('returns true when 100 challenges completed', () => {
    expect(isClassifiedUnlocked(100)).toBe(true);
  });

  it('returns true when more than 100 challenges completed', () => {
    expect(isClassifiedUnlocked(150)).toBe(true);
  });
});

describe('isChaosUnlocked', () => {
  it('returns true when all gates met (100, 40, 64)', () => {
    expect(isChaosUnlocked(100, 40, 64, 64)).toBe(true);
  });

  it('returns false when choice modes short by 1 (100, 39, 64)', () => {
    expect(isChaosUnlocked(100, 39, 64, 64)).toBe(false);
  });

  it('returns false when classified games short by 1 (100, 40, 63)', () => {
    expect(isChaosUnlocked(100, 40, 63, 64)).toBe(false);
  });

  it('returns false when challenges short by 1 (99, 40, 64)', () => {
    expect(isChaosUnlocked(99, 40, 64, 64)).toBe(false);
  });

  it('returns false when all values are 0', () => {
    expect(isChaosUnlocked(0, 0, 0, 64)).toBe(false);
  });

  it('returns true when values exceed thresholds', () => {
    expect(isChaosUnlocked(200, 50, 70, 64)).toBe(true);
  });

  it('uses dynamic classified count from registry by default', () => {
    // Default parameter reads from getModesByCategory('classified').length = 64
    expect(isChaosUnlocked(100, 40, 64)).toBe(true);
    expect(isChaosUnlocked(100, 40, 63)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Threshold constant integrity tests
// ---------------------------------------------------------------------------

describe('TRACK_1_THRESHOLDS', () => {
  it('has exactly 8 elements', () => {
    expect(TRACK_1_THRESHOLDS).toHaveLength(8);
  });

  it('is monotonically increasing', () => {
    for (let i = 1; i < TRACK_1_THRESHOLDS.length; i++) {
      expect(TRACK_1_THRESHOLDS[i]).toBeGreaterThan(
        TRACK_1_THRESHOLDS[i - 1] as number,
      );
    }
  });

  it('starts at 1', () => {
    expect(TRACK_1_THRESHOLDS[0]).toBe(1);
  });

  it('ends at 99', () => {
    expect(TRACK_1_THRESHOLDS[7]).toBe(99);
  });

  it('has thresholds spaced 14 apart after the first', () => {
    for (let i = 1; i < TRACK_1_THRESHOLDS.length; i++) {
      expect(
        (TRACK_1_THRESHOLDS[i] as number) -
          (TRACK_1_THRESHOLDS[i - 1] as number),
      ).toBe(14);
    }
  });
});

describe('TRACK_2_THRESHOLDS', () => {
  it('has exactly 8 elements', () => {
    expect(TRACK_2_THRESHOLDS).toHaveLength(8);
  });

  it('is monotonically increasing', () => {
    for (let i = 1; i < TRACK_2_THRESHOLDS.length; i++) {
      expect(TRACK_2_THRESHOLDS[i]).toBeGreaterThan(
        TRACK_2_THRESHOLDS[i - 1] as number,
      );
    }
  });

  it('starts at 1 and ends at 36', () => {
    expect(TRACK_2_THRESHOLDS[0]).toBe(1);
    expect(TRACK_2_THRESHOLDS[7]).toBe(36);
  });
});

describe('TRACK_3_THRESHOLDS', () => {
  it('has exactly 8 elements', () => {
    expect(TRACK_3_THRESHOLDS).toHaveLength(8);
  });

  it('is monotonically increasing', () => {
    for (let i = 1; i < TRACK_3_THRESHOLDS.length; i++) {
      expect(TRACK_3_THRESHOLDS[i]).toBeGreaterThan(
        TRACK_3_THRESHOLDS[i - 1] as number,
      );
    }
  });

  it('starts at 1 and ends at 43', () => {
    expect(TRACK_3_THRESHOLDS[0]).toBe(1);
    expect(TRACK_3_THRESHOLDS[7]).toBe(43);
  });
});

describe('TRACK_5_THRESHOLDS', () => {
  it('has exactly 8 elements', () => {
    expect(TRACK_5_THRESHOLDS).toHaveLength(8);
  });

  it('is monotonically increasing', () => {
    for (let i = 1; i < TRACK_5_THRESHOLDS.length; i++) {
      expect(TRACK_5_THRESHOLDS[i]).toBeGreaterThan(
        TRACK_5_THRESHOLDS[i - 1] as number,
      );
    }
  });

  it('starts at 1 and ends at 64', () => {
    expect(TRACK_5_THRESHOLDS[0]).toBe(1);
    expect(TRACK_5_THRESHOLDS[7]).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// Cross-validation against CHOICE_MODE_DATA
// ---------------------------------------------------------------------------

describe('TRACK_1_THRESHOLDS cross-validation', () => {
  it('matches the puzzle-mastery entries in CHOICE_MODE_DATA', () => {
    const track1Modes = CHOICE_MODE_DATA.filter(
      (d) => d.track === 'puzzle-mastery',
    );
    expect(track1Modes).toHaveLength(TRACK_1_THRESHOLDS.length);

    for (let i = 0; i < track1Modes.length; i++) {
      const expectedThreshold = TRACK_1_THRESHOLDS[i];
      const mode = track1Modes[i];
      expect(mode).toBeDefined();
      const description = (mode as (typeof track1Modes)[number])
        .unlockThreshold;
      const match = description.match(/(\d+)/);
      expect(match).not.toBeNull();
      const parsedThreshold = Number((match as RegExpMatchArray)[1]);
      expect(parsedThreshold).toBe(expectedThreshold);
    }
  });
});

describe('TRACK_2_THRESHOLDS cross-validation', () => {
  it('matches the chaos-veteran entries in CHOICE_MODE_DATA', () => {
    const track2Modes = CHOICE_MODE_DATA.filter(
      (d) => d.track === 'chaos-veteran',
    );
    expect(track2Modes).toHaveLength(TRACK_2_THRESHOLDS.length);

    for (let i = 0; i < track2Modes.length; i++) {
      const expectedThreshold = TRACK_2_THRESHOLDS[i];
      const mode = track2Modes[i];
      expect(mode).toBeDefined();
      const description = (mode as (typeof track2Modes)[number])
        .unlockThreshold;
      const match = description.match(/(\d+)/);
      expect(match).not.toBeNull();
      const parsedThreshold = Number((match as RegExpMatchArray)[1]);
      expect(parsedThreshold).toBe(expectedThreshold);
    }
  });
});

describe('TRACK_3_THRESHOLDS cross-validation', () => {
  it('matches the rule-bender entries in CHOICE_MODE_DATA', () => {
    const track3Modes = CHOICE_MODE_DATA.filter(
      (d) => d.track === 'rule-bender',
    );
    expect(track3Modes).toHaveLength(TRACK_3_THRESHOLDS.length);

    for (let i = 0; i < track3Modes.length; i++) {
      const expectedThreshold = TRACK_3_THRESHOLDS[i];
      const mode = track3Modes[i];
      expect(mode).toBeDefined();
      const description = (mode as (typeof track3Modes)[number])
        .unlockThreshold;
      const match = description.match(/(\d+)/);
      expect(match).not.toBeNull();
      const parsedThreshold = Number((match as RegExpMatchArray)[1]);
      expect(parsedThreshold).toBe(expectedThreshold);
    }
  });
});

describe('TRACK_5_THRESHOLDS cross-validation', () => {
  it('matches all world-player entries in CHOICE_MODE_DATA (all 8 thresholds)', () => {
    const track5Modes = CHOICE_MODE_DATA.filter(
      (d) => d.track === 'world-player',
    );
    expect(track5Modes).toHaveLength(TRACK_5_THRESHOLDS.length);

    // All 8 thresholds match the numeric values in unlockThreshold text.
    for (let i = 0; i < 8; i++) {
      const expectedThreshold = TRACK_5_THRESHOLDS[i];
      const mode = track5Modes[i];
      expect(mode).toBeDefined();
      const description = (mode as (typeof track5Modes)[number])
        .unlockThreshold;
      const match = description.match(/(\d+)/);
      expect(match).not.toBeNull();
      const parsedThreshold = Number((match as RegExpMatchArray)[1]);
      expect(parsedThreshold).toBe(expectedThreshold);
    }
  });

  it('last threshold (64) matches CHOICE_MODE_DATA text and registry size', () => {
    const track5Modes = CHOICE_MODE_DATA.filter(
      (d) => d.track === 'world-player',
    );
    const lastMode = track5Modes[7];
    expect(lastMode).toBeDefined();
    // CHOICE_MODE_DATA says "Win all 64 Classified games vs. Hard CPU"
    const match = lastMode!.unlockThreshold.match(/(\d+)/);
    expect(match).not.toBeNull();
    const dataThreshold = Number((match as RegExpMatchArray)[1]);
    expect(dataThreshold).toBe(64);
    expect(TRACK_5_THRESHOLDS[7]).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// Track 1 — getTrack1UnlockedCount
// ---------------------------------------------------------------------------

describe('getTrack1UnlockedCount', () => {
  it('returns 0 when 0 challenges completed', () => {
    expect(getTrack1UnlockedCount(0)).toBe(0);
  });

  it('returns 1 at exactly threshold 1', () => {
    expect(getTrack1UnlockedCount(1)).toBe(1);
  });

  it('returns 1 just below threshold 2', () => {
    expect(getTrack1UnlockedCount(14)).toBe(1);
  });

  it('returns 2 at exactly threshold 2', () => {
    expect(getTrack1UnlockedCount(15)).toBe(2);
  });

  it('returns 8 at exactly threshold 8 (all unlocked)', () => {
    expect(getTrack1UnlockedCount(99)).toBe(8);
  });

  it('returns 8 when above all thresholds', () => {
    expect(getTrack1UnlockedCount(100)).toBe(8);
  });

  it('returns 8 for very large input', () => {
    expect(getTrack1UnlockedCount(1000)).toBe(8);
  });

  it('returns 0 for negative input', () => {
    expect(getTrack1UnlockedCount(-1)).toBe(0);
  });

  it('returns 0 for NaN input', () => {
    expect(getTrack1UnlockedCount(NaN)).toBe(0);
  });

  it('returns correct count for mid-range value (50)', () => {
    expect(getTrack1UnlockedCount(50)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Track 1 — getTrack1Progress
// ---------------------------------------------------------------------------

describe('getTrack1Progress', () => {
  it('returns correct info for zero challenges', () => {
    const info = getTrack1Progress(0);
    expect(info).toEqual({
      unlockedCount: 0,
      totalMilestones: 8,
      nextThreshold: 1,
      challengesCompleted: 0,
    });
  });

  it('returns correct info for one challenge', () => {
    const info = getTrack1Progress(1);
    expect(info).toEqual({
      unlockedCount: 1,
      totalMilestones: 8,
      nextThreshold: 15,
      challengesCompleted: 1,
    });
  });

  it('returns correct info for mid-range (50 challenges)', () => {
    const info = getTrack1Progress(50);
    expect(info).toEqual({
      unlockedCount: 4,
      totalMilestones: 8,
      nextThreshold: 57,
      challengesCompleted: 50,
    });
  });

  it('returns null nextThreshold when all 8 are unlocked (99)', () => {
    const info = getTrack1Progress(99);
    expect(info).toEqual({
      unlockedCount: 8,
      totalMilestones: 8,
      nextThreshold: null,
      challengesCompleted: 99,
    });
  });

  it('returns null nextThreshold beyond all thresholds (100)', () => {
    const info = getTrack1Progress(100);
    expect(info.nextThreshold).toBeNull();
    expect(info.unlockedCount).toBe(8);
    expect(info.challengesCompleted).toBe(100);
  });

  it('reports nextThreshold at each boundary', () => {
    expect(getTrack1Progress(0).nextThreshold).toBe(1);
    expect(getTrack1Progress(1).nextThreshold).toBe(15);
    expect(getTrack1Progress(15).nextThreshold).toBe(29);
    expect(getTrack1Progress(29).nextThreshold).toBe(43);
    expect(getTrack1Progress(43).nextThreshold).toBe(57);
    expect(getTrack1Progress(57).nextThreshold).toBe(71);
    expect(getTrack1Progress(71).nextThreshold).toBe(85);
    expect(getTrack1Progress(85).nextThreshold).toBe(99);
    expect(getTrack1Progress(99).nextThreshold).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Track 2 — getTrack2UnlockedCount
// ---------------------------------------------------------------------------

describe('getTrack2UnlockedCount', () => {
  it('returns 0 when 0 Crazy Hard wins', () => {
    expect(getTrack2UnlockedCount(0)).toBe(0);
  });

  it('returns 1 at exactly 1 Crazy Hard win', () => {
    expect(getTrack2UnlockedCount(1)).toBe(1);
  });

  it('returns 2 at 3 (exactly threshold 2)', () => {
    expect(getTrack2UnlockedCount(3)).toBe(2);
  });

  it('returns 2 at 5 (between thresholds 2 and 3)', () => {
    expect(getTrack2UnlockedCount(5)).toBe(2);
  });

  it('returns 3 at exactly 6', () => {
    expect(getTrack2UnlockedCount(6)).toBe(3);
  });

  it('returns 8 at exactly 36 (all thresholds)', () => {
    expect(getTrack2UnlockedCount(36)).toBe(8);
  });

  it('returns 8 above all thresholds', () => {
    expect(getTrack2UnlockedCount(100)).toBe(8);
  });

  it('returns 0 for NaN', () => {
    expect(getTrack2UnlockedCount(NaN)).toBe(0);
  });

  it('returns 0 for negative', () => {
    expect(getTrack2UnlockedCount(-5)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Track 3 — getTrack3UnlockedCount
// ---------------------------------------------------------------------------

describe('getTrack3UnlockedCount', () => {
  it('returns 0 when 0 Choice Hard wins', () => {
    expect(getTrack3UnlockedCount(0)).toBe(0);
  });

  it('returns 1 at exactly 1', () => {
    expect(getTrack3UnlockedCount(1)).toBe(1);
  });

  it('returns 2 at exactly 4', () => {
    expect(getTrack3UnlockedCount(4)).toBe(2);
  });

  it('returns 8 at exactly 43 (all thresholds)', () => {
    expect(getTrack3UnlockedCount(43)).toBe(8);
  });

  it('returns 0 for NaN', () => {
    expect(getTrack3UnlockedCount(NaN)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Track 4 — getTrack4UnlockedCount
// ---------------------------------------------------------------------------

describe('getTrack4UnlockedCount', () => {
  it('returns 0 when no milestones met', () => {
    expect(getTrack4UnlockedCount(makeDefaultMilestones(0))).toBe(0);
  });

  it('returns 3 when 3 milestones met', () => {
    expect(getTrack4UnlockedCount(makeDefaultMilestones(3))).toBe(3);
  });

  it('returns 8 when all 8 milestones met', () => {
    expect(getTrack4UnlockedCount(makeDefaultMilestones(8))).toBe(8);
  });

  it('returns 0 for empty array', () => {
    expect(getTrack4UnlockedCount([])).toBe(0);
  });

  it('counts milestones met in any order', () => {
    const milestones: Track4MilestoneStatus[] = [
      makeMilestone(25, false),
      makeMilestone(26, true),
      makeMilestone(27, false),
      makeMilestone(28, true),
      makeMilestone(29, false),
      makeMilestone(30, true),
      makeMilestone(31, false),
      makeMilestone(32, false),
    ];
    expect(getTrack4UnlockedCount(milestones)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Track 5 — getTrack5UnlockedCount
// ---------------------------------------------------------------------------

describe('getTrack5UnlockedCount', () => {
  it('returns 0 when 0 Classified Hard wins', () => {
    expect(getTrack5UnlockedCount(0)).toBe(0);
  });

  it('returns 1 at exactly 1', () => {
    expect(getTrack5UnlockedCount(1)).toBe(1);
  });

  it('returns 2 at exactly 5', () => {
    expect(getTrack5UnlockedCount(5)).toBe(2);
  });

  it('returns 8 at exactly 64 (all thresholds)', () => {
    expect(getTrack5UnlockedCount(64)).toBe(8);
  });

  it('returns 8 above all thresholds', () => {
    expect(getTrack5UnlockedCount(100)).toBe(8);
  });

  it('returns 0 for NaN', () => {
    expect(getTrack5UnlockedCount(NaN)).toBe(0);
  });

  it('returns 0 for negative', () => {
    expect(getTrack5UnlockedCount(-10)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Code unlock persistence (localStorage)
// ---------------------------------------------------------------------------

describe('Code unlock persistence', () => {
  beforeEach(() => {
    localStorage.removeItem(CODE_UNLOCKS_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(CODE_UNLOCKS_KEY);
  });

  it('loadCodeUnlocks returns empty set when no localStorage data', () => {
    const unlocks = loadCodeUnlocks();
    expect(unlocks.size).toBe(0);
  });

  it('loadCodeUnlocks returns entries from valid stored data', () => {
    localStorage.setItem(
      CODE_UNLOCKS_KEY,
      JSON.stringify(['choice-revolution', 'chaos']),
    );
    const unlocks = loadCodeUnlocks();
    expect(unlocks.size).toBe(2);
    expect(unlocks.has('choice-revolution')).toBe(true);
    expect(unlocks.has('chaos')).toBe(true);
  });

  it('loadCodeUnlocks returns empty set for corrupt JSON', () => {
    localStorage.setItem(CODE_UNLOCKS_KEY, 'not json{{{');
    const unlocks = loadCodeUnlocks();
    expect(unlocks.size).toBe(0);
  });

  it('loadCodeUnlocks returns empty set for non-array JSON', () => {
    localStorage.setItem(CODE_UNLOCKS_KEY, '{"key":"value"}');
    const unlocks = loadCodeUnlocks();
    expect(unlocks.size).toBe(0);
  });

  it('loadCodeUnlocks filters out non-string entries', () => {
    localStorage.setItem(
      CODE_UNLOCKS_KEY,
      JSON.stringify([1, null, 'valid', true, 'also-valid']),
    );
    const unlocks = loadCodeUnlocks();
    expect(unlocks.size).toBe(2);
    expect(unlocks.has('valid')).toBe(true);
    expect(unlocks.has('also-valid')).toBe(true);
  });

  it('saveCodeUnlocks round-trip persistence', () => {
    const original = new Set(['chaos', 'choice-revolution', 'classified']);
    saveCodeUnlocks(original);
    const loaded = loadCodeUnlocks();
    expect(loaded).toEqual(original);
  });

  it('saveCodeUnlocks sorts entries for deterministic serialization', () => {
    saveCodeUnlocks(new Set(['z-mode', 'a-mode', 'm-mode']));
    const raw = localStorage.getItem(CODE_UNLOCKS_KEY);
    expect(raw).toBe('["a-mode","m-mode","z-mode"]');
  });

  it('addCodeUnlock returns true for new unlock', () => {
    const result = addCodeUnlock('chaos');
    expect(result).toBe(true);
    const unlocks = loadCodeUnlocks();
    expect(unlocks.has('chaos')).toBe(true);
  });

  it('addCodeUnlock returns false for duplicate', () => {
    addCodeUnlock('chaos');
    const result = addCodeUnlock('chaos');
    expect(result).toBe(false);
  });

  it('loadCodeUnlocks deduplicates stored array', () => {
    localStorage.setItem(
      CODE_UNLOCKS_KEY,
      JSON.stringify(['chaos', 'chaos', 'chaos']),
    );
    const unlocks = loadCodeUnlocks();
    expect(unlocks.size).toBe(1);
  });

  it('clearCodeUnlocks removes the persisted key', () => {
    localStorage.setItem(
      CODE_UNLOCKS_KEY,
      JSON.stringify(['chaos', 'choice-revolution']),
    );
    clearCodeUnlocks();
    expect(localStorage.getItem(CODE_UNLOCKS_KEY)).toBeNull();
    expect(loadCodeUnlocks().size).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateFullUnlockState — Fresh player (no data)
// ---------------------------------------------------------------------------

describe('evaluateFullUnlockState — Fresh player', () => {
  let evaluation: UnlockEvaluation;

  beforeEach(() => {
    const snapshot = makeCareerSnapshot();
    evaluation = evaluateFullUnlockState(snapshot, new Set());
  });

  it('returns all-locked snapshot', () => {
    expect(evaluation.snapshot.choiceUnlocked).toBe(false);
    expect(evaluation.snapshot.classifiedUnlocked).toBe(false);
    expect(evaluation.snapshot.chaosUnlocked).toBe(false);
  });

  it('has 0 total Choice modes unlocked', () => {
    expect(evaluation.totalChoiceModesUnlocked).toBe(0);
  });

  it('has 5 track results', () => {
    expect(evaluation.tracks).toHaveLength(5);
  });

  it('all tracks at 0 progress', () => {
    for (const track of evaluation.tracks) {
      expect(track.currentValue).toBe(0);
      expect(track.unlockedCount).toBe(0);
      expect(track.complete).toBe(false);
    }
  });

  it('Chaos Gate all gates unmet', () => {
    expect(evaluation.chaosGate.unlocked).toBe(false);
    expect(evaluation.chaosGate.gates.challengesCompleted.met).toBe(false);
    expect(evaluation.chaosGate.gates.choiceModesUnlocked.met).toBe(false);
    expect(evaluation.chaosGate.gates.classifiedUnlocked.met).toBe(false);
    expect(evaluation.chaosGate.gates.classifiedHardWins.met).toBe(false);
  });

  it('masterUnlockActive is false', () => {
    expect(evaluation.masterUnlockActive).toBe(false);
  });

  it('all 40 Choice modes are locked', () => {
    expect(evaluation.choiceModes.size).toBe(40);
    for (const [, status] of evaluation.choiceModes) {
      expect(status.unlocked).toBe(false);
      expect(status.unlockedByProgression).toBe(false);
      expect(status.unlockedByCode).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// evaluateFullUnlockState — Player with 1 challenge solved
// ---------------------------------------------------------------------------

describe('evaluateFullUnlockState — 1 challenge solved', () => {
  let evaluation: UnlockEvaluation;

  beforeEach(() => {
    const snapshot = makeCareerSnapshot({ puzzlesCompleted: 1 });
    evaluation = evaluateFullUnlockState(snapshot, new Set());
  });

  it('Choice menu is visible', () => {
    expect(evaluation.snapshot.choiceUnlocked).toBe(true);
  });

  it('Classified and Chaos remain locked', () => {
    expect(evaluation.snapshot.classifiedUnlocked).toBe(false);
    expect(evaluation.snapshot.chaosUnlocked).toBe(false);
  });

  it('1 Choice mode unlocked (Revolution, choice #1)', () => {
    expect(evaluation.totalChoiceModesUnlocked).toBe(1);
    const mode1 = evaluation.choiceModes.get(1);
    expect(mode1).toBeDefined();
    expect(mode1!.unlocked).toBe(true);
    expect(mode1!.unlockedByProgression).toBe(true);
    expect(mode1!.registryId).toBe('choice-revolution');
  });

  it('Choice mode 2 is still locked', () => {
    const mode2 = evaluation.choiceModes.get(2);
    expect(mode2).toBeDefined();
    expect(mode2!.unlocked).toBe(false);
  });

  it('Track 1 shows unlockedCount = 1', () => {
    const track1 = evaluation.tracks.find(
      (t) => t.trackId === 'puzzle-mastery',
    );
    expect(track1).toBeDefined();
    expect(track1!.unlockedCount).toBe(1);
    expect(track1!.nextThreshold).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// evaluateFullUnlockState — Partial progress across tracks
// ---------------------------------------------------------------------------

describe('evaluateFullUnlockState — Partial progress', () => {
  it('mixed progress: 50 challenges, 10 Crazy Hard wins, 8 Choice Hard wins', () => {
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 50,
      track2Value: 10,
      track3Value: 8,
      track4MilestonesMet: 2,
      track5Value: 5,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    // Track 1: 50 challenges = 4 unlocked (thresholds 1,15,29,43)
    const t1 = evaluation.tracks.find((t) => t.trackId === 'puzzle-mastery');
    expect(t1!.unlockedCount).toBe(4);

    // Track 2: 10 Crazy Hard wins = 4 unlocked (thresholds 1,3,6,10)
    const t2 = evaluation.tracks.find((t) => t.trackId === 'chaos-veteran');
    expect(t2!.unlockedCount).toBe(4);

    // Track 3: 8 Choice Hard wins = 3 unlocked (thresholds 1,4,8)
    const t3 = evaluation.tracks.find((t) => t.trackId === 'rule-bender');
    expect(t3!.unlockedCount).toBe(3);

    // Track 4: 2 milestones met = 2 unlocked
    const t4 = evaluation.tracks.find((t) => t.trackId === 'lifer');
    expect(t4!.unlockedCount).toBe(2);

    // Track 5: 5 Classified Hard wins = 2 unlocked (thresholds 1,5)
    const t5 = evaluation.tracks.find((t) => t.trackId === 'world-player');
    expect(t5!.unlockedCount).toBe(2);

    // Total unlocked: 4+4+3+2+2 = 15
    expect(evaluation.totalChoiceModesUnlocked).toBe(15);

    // Choice menu visible
    expect(evaluation.snapshot.choiceUnlocked).toBe(true);

    // Classified not yet (need 100 challenges)
    expect(evaluation.snapshot.classifiedUnlocked).toBe(false);
  });

  it('boundary: Track 2 mode 11 at exactly 6 wins', () => {
    const snapshot = makeCareerSnapshot({ track2Value: 6 });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    // Modes 9 (pos 1), 10 (pos 2), 11 (pos 3) should be unlocked
    expect(evaluation.choiceModes.get(9)!.unlocked).toBe(true);
    expect(evaluation.choiceModes.get(10)!.unlocked).toBe(true);
    expect(evaluation.choiceModes.get(11)!.unlocked).toBe(true);
    // Mode 12 (pos 4) should be locked (needs threshold 10)
    expect(evaluation.choiceModes.get(12)!.unlocked).toBe(false);
  });

  it('boundary: Track 3 mode 24 at exactly 43 wins (all Track 3 complete)', () => {
    const snapshot = makeCareerSnapshot({ track3Value: 43 });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    for (let i = 17; i <= 24; i++) {
      expect(evaluation.choiceModes.get(i)!.unlocked).toBe(true);
    }
    const t3 = evaluation.tracks.find((t) => t.trackId === 'rule-bender');
    expect(t3!.complete).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateFullUnlockState — Full progress (everything unlocked by progression)
// ---------------------------------------------------------------------------

describe('evaluateFullUnlockState — Full progress', () => {
  it('all 40 Choice modes unlocked at maximum values', () => {
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 100,
      track2Value: 36,
      track3Value: 43,
      track4MilestonesMet: 8,
      track5Value: 64,
      classifiedHardWins: 64,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.totalChoiceModesUnlocked).toBe(40);
    for (const [, status] of evaluation.choiceModes) {
      expect(status.unlocked).toBe(true);
      expect(status.unlockedByProgression).toBe(true);
    }
  });

  it('all tracks complete', () => {
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 100,
      track2Value: 36,
      track3Value: 43,
      track4MilestonesMet: 8,
      track5Value: 64,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    for (const track of evaluation.tracks) {
      expect(track.complete).toBe(true);
      expect(track.nextThreshold).toBeNull();
    }
  });

  it('Chaos Gate fully met with 64 classified hard wins', () => {
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 100,
      track2Value: 36,
      track3Value: 43,
      track4MilestonesMet: 8,
      track5Value: 64,
      classifiedHardWins: 64,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.chaosGate.unlocked).toBe(true);
    expect(evaluation.chaosGate.gates.challengesCompleted.met).toBe(true);
    expect(evaluation.chaosGate.gates.choiceModesUnlocked.met).toBe(true);
    expect(evaluation.chaosGate.gates.classifiedUnlocked.met).toBe(true);
    expect(evaluation.chaosGate.gates.classifiedHardWins.met).toBe(true);
    expect(evaluation.snapshot.chaosUnlocked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// evaluateFullUnlockState — Code unlock overrides
// ---------------------------------------------------------------------------

describe('evaluateFullUnlockState — Code unlock overrides', () => {
  it('code unlock for single Choice mode', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['choice-revolution']),
    );

    // Mode 1 unlocked by code
    const mode1 = evaluation.choiceModes.get(1);
    expect(mode1!.unlocked).toBe(true);
    expect(mode1!.unlockedByCode).toBe(true);
    expect(mode1!.unlockedByProgression).toBe(false);

    // Others still locked
    expect(evaluation.choiceModes.get(2)!.unlocked).toBe(false);

    // Choice menu visible (1 mode unlocked)
    expect(evaluation.snapshot.choiceUnlocked).toBe(true);

    // Total unlocked = 1
    expect(evaluation.totalChoiceModesUnlocked).toBe(1);
  });

  it('code unlock for chaos', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['chaos']),
    );

    expect(evaluation.chaosGate.unlocked).toBe(true);
    expect(evaluation.chaosGate.unlockedByCode).toBe(true);
    expect(evaluation.snapshot.chaosUnlocked).toBe(true);

    // Gates still show real progress (all unmet)
    expect(evaluation.chaosGate.gates.challengesCompleted.met).toBe(false);
    expect(evaluation.chaosGate.gates.choiceModesUnlocked.met).toBe(false);
  });

  it('code unlock for classified', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['classified']),
    );

    expect(evaluation.snapshot.classifiedUnlocked).toBe(true);
    // Chaos still locked (only classified code unlock, not chaos gate met)
    expect(evaluation.snapshot.chaosUnlocked).toBe(false);
  });

  it('master unlock "all" unlocks everything', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['all']),
    );

    expect(evaluation.masterUnlockActive).toBe(true);
    expect(evaluation.totalChoiceModesUnlocked).toBe(40);
    expect(evaluation.snapshot.choiceUnlocked).toBe(true);
    expect(evaluation.snapshot.classifiedUnlocked).toBe(true);
    expect(evaluation.snapshot.chaosUnlocked).toBe(true);

    for (const [, status] of evaluation.choiceModes) {
      expect(status.unlocked).toBe(true);
      expect(status.unlockedByCode).toBe(true);
    }
  });

  it('code unlock coexists with progression', () => {
    // 1 challenge = mode 1 by progression; code unlock for mode 9 (Moonwalk)
    const snapshot = makeCareerSnapshot({ puzzlesCompleted: 1 });
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['choice-moonwalk']),
    );

    const mode1 = evaluation.choiceModes.get(1);
    expect(mode1!.unlocked).toBe(true);
    expect(mode1!.unlockedByProgression).toBe(true);
    expect(mode1!.unlockedByCode).toBe(false);

    const mode9 = evaluation.choiceModes.get(9);
    expect(mode9!.unlocked).toBe(true);
    expect(mode9!.unlockedByProgression).toBe(false);
    expect(mode9!.unlockedByCode).toBe(true);

    expect(evaluation.totalChoiceModesUnlocked).toBe(2);
  });

  it('code unlock does not corrupt track progress', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['choice-revolution']),
    );

    const t1 = evaluation.tracks.find((t) => t.trackId === 'puzzle-mastery');
    expect(t1!.currentValue).toBe(0);
    expect(t1!.unlockedCount).toBe(0);
  });

  it('empty codeUnlocks set applies no overrides', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.masterUnlockActive).toBe(false);
    expect(evaluation.totalChoiceModesUnlocked).toBe(0);
  });

  it('code unlock for "choice" makes menu visible but no modes unlocked', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['choice']),
    );

    expect(evaluation.snapshot.choiceUnlocked).toBe(true);
    expect(evaluation.totalChoiceModesUnlocked).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// evaluateFullUnlockState — Chaos Gate
// ---------------------------------------------------------------------------

describe('evaluateFullUnlockState — Chaos Gate', () => {
  it('all conditions met', () => {
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 100,
      track2Value: 36,
      track3Value: 43,
      track4MilestonesMet: 8,
      track5Value: 64,
      classifiedHardWins: 64,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.chaosGate.unlocked).toBe(true);
    expect(evaluation.chaosGate.unlockedByCode).toBe(false);
  });

  it('missing challenges (99)', () => {
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 99,
      track2Value: 36,
      track3Value: 43,
      track4MilestonesMet: 8,
      track5Value: 64,
      classifiedHardWins: 64,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.chaosGate.unlocked).toBe(false);
    expect(evaluation.chaosGate.gates.challengesCompleted.met).toBe(false);
    expect(evaluation.chaosGate.gates.challengesCompleted.current).toBe(99);
    expect(evaluation.chaosGate.gates.challengesCompleted.required).toBe(100);
  });

  it('missing Choice modes (39 of 40)', () => {
    // All tracks complete except Track 1 only has 7 of 8
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 98, // only 7 Track 1 modes (threshold 8 is 99)
      track2Value: 36,
      track3Value: 43,
      track4MilestonesMet: 8,
      track5Value: 64,
      classifiedHardWins: 64,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.chaosGate.unlocked).toBe(false);
    expect(evaluation.chaosGate.gates.choiceModesUnlocked.met).toBe(false);
    expect(evaluation.totalChoiceModesUnlocked).toBe(39);
  });

  it('missing Classified Hard wins', () => {
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 100,
      track2Value: 36,
      track3Value: 43,
      track4MilestonesMet: 8,
      track5Value: 64,
      classifiedHardWins: 63,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.chaosGate.unlocked).toBe(false);
    expect(evaluation.chaosGate.gates.classifiedHardWins.met).toBe(false);
    expect(evaluation.chaosGate.gates.classifiedHardWins.current).toBe(63);
    expect(evaluation.chaosGate.gates.classifiedHardWins.required).toBe(64);
  });

  it('all conditions unmet (fresh player)', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.chaosGate.unlocked).toBe(false);
    expect(evaluation.chaosGate.gates.challengesCompleted.met).toBe(false);
    expect(evaluation.chaosGate.gates.choiceModesUnlocked.met).toBe(false);
    expect(evaluation.chaosGate.gates.classifiedUnlocked.met).toBe(false);
    expect(evaluation.chaosGate.gates.classifiedHardWins.met).toBe(false);
  });

  it('code override bypasses all gates', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['chaos']),
    );

    expect(evaluation.chaosGate.unlocked).toBe(true);
    expect(evaluation.chaosGate.unlockedByCode).toBe(true);
    // Gates still show real (unmet) progress
    expect(evaluation.chaosGate.gates.challengesCompleted.met).toBe(false);
  });

  it('master unlock bypasses all gates', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['all']),
    );

    expect(evaluation.chaosGate.unlocked).toBe(true);
    expect(evaluation.masterUnlockActive).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Task 22.2 — Chaos Gate verification tests (plan §7.1)
  // -------------------------------------------------------------------------

  it('Task 22.2: individual gate fields (current, required, met) when all gates met', () => {
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 100,
      track2Value: 36,
      track3Value: 43,
      track4MilestonesMet: 8,
      track5Value: 64,
      classifiedHardWins: 64,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.chaosGate.gates.challengesCompleted.current).toBe(100);
    expect(evaluation.chaosGate.gates.challengesCompleted.required).toBe(100);
    expect(evaluation.chaosGate.gates.challengesCompleted.met).toBe(true);

    expect(evaluation.chaosGate.gates.choiceModesUnlocked.current).toBe(40);
    expect(evaluation.chaosGate.gates.choiceModesUnlocked.required).toBe(40);
    expect(evaluation.chaosGate.gates.choiceModesUnlocked.met).toBe(true);

    expect(evaluation.chaosGate.gates.classifiedUnlocked.met).toBe(true);

    expect(evaluation.chaosGate.gates.classifiedHardWins.current).toBe(64);
    expect(evaluation.chaosGate.gates.classifiedHardWins.required).toBe(64);
    expect(evaluation.chaosGate.gates.classifiedHardWins.met).toBe(true);
  });

  it('Task 22.2: partial progression — challenges and choice done, no classified wins → locked', () => {
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 100,
      track2Value: 36,
      track3Value: 43,
      track4MilestonesMet: 8,
      track5Value: 64,
      classifiedHardWins: 0,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.chaosGate.gates.challengesCompleted.met).toBe(true);
    expect(evaluation.chaosGate.gates.choiceModesUnlocked.met).toBe(true);
    expect(evaluation.chaosGate.gates.classifiedUnlocked.met).toBe(true);
    expect(evaluation.chaosGate.gates.classifiedHardWins.met).toBe(false);
    expect(evaluation.chaosGate.unlocked).toBe(false);
  });

  it('Task 22.2: Phase 3 realistic ceiling — everything except classified wins → chaos locked', () => {
    // In Phase 3 no Classified games are playable, so classifiedHardWins is
    // always 0 and Chaos is unreachable by normal progression.
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 100,
      track2Value: 36,
      track3Value: 43,
      track4MilestonesMet: 8,
      track5Value: 64,
      classifiedHardWins: 0,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    expect(evaluation.totalChoiceModesUnlocked).toBe(40);
    expect(evaluation.chaosGate.unlocked).toBe(false);
    expect(evaluation.snapshot.chaosUnlocked).toBe(false);
  });

  it('Task 22.2: code override coexists with partial progression — chaosGate reports real gate state', () => {
    const snapshot = makeCareerSnapshot({
      puzzlesCompleted: 50,
      track2Value: 10,
      classifiedHardWins: 0,
    });
    const evaluation = evaluateFullUnlockState(snapshot, new Set(['chaos']));

    expect(evaluation.chaosGate.unlocked).toBe(true);
    expect(evaluation.chaosGate.unlockedByCode).toBe(true);
    expect(evaluation.chaosGate.gates.challengesCompleted.met).toBe(false);
    expect(evaluation.chaosGate.gates.challengesCompleted.current).toBe(50);
    expect(evaluation.chaosGate.gates.choiceModesUnlocked.met).toBe(false);
    expect(evaluation.chaosGate.gates.classifiedHardWins.met).toBe(false);
  });

  it('Task 22.2: classifiedHardWins.required matches the classified registry count', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    // The Phase 3 registry has 64 placeholder Classified games.
    expect(evaluation.chaosGate.gates.classifiedHardWins.required).toBe(64);
  });
});

// ---------------------------------------------------------------------------
// Track 4 milestone details in evaluation
// ---------------------------------------------------------------------------

describe('evaluateFullUnlockState — Track 4 milestones', () => {
  it('Track 4 result includes milestoneDetails', () => {
    const snapshot = makeCareerSnapshot({ track4MilestonesMet: 3 });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    const t4 = evaluation.tracks.find((t) => t.trackId === 'lifer');
    expect(t4).toBeDefined();
    expect(t4!.milestoneDetails).not.toBeNull();
    expect(t4!.milestoneDetails).toHaveLength(8);
  });

  it('other tracks have null milestoneDetails', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    for (const track of evaluation.tracks) {
      if (track.trackId !== 'lifer') {
        expect(track.milestoneDetails).toBeNull();
      }
    }
  });

  it('Track 4 milestones met out of order: unlock is sequential', () => {
    // Milestones #25 and #27 met (but not #26) = 2 met total
    const milestones: Track4MilestoneStatus[] = [
      makeMilestone(25, true, 50, 50),
      makeMilestone(26, false, 3, 5),
      makeMilestone(27, true, 10, 10),
      makeMilestone(28, false, 50, 100),
      makeMilestone(29, false, 2, 5),
      makeMilestone(30, false, 0, 25),
      makeMilestone(31, false, 3, 10),
      makeMilestone(32, false, 50, 200),
    ];

    // Build snapshot with these specific milestones
    const snapshot = makeCareerSnapshot();
    // Replace track4Milestones
    const modifiedSnapshot = {
      ...snapshot,
      track4Milestones: milestones,
      tracks: snapshot.tracks.map((t) =>
        t.trackId === 'lifer'
          ? { ...t, currentValue: 2, completedMilestones: 2 }
          : t,
      ),
    } as CareerSnapshot;

    const evaluation = evaluateFullUnlockState(modifiedSnapshot, new Set());

    // 2 milestones met = modes 25 and 26 unlocked (sequential)
    expect(evaluation.choiceModes.get(25)!.unlocked).toBe(true);
    expect(evaluation.choiceModes.get(26)!.unlocked).toBe(true);
    // Mode 27 not unlocked (would need 3 milestones met)
    expect(evaluation.choiceModes.get(27)!.unlocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Convenience APIs — isUnlocked and getTrackProgress
// ---------------------------------------------------------------------------

describe('isUnlocked', () => {
  it('returns true for Choice mode unlocked by progression', () => {
    const snapshot = makeCareerSnapshot({ puzzlesCompleted: 1 });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    expect(isUnlocked('choice-revolution', evaluation)).toBe(true);
  });

  it('returns false for locked Choice mode', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    expect(isUnlocked('choice-revolution', evaluation)).toBe(false);
  });

  it('returns true for "choice" when Choice menu is visible', () => {
    const snapshot = makeCareerSnapshot({ puzzlesCompleted: 1 });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    expect(isUnlocked('choice', evaluation)).toBe(true);
  });

  it('returns false for "classified" when not enough challenges', () => {
    const snapshot = makeCareerSnapshot({ puzzlesCompleted: 50 });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    expect(isUnlocked('classified', evaluation)).toBe(false);
  });

  it('returns true for "classified" when code unlocked', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['classified']),
    );
    expect(isUnlocked('classified', evaluation)).toBe(true);
  });

  it('returns true for "chaos" when code unlocked', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['chaos']),
    );
    expect(isUnlocked('chaos', evaluation)).toBe(true);
  });

  it('returns true for core modes (classic, crazy)', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    expect(isUnlocked('classic', evaluation)).toBe(true);
    expect(isUnlocked('crazy', evaluation)).toBe(true);
  });

  it('master unlock makes everything return true', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(
      snapshot,
      new Set(['all']),
    );
    expect(isUnlocked('choice-revolution', evaluation)).toBe(true);
    expect(isUnlocked('classified', evaluation)).toBe(true);
    expect(isUnlocked('chaos', evaluation)).toBe(true);
    expect(isUnlocked('choice-ice-age', evaluation)).toBe(true);
  });
});

describe('getTrackProgress', () => {
  it('returns Track 1 progress', () => {
    const snapshot = makeCareerSnapshot({ puzzlesCompleted: 50 });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    const result = getTrackProgress('puzzle-mastery', evaluation);
    expect(result).not.toBeNull();
    expect(result!.trackId).toBe('puzzle-mastery');
    expect(result!.currentValue).toBe(50);
    expect(result!.unlockedCount).toBe(4);
  });

  it('returns null for unknown track ID', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    // Cast to TrackId to test the edge case
    const result = getTrackProgress('nonexistent' as TrackId, evaluation);
    expect(result).toBeNull();
  });

  it('returns Track 4 with milestoneDetails', () => {
    const snapshot = makeCareerSnapshot({ track4MilestonesMet: 3 });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    const result = getTrackProgress('lifer', evaluation);
    expect(result).not.toBeNull();
    expect(result!.milestoneDetails).not.toBeNull();
    expect(result!.milestoneDetails).toHaveLength(8);
  });
});

// ---------------------------------------------------------------------------
// Choice mode status mapping
// ---------------------------------------------------------------------------

describe('Choice mode status mapping', () => {
  it('all 40 modes are present in choiceModes map', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    expect(evaluation.choiceModes.size).toBe(40);
  });

  it('each mode has correct trackId', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    for (const [choiceNumber, status] of evaluation.choiceModes) {
      if (choiceNumber <= 8) expect(status.trackId).toBe('puzzle-mastery');
      else if (choiceNumber <= 16) expect(status.trackId).toBe('chaos-veteran');
      else if (choiceNumber <= 24) expect(status.trackId).toBe('rule-bender');
      else if (choiceNumber <= 32) expect(status.trackId).toBe('lifer');
      else expect(status.trackId).toBe('world-player');
    }
  });

  it('each mode has a non-empty registryId and displayName', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());

    for (const [, status] of evaluation.choiceModes) {
      expect(status.registryId).toBeTruthy();
      expect(status.displayName).toBeTruthy();
    }
  });

  it('Choice mode 25 unlocked at 1 milestone met', () => {
    const snapshot = makeCareerSnapshot({ track4MilestonesMet: 1 });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    expect(evaluation.choiceModes.get(25)!.unlocked).toBe(true);
    expect(evaluation.choiceModes.get(26)!.unlocked).toBe(false);
  });

  it('Choice mode 33 unlocked at 1 Classified Hard win', () => {
    const snapshot = makeCareerSnapshot({ track5Value: 1 });
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    expect(evaluation.choiceModes.get(33)!.unlocked).toBe(true);
    expect(evaluation.choiceModes.get(34)!.unlocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Backward compatibility — evaluateUnlocks
// ---------------------------------------------------------------------------

describe('evaluateUnlocks', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
    localStorage.removeItem(CODE_UNLOCKS_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(CODE_UNLOCKS_KEY);
  });

  it('returns all false with no challenge records', async () => {
    const snapshot = await evaluateUnlocks();
    expect(snapshot.choiceUnlocked).toBe(false);
    expect(snapshot.classifiedUnlocked).toBe(false);
    expect(snapshot.chaosUnlocked).toBe(false);
  });

  it('returns correct UnlockSnapshot shape', async () => {
    const snapshot = await evaluateUnlocks();
    expect(typeof snapshot.choiceUnlocked).toBe('boolean');
    expect(typeof snapshot.classifiedUnlocked).toBe('boolean');
    expect(typeof snapshot.chaosUnlocked).toBe('boolean');
    expect(Object.keys(snapshot).sort()).toEqual(
      ['chaosUnlocked', 'choiceUnlocked', 'classifiedUnlocked'],
    );
  });

  it('unlocks Choice after 1 solved puzzle', async () => {
    await recordChallengeAttempt(1, true, 5000, 3, ['e3-d4']);
    const snapshot = await evaluateUnlocks();
    expect(snapshot.choiceUnlocked).toBe(true);
    expect(snapshot.classifiedUnlocked).toBe(false);
    expect(snapshot.chaosUnlocked).toBe(false);
  });

  it('does not unlock Choice after 1 unsolved attempt', async () => {
    await recordChallengeAttempt(1, false, 0, 0, []);
    const snapshot = await evaluateUnlocks();
    expect(snapshot.choiceUnlocked).toBe(false);
  });

  it('Chaos remains locked even with max Track 1 unlocks', () => {
    // Track 1 provides at most 8 Choice mode unlocks; Chaos requires 40
    expect(isChaosUnlocked(100, 8, 0, 64)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration with challenge records
// ---------------------------------------------------------------------------

describe('evaluateUnlocks integration with challenge records', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
    localStorage.removeItem(CODE_UNLOCKS_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(CODE_UNLOCKS_KEY);
  });

  it('duplicate solves of same puzzle count once', async () => {
    await recordChallengeAttempt(1, true, 5000, 3, ['e3-d4']);
    await recordChallengeAttempt(1, true, 4000, 3, ['e3-d4']);
    const count = await getChallengesCompletedCount();
    expect(count).toBe(1);
  });

  it('unsolved then solved counts as 1 completed', async () => {
    await recordChallengeAttempt(1, false, 0, 0, []);
    await recordChallengeAttempt(1, true, 5000, 2, ['e3-d4']);
    const count = await getChallengesCompletedCount();
    expect(count).toBe(1);
  });

  it('boundary: 14 challenges yield 1 unlock, 15 yield 2', () => {
    expect(getTrack1UnlockedCount(14)).toBe(1);
    expect(getTrack1UnlockedCount(15)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('NaN input to all track counters returns 0', () => {
    expect(getTrack1UnlockedCount(NaN)).toBe(0);
    expect(getTrack2UnlockedCount(NaN)).toBe(0);
    expect(getTrack3UnlockedCount(NaN)).toBe(0);
    expect(getTrack5UnlockedCount(NaN)).toBe(0);
  });

  it('negative input to all track counters returns 0', () => {
    expect(getTrack1UnlockedCount(-100)).toBe(0);
    expect(getTrack2UnlockedCount(-100)).toBe(0);
    expect(getTrack3UnlockedCount(-100)).toBe(0);
    expect(getTrack5UnlockedCount(-100)).toBe(0);
  });

  it('very large input returns 8 for all tracks', () => {
    expect(getTrack1UnlockedCount(99999)).toBe(8);
    expect(getTrack2UnlockedCount(99999)).toBe(8);
    expect(getTrack3UnlockedCount(99999)).toBe(8);
    expect(getTrack5UnlockedCount(99999)).toBe(8);
  });

  it('Track 4 with empty milestones returns 0', () => {
    expect(getTrack4UnlockedCount([])).toBe(0);
  });

  it('evaluateFullUnlockState returns frozen object', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    expect(Object.isFrozen(evaluation)).toBe(true);
  });

  it('Chaos Gate classifiedHardWins required matches registry size', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    // The required value should be 64 (current registry size)
    expect(evaluation.chaosGate.gates.classifiedHardWins.required).toBe(64);
  });

  it('isUnlocked returns true for unknown mode IDs (non-Choice, non-menu)', () => {
    const snapshot = makeCareerSnapshot();
    const evaluation = evaluateFullUnlockState(snapshot, new Set());
    // Unknown modes default to "always unlocked" (core modes)
    expect(isUnlocked('some-unknown-mode', evaluation)).toBe(true);
  });
});
