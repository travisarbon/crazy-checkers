/**
 * Load/save user preferences and in-progress game to localStorage.
 *
 * Settings and auto-save use a versioned envelope for forward compatibility.
 * All operations silently fail if localStorage is unavailable.
 */

import type { Settings } from '../ui/settings';
import { DEFAULT_SETTINGS } from '../ui/settings';
import type { GameState } from '../engine/types';
import type { SerializedGameState } from './serialization';
import { serializeGameState } from './serialization';

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'crazy-checkers-settings';
const SETTINGS_VERSION = 1;

interface PersistedSettingsEnvelope {
  version: number;
  data: Settings;
}

/**
 * Persists the current settings to localStorage.
 * Failures are silently swallowed (e.g., storage quota exceeded,
 * private browsing mode).
 */
export function saveSettings(settings: Settings): void {
  try {
    const envelope: PersistedSettingsEnvelope = {
      version: SETTINGS_VERSION,
      data: settings,
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(envelope));
  } catch {
    // Fail silently.
  }
}

/**
 * Reads settings from localStorage. Returns DEFAULT_SETTINGS if no
 * persisted settings exist, if the stored data is corrupt, or if the
 * schema version is unrecognized.
 */
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw === null) return DEFAULT_SETTINGS;

    const envelope: unknown = JSON.parse(raw);
    if (!isValidEnvelope(envelope)) return DEFAULT_SETTINGS;

    if (envelope.version !== SETTINGS_VERSION) return DEFAULT_SETTINGS;

    return mergeWithDefaults(envelope.data);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/**
 * Removes persisted settings. Called by the "Reset Progress" button
 * (wired in Phase 3).
 */
export function clearSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Fail silently.
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidEnvelope(value: unknown): value is PersistedSettingsEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.version === 'number' && typeof obj.data === 'object' && obj.data !== null;
}

function mergeWithDefaults(data: unknown): Settings {
  const obj = data as Record<string, unknown>;

  const themeId = isValidThemeId(obj.themeId) ? obj.themeId : DEFAULT_SETTINGS.themeId;
  const animationSpeed = isValidAnimationSpeed(obj.animationSpeed)
    ? obj.animationSpeed
    : DEFAULT_SETTINGS.animationSpeed;
  const moveConfirmation = typeof obj.moveConfirmation === 'boolean'
    ? obj.moveConfirmation
    : DEFAULT_SETTINGS.moveConfirmation;

  return { themeId, animationSpeed, moveConfirmation };
}

function isValidThemeId(value: unknown): value is Settings['themeId'] {
  return value === 'classic' || value === 'modern' || value === 'high-contrast';
}

function isValidAnimationSpeed(value: unknown): value is number {
  return typeof value === 'number' && value >= 0.5 && value <= 2.0;
}

// ---------------------------------------------------------------------------
// In-progress game auto-save
// ---------------------------------------------------------------------------

/**
 * Schema for an in-progress game saved to localStorage.
 */
export interface SavedGame {
  version: number;
  state: SerializedGameState;
  mode: string;
  playerSetup: {
    white: string;
    black: string;
  };
  flipped: boolean;
  timestamp: number;
}

const SAVED_GAME_KEY = 'crazy-checkers-saved-game';
const SAVED_GAME_VERSION = 1;

/**
 * Auto-saves the current game state to localStorage.
 * Only saves games that are IN_PROGRESS.
 */
export function saveGame(
  state: GameState,
  mode: string,
  flipped: boolean,
): void {
  if (state.status !== 'IN_PROGRESS') return;

  try {
    const saved: SavedGame = {
      version: SAVED_GAME_VERSION,
      state: serializeGameState(state),
      mode,
      playerSetup: {
        white: state.players.white,
        black: state.players.black,
      },
      flipped,
      timestamp: Date.now(),
    };
    localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(saved));
  } catch {
    // Fail silently.
  }
}

/**
 * Reads a saved in-progress game from localStorage.
 * Returns null if no saved game exists, if the data is corrupt,
 * or if the schema version is unrecognized.
 */
export function loadSavedGame(): SavedGame | null {
  try {
    const raw = localStorage.getItem(SAVED_GAME_KEY);
    if (raw === null) return null;

    const parsed: unknown = JSON.parse(raw);
    if (!isValidSavedGame(parsed)) return null;
    if (parsed.version !== SAVED_GAME_VERSION) return null;

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Removes the saved game from localStorage.
 */
export function clearSavedGame(): void {
  try {
    localStorage.removeItem(SAVED_GAME_KEY);
  } catch {
    // Fail silently.
  }
}

function isValidSavedGame(value: unknown): value is SavedGame {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.version === 'number' &&
    typeof obj.state === 'object' && obj.state !== null &&
    typeof obj.mode === 'string' &&
    typeof obj.playerSetup === 'object' && obj.playerSetup !== null &&
    typeof obj.flipped === 'boolean' &&
    typeof obj.timestamp === 'number'
  );
}
