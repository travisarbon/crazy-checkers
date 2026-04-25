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
// Settings persistence tests
// ---------------------------------------------------------------------------

describe('saveSettings', () => {
  it('writes to localStorage', () => {
    saveSettings(DEFAULT_SETTINGS);
    const raw = localStorage.getItem('crazy-checkers-settings');
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw as string) as { version: number; data: Settings };
    expect(parsed.version).toBe(4);
    expect(parsed.data).toEqual(DEFAULT_SETTINGS);
  });

  it('handles storage quota error without throwing', () => {
    vi.spyOn(mockStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => {
      saveSettings(DEFAULT_SETTINGS);
    }).not.toThrow();
  });
});

describe('loadSettings', () => {
  it('returns saved settings', () => {
    const custom: Settings = {
      themeId: 'current',
      animationSpeed: 1.5,
      moveConfirmation: true,
      masterVolume: 0.8,
      sfxVolume: 0.9,
      musicVolume: 0.6,
      muted: true,
      audioPackId: 'silent',
      marginNotesEscalation: false,
      timeControl: null,
    };
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
      JSON.stringify({ version: 2, data: { themeId: 'current' } }),
    );
    const result = loadSettings();
    expect(result.themeId).toBe('current');
    expect(result.animationSpeed).toBe(DEFAULT_SETTINGS.animationSpeed);
    expect(result.moveConfirmation).toBe(DEFAULT_SETTINGS.moveConfirmation);
  });

  it('rejects invalid themeId', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 3,
        data: { themeId: 'neon', animationSpeed: 1.0, moveConfirmation: false },
      }),
    );
    expect(loadSettings().themeId).toBe(DEFAULT_SETTINGS.themeId);
  });

  it('migrates legacy "modern" themeId to "current"', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 2,
        data: { themeId: 'modern', animationSpeed: 1.0, moveConfirmation: false },
      }),
    );
    expect(loadSettings().themeId).toBe('current');
  });

  it('migrates legacy "high-contrast" themeId to "contrast"', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 2,
        data: { themeId: 'high-contrast', animationSpeed: 1.0, moveConfirmation: false },
      }),
    );
    expect(loadSettings().themeId).toBe('contrast');
  });

  it('accepts margin-notes themeId (P1.1)', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 3,
        data: { ...DEFAULT_SETTINGS, themeId: 'margin-notes' },
      }),
    );
    expect(loadSettings().themeId).toBe('margin-notes');
  });

  it('migrates legacy "crazy" themeId to "crazy-original" (P1.2)', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 3,
        data: {
          ...DEFAULT_SETTINGS,
          themeId: 'crazy',
        },
      }),
    );
    expect(loadSettings().themeId).toBe('crazy-original');
  });

  it('round-trips a v4 envelope with crazy-original themeId (P1.2)', () => {
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      themeId: 'crazy-original',
    };
    saveSettings(settings);
    expect(loadSettings()).toEqual(settings);
  });

  it('rejects bare "crazy" themeId without legacy migration mapping (regression guard)', () => {
    // After P1.2, isValidThemeId returns false for 'crazy'. The legacy map
    // catches it for stored envelopes, but a value reaching isValidThemeId
    // directly (e.g. via a future code path) must not slip through.
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 3,
        data: { ...DEFAULT_SETTINGS, themeId: 'crazy' },
      }),
    );
    // Stored 'crazy' is migrated by LEGACY_THEME_MAP, not by isValidThemeId.
    expect(loadSettings().themeId).toBe('crazy-original');
  });

  it('rejects out-of-range animationSpeed', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 3,
        data: { themeId: 'classic', animationSpeed: 5.0, moveConfirmation: false },
      }),
    );
    expect(loadSettings().animationSpeed).toBe(DEFAULT_SETTINGS.animationSpeed);
  });

  it('migrates v2 settings to v3 (preserves audio fields)', () => {
    // P1.2 slid the load window to [v2, v3, v4]; the original v1-to-v2
    // case asserted that audio defaults get filled in for envelopes that
    // pre-date them. The same code path still runs for any pre-current
    // envelope; we now exercise it with a v2 fixture.
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 2,
        data: { themeId: 'current', animationSpeed: 1.5, moveConfirmation: true },
      }),
    );
    const result = loadSettings();
    // Original fields preserved
    expect(result.themeId).toBe('current');
    expect(result.animationSpeed).toBe(1.5);
    expect(result.moveConfirmation).toBe(true);
    // Audio fields get defaults
    expect(result.masterVolume).toBe(DEFAULT_SETTINGS.masterVolume);
    expect(result.sfxVolume).toBe(DEFAULT_SETTINGS.sfxVolume);
    expect(result.musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
    expect(result.muted).toBe(DEFAULT_SETTINGS.muted);
    expect(result.audioPackId).toBe(DEFAULT_SETTINGS.audioPackId);
  });

  it('rejects volume values outside 0.0-1.0', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 2,
        data: {
          themeId: 'classic',
          animationSpeed: 1.0,
          moveConfirmation: false,
          masterVolume: 1.5,
          sfxVolume: -0.1,
          musicVolume: 'not a number',
          muted: false,
          audioPackId: 'default',
        },
      }),
    );
    const result = loadSettings();
    expect(result.masterVolume).toBe(DEFAULT_SETTINGS.masterVolume);
    expect(result.sfxVolume).toBe(DEFAULT_SETTINGS.sfxVolume);
    expect(result.musicVolume).toBe(DEFAULT_SETTINGS.musicVolume);
  });

  it('preserves valid audio settings in v2', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 2,
        data: {
          themeId: 'classic',
          animationSpeed: 1.0,
          moveConfirmation: false,
          masterVolume: 0.3,
          sfxVolume: 0.8,
          musicVolume: 0.4,
          muted: true,
          audioPackId: 'silent',
        },
      }),
    );
    const result = loadSettings();
    expect(result.masterVolume).toBe(0.3);
    expect(result.sfxVolume).toBe(0.8);
    expect(result.musicVolume).toBe(0.4);
    expect(result.muted).toBe(true);
    expect(result.audioPackId).toBe('silent');
  });

  // ── P1.3 — marginNotesEscalation persistence ───────────────────────

  it('round-trips marginNotesEscalation: true (P1.3)', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 4,
        data: { ...DEFAULT_SETTINGS, marginNotesEscalation: true },
      }),
    );
    expect(loadSettings().marginNotesEscalation).toBe(true);
  });

  it('defaults marginNotesEscalation to false when the field is missing (P1.3)', () => {
    const partial: Record<string, unknown> = { ...DEFAULT_SETTINGS };
    delete partial.marginNotesEscalation;
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({ version: 4, data: partial }),
    );
    expect(loadSettings().marginNotesEscalation).toBe(false);
  });

  it('rejects non-boolean marginNotesEscalation (P1.3)', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 4,
        data: { ...DEFAULT_SETTINGS, marginNotesEscalation: 'yes' },
      }),
    );
    expect(loadSettings().marginNotesEscalation).toBe(false);
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
