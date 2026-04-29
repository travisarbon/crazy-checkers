/**
 * Load/save user preferences and in-progress game to localStorage.
 *
 * Settings and auto-save use a versioned envelope for forward compatibility.
 * All operations silently fail if localStorage is unavailable.
 */

import type { Settings } from '../ui/settings';
import { DEFAULT_SETTINGS } from '../ui/settings';
import type { TimeControlConfig } from '../engine/clock';
import type { GameState } from '../engine/types';
import type { SerializedGameState } from './serialization';
import { serializeGameState } from './serialization';

// ---------------------------------------------------------------------------
// Settings persistence
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'crazy-checkers-settings';
const SETTINGS_VERSION = 4;

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

    // Accept current version and up to two previous versions (v1 → v2 → v3 migration)
    if (envelope.version < SETTINGS_VERSION - 2 || envelope.version > SETTINGS_VERSION) {
      return DEFAULT_SETTINGS;
    }

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

  const themeId = migrateThemeId(obj.themeId) ?? DEFAULT_SETTINGS.themeId;
  const animationSpeed = isValidAnimationSpeed(obj.animationSpeed)
    ? obj.animationSpeed
    : DEFAULT_SETTINGS.animationSpeed;
  const moveConfirmation =
    typeof obj.moveConfirmation === 'boolean'
      ? obj.moveConfirmation
      : DEFAULT_SETTINGS.moveConfirmation;

  // Audio fields (new in v2, with safe defaults for v1 upgrades)
  const masterVolume = isValidVolume(obj.masterVolume)
    ? obj.masterVolume
    : DEFAULT_SETTINGS.masterVolume;
  const sfxVolume = isValidVolume(obj.sfxVolume)
    ? obj.sfxVolume
    : DEFAULT_SETTINGS.sfxVolume;
  const musicVolume = isValidVolume(obj.musicVolume)
    ? obj.musicVolume
    : DEFAULT_SETTINGS.musicVolume;
  const muted =
    typeof obj.muted === 'boolean' ? obj.muted : DEFAULT_SETTINGS.muted;
  const audioPackId =
    typeof obj.audioPackId === 'string'
      ? obj.audioPackId
      : DEFAULT_SETTINGS.audioPackId;

  // Margin Notes substrate flag (P1.3, P4.1, P6.3) — purely additive,
  // no SETTINGS_VERSION bump.
  //
  // P4.1 changed the default-derivation rule: when the field is absent
  // from a stored envelope, we derive the default from the stored
  // themeId. A stored `themeId === 'margin-notes'` defaults to `true`
  // (the dogfood cohort, and post-P6.1 the global default); every other
  // theme defaults to a literal `false`. An explicit boolean in the
  // envelope ALWAYS wins over the derivation — the user's choice is
  // sticky.
  //
  // The derivation uses a literal `false` (not DEFAULT_SETTINGS) for the
  // non-margin-notes case so that DEFAULT_SETTINGS.marginNotesEscalation
  // can flip to `true` (per P6.1) without retroactively turning
  // escalation on for users on Cork/Current/Classic/Contrast/crazy-original.
  const marginNotesEscalation =
    typeof obj.marginNotesEscalation === 'boolean'
      ? obj.marginNotesEscalation
      : themeId === 'margin-notes';

  // Time control field (new in v3, defaults to null = untimed for v1/v2 upgrades)
  const timeControl = isValidTimeControl(obj.timeControl)
    ? obj.timeControl
    : null;

  // P6.4 — toast state. Both fields are purely additive on the v4
  // envelope; old envelopes without the fields default to "never dismissed,
  // never seen" so the toast is eligible to show.
  const marginNotesToastDismissed =
    typeof obj.marginNotesToastDismissed === 'boolean'
      ? obj.marginNotesToastDismissed
      : DEFAULT_SETTINGS.marginNotesToastDismissed;
  const marginNotesToastFirstSeenAt =
    typeof obj.marginNotesToastFirstSeenAt === 'number'
      ? obj.marginNotesToastFirstSeenAt
      : DEFAULT_SETTINGS.marginNotesToastFirstSeenAt;

  return {
    themeId,
    animationSpeed,
    moveConfirmation,
    masterVolume,
    sfxVolume,
    musicVolume,
    muted,
    audioPackId,
    marginNotesEscalation,
    timeControl,
    marginNotesToastDismissed,
    marginNotesToastFirstSeenAt,
  };
}

/** Maps legacy theme IDs from before the rename to their new IDs. */
const LEGACY_THEME_MAP: Record<string, Settings['themeId']> = {
  modern: 'current',
  'high-contrast': 'contrast',
  crazy: 'crazy-original',
};

function migrateThemeId(value: unknown): Settings['themeId'] | null {
  if (typeof value !== 'string') return null;
  const legacy = LEGACY_THEME_MAP[value];
  if (legacy) return legacy;
  if (isValidThemeId(value)) return value;
  return null;
}

