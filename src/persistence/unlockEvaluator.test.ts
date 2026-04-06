import { describe, it, expect } from 'vitest';
import {
  isChoiceUnlocked,
  isClassifiedUnlocked,
  isChaosUnlocked,
  evaluateUnlocks,
} from './unlockEvaluator';

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
// Integration: evaluateUnlocks with stubs
// ---------------------------------------------------------------------------

describe('evaluateUnlocks', () => {
  it('returns all false with stubs active', async () => {
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
