/**
 * Centralized unlock evaluation system for the 5-track progression system.
 *
 * Determines which of the 40 Choice modes, three hidden menu modes
 * (Choice, Classified, Chaos), and any code-override unlocks are
 * available to the player.
 *
 * Architecture: pure core + async shell.
 * - Pure core (`evaluateFullUnlockState`): Accepts CareerSnapshot + codeUnlocks Set,
 *   returns deterministic UnlockEvaluation. No I/O, no side effects.
 * - Async shell (`evaluateUnlocks`, `evaluateFullUnlocks`): Loads data from
 *   IndexedDB/localStorage, delegates to pure core.
 */

import type { UnlockSnapshot } from './unlockState';
import type {
  CareerSnapshot,
  Track4MilestoneStatus,
} from './careerStatsEngine';
import { computeCareerSnapshot } from './careerStatsEngine';
import { getAllGameRecords } from './gameHistory';
import { getAllChallengeRecords } from './challengeRecords';
import { getModesByCategory } from './gameModeRegistry';
import type { TrackId } from './gameModeRegistry';

// Re-export TrackId for convenience
export type { TrackId } from './gameModeRegistry';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/**
 * Rich unlock evaluation result consumed by Career screen, Choice gallery,
 * and other granular UI consumers.
 */
export interface UnlockEvaluation {
  /** Simplified snapshot for menu visibility (backward-compatible). */
  readonly snapshot: UnlockSnapshot;
  /** Per-Choice-mode unlock status for all 40 modes. */
  readonly choiceModes: ReadonlyMap<number, ChoiceModeUnlockStatus>;
  /** Per-track evaluation results (5 entries, one per track). */
  readonly tracks: readonly TrackUnlockResult[];
  /** Chaos Gate detailed status. */
  readonly chaosGate: ChaosGateStatus;
  /** Whether the master unlock-all code has been entered. */
  readonly masterUnlockActive: boolean;
  /** Total number of Choice modes unlocked (0-40). */
  readonly totalChoiceModesUnlocked: number;
}

/** Per-Choice-mode unlock status. */
export interface ChoiceModeUnlockStatus {
  /** Choice mode number (1-40). */
  readonly choiceNumber: number;
  /** Registry ID (e.g., 'choice-revolution'). */
  readonly registryId: string;
  /** Display name (e.g., 'Revolution'). */
  readonly displayName: string;
  /** Which track this mode belongs to. */
  readonly trackId: TrackId;
  /** Whether the mode is unlocked via normal progression. */
  readonly unlockedByProgression: boolean;
  /** Whether the mode is unlocked via code entry. */
  readonly unlockedByCode: boolean;
  /** Whether the mode is available (progression OR code). */
  readonly unlocked: boolean;
}

/** Per-track evaluation result. */
export interface TrackUnlockResult {
  /** Track identifier. */
  readonly trackId: TrackId;
  /** Human-readable track name. */
  readonly trackName: string;
  /** Current progress value for the track. */
  readonly currentValue: number;
  /** Threshold array for this track. */
  readonly thresholds: readonly number[];
  /** Number of milestones (Choice modes) unlocked in this track (0-8). */
  readonly unlockedCount: number;
  /** Total milestones in this track (always 8). */
  readonly totalMilestones: number;
  /** Next threshold to reach, or null if all milestones complete. */
  readonly nextThreshold: number | null;
  /** Whether this track is fully complete. */
  readonly complete: boolean;
  /** For Track 4 only: detailed per-milestone status. Null for other tracks. */
  readonly milestoneDetails: readonly Track4MilestoneStatus[] | null;
}

/** Chaos Gate detailed status. */
export interface ChaosGateStatus {
  /** Whether all Chaos Gate conditions are satisfied. */
  readonly unlocked: boolean;
  /** Whether Chaos is unlocked via code override. */
  readonly unlockedByCode: boolean;
  /** Individual gate conditions. */
  readonly gates: {
    readonly challengesCompleted: {
      readonly current: number;
      readonly required: number;
      readonly met: boolean;
    };
    readonly choiceModesUnlocked: {
      readonly current: number;
      readonly required: number;
      readonly met: boolean;
    };
    readonly classifiedUnlocked: { readonly met: boolean };
    readonly classifiedHardWins: {
      readonly current: number;
      readonly required: number;
      readonly met: boolean;
    };
  };
}

