/**
 * Persistence layer for the progressive unlock system.
 *
 * Tracks which hidden modes (Choice, Classified, Chaos) are unlocked
 * and whether the player has already seen the reveal animation.
 * Uses localStorage with a versioned envelope matching settings.ts conventions.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Unlock status of all hidden modes, computed by UnlockEvaluator. */
export interface UnlockSnapshot {
  /** Choice menu button is visible (≥1 challenge completed). */
  choiceUnlocked: boolean;
  /** Classified menu button is visible (100 challenges completed). */
  classifiedUnlocked: boolean;
  /** Chaos menu button is visible (all Chaos Gate conditions met). */
  chaosUnlocked: boolean;
}

/** Tracks which unlocks have been "seen" (animation has played). */
export interface UnlockSeenFlags {
  choiceSeen: boolean;
  classifiedSeen: boolean;
  chaosSeen: boolean;
}

/** Combined persisted state for the unlock system. */
export interface PersistedUnlockState {
  version: number;
  snapshot: UnlockSnapshot;
  seen: UnlockSeenFlags;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'crazy-checkers-unlock-state';
const VERSION = 1;

const DEFAULT_SNAPSHOT: UnlockSnapshot = {
  choiceUnlocked: false,
  classifiedUnlocked: false,
  chaosUnlocked: false,
};

const DEFAULT_SEEN: UnlockSeenFlags = {
  choiceSeen: false,
  classifiedSeen: false,
  chaosSeen: false,
};

const DEFAULT_STATE: PersistedUnlockState = {
  version: VERSION,
  snapshot: DEFAULT_SNAPSHOT,
  seen: DEFAULT_SEEN,
};

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Reads unlock state from localStorage.
 * Returns defaults if no state exists, data is corrupt, or version is wrong.
 */
export function loadUnlockState(): PersistedUnlockState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_STATE };

    const parsed: unknown = JSON.parse(raw);
    if (!isValidEnvelope(parsed)) return { ...DEFAULT_STATE };
    if (parsed.version !== VERSION) return { ...DEFAULT_STATE };

    return {
      version: VERSION,
      snapshot: mergeSnapshot(parsed.snapshot),
      seen: mergeSeen(parsed.seen),
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

/** Persists unlock state to localStorage. Failures are silently swallowed. */
export function saveUnlockState(state: PersistedUnlockState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Fail silently.
  }
}

/** Removes the unlock state key from localStorage. */
export function clearUnlockState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Fail silently.
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidEnvelope(value: unknown): value is PersistedUnlockState {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.version === 'number' &&
    typeof obj.snapshot === 'object' &&
    obj.snapshot !== null &&
    typeof obj.seen === 'object' &&
    obj.seen !== null
  );
}

function mergeSnapshot(data: unknown): UnlockSnapshot {
  const obj = (data ?? {}) as Record<string, unknown>;
  return {
    choiceUnlocked:
      typeof obj.choiceUnlocked === 'boolean' ? obj.choiceUnlocked : false,
    classifiedUnlocked:
      typeof obj.classifiedUnlocked === 'boolean' ? obj.classifiedUnlocked : false,
    chaosUnlocked:
      typeof obj.chaosUnlocked === 'boolean' ? obj.chaosUnlocked : false,
  };
}

function mergeSeen(data: unknown): UnlockSeenFlags {
  const obj = (data ?? {}) as Record<string, unknown>;
  return {
    choiceSeen:
      typeof obj.choiceSeen === 'boolean' ? obj.choiceSeen : false,
    classifiedSeen:
      typeof obj.classifiedSeen === 'boolean' ? obj.classifiedSeen : false,
    chaosSeen:
      typeof obj.chaosSeen === 'boolean' ? obj.chaosSeen : false,
  };
}
