/**
 * Data management — Export / Import / Reset for the Configure screen.
 *
 * Produces a single JSON envelope containing every piece of persisted
 * user state (localStorage keys + both IndexedDB object stores), parses
 * and validates that envelope for import, and provides an atomic reset
 * that wipes every slot.
 *
 * See Documentation/Phase 3/Task 26/Task_26_Data_Management_Plan.md
 * for the full design. This module is the single source of truth for
 * which slots are exported/imported/reset; any new persisted state
 * added to the app MUST extend the manifest here.
 */

import {
  CHALLENGES_STORE,
  GAMES_STORE_NAME,
  clearGameHistory,
  getAllGameRecords,
  getDb,
} from './gameHistory';
import type { GameRecord } from './gameHistory';
import {
  clearChallengeHistory,
  getAllChallengeRecords,
} from './challengeRecords';
import type { ChallengeRecord } from './challengeRecords';
import { clearSettings, clearSavedGame } from './settings';
import { clearRedemptionHistory } from './redemptionHistory';
import { clearUnlockState } from './unlockState';
import { clearCodeUnlocks } from './unlockEvaluator';

// ---------------------------------------------------------------------------
// Manifest — the single source of truth for what gets exported/imported/reset
// ---------------------------------------------------------------------------

const SETTINGS_KEY = 'crazy-checkers-settings';
const SAVED_GAME_KEY = 'crazy-checkers-saved-game';
const UNLOCK_STATE_KEY = 'crazy-checkers-unlock-state';
const CODE_UNLOCKS_KEY = 'crazy-checkers-code-unlocks';
const REDEMPTION_HISTORY_KEY = 'crazy-checkers-redemption-history';

// ---------------------------------------------------------------------------
// Envelope schema
// ---------------------------------------------------------------------------

export const EXPORT_SCHEMA = 'crazy-checkers-export' as const;
export const EXPORT_SCHEMA_VERSION = 1 as const;

export interface ExportPayload {
  /** Raw JSON envelope string from localStorage (or undefined if absent). */
  readonly settings?: string;
  readonly savedGame?: string;
  readonly unlockState?: string;
  readonly codeUnlocks?: string;
  readonly redemptionHistory?: string;
  /** Parsed IndexedDB records. */
  readonly games: GameRecord[];
  readonly challenges: ChallengeRecord[];
}

export interface ExportEnvelope {
  readonly schema: typeof EXPORT_SCHEMA;
  readonly schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  readonly exportedAt: number;
  readonly appVersion: string;
  readonly payload: ExportPayload;
}

export type ParseResult =
  | { kind: 'ok'; envelope: ExportEnvelope }
  | { kind: 'invalid-envelope'; reason: string }
  | { kind: 'unsupported-version'; actualVersion: number };