// ---------------------------------------------------------------------------
// Track threshold constants (Design Document §2.3–2.4)
// ---------------------------------------------------------------------------

/**
 * Challenge-completion thresholds for unlocking Track 1 (Puzzle Mastery) Choice modes.
 * Index 0 → Choice #1 (Revolution), Index 7 → Choice #8 (Extra Crazy).
 * Validated against CHOICE_MODE_DATA by cross-reference unit test.
 */
export const TRACK_1_THRESHOLDS = [1, 15, 29, 43, 57, 71, 85, 99] as const;

/** Crazy Hard CPU win thresholds for Track 2 (Chaos Veteran). */
export const TRACK_2_THRESHOLDS = [1, 3, 6, 10, 15, 21, 28, 36] as const;

/** Choice Hard CPU win thresholds for Track 3 (Rule Bender). */
export const TRACK_3_THRESHOLDS = [1, 4, 8, 13, 19, 26, 34, 43] as const;

/** Classified distinct Hard CPU win thresholds for Track 5 (World Player). */
export const TRACK_5_THRESHOLDS = [1, 5, 10, 20, 30, 40, 50, 64] as const;

// ---------------------------------------------------------------------------
// Track 1 — Progress info (preserved from original for ChallengeScreen)
// ---------------------------------------------------------------------------

/**
 * Progress information for Track 1 (Puzzle Mastery).
 * Used by ChallengeScreen progress dashboard and future Career screen.
 */
export interface Track1ProgressInfo {
  /** Number of Track 1 Choice modes currently unlocked (0-8). */
  readonly unlockedCount: number;
  /** Total number of Track 1 milestones (always 8). */
  readonly totalMilestones: number;
  /** Number of challenges needed for the next unlock, or null if all 8 are unlocked. */
  readonly nextThreshold: number | null;
  /** Current count of distinct solved puzzles. */
  readonly challengesCompleted: number;
}

// ---------------------------------------------------------------------------
// Generic threshold counter (internal)
// ---------------------------------------------------------------------------

/**
 * Returns the number of thresholds met given a current value
 * and a monotonically increasing threshold array.
 */