function isValidThemeId(value: unknown): value is Settings['themeId'] {
  return (
    value === 'classic' ||
    value === 'contrast' ||
    value === 'cork' ||
    value === 'crazy-original' ||
    value === 'current' ||
    value === 'margin-notes'
  );
}

function isValidAnimationSpeed(value: unknown): value is number {
  return typeof value === 'number' && value >= 0.5 && value <= 2.0;
}

function isValidVolume(value: unknown): value is number {
  return typeof value === 'number' && value >= 0.0 && value <= 1.0;
}

function isValidTimeControl(value: unknown): value is TimeControlConfig {
  if (value === null || value === undefined) return false;
  if (typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  const validModes = ['perMove', 'suddenDeath', 'increment', 'delay'];
  if (!validModes.includes(obj.mode as string)) return false;

  switch (obj.mode) {
    case 'perMove':
      return typeof obj.perMoveTimeMs === 'number' && obj.perMoveTimeMs > 0;
    case 'suddenDeath':
      return typeof obj.totalTimeMs === 'number' && obj.totalTimeMs > 0;
    case 'increment':
      return (
        typeof obj.totalTimeMs === 'number' && obj.totalTimeMs > 0 &&
        typeof obj.incrementMs === 'number' && obj.incrementMs >= 0
      );
    case 'delay':
      return (
        typeof obj.totalTimeMs === 'number' && obj.totalTimeMs > 0 &&
        typeof obj.delayMs === 'number' && obj.delayMs >= 0
      );
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// P4.1 — Theme-change → escalation-flag coupling
// ---------------------------------------------------------------------------

/**
 * Returns a new Settings object that flips on `marginNotesEscalation` when
 * the user is moving TO `margin-notes` for the first time. Once the user
 * has explicitly toggled the flag (in either direction), the explicit
 * choice is sticky and is preserved across all subsequent theme changes.
 *
 * Callers — typically ConfigScreen's theme-radio onClick — should use this
 * helper instead of a bare `{ ...prev, themeId: next }` spread when
 * updating the active theme. The helper is a no-op for any non-margin-notes
 * target.
 *
 * The "explicitly toggled" signal is the literal stored value of
 * `marginNotesEscalation`. If the field was present in the stored envelope
 * and its value disagrees with the theme-derived default, we treat the
 * field as user-set and never override it. The merge logic in
 * `mergeWithDefaults` handles the converse case (deriving the default at
 * load time when the field is absent from the envelope).
 */
export function coerceEscalationOnThemeChange(
  prev: Settings,
  nextThemeId: Settings['themeId'],
): Settings {
  if (nextThemeId === 'margin-notes' && prev.themeId !== 'margin-notes' && !prev.marginNotesEscalation) {
    return { ...prev, themeId: nextThemeId, marginNotesEscalation: true };
  }
  return { ...prev, themeId: nextThemeId };
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
  // Time control fields (added in v2, optional for backward compatibility)
  timeControl?: TimeControlConfig | null;
  remainingTimeWhiteMs?: number;
  remainingTimeBlackMs?: number;
}

const SAVED_GAME_KEY = 'crazy-checkers-saved-game';
const SAVED_GAME_VERSION = 2;

/**
 * Auto-saves the current game state to localStorage.
 * Only saves games that are IN_PROGRESS.
 */
export function saveGame(
  state: GameState,
  mode: string,
  flipped: boolean,
  timeControl?: TimeControlConfig | null,
  remainingTimeWhiteMs?: number,
  remainingTimeBlackMs?: number,
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
      ...(timeControl !== undefined ? { timeControl } : {}),
      ...(remainingTimeWhiteMs !== undefined ? { remainingTimeWhiteMs } : {}),
      ...(remainingTimeBlackMs !== undefined ? { remainingTimeBlackMs } : {}),
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
    // Accept v1 (Phase 1, no time control) and v2 (Phase 2, with time control)
    if (parsed.version !== SAVED_GAME_VERSION && parsed.version !== SAVED_GAME_VERSION - 1) {
      return null;
    }

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

/**
 * Returns true if a saved game exists in persistence for the specified mode.
 * Mode is matched against the SavedGame.mode field.
 */
export function savedGameExistsForMode(targetMode: string): boolean {
  const saved = loadSavedGame();
  return saved !== null && saved.mode === targetMode;
}

/**
 * Returns the saved game if it matches the specified mode, or null otherwise.
 */
export function loadSavedGameForMode(targetMode: string): SavedGame | null {
  const saved = loadSavedGame();
  if (saved !== null && saved.mode === targetMode) {
    return saved;
  }
  return null;
}

function isValidSavedGame(value: unknown): value is SavedGame {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.version === 'number' &&
    typeof obj.state === 'object' &&
    obj.state !== null &&
    typeof obj.mode === 'string' &&
    typeof obj.playerSetup === 'object' &&
    obj.playerSetup !== null &&
    typeof obj.flipped === 'boolean' &&
    typeof obj.timestamp === 'number'
  );
}