export type ImportResult =
  | { kind: 'ok' }
  | { kind: 'write-failed'; slot: keyof ExportPayload; error: unknown };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lsGet(key: string): string | undefined {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function lsSet(key: string, value: string | undefined): void {
  if (value === undefined) return;
  localStorage.setItem(key, value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getAppVersion(): string {
  const v = (import.meta as unknown as { env?: { VITE_APP_VERSION?: string } })
    .env?.VITE_APP_VERSION;
  return typeof v === 'string' && v.length > 0 ? v : 'unknown';
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Collect every persisted slot into a single envelope. Safe to call on
 * a fresh install — absent localStorage keys appear as `undefined` and
 * empty IndexedDB stores produce empty arrays.
 */
export async function exportAll(): Promise<ExportEnvelope> {
  let games: GameRecord[] = [];
  let challenges: ChallengeRecord[] = [];
  try {
    [games, challenges] = await Promise.all([
      getAllGameRecords(),
      getAllChallengeRecords(),
    ]);
  } catch {
    // IndexedDB unavailable (private mode, disk full, etc.). Continue
    // with empty arrays so the user still gets a file with their
    // localStorage-backed settings + unlocks.
  }

  return {
    schema: EXPORT_SCHEMA,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    appVersion: getAppVersion(),
    payload: {
      settings: lsGet(SETTINGS_KEY),
      savedGame: lsGet(SAVED_GAME_KEY),
      unlockState: lsGet(UNLOCK_STATE_KEY),
      codeUnlocks: lsGet(CODE_UNLOCKS_KEY),
      redemptionHistory: lsGet(REDEMPTION_HISTORY_KEY),
      games,
      challenges,
    },
  };
}

/**
 * Serialize an envelope for download. Pretty-printed for human auditability.
 */
export function serializeExportEnvelope(envelope: ExportEnvelope): string {
  return JSON.stringify(envelope, null, 2);
}

// ---------------------------------------------------------------------------
// Parse + validate
// ---------------------------------------------------------------------------

/**
 * Parse and validate an export JSON blob. Returns a discriminated union
 * — the caller must narrow on `kind` before using `envelope`.
 */
export function parseExportEnvelope(json: string): ParseResult {
  if (json.trim().length === 0) {
    return { kind: 'invalid-envelope', reason: 'File is empty.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { kind: 'invalid-envelope', reason: 'File is not valid JSON.' };
  }

  if (!isPlainObject(parsed)) {
    return { kind: 'invalid-envelope', reason: 'Root is not an object.' };
  }
  if (parsed.schema !== EXPORT_SCHEMA) {
    return {
      kind: 'invalid-envelope',
      reason: `Not a Crazy Checkers export file (schema marker was "${String(parsed.schema)}").`,
    };
  }
  if (typeof parsed.schemaVersion !== 'number') {
    return {
      kind: 'invalid-envelope',
      reason: 'schemaVersion is missing or not a number.',
    };
  }
  if (parsed.schemaVersion > EXPORT_SCHEMA_VERSION) {
    return {
      kind: 'unsupported-version',
      actualVersion: parsed.schemaVersion,
    };
  }
  if (typeof parsed.exportedAt !== 'number') {
    return { kind: 'invalid-envelope', reason: 'exportedAt missing.' };
  }
  if (typeof parsed.appVersion !== 'string') {
    return { kind: 'invalid-envelope', reason: 'appVersion missing.' };
  }
  if (!isPlainObject(parsed.payload)) {
    return { kind: 'invalid-envelope', reason: 'payload missing.' };
  }

  const payload = parsed.payload;
  if (!Array.isArray(payload.games)) {
    return {
      kind: 'invalid-envelope',
      reason: 'payload.games must be an array.',
    };
  }
  if (!Array.isArray(payload.challenges)) {
    return {
      kind: 'invalid-envelope',
      reason: 'payload.challenges must be an array.',
    };
  }

  // Optional string slots — validate type when present.
  for (const slot of ['settings', 'savedGame', 'unlockState', 'codeUnlocks', 'redemptionHistory'] as const) {
    const v: unknown = payload[slot];
    if (v !== undefined && typeof v !== 'string') {
      return {
        kind: 'invalid-envelope',
        reason: `payload.${slot} must be a string if present.`,
      };
    }
  }

  return { kind: 'ok', envelope: parsed as unknown as ExportEnvelope };
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Write an envelope's payload back to storage. Replaces matching slots;
 * absent slots are left untouched. See Task 26 plan §3.5 for the
 * transactional-guarantee caveat.
 */
export async function importAll(envelope: ExportEnvelope): Promise<ImportResult> {
  const { payload } = envelope;

  // Phase A — localStorage (fast, synchronous).
  try {
    lsSet(SETTINGS_KEY, payload.settings);
    lsSet(SAVED_GAME_KEY, payload.savedGame);
    lsSet(UNLOCK_STATE_KEY, payload.unlockState);
    lsSet(CODE_UNLOCKS_KEY, payload.codeUnlocks);
    lsSet(REDEMPTION_HISTORY_KEY, payload.redemptionHistory);
  } catch (error) {
    return { kind: 'write-failed', slot: 'settings', error };
  }

  // Phase B — IndexedDB (one transaction across both stores).
  try {
    const db = await getDb();
    const tx = db.transaction([GAMES_STORE_NAME, CHALLENGES_STORE], 'readwrite');
    const gamesStore = tx.objectStore(GAMES_STORE_NAME);
    await gamesStore.clear();
    for (const game of payload.games) {
      await gamesStore.put(game);
    }
    const challengesStore = tx.objectStore(CHALLENGES_STORE);
    await challengesStore.clear();
    for (const challenge of payload.challenges) {
      await challengesStore.put(challenge);
    }
    await tx.done;
  } catch (error) {
    return { kind: 'write-failed', slot: 'games', error };
  }

  return { kind: 'ok' };
}

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

/**
 * Wipe every persisted store. The caller is responsible for reloading
 * the page afterwards so cached React/Zustand state re-initializes
 * from the now-empty storage.
 */
export async function resetAll(): Promise<void> {
  clearSettings();
  clearSavedGame();
  clearUnlockState();
  clearCodeUnlocks();
  clearRedemptionHistory();
  await clearGameHistory();
  await clearChallengeHistory();
}
