import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  isChoiceUnlocked,
  isClassifiedUnlocked,
  isChaosUnlocked,
  evaluateUnlocks,
  TRACK_1_THRESHOLDS,
  getTrack1UnlockedCount,
  getTrack1Progress,
} from './unlockEvaluator';
import { CHOICE_MODE_DATA } from './choiceModeData';
import {
  recordChallengeAttempt,
  clearChallengeHistory,
  getChallengesCompletedCount,
} from './challengeRecords';

// ---------------------------------------------------------------------------
// Direct condition evaluator tests
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
  it('returns true when all gates met (100, 40, 60)', () => {
    expect(isChaosUnlocked(100, 40, 60)).toBe(true);
  });

  it('returns false when choice modes short by 1 (100, 39, 60)', () => {
    expect(isChaosUnlocked(100, 39, 60)).toBe(false);
  });

  it('returns false when classified games short by 1 (100, 40, 59)', () => {
    expect(isChaosUnlocked(100, 40, 59)).toBe(false);
  });

  it('returns false when challenges short by 1 (99, 40, 60)', () => {
    expect(isChaosUnlocked(99, 40, 60)).toBe(false);
  });

  it('returns false when all values are 0', () => {
    expect(isChaosUnlocked(0, 0, 0)).toBe(false);
  });

  it('returns true when values exceed thresholds', () => {
    expect(isChaosUnlocked(200, 50, 70)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Track 1 — TRACK_1_THRESHOLDS integrity
// ---------------------------------------------------------------------------

describe('TRACK_1_THRESHOLDS', () => {
  it('has exactly 8 elements', () => {
    expect(TRACK_1_THRESHOLDS).toHaveLength(8);
  });

  it('is monotonically increasing', () => {
    for (let i = 1; i < TRACK_1_THRESHOLDS.length; i++) {
      const current = TRACK_1_THRESHOLDS[i] as number;
      const previous = TRACK_1_THRESHOLDS[i - 1] as number;
      expect(current).toBeGreaterThan(previous);
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
      const current = TRACK_1_THRESHOLDS[i] as number;
      const previous = TRACK_1_THRESHOLDS[i - 1] as number;
      expect(current - previous).toBe(14);
    }
  });
});

// ---------------------------------------------------------------------------
// Track 1 — TRACK_1_THRESHOLDS cross-validation against CHOICE_MODE_DATA
// ---------------------------------------------------------------------------

describe('TRACK_1_THRESHOLDS cross-validation', () => {
  it('matches the puzzle-mastery entries in CHOICE_MODE_DATA', () => {
    const track1Modes = CHOICE_MODE_DATA.filter((d) => d.track === 'puzzle-mastery');
    expect(track1Modes).toHaveLength(TRACK_1_THRESHOLDS.length);

    for (let i = 0; i < track1Modes.length; i++) {
      const expectedThreshold = TRACK_1_THRESHOLDS[i];
      const mode = track1Modes[i];
      expect(mode).toBeDefined();
      const description = (mode as (typeof track1Modes)[number]).unlockThreshold;
      const match = description.match(/(\d+)/);
      expect(match).not.toBeNull();
      const parsedThreshold = Number((match as RegExpMatchArray)[1]);
      expect(parsedThreshold).toBe(expectedThreshold);
    }
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

  it('returns 2 just below threshold 3', () => {
    expect(getTrack1UnlockedCount(28)).toBe(2);
  });

  it('returns 3 at exactly threshold 3', () => {
    expect(getTrack1UnlockedCount(29)).toBe(3);
  });

  it('returns 3 just below threshold 4', () => {
    expect(getTrack1UnlockedCount(42)).toBe(3);
  });

  it('returns 4 at exactly threshold 4', () => {
    expect(getTrack1UnlockedCount(43)).toBe(4);
  });

  it('returns 4 just below threshold 5', () => {
    expect(getTrack1UnlockedCount(56)).toBe(4);
  });

  it('returns 5 at exactly threshold 5', () => {
    expect(getTrack1UnlockedCount(57)).toBe(5);
  });

  it('returns 5 just below threshold 6', () => {
    expect(getTrack1UnlockedCount(70)).toBe(5);
  });

  it('returns 6 at exactly threshold 6', () => {
    expect(getTrack1UnlockedCount(71)).toBe(6);
  });

  it('returns 6 just below threshold 7', () => {
    expect(getTrack1UnlockedCount(84)).toBe(6);
  });

  it('returns 7 at exactly threshold 7', () => {
    expect(getTrack1UnlockedCount(85)).toBe(7);
  });

  it('returns 7 just below threshold 8', () => {
    expect(getTrack1UnlockedCount(98)).toBe(7);
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
// Integration: evaluateUnlocks with stubs
// ---------------------------------------------------------------------------

describe('evaluateUnlocks', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
  });

  it('returns all false with no challenge records', async () => {
    const snapshot = await evaluateUnlocks();
    expect(snapshot.choiceUnlocked).toBe(false);
    expect(snapshot.classifiedUnlocked).toBe(false);
    expect(snapshot.chaosUnlocked).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration with mocked adapters
// ---------------------------------------------------------------------------

describe('evaluateUnlocks with mocked adapters', () => {
  it('1 challenge → Choice unlocked only', () => {
    // Use the exported condition functions directly to simulate
    expect(isChoiceUnlocked(1)).toBe(true);
    expect(isClassifiedUnlocked(1)).toBe(false);
    expect(isChaosUnlocked(1, 0, 0)).toBe(false);
  });

  it('100 challenges → Choice + Classified unlocked', () => {
    // Use the exported condition functions directly
    expect(isChoiceUnlocked(100)).toBe(true);
    expect(isClassifiedUnlocked(100)).toBe(true);
    expect(isChaosUnlocked(100, 0, 0)).toBe(false);
  });

  it('full Chaos Gate values → all three unlocked', () => {
    expect(isChoiceUnlocked(100)).toBe(true);
    expect(isClassifiedUnlocked(100)).toBe(true);
    expect(isChaosUnlocked(100, 40, 60)).toBe(true);
  });

  it('100 challenges + 40 choice + 59 classified → Chaos still locked', () => {
    expect(isChoiceUnlocked(100)).toBe(true);
    expect(isClassifiedUnlocked(100)).toBe(true);
    expect(isChaosUnlocked(100, 40, 59)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: evaluateUnlocks with challenge records
// ---------------------------------------------------------------------------

describe('evaluateUnlocks integration with challenge records', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
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
    expect(isChaosUnlocked(100, 8, 0)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  beforeEach(async () => {
    await clearChallengeHistory();
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

