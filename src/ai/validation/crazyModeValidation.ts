/**
 * Crazy Mode Automated Validation Suite.
 *
 * Orchestrates large-scale self-play matches to validate event correctness,
 * AI event reasoning, and the absence of degenerate or crash-inducing board states.
 */

import { GameMode, type CrazyEvent } from '../../engine/types';
import { IMPLEMENTED_EVENTS } from '../../engine/events';
import { runMatch, type MatchConfig, type MatchResult } from './selfPlay';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Results of the complete Crazy mode validation suite. */
export interface CrazyValidationReport {
  /** Hard vs. Easy (Crazy mode), 50 games. */
  hardVsEasy: MatchResult;
  /** Hard vs. Hard (Crazy mode), 50 games. */
  hardVsHard: MatchResult;
  /** Per-event forced matches (10 games each, 7 events = 70 games). */
  perEvent: Record<string, MatchResult>;
  /** Pairwise event stacking spot-checks (21 combinations, 2 games each = 42 games). */
  pairwise: Record<string, MatchResult>;
  /** Summary statistics. */
  summary: ValidationSummary;
}

export interface ValidationSummary {
  totalGames: number;
  totalErrors: number;
  totalAnomalies: number;
  hardVsEasyWinRate: number;
  allEventsTriggered: boolean;
  degenerateStatesFound: string[];
}

// ---------------------------------------------------------------------------
// Match Configurations
// ---------------------------------------------------------------------------

const HARD_VS_EASY_CONFIG: MatchConfig = {
  gameCount: 50,
  whiteDifficulty: 'hard',
  blackDifficulty: 'easy',
  alternateColors: true,
  maxMovesPerGame: 400,
  seed: 20260405,
  mode: GameMode.Crazy,
};

const HARD_VS_HARD_CONFIG: MatchConfig = {
  gameCount: 50,
  whiteDifficulty: 'hard',
  blackDifficulty: 'hard',
  alternateColors: false,
  maxMovesPerGame: 400,
  seed: 20260406,
  mode: GameMode.Crazy,
};

function buildPerEventConfigs(): Array<{ event: CrazyEvent; config: MatchConfig }> {
  return IMPLEMENTED_EVENTS.map((event, i) => ({
    event,
    config: {
      gameCount: 10,
      whiteDifficulty: 'hard' as const,
      blackDifficulty: 'hard' as const,
      alternateColors: false,
      maxMovesPerGame: 400,
      seed: 20260410 + i * 1000,
      mode: GameMode.Crazy,
      forceEvent: event,
    },
  }));
}

function buildPairwiseConfigs(): Array<{ pair: [CrazyEvent, CrazyEvent]; config: MatchConfig }> {
  const configs: Array<{ pair: [CrazyEvent, CrazyEvent]; config: MatchConfig }> = [];
  for (let i = 0; i < IMPLEMENTED_EVENTS.length; i++) {
    for (let j = i + 1; j < IMPLEMENTED_EVENTS.length; j++) {
      configs.push({
        pair: [IMPLEMENTED_EVENTS[i] as CrazyEvent, IMPLEMENTED_EVENTS[j] as CrazyEvent],
        config: {
          gameCount: 2,
          whiteDifficulty: 'hard',
          blackDifficulty: 'hard',
          alternateColors: false,
          maxMovesPerGame: 400,
          seed: 20260420 + i * 100 + j,
          mode: GameMode.Crazy,
          forceEventSequence: [IMPLEMENTED_EVENTS[i] as CrazyEvent, IMPLEMENTED_EVENTS[j] as CrazyEvent],
        },
      });
    }
  }
  return configs;
}

// ---------------------------------------------------------------------------
// Degenerate State Checks
// ---------------------------------------------------------------------------

/**
 * Checks per-event match results for event-specific degenerate states.
 * Returns a list of degenerate state descriptions found.
 */
function checkDegenerateStates(
  perEventResults: Record<string, MatchResult>,
): string[] {
  const degenerates: string[] = [];

  for (const [eventType, result] of Object.entries(perEventResults)) {
    for (const game of result.games) {
      if (game.result === 'error') continue;

      // Checks Mix: no game ends within 1 ply of shuffle
      if (eventType === 'CHECKS_MIX' && game.eventLog) {
        for (const entry of game.eventLog) {
          if (entry.event === 'CHECKS_MIX' && game.moveCount <= entry.ply + 1) {
            degenerates.push(
              `Checks Mix: Game #${String(game.gameNumber)} ended within 1 ply of shuffle at ply ${String(entry.ply)} (seed: ${String(game.gameSeed)})`,
            );
          }
        }
      }

      // Up in the Air: flag if game move count is suspiciously high
      if (eventType === 'UP_IN_THE_AIR' && game.moveCount > 350) {
        degenerates.push(
          `Up in the Air: Game #${String(game.gameNumber)} had ${String(game.moveCount)} moves, approaching cap (seed: ${String(game.gameSeed)})`,
        );
      }

      // Hot Potato: flag games with excessive event repetition
      if (eventType === 'HOT_POTATO' && game.eventLog) {
        let maxConsecutive = 0;
        let consecutive = 1;
        for (let i = 1; i < game.eventLog.length; i++) {
          const curr = game.eventLog[i];
          const prev = game.eventLog[i - 1];
          if (curr && prev && curr.event === prev.event) {
            consecutive++;
            maxConsecutive = Math.max(maxConsecutive, consecutive);
          } else {
            consecutive = 1;
          }
        }
        if (maxConsecutive > 4) {
          degenerates.push(
            `Hot Potato: Game #${String(game.gameNumber)} had ${String(maxConsecutive)} consecutive same-event triggers (seed: ${String(game.gameSeed)})`,
          );
        }
      }
    }
  }

  return degenerates;
}

