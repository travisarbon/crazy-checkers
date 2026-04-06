import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadUnlockState,
  saveUnlockState,
  clearUnlockState,
} from './unlockState';
import type { PersistedUnlockState } from './unlockState';

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
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('unlockState persistence', () => {
  it('loadUnlockState returns defaults when localStorage is empty', () => {
    const state = loadUnlockState();
    expect(state.version).toBe(1);
    expect(state.snapshot.choiceUnlocked).toBe(false);
    expect(state.snapshot.classifiedUnlocked).toBe(false);
    expect(state.snapshot.chaosUnlocked).toBe(false);
    expect(state.seen.choiceSeen).toBe(false);
    expect(state.seen.classifiedSeen).toBe(false);
    expect(state.seen.chaosSeen).toBe(false);
  });

  it('saveUnlockState + loadUnlockState round-trips correctly', () => {
    const state: PersistedUnlockState = {
      version: 1,
      snapshot: {
        choiceUnlocked: true,
        classifiedUnlocked: false,
        chaosUnlocked: true,
      },
      seen: {
        choiceSeen: true,
        classifiedSeen: false,
        chaosSeen: false,
      },
    };
    saveUnlockState(state);
    const loaded = loadUnlockState();
    expect(loaded).toEqual(state);
  });

  it('corrupt JSON in localStorage returns defaults', () => {
    mockStorage.setItem('crazy-checkers-unlock-state', '{{not valid json');
    const state = loadUnlockState();
    expect(state.snapshot.choiceUnlocked).toBe(false);
    expect(state.snapshot.classifiedUnlocked).toBe(false);
    expect(state.snapshot.chaosUnlocked).toBe(false);
  });

  it('wrong version number returns defaults', () => {
    const badVersion: PersistedUnlockState = {
      version: 99,
      snapshot: {
        choiceUnlocked: true,
        classifiedUnlocked: true,
        chaosUnlocked: true,
      },
      seen: {
        choiceSeen: true,
        classifiedSeen: true,
        chaosSeen: true,
      },
    };
    mockStorage.setItem('crazy-checkers-unlock-state', JSON.stringify(badVersion));
    const state = loadUnlockState();
    expect(state.snapshot.choiceUnlocked).toBe(false);
    expect(state.snapshot.classifiedUnlocked).toBe(false);
    expect(state.snapshot.chaosUnlocked).toBe(false);
  });

  it('clearUnlockState removes the key', () => {
    saveUnlockState({
      version: 1,
      snapshot: { choiceUnlocked: true, classifiedUnlocked: true, chaosUnlocked: true },
      seen: { choiceSeen: true, classifiedSeen: true, chaosSeen: true },
    });
    clearUnlockState();
    const state = loadUnlockState();
    expect(state.snapshot.choiceUnlocked).toBe(false);
    expect(state.snapshot.classifiedUnlocked).toBe(false);
    expect(state.snapshot.chaosUnlocked).toBe(false);
  });

  it('missing fields in partial data merge with defaults', () => {
    // Simulate partial data: snapshot missing classifiedUnlocked, seen missing chaosSeen
    const partial = {
      version: 1,
      snapshot: { choiceUnlocked: true },
      seen: { choiceSeen: true },
    };
    mockStorage.setItem('crazy-checkers-unlock-state', JSON.stringify(partial));
    const state = loadUnlockState();
    expect(state.snapshot.choiceUnlocked).toBe(true);
    expect(state.snapshot.classifiedUnlocked).toBe(false);
    expect(state.snapshot.chaosUnlocked).toBe(false);
    expect(state.seen.choiceSeen).toBe(true);
    expect(state.seen.classifiedSeen).toBe(false);
    expect(state.seen.chaosSeen).toBe(false);
  });
});
