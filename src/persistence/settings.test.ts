import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../ui/settings';
import { createNewGame } from '../engine/game';
import { createAmericanRules } from '../engine/rules';
import { PlayerType } from '../engine/types';
import type { Settings } from '../ui/settings';
import type { GameState } from '../engine/types';
import {
  saveSettings,
  loadSettings,
  clearSettings,
  saveGame,
  loadSavedGame,
  clearSavedGame,
} from './settings';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

let mockStorage: Storage;

beforeEach(() => {
  mockStorage = createMockStorage();
  vi.stubGlobal('localStorage', mockStorage);
});

// ---------------------------------------------------------------------------
// Settings persistence tests
// ---------------------------------------------------------------------------

describe('saveSettings', () => {
  it('writes to localStorage', () => {
    saveSettings(DEFAULT_SETTINGS);
    const raw = localStorage.getItem('crazy-checkers-settings');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { version: number; data: Settings };
    expect(parsed.version).toBe(1);
    expect(parsed.data).toEqual(DEFAULT_SETTINGS);
  });

  it('handles storage quota error without throwing', () => {
    vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => { saveSettings(DEFAULT_SETTINGS); }).not.toThrow();
  });
});

describe('loadSettings', () => {
  it('returns saved settings', () => {
    const custom: Settings = { themeId: 'current', animationSpeed: 1.5, moveConfirmation: true };
    saveSettings(custom);
    expect(loadSettings()).toEqual(custom);
  });

  it('returns defaults when empty', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults for corrupt JSON', () => {
    localStorage.setItem('crazy-checkers-settings', 'not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults for wrong version', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({ version: 999, data: DEFAULT_SETTINGS }),
    );
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('handles missing fields gracefully', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({ version: 1, data: { themeId: 'current' } }),
    );
    const result = loadSettings();
    expect(result.themeId).toBe('current');
    expect(result.animationSpeed).toBe(DEFAULT_SETTINGS.animationSpeed);
    expect(result.moveConfirmation).toBe(DEFAULT_SETTINGS.moveConfirmation);
  });

  it('rejects invalid themeId', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({ version: 1, data: { themeId: 'neon', animationSpeed: 1.0, moveConfirmation: false } }),
    );
    expect(loadSettings().themeId).toBe(DEFAULT_SETTINGS.themeId);
  });

  it('migrates legacy "modern" themeId to "current"', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({ version: 1, data: { themeId: 'modern', animationSpeed: 1.0, moveConfirmation: false } }),
    );
    expect(loadSettings().themeId).toBe('current');
  });

  it('migrates legacy "high-contrast" themeId to "contrast"', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({ version: 1, data: { themeId: 'high-contrast', animationSpeed: 1.0, moveConfirmation: false } }),
    );
    expect(loadSettings().themeId).toBe('contrast');
  });

  it('rejects out-of-range animationSpeed', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({ version: 1, data: { themeId: 'crazy', animationSpeed: 5.0, moveConfirmation: false } }),
    );
    expect(loadSettings().animationSpeed).toBe(DEFAULT_SETTINGS.animationSpeed);
  });
});

describe('clearSettings', () => {
  it('removes the key', () => {
    saveSettings(DEFAULT_SETTINGS);
    clearSettings();
    expect(localStorage.getItem('crazy-checkers-settings')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Game auto-save tests
// ---------------------------------------------------------------------------

function createTestGame(): GameState {
  const ruleSet = createAmericanRules();
  const players = { white: PlayerType.Human, black: PlayerType.Human };
  return createNewGame(ruleSet, players);
}

describe('saveGame', () => {
  it('writes to localStorage', () => {
    const state = createTestGame();
    saveGame(state, 'classic', false);
    const raw = localStorage.getItem('crazy-checkers-saved-game');
    expect(raw).not.toBeNull();
  });

  it('skips GAME_OVER states', () => {
    const state = createTestGame();
    const gameOverState: GameState = {
      ...state,
      status: 'GAME_OVER' as GameState['status'],
      result: { type: 'WHITE_WIN' as const, reason: 'NO_LEGAL_MOVES' as const },
    };
    saveGame(gameOverState, 'classic', false);
    expect(localStorage.getItem('crazy-checkers-saved-game')).toBeNull();
  });
});

describe('loadSavedGame', () => {
  it('returns saved game', () => {
    const state = createTestGame();
    saveGame(state, 'classic', false);
    const saved = loadSavedGame();
    expect(saved).not.toBeNull();
    expect(saved).toHaveProperty('mode', 'classic');
    expect(saved).toHaveProperty('flipped', false);
    expect(saved?.state.plyCount).toBe(0);
  });

  it('returns null when empty', () => {
    expect(loadSavedGame()).toBeNull();
  });

  it('returns null for corrupt data', () => {
    localStorage.setItem('crazy-checkers-saved-game', 'not json');
    expect(loadSavedGame()).toBeNull();
  });
});

describe('clearSavedGame', () => {
  it('removes the key', () => {
    const state = createTestGame();
    saveGame(state, 'classic', false);
    clearSavedGame();
    expect(loadSavedGame()).toBeNull();
  });
});
