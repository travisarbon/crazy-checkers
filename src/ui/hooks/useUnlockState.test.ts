import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { PersistedUnlockState } from '../../persistence/unlockState';

// ---------------------------------------------------------------------------
// Mock evaluateUnlocks — must be set up before importing the hook
// ---------------------------------------------------------------------------

let mockEvaluateResult = {
  choiceUnlocked: false,
  classifiedUnlocked: false,
  chaosUnlocked: false,
};

vi.mock('../../persistence/unlockEvaluator', () => ({
  evaluateUnlocks: vi.fn(() => Promise.resolve({ ...mockEvaluateResult })),
  isChoiceUnlocked: (n: number) => n >= 1,
  isClassifiedUnlocked: (n: number) => n >= 100,
  isChaosUnlocked: (c: number, ch: number, cl: number) =>
    c >= 100 && ch >= 40 && cl >= 60,
}));

import { useUnlockState } from './useUnlockState';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

let mockStorage: Storage;

beforeEach(() => {
  mockStorage = createMockStorage();
  vi.stubGlobal('localStorage', mockStorage);
  mockEvaluateResult = {
    choiceUnlocked: false,
    classifiedUnlocked: false,
    chaosUnlocked: false,
  };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useUnlockState', () => {
  it('returns all-false snapshot when localStorage is empty', () => {
    const { result } = renderHook(() => useUnlockState());
    expect(result.current.snapshot.choiceUnlocked).toBe(false);
    expect(result.current.snapshot.classifiedUnlocked).toBe(false);
    expect(result.current.snapshot.chaosUnlocked).toBe(false);
  });

  it('returns cached snapshot on initial render (synchronous)', () => {
    const cached: PersistedUnlockState = {
      version: 1,
      snapshot: { choiceUnlocked: true, classifiedUnlocked: false, chaosUnlocked: false },
      seen: { choiceSeen: true, classifiedSeen: false, chaosSeen: false },
    };
    mockStorage.setItem('crazy-checkers-unlock-state', JSON.stringify(cached));

    const { result } = renderHook(() => useUnlockState());
    // Synchronous — immediately returns cached value
    expect(result.current.snapshot.choiceUnlocked).toBe(true);
  });

  it('after mount evaluation updates snapshot if unlock status changed', async () => {
    mockEvaluateResult = {
      choiceUnlocked: true,
      classifiedUnlocked: false,
      chaosUnlocked: false,
    };

    const { result } = renderHook(() => useUnlockState());

    await waitFor(() => {
      expect(result.current.snapshot.choiceUnlocked).toBe(true);
    });
  });

  it('newlyUnlocked.choice is true when choice was not previously seen', async () => {
    mockEvaluateResult = {
      choiceUnlocked: true,
      classifiedUnlocked: false,
      chaosUnlocked: false,
    };

    const { result } = renderHook(() => useUnlockState());

    await waitFor(() => {
      expect(result.current.newlyUnlocked.choice).toBe(true);
    });
  });

  it('markSeen(choice) clears newlyUnlocked.choice and persists', async () => {
    mockEvaluateResult = {
      choiceUnlocked: true,
      classifiedUnlocked: false,
      chaosUnlocked: false,
    };

    const { result } = renderHook(() => useUnlockState());

    await waitFor(() => {
      expect(result.current.newlyUnlocked.choice).toBe(true);
    });

    act(() => {
      result.current.markSeen('choice');
    });

    expect(result.current.newlyUnlocked.choice).toBe(false);

    // Verify persisted
    const raw = mockStorage.getItem('crazy-checkers-unlock-state');
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw as string) as PersistedUnlockState;
    expect(stored.seen.choiceSeen).toBe(true);
  });

  it('refreshUnlocks triggers re-evaluation', async () => {
    const { result } = renderHook(() => useUnlockState());

    // Wait for initial eval
    await waitFor(() => {
      expect(result.current.evaluating).toBe(false);
    });

    // Change what the mock returns
    mockEvaluateResult = {
      choiceUnlocked: true,
      classifiedUnlocked: true,
      chaosUnlocked: false,
    };

    act(() => {
      result.current.refreshUnlocks();
    });

    await waitFor(() => {
      expect(result.current.snapshot.classifiedUnlocked).toBe(true);
    });
  });

  it('already-seen unlocks do not re-trigger newlyUnlocked', async () => {
    // Pre-populate: choice is unlocked AND seen
    const cached: PersistedUnlockState = {
      version: 1,
      snapshot: { choiceUnlocked: true, classifiedUnlocked: false, chaosUnlocked: false },
      seen: { choiceSeen: true, classifiedSeen: false, chaosSeen: false },
    };
    mockStorage.setItem('crazy-checkers-unlock-state', JSON.stringify(cached));

    mockEvaluateResult = {
      choiceUnlocked: true,
      classifiedUnlocked: false,
      chaosUnlocked: false,
    };

    const { result } = renderHook(() => useUnlockState());

    await waitFor(() => {
      expect(result.current.evaluating).toBe(false);
    });

    // Choice is unlocked but was already seen — should not be newly unlocked
    expect(result.current.newlyUnlocked.choice).toBe(false);
  });

  it('multiple rapid refreshUnlocks calls handle correctly', async () => {
    const { result } = renderHook(() => useUnlockState());

    await waitFor(() => {
      expect(result.current.evaluating).toBe(false);
    });

    mockEvaluateResult = {
      choiceUnlocked: true,
      classifiedUnlocked: false,
      chaosUnlocked: false,
    };

    // Fire multiple refreshes rapidly
    act(() => {
      result.current.refreshUnlocks();
      result.current.refreshUnlocks();
      result.current.refreshUnlocks();
    });

    await waitFor(() => {
      expect(result.current.evaluating).toBe(false);
    });

    // Should still resolve to the correct state
    expect(result.current.snapshot.choiceUnlocked).toBe(true);
  });
});