// ---------------------------------------------------------------------------
// Validation Runner
// ---------------------------------------------------------------------------

/**
 * Runs the complete Crazy mode validation suite.
 * Returns a structured report with all match results and summary statistics.
 *
 * @param onProgress - Optional callback for progress reporting (match name, games completed).
 */
export function runCrazyValidation(
  onProgress?: (matchName: string, gamesCompleted: number, totalGames: number) => void,
): CrazyValidationReport {
  // 1. Hard vs. Easy (50 games)
  const hardVsEasy = runMatch({
    ...HARD_VS_EASY_CONFIG,
    onGameComplete: onProgress
      ? (record) => { onProgress('Hard vs. Easy', record.gameNumber, 50); }
      : undefined,
  });

  // 2. Hard vs. Hard (50 games)
  const hardVsHard = runMatch({
    ...HARD_VS_HARD_CONFIG,
    onGameComplete: onProgress
      ? (record) => { onProgress('Hard vs. Hard', record.gameNumber, 50); }
      : undefined,
  });

  // 3. Per-event forced matches (70 games)
  const perEvent: Record<string, MatchResult> = {};
  for (const { event, config } of buildPerEventConfigs()) {
    perEvent[event] = runMatch({
      ...config,
      onGameComplete: onProgress
        ? (record) => { onProgress(`Per-event: ${event}`, record.gameNumber, 10); }
        : undefined,
    });
  }

  // 4. Pairwise stacking spot-checks (42 games)
  const pairwise: Record<string, MatchResult> = {};
  for (const { pair, config } of buildPairwiseConfigs()) {
    const pairKey = `${pair[0]} + ${pair[1]}`;
    pairwise[pairKey] = runMatch({
      ...config,
      onGameComplete: onProgress
        ? (record) => { onProgress(`Pairwise: ${pairKey}`, record.gameNumber, 2); }
        : undefined,
    });
  }

  // 5. Degenerate state checks
  const degenerateStates = checkDegenerateStates(perEvent);

  // 6. Aggregate summary
  const allResults = [
    hardVsEasy,
    hardVsHard,
    ...Object.values(perEvent),
    ...Object.values(pairwise),
  ];

  const totalGames = allResults.reduce((sum, r) => sum + r.totalGames, 0);
  const totalErrors = allResults.reduce((sum, r) => sum + r.errorGames, 0);
  const totalAnomalies = allResults.reduce((sum, r) => sum + r.anomalousGames.length, 0);

  // Check that all 7 event types triggered at least once across random matches
  const allFrequency = { ...hardVsEasy.eventStats?.eventFrequency, ...hardVsHard.eventStats?.eventFrequency };
  const allEventsTriggered = IMPLEMENTED_EVENTS.every((event) => (allFrequency[event] ?? 0) > 0);

  const summary: ValidationSummary = {
    totalGames,
    totalErrors,
    totalAnomalies,
    hardVsEasyWinRate: hardVsEasy.primaryWinRate,
    allEventsTriggered,
    degenerateStatesFound: degenerateStates,
  };

  return { hardVsEasy, hardVsHard, perEvent, pairwise, summary };
}

// ---------------------------------------------------------------------------
// Report Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a CrazyValidationReport as a markdown document suitable for
 * inclusion in the Phase 2 documentation folder.
 */
