/**
 * Pure logic module that evaluates unlock conditions for hidden modes.
 *
 * Reads from persistence stores and computes an UnlockSnapshot.
 * Stubs return safe defaults for stores not yet implemented.
 */

import type { UnlockSnapshot } from './unlockState';
import { getChallengesCompletedCount } from './challengeRecords';

// ---------------------------------------------------------------------------
// Data adapters (each reads from a specific persistence store)
// ---------------------------------------------------------------------------

function getChallengesCompleted(): Promise<number> {
  return getChallengesCompletedCount();
}

/**
 * @stub — Returns 0 until Tasks 19-22 implement all five
 * progression tracks and the Choice unlock aggregator.
 * Replace with: import { getUnlockedChoiceModeCount } from './choiceProgress';
 */
function getChoiceModesUnlocked(): Promise<number> {
  // TODO(Task 20): Wire to Choice mode unlock aggregator
  return Promise.resolve(0);
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
