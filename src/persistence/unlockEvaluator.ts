/**
 * Pure logic module that evaluates unlock conditions for hidden modes.
 *
 * Reads from persistence stores and computes an UnlockSnapshot.
 * Stubs return safe defaults for stores not yet implemented.
 */

import type { UnlockSnapshot } from './unlockState';
import { getChallengesCompletedCount } from './challengeRecords';

// ---------------------------------------------------------------------------
// Track 1 — Puzzle Mastery thresholds (Design Document §2.3)
// ---------------------------------------------------------------------------

/**
 * Challenge-completion thresholds for unlocking Track 1 (Puzzle Mastery) Choice modes.
 * Index 0 → Choice #1 (Revolution), Index 7 → Choice #8 (Extra Crazy).
 * Validated against CHOICE_MODE_DATA by cross-reference unit test.
 */
export const TRACK_1_THRESHOLDS = [1, 15, 29, 43, 57, 71, 85, 99] as const;

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
// Track 1 evaluators (pure — no I/O)
// ---------------------------------------------------------------------------

/**
 * Returns the number of Track 1 (Puzzle Mastery) Choice modes unlocked
 * for the given challenge completion count.
 *
 * @param challengesCompleted — Count of distinct puzzleIds solved (0-100).
 * @returns Integer in [0, 8].
 */
export function getTrack1UnlockedCount(challengesCompleted: number): number {
  let count = 0;
  for (const threshold of TRACK_1_THRESHOLDS) {
    if (challengesCompleted >= threshold) {
      count += 1;
    } else {
      break;
    }
  }
  return count;
}

/**
 * Returns detailed Track 1 progress information for display in the
 * ChallengeScreen dashboard and future Career screen.
 *
 * @param challengesCompleted — Count of distinct puzzleIds solved (0-100).
 * @returns Track1ProgressInfo object.
 */
export function getTrack1Progress(challengesCompleted: number): Track1ProgressInfo {
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

// ---------------------------------------------------------------------------
// Data adapters (each reads from a specific persistence store)
// ---------------------------------------------------------------------------

function getChallengesCompleted(): Promise<number> {
  return getChallengesCompletedCount();
}

/**
 * Returns the total number of Choice modes unlocked across all five tracks.
 *
 * Currently only Track 1 (Puzzle Mastery) is wired — Tracks 2-5 return 0.
 * When Tasks 19-22 implement the remaining tracks, this function will
 * aggregate all five track counts.
 *
 * @returns Promise resolving to the number of unlocked Choice modes (0-40).
 */
async function getChoiceModesUnlocked(): Promise<number> {
  const challengesCompleted = await getChallengesCompleted();
  const track1Count = getTrack1UnlockedCount(challengesCompleted);

  // TODO(Task 20): Add Track 2 (Chaos Veteran) — Crazy Hard wins
  const track2Count = 0;
  // TODO(Task 20): Add Track 3 (Rule Bender) — Choice Hard wins
  const track3Count = 0;
  // TODO(Task 20): Add Track 4 (Lifer) — mixed lifetime milestones
  const track4Count = 0;
  // TODO(Task 20): Add Track 5 (World Player) — Classified Hard wins
  const track5Count = 0;

  return track1Count + track2Count + track3Count + track4Count + track5Count;
}

/**
 * @stub — Returns 0 until Phase 4 implements Classified game
 * tracking. Classified games are unlocked by Hard wins in any mode
 * (Crazy, Classic, Choice), tracked via gameHistory once Classified exists.
 * Replace with: import { getClassifiedGamesUnlockedCount } from './classifiedProgress';
 */
function getClassifiedGamesUnlocked(): Promise<number> {
  // TODO(Phase 4): Wire to Classified games unlocked tracker
  return Promise.resolve(0);
}

// ---------------------------------------------------------------------------
// Condition evaluators (exported for direct unit testing)
// ---------------------------------------------------------------------------

/** Choice is unlocked when the player has completed ≥1 challenge puzzle. */
export function isChoiceUnlocked(challengesCompleted: number): boolean {
  return challengesCompleted >= 1;
}

/** Classified is unlocked when all 100 challenge puzzles are completed. */
export function isClassifiedUnlocked(challengesCompleted: number): boolean {
  return challengesCompleted >= 100;
}

/** Chaos is unlocked when ALL Chaos Gate conditions are satisfied. */
export function isChaosUnlocked(
  challengesCompleted: number,
  choiceModesUnlocked: number,
  classifiedGamesUnlocked: number,
): boolean {
  return (
    challengesCompleted >= 100 &&
    choiceModesUnlocked >= 40 &&
    classifiedGamesUnlocked >= 60
  );
}

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------

/**
 * Evaluates the current state of all unlock conditions.
 * Reads from available persistence stores; returns safe defaults
 * for stores not yet implemented.
 */
export async function evaluateUnlocks(): Promise<UnlockSnapshot> {
  const [challenges, choiceModes, classifiedGames] = await Promise.all([
    getChallengesCompleted(),
    getChoiceModesUnlocked(),
    getClassifiedGamesUnlocked(),
  ]);

  return {
    choiceUnlocked: isChoiceUnlocked(challenges),
    classifiedUnlocked: isClassifiedUnlocked(challenges),
    chaosUnlocked: isChaosUnlocked(challenges, choiceModes, classifiedGames),
  };
}