export function formatValidationReport(report: CrazyValidationReport): string {
  const { hardVsEasy, hardVsHard, perEvent, pairwise, summary } = report;
  const overallPass = summary.totalErrors === 0 && summary.hardVsEasyWinRate >= 0.70;

  const lines: string[] = [];
  lines.push('# Task 13.1 — Crazy Mode Automated Validation Report');
  lines.push('');
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push(`**Total games:** ${String(summary.totalGames)}`);
  lines.push(`**Total errors:** ${String(summary.totalErrors)}`);
  lines.push(`**Overall result:** ${overallPass ? 'PASS' : 'FAIL'}`);
  lines.push('');

  // Section 1: Hard vs. Easy
  lines.push('## 1. Hard vs. Easy (50 games)');
  lines.push('');
  lines.push(`- Hard win rate: ${(hardVsEasy.primaryWinRate * 100).toFixed(1)}% (threshold: >=70%)`);
  lines.push(`- Crashes: ${String(hardVsEasy.errorGames)}`);
  lines.push(`- Average game length: ${hardVsEasy.avgMoveCount.toFixed(1)} moves`);
  lines.push(`- Capped games: ${String(hardVsEasy.cappedGames)}`);
  lines.push(`- Anomalous games: ${hardVsEasy.anomalousGames.length > 0 ? hardVsEasy.anomalousGames.map(String).join(', ') : 'none'}`);
  lines.push('');

  // Section 2: Hard vs. Hard
  lines.push('## 2. Hard vs. Hard (50 games)');
  lines.push('');
  lines.push(`- Crashes: ${String(hardVsHard.errorGames)}`);
  lines.push(`- Average game length: ${hardVsHard.avgMoveCount.toFixed(1)} moves`);
  lines.push(`- Longest game: ${String(hardVsHard.maxMoveCount)} moves`);
  lines.push(`- Capped games: ${String(hardVsHard.cappedGames)}`);
  lines.push(`- Anomalous games: ${hardVsHard.anomalousGames.length > 0 ? hardVsHard.anomalousGames.map(String).join(', ') : 'none'}`);
  lines.push('');

  // Section 3: Per-Event
  lines.push('## 3. Per-Event Forced Matches (70 games)');
  lines.push('');
  lines.push('| Event | Games | Errors | Avg Length | Anomalies | Notes |');
  lines.push('|-------|-------|--------|------------|-----------|-------|');
  for (const [eventType, result] of Object.entries(perEvent)) {
    const anomalyStr = result.anomalousGames.length > 0
      ? result.anomalousGames.map(String).join(', ')
      : 'none';
    lines.push(`| ${eventType} | ${String(result.totalGames)} | ${String(result.errorGames)} | ${result.avgMoveCount.toFixed(1)} | ${anomalyStr} | |`);
  }
  lines.push('');

  // Section 4: Pairwise
  lines.push('## 4. Pairwise Stacking Spot-Checks (42 games)');
  lines.push('');
  lines.push('| Pair | Games | Errors | Notes |');
  lines.push('|------|-------|--------|-------|');
  for (const [pairKey, result] of Object.entries(pairwise)) {
    lines.push(`| ${pairKey} | ${String(result.totalGames)} | ${String(result.errorGames)} | |`);
  }
  lines.push('');

  // Section 5: Event Frequency
  lines.push('## 5. Event Frequency Distribution');
  lines.push('');
  const combinedFrequency: Record<string, number> = {};
  for (const result of [hardVsEasy, hardVsHard]) {
    for (const [event, count] of Object.entries(result.eventStats?.eventFrequency ?? {})) {
      combinedFrequency[event] = (combinedFrequency[event] ?? 0) + count;
    }
  }
  lines.push('| Event | Triggers (random matches) |');
  lines.push('|-------|---------------------------|');
  for (const event of IMPLEMENTED_EVENTS) {
    lines.push(`| ${event} | ${String(combinedFrequency[event] ?? 0)} |`);
  }
  lines.push('');

  // Section 6: Degenerate States
  lines.push('## 6. Degenerate States Found');
  lines.push('');
  if (summary.degenerateStatesFound.length === 0) {
    lines.push('No degenerate states found.');
  } else {
    for (const state of summary.degenerateStatesFound) {
      lines.push(`- ${state}`);
    }
  }
  lines.push('');

  // Section 7: Anomalous Games
  lines.push('## 7. Anomalous Games for Manual Review');
  lines.push('');
  const allAnomalous: Array<{ matchName: string; gameNumber: number; seed: number }> = [];
  const collectAnomalous = (name: string, result: MatchResult) => {
    for (const idx of result.anomalousGames) {
      const game = result.games.find((g) => g.gameNumber === idx);
      if (game) {
        allAnomalous.push({ matchName: name, gameNumber: idx, seed: game.gameSeed });
      }
    }
  };
  collectAnomalous('Hard vs. Easy', hardVsEasy);
  collectAnomalous('Hard vs. Hard', hardVsHard);
  for (const [eventType, result] of Object.entries(perEvent)) {
    collectAnomalous(`Per-event: ${eventType}`, result);
  }
  for (const [pairKey, result] of Object.entries(pairwise)) {
    collectAnomalous(`Pairwise: ${pairKey}`, result);
  }

  if (allAnomalous.length === 0) {
    lines.push('No anomalous games found.');
  } else {
    lines.push('| Match | Game # | Seed |');
    lines.push('|-------|--------|------|');
    for (const entry of allAnomalous) {
      lines.push(`| ${entry.matchName} | ${String(entry.gameNumber)} | ${String(entry.seed)} |`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

// Re-export configs for testing
export {
  HARD_VS_EASY_CONFIG,
  HARD_VS_HARD_CONFIG,
  buildPerEventConfigs,
  buildPairwiseConfigs,
  checkDegenerateStates,
};
