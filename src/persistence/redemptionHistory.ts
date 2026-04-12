/**
 * Redemption history persistence for Code mode.
 *
 * Stores a chronological log of successful code redemptions so the Code
 * screen can display what the player has already entered. The low-level
 * unlock-target IDs themselves live in `unlockEvaluator`'s codeUnlocks;
 * this module only tracks user-facing metadata.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RedemptionRecord {
  /** The original code as entered, after normalization (uppercase, alnum). */
  readonly code: string;
  /** Human-readable description of what was unlocked. */
  readonly description: string;
  /** Number of new unlock targets added (excludes already-unlocked). */
  readonly newUnlocksCount: number;
  /** Timestamp of redemption (Date.now()). */
  readonly timestamp: number;
}

interface RedemptionHistoryEnvelope {
  readonly version: number;
  readonly records: readonly RedemptionRecord[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REDEMPTION_HISTORY_KEY = 'crazy-checkers-redemption-history';
const REDEMPTION_HISTORY_VERSION = 1;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Load redemption history from localStorage.
 * Returns an empty array for missing, corrupt, or version-mismatched data.
 */
export function loadRedemptionHistory(): readonly RedemptionRecord[] {
  try {
    const raw = localStorage.getItem(REDEMPTION_HISTORY_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!isValidEnvelope(parsed)) return [];
    return parsed.records;
  } catch {
    return [];
  }
}

/** Append a redemption record and persist. Failures are swallowed. */
export function appendRedemption(record: RedemptionRecord): void {
  try {
    const existing = loadRedemptionHistory();
    const updated: RedemptionHistoryEnvelope = {
      version: REDEMPTION_HISTORY_VERSION,
      records: [...existing, record],
    };
    localStorage.setItem(REDEMPTION_HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // Fail silently — private browsing or quota exceeded.
  }
}

/** Clear all redemption history (called during data reset). */
export function clearRedemptionHistory(): void {
  try {
    localStorage.removeItem(REDEMPTION_HISTORY_KEY);
  } catch {
    // Fail silently.
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function isValidEnvelope(value: unknown): value is RedemptionHistoryEnvelope {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  if (obj.version !== REDEMPTION_HISTORY_VERSION) return false;
  if (!Array.isArray(obj.records)) return false;
  return obj.records.every(isValidRecord);
}

function isValidRecord(value: unknown): value is RedemptionRecord {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.code === 'string' &&
    typeof obj.description === 'string' &&
    typeof obj.newUnlocksCount === 'number' &&
    typeof obj.timestamp === 'number'
  );
}