function countThresholdsMet(
  currentValue: number,
  thresholds: readonly number[],
): number {
  let count = 0;
  for (const t of thresholds) {
    if (currentValue >= t) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Per-track unlock count functions (pure — no I/O)
// ---------------------------------------------------------------------------

/**
 * Returns the number of Track 1 (Puzzle Mastery) Choice modes unlocked
 * for the given challenge completion count.
 *
 * @param challengesCompleted — Count of distinct puzzleIds solved (0-100).
 * @returns Integer in [0, 8].
 */
export function getTrack1UnlockedCount(challengesCompleted: number): number {
  return countThresholdsMet(challengesCompleted, TRACK_1_THRESHOLDS);
}

/**
 * Returns detailed Track 1 progress information for display in the
 * ChallengeScreen dashboard and future Career screen.
 *
 * @param challengesCompleted — Count of distinct puzzleIds solved (0-100).
 * @returns Track1ProgressInfo object.
 */
export function getTrack1Progress(
  challengesCompleted: number,
): Track1ProgressInfo {
  const unlockedCount = getTrack1UnlockedCount(challengesCompleted);
  const totalMilestones = TRACK_1_THRESHOLDS.length;
  const nextThreshold =
    unlockedCount < totalMilestones
      ? TRACK_1_THRESHOLDS[unlockedCount] ?? null
      : null;

  return {
    unlockedCount,
    totalMilestones,
    nextThreshold,
    challengesCompleted,
  };
}

/** Returns the number of Track 2 (Chaos Veteran) Choice modes unlocked. */
export function getTrack2UnlockedCount(crazyHardWins: number): number {
  return countThresholdsMet(crazyHardWins, TRACK_2_THRESHOLDS);
}

/** Returns the number of Track 3 (Rule Bender) Choice modes unlocked. */
export function getTrack3UnlockedCount(choiceHardWins: number): number {
  return countThresholdsMet(choiceHardWins, TRACK_3_THRESHOLDS);
}

/** Returns the number of Track 4 (Lifer) Choice modes unlocked. */
export function getTrack4UnlockedCount(
  milestones: readonly Track4MilestoneStatus[],
): number {
  return milestones.filter((m) => m.met).length;
}

/** Returns the number of Track 5 (World Player) Choice modes unlocked. */
export function getTrack5UnlockedCount(
  classifiedDistinctHardWins: number,
): number {
  return countThresholdsMet(classifiedDistinctHardWins, TRACK_5_THRESHOLDS);
}

// ---------------------------------------------------------------------------
// Backward-compatible condition evaluators (exported for direct testing)
// ---------------------------------------------------------------------------

/** Choice is unlocked when the player has completed ≥1 challenge puzzle. */
export function isChoiceUnlocked(challengesCompleted: number): boolean {
  return challengesCompleted >= 1;
}

/** Classified is unlocked when all 100 challenge puzzles are completed. */
export function isClassifiedUnlocked(challengesCompleted: number): boolean {
  return challengesCompleted >= 100;
}

/**
 * Chaos is unlocked when ALL Chaos Gate conditions are satisfied.
 *
 * @param totalClassifiedGames — Total number of Classified games in the registry.
 *   Defaults to current registry count (64 placeholders) for backward compatibility.
 */
export function isChaosUnlocked(
  challengesCompleted: number,
  choiceModesUnlocked: number,
  classifiedHardWins: number,
  totalClassifiedGames: number = getModesByCategory('classified').length,
): boolean {
  return (
    challengesCompleted >= 100 &&
    choiceModesUnlocked >= 40 &&
    classifiedHardWins >= totalClassifiedGames
  );
}

// ---------------------------------------------------------------------------
// Code unlock persistence (localStorage)
// ---------------------------------------------------------------------------

const CODE_UNLOCKS_KEY = 'crazy-checkers-code-unlocks';

/**
 * Load the set of code-based unlocks from localStorage.
 * Returns an empty set if no data exists or data is corrupt.
 */
export function loadCodeUnlocks(): Set<string> {
  try {
    const raw = localStorage.getItem(CODE_UNLOCKS_KEY);
    if (raw === null) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      (parsed as unknown[]).filter(
        (item): item is string => typeof item === 'string',
      ),
    );
  } catch {
    return new Set();
  }
}

/**
 * Persist the set of code-based unlocks to localStorage.
 * Entries are sorted for deterministic serialization.
 */
export function saveCodeUnlocks(unlocks: Set<string>): void {
  try {
    const sorted = [...unlocks].sort();
    localStorage.setItem(CODE_UNLOCKS_KEY, JSON.stringify(sorted));
  } catch {
    // Fail silently — same pattern as unlockState.ts
  }
}

/**
 * Add a single code unlock and persist.
 * Returns true if the unlock was new; false if already present.
 */
export function addCodeUnlock(modeId: string): boolean {
  const unlocks = loadCodeUnlocks();
  if (unlocks.has(modeId)) return false;
  unlocks.add(modeId);
  saveCodeUnlocks(unlocks);
  return true;
}

// ---------------------------------------------------------------------------
// Build TrackUnlockResult objects from CareerSnapshot
// ---------------------------------------------------------------------------

function buildTrackUnlockResults(
  careerSnapshot: CareerSnapshot,
): TrackUnlockResult[] {
  return careerSnapshot.tracks.map((track) => ({
    trackId: track.trackId,
    trackName: track.trackName,
    currentValue: track.currentValue,
    thresholds: track.thresholds,
    unlockedCount: track.completedMilestones,
    totalMilestones: track.totalMilestones,
    nextThreshold: track.nextThreshold,
    complete: track.completedMilestones >= track.totalMilestones,
    milestoneDetails:
      track.trackId === 'lifer' ? careerSnapshot.track4Milestones : null,
  }));
}

// ---------------------------------------------------------------------------
// Per-Choice-mode unlock evaluation
// ---------------------------------------------------------------------------

/**
 * Given a Choice mode number (1-40) and the track unlock results,
 * returns whether this mode is unlocked by normal progression.
 */
function isChoiceModeUnlockedByProgression(
  choiceNumber: number,
  trackResults: readonly TrackUnlockResult[],
): boolean {
  if (choiceNumber >= 1 && choiceNumber <= 8) {
    const track = trackResults.find((t) => t.trackId === 'puzzle-mastery');
    return track ? track.unlockedCount >= choiceNumber : false;
  }
  if (choiceNumber >= 9 && choiceNumber <= 16) {
    const track = trackResults.find((t) => t.trackId === 'chaos-veteran');
    const positionInTrack = choiceNumber - 8;
    return track ? track.unlockedCount >= positionInTrack : false;
  }
  if (choiceNumber >= 17 && choiceNumber <= 24) {
    const track = trackResults.find((t) => t.trackId === 'rule-bender');
    const positionInTrack = choiceNumber - 16;
    return track ? track.unlockedCount >= positionInTrack : false;
  }
  if (choiceNumber >= 25 && choiceNumber <= 32) {
    const track = trackResults.find((t) => t.trackId === 'lifer');
    const positionInTrack = choiceNumber - 24;
    return track ? track.unlockedCount >= positionInTrack : false;
  }
  if (choiceNumber >= 33 && choiceNumber <= 40) {
    const track = trackResults.find((t) => t.trackId === 'world-player');
    const positionInTrack = choiceNumber - 32;
    return track ? track.unlockedCount >= positionInTrack : false;
  }
  return false;
}

/**
 * Determine the track ID for a given choice number.
 */
function getTrackIdForChoiceNumber(choiceNumber: number): TrackId {
  if (choiceNumber <= 8) return 'puzzle-mastery';
  if (choiceNumber <= 16) return 'chaos-veteran';
  if (choiceNumber <= 24) return 'rule-bender';
  if (choiceNumber <= 32) return 'lifer';
  return 'world-player';
}

/**
 * Build per-Choice-mode unlock status map for all 40 modes.
 */
function buildChoiceModeStatuses(
  trackResults: readonly TrackUnlockResult[],
  codeUnlocks: ReadonlySet<string>,
  masterUnlockActive: boolean,
): Map<number, ChoiceModeUnlockStatus> {
  const statuses = new Map<number, ChoiceModeUnlockStatus>();
  const choiceModes = getModesByCategory('choice');

  for (const entry of choiceModes) {
    if (entry.choiceNumber === null) continue;

    const choiceNumber = entry.choiceNumber;
    const unlockedByProgression = isChoiceModeUnlockedByProgression(
      choiceNumber,
      trackResults,
    );
    const unlockedByCode = masterUnlockActive || codeUnlocks.has(entry.id);
    const trackId = getTrackIdForChoiceNumber(choiceNumber);

    statuses.set(choiceNumber, {
      choiceNumber,
      registryId: entry.id,
      displayName: entry.displayName,
      trackId,
      unlockedByProgression,
      unlockedByCode,
      unlocked: unlockedByProgression || unlockedByCode,
    });
  }

  return statuses;
}

// ---------------------------------------------------------------------------
// Chaos Gate evaluation
// ---------------------------------------------------------------------------

function evaluateChaosGateStatus(
  challengesCompleted: number,
  totalChoiceModesUnlocked: number,
  classifiedHardWins: number,
  codeUnlocks: ReadonlySet<string>,
  masterUnlockActive: boolean,
): ChaosGateStatus {
  const classifiedModes = getModesByCategory('classified');
  const totalClassifiedGames = classifiedModes.length;

  const gate1Met = challengesCompleted >= 100;
  const gate2Met = totalChoiceModesUnlocked >= 40;
  const gate3Met = challengesCompleted >= 100;
  const gate4Met = classifiedHardWins >= totalClassifiedGames;

  const unlockedByProgression = gate1Met && gate2Met && gate3Met && gate4Met;
  const unlockedByCode = masterUnlockActive || codeUnlocks.has('chaos');

  return {
    unlocked: unlockedByProgression || unlockedByCode,
    unlockedByCode,
    gates: {
      challengesCompleted: {
        current: challengesCompleted,
        required: 100,
        met: gate1Met,
      },
      choiceModesUnlocked: {
        current: totalChoiceModesUnlocked,
        required: 40,
        met: gate2Met,
      },
      classifiedUnlocked: {
        met: gate3Met,
      },
      classifiedHardWins: {
        current: classifiedHardWins,
        required: totalClassifiedGames,
        met: gate4Met,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Pure core: evaluateFullUnlockState
// ---------------------------------------------------------------------------

/**
 * Pure evaluation of all unlock conditions.
 * Accepts pre-computed data; no I/O.
 *
 * @param careerSnapshot — Full career statistics from computeCareerSnapshot()
 * @param codeUnlocks — Set of code-based unlock mode IDs
 * @returns Complete unlock evaluation
 */
export function evaluateFullUnlockState(
  careerSnapshot: CareerSnapshot,
  codeUnlocks: ReadonlySet<string>,
): UnlockEvaluation {
  const masterUnlockActive = codeUnlocks.has('all');
  const challengesCompleted = careerSnapshot.challengeStats.puzzlesCompleted;

  // Build track unlock results from CareerSnapshot
  const tracks = buildTrackUnlockResults(careerSnapshot);

  // Build per-Choice-mode statuses
  const choiceModes = buildChoiceModeStatuses(
    tracks,
    codeUnlocks,
    masterUnlockActive,
  );

  // Count total unlocked Choice modes (by any means)
  let totalChoiceModesUnlocked = 0;
  for (const [, status] of choiceModes) {
    if (status.unlocked) totalChoiceModesUnlocked += 1;
  }

  // Evaluate Chaos Gate
  const classifiedHardWins = careerSnapshot.chaosGate.classifiedHardWins;
  const chaosGate = evaluateChaosGateStatus(
    challengesCompleted,
    totalChoiceModesUnlocked,
    classifiedHardWins,
    codeUnlocks,
    masterUnlockActive,
  );

  // Build backward-compatible UnlockSnapshot for menu visibility
  const choiceUnlocked =
    masterUnlockActive ||
    totalChoiceModesUnlocked > 0 ||
    codeUnlocks.has('choice');
  const classifiedUnlocked =
    masterUnlockActive ||
    challengesCompleted >= 100 ||
    codeUnlocks.has('classified');
  const chaosUnlocked = chaosGate.unlocked;

  const snapshot: UnlockSnapshot = {
    choiceUnlocked,
    classifiedUnlocked,
    chaosUnlocked,
  };

  return Object.freeze({
    snapshot,
    choiceModes,
    tracks,
    chaosGate,
    masterUnlockActive,
    totalChoiceModesUnlocked,
  });
}

// ---------------------------------------------------------------------------
// Convenience query APIs
// ---------------------------------------------------------------------------

/**
 * Check whether a specific mode is unlocked.
 * Accepts a registry ID (e.g., 'choice-revolution', 'classified', 'chaos').
 *
 * This is a convenience wrapper that requires a pre-computed UnlockEvaluation.
 */
export function isUnlocked(
  modeId: string,
  evaluation: UnlockEvaluation,
): boolean {
  // Check master unlock
  if (evaluation.masterUnlockActive) return true;

  // Check Choice modes by registry ID
  for (const [, status] of evaluation.choiceModes) {
    if (status.registryId === modeId) return status.unlocked;
  }

  // Check menu-level modes
  if (modeId === 'choice') return evaluation.snapshot.choiceUnlocked;
  if (modeId === 'classified') return evaluation.snapshot.classifiedUnlocked;
  if (modeId === 'chaos') return evaluation.chaosGate.unlocked;

  // Core modes (classic, crazy, challenge, etc.) are always unlocked
  return true;
}

/**
 * Get detailed progress for a specific track.
 * Returns null if the trackId is not found.
 */
export function getTrackProgress(
  trackId: TrackId,
  evaluation: UnlockEvaluation,
): TrackUnlockResult | null {
  return evaluation.tracks.find((t) => t.trackId === trackId) ?? null;
}

// ---------------------------------------------------------------------------
// Async adapters
// ---------------------------------------------------------------------------

/**
 * Evaluates the current state of all unlock conditions.
 * Loads data from IndexedDB and localStorage, delegates to pure core.
 *
 * Returns the simplified UnlockSnapshot for backward compatibility
 * with useUnlockState hook and MenuScreen.
 */
export async function evaluateUnlocks(): Promise<UnlockSnapshot> {
  const [gameRecords, challengeRecords] = await Promise.all([
    getAllGameRecords(),
    getAllChallengeRecords(),
  ]);

  const codeUnlocks = loadCodeUnlocks();
  const careerSnapshot = computeCareerSnapshot(gameRecords, challengeRecords);
  const evaluation = evaluateFullUnlockState(careerSnapshot, codeUnlocks);

  return evaluation.snapshot;
}

/**
 * Async evaluation returning the full UnlockEvaluation.
 * For consumers that need per-mode status and track details
 * (Career screen, Choice gallery, etc.).
 */
export async function evaluateFullUnlocks(): Promise<UnlockEvaluation> {
  const [gameRecords, challengeRecords] = await Promise.all([
    getAllGameRecords(),
    getAllChallengeRecords(),
  ]);

  const codeUnlocks = loadCodeUnlocks();
  const careerSnapshot = computeCareerSnapshot(gameRecords, challengeRecords);

  return evaluateFullUnlockState(careerSnapshot, codeUnlocks);
}
