/**
 * Crazy Mode Automated Validation Suite.
 *
 * Orchestrates large-scale self-play matches to validate event correctness,
 * AI event reasoning, and the absence of degenerate or crash-inducing board states.
 */

import { CrazyEvent, GameMode } from '../../engine/types';
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
  /** Per-event forced matches (10 games each). */
  perEvent: Record<string, MatchResult>;
  /** Pairwise event stacking spot-checks. */
  pairwise: Record<string, MatchResult>;
  /** Summary statistics. */
  summary: ValidationSummary;
  // Phase 3 additions
  /** Triple+ event stacking stress tests. */
  tripleStacking: Record<string, MatchResult>;
  /** Extra Crazy mode (event on every capture). */
  extraCrazy: MatchResult | null;
  /** Simulated Chaos mode (DoubleTrouble on every capture). */
  chaosMode: MatchResult | null;
  /** Performance benchmark with 5+ simultaneous events. */
  performanceBenchmark: PerformanceBenchmarkResult | null;
}

export interface PerformanceBenchmarkResult {
  avgMoveTimeMs: number;
  p95MoveTimeMs: number;
  maxMoveTimeMs: number;
  totalGames: number;
  totalMoves: number;
  passesThreshold: boolean;
}

export interface ValidationSummary {
  totalGames: number;
  totalErrors: number;
  totalAnomalies: number;
  hardVsEasyWinRate: number;
  allEventsTriggered: boolean;
  degenerateStatesFound: string[];
  // Phase 3 additions
  pairwiseCoverage: number;
  tripleStackingErrors: number;
  extraCrazyErrors: number;
  chaosModeErrors: number;
  performancePass: boolean;
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
// Phase 3 — Triple+ Stacking Configs
// ---------------------------------------------------------------------------

const TRIPLE_STACKING_BASE: Omit<MatchConfig, 'forceEventSequence'> = {
  gameCount: 3,
  whiteDifficulty: 'hard',
  blackDifficulty: 'hard',
  alternateColors: false,
  maxMovesPerGame: 400,
  seed: 20260430,
  mode: GameMode.Crazy,
};

function buildTripleStackingConfigs(): Array<{ label: string; config: MatchConfig }> {
  const configs: Array<{ label: string; config: MatchConfig }> = [
    // All Tier 3
    { label: 'Tier3-All', config: { ...TRIPLE_STACKING_BASE, gameCount: 5, forceEventSequence: [CrazyEvent.FlippedScript, CrazyEvent.MarchingOrders, CrazyEvent.Haunted, CrazyEvent.ShrinkingBoard] } },
    // Same-hook triples: getLegalMoves
    { label: 'getLegalMoves-3a', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.Quicksand, CrazyEvent.ForcedMarch, CrazyEvent.FrozenAssets] } },
    { label: 'getLegalMoves-3b', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.GhostWalk, CrazyEvent.Leapfrog, CrazyEvent.Backfire] } },
    { label: 'getLegalMoves-3c', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.RoyalDecree, CrazyEvent.Sentry, CrazyEvent.StepBack] } },
    // Same-hook triples: onCapture
    { label: 'onCapture-3a', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.ChainReaction, CrazyEvent.Sacrifice, CrazyEvent.Haunted] } },
    { label: 'onCapture-3b', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.LiveGrenade, CrazyEvent.TimeBomb, CrazyEvent.ChainReaction] } },
    // Same-hook triples: onTurnEnd
    { label: 'onTurnEnd-3a', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.HotPotato, CrazyEvent.Landmine, CrazyEvent.TollRoad] } },
    { label: 'onTurnEnd-3b', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.Wormhole, CrazyEvent.DoubleTime, CrazyEvent.ShrinkingBoard] } },
    // Same-hook triples: applyMove
    { label: 'applyMove-3a', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.Conscription, CrazyEvent.Ricochet, CrazyEvent.CrownThief] } },
    // Same-hook triples: onTurnStart
    { label: 'onTurnStart-3a', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.ChecksMix, CrazyEvent.Stampede, CrazyEvent.SwapMeet] } },
    // Capture chain combos
    { label: 'Capture-Chain-3a', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.ChainReaction, CrazyEvent.Backfire, CrazyEvent.Landmine] } },
    { label: 'Capture-Chain-3b', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.Conscription, CrazyEvent.Sacrifice, CrazyEvent.TollRoad] } },
    { label: 'Capture-Chain-3c', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.LiveGrenade, CrazyEvent.Conscription, CrazyEvent.ChainReaction] } },
    // Board-altering stacks
    { label: 'Board-Alter-5a', config: { ...TRIPLE_STACKING_BASE, gameCount: 2, forceEventSequence: [CrazyEvent.ShrinkingBoard, CrazyEvent.Landmine, CrazyEvent.Wormhole, CrazyEvent.SafeHaven, CrazyEvent.TollRoad] } },
    { label: 'Board-Alter-5b', config: { ...TRIPLE_STACKING_BASE, gameCount: 2, forceEventSequence: [CrazyEvent.Haunted, CrazyEvent.Quicksand, CrazyEvent.Landmine, CrazyEvent.Bodyguard, CrazyEvent.Sentry] } },
    // Duration mix (instant + permanent + timed)
    { label: 'Mixed-Duration-5', config: { ...TRIPLE_STACKING_BASE, gameCount: 2, forceEventSequence: [CrazyEvent.ChecksMix, CrazyEvent.KingForADay, CrazyEvent.OppositeDay, CrazyEvent.Reinforcements, CrazyEvent.Stampede] } },
    { label: 'Mixed-Duration-5b', config: { ...TRIPLE_STACKING_BASE, gameCount: 2, forceEventSequence: [CrazyEvent.SwapMeet, CrazyEvent.Demotion, CrazyEvent.FlippedScript, CrazyEvent.RushHour, CrazyEvent.GhostWalk] } },
    // 5-event stress
    { label: 'Stress-5a', config: { ...TRIPLE_STACKING_BASE, gameCount: 2, forceEventSequence: [CrazyEvent.OppositeDay, CrazyEvent.Bodyguard, CrazyEvent.Quicksand, CrazyEvent.FrozenAssets, CrazyEvent.SafeHaven] } },
    { label: 'Stress-5b', config: { ...TRIPLE_STACKING_BASE, gameCount: 2, forceEventSequence: [CrazyEvent.ForcedMarch, CrazyEvent.RoyalDecree, CrazyEvent.Sentry, CrazyEvent.RushHour, CrazyEvent.StepBack] } },
    // 6+ event mega-stacks
    { label: 'Mega-6', config: { ...TRIPLE_STACKING_BASE, gameCount: 2, forceEventSequence: [CrazyEvent.KingForADay, CrazyEvent.OppositeDay, CrazyEvent.Bodyguard, CrazyEvent.Conscription, CrazyEvent.Sacrifice, CrazyEvent.TollRoad] } },
    { label: 'Mega-7', config: { ...TRIPLE_STACKING_BASE, gameCount: 2, forceEventSequence: [CrazyEvent.ShrinkingBoard, CrazyEvent.Haunted, CrazyEvent.Landmine, CrazyEvent.Wormhole, CrazyEvent.TimeBomb, CrazyEvent.ChainReaction, CrazyEvent.LiveGrenade] } },
    // Promotion combos
    { label: 'Promo-3a', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.FlippedScript, CrazyEvent.PromotionParty, CrazyEvent.CrownThief] } },
    { label: 'Promo-3b', config: { ...TRIPLE_STACKING_BASE, forceEventSequence: [CrazyEvent.Demotion, CrazyEvent.Sacrifice, CrazyEvent.KingForADay] } },
  ];
  return configs;
}

const EXTRA_CRAZY_CONFIG: MatchConfig = {
  gameCount: 30,
  whiteDifficulty: 'hard',
  blackDifficulty: 'hard',
  alternateColors: true,
  maxMovesPerGame: 400,
  seed: 20260440,
  mode: GameMode.Crazy,
  extraCrazyMode: true,
};

const CHAOS_MODE_CONFIG: MatchConfig = {
  gameCount: 30,
  whiteDifficulty: 'hard',
  blackDifficulty: 'hard',
  alternateColors: true,
  maxMovesPerGame: 400,
  seed: 20260450,
  mode: GameMode.Chaos,
};

const PERF_BENCHMARK_CONFIG: MatchConfig = {
  gameCount: 20,
  whiteDifficulty: 'hard',
  blackDifficulty: 'hard',
  alternateColors: false,
  maxMovesPerGame: 200,
  seed: 20260460,
  mode: GameMode.Crazy,
  forceEventSequence: [
    CrazyEvent.OppositeDay,
    CrazyEvent.Bodyguard,
    CrazyEvent.Quicksand,
    CrazyEvent.FrozenAssets,
    CrazyEvent.SafeHaven,
    CrazyEvent.ForcedMarch,
    CrazyEvent.RoyalDecree,
    CrazyEvent.Sentry,
  ],
  trackMoveTimings: true,
};

function runPerformanceBenchmark(
  onProgress?: (matchName: string, gamesCompleted: number, totalGames: number) => void,
): PerformanceBenchmarkResult {
  const result = runMatch({
    ...PERF_BENCHMARK_CONFIG,
    onGameComplete: onProgress
      ? (record) => { onProgress('Perf Benchmark', record.gameNumber, PERF_BENCHMARK_CONFIG.gameCount); }
      : undefined,
  });
  const allMoveTimes = result.games.flatMap(g => g.moveTimings ?? []);
  if (allMoveTimes.length === 0) {
    return { avgMoveTimeMs: 0, p95MoveTimeMs: 0, maxMoveTimeMs: 0, totalGames: result.totalGames, totalMoves: 0, passesThreshold: true };
  }
  allMoveTimes.sort((a, b) => a - b);
  const p95Index = Math.floor(allMoveTimes.length * 0.95);
  return {
    avgMoveTimeMs: allMoveTimes.reduce((s, t) => s + t, 0) / allMoveTimes.length,
    p95MoveTimeMs: allMoveTimes[p95Index] ?? 0,
    maxMoveTimeMs: allMoveTimes[allMoveTimes.length - 1] ?? 0,
    totalGames: result.totalGames,
    totalMoves: allMoveTimes.length,
    passesThreshold: (allMoveTimes[p95Index] ?? 0) <= 3000,
  };
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

      // Instant shuffle events: game must not end within 1 ply
      const instantShuffleEvents = ['CHECKS_MIX', 'STAMPEDE', 'SWAP_MEET', 'REINFORCEMENTS'];
      if (instantShuffleEvents.includes(eventType) && game.eventLog) {
        for (const entry of game.eventLog) {
          if (entry.event === eventType && game.moveCount <= entry.ply + 1) {
            degenerates.push(
              `${eventType}: Game #${String(game.gameNumber)} ended within 1 ply of activation at ply ${String(entry.ply)} (seed: ${String(game.gameSeed)})`,
            );
          }
        }
      }

      // Long-game events: flag excessively long games
      const longGameEvents = ['UP_IN_THE_AIR', 'OPPOSITE_DAY', 'SHRINKING_BOARD', 'MARCHING_ORDERS'];
      if (longGameEvents.includes(eventType) && game.moveCount > 350) {
        degenerates.push(
          `${eventType}: Game #${String(game.gameNumber)} had ${String(game.moveCount)} moves, approaching cap (seed: ${String(game.gameSeed)})`,
        );
      }

      // Repetition events: flag excessive consecutive same-event triggers
      const repetitionEvents = ['HOT_POTATO', 'DOUBLE_TROUBLE'];
      if (repetitionEvents.includes(eventType) && game.eventLog) {
        let maxConsecutive = 0;
        let consecutive = 1;
        for (let k = 1; k < game.eventLog.length; k++) {
          const curr = game.eventLog[k];
          const prev = game.eventLog[k - 1];
          if (curr && prev && curr.event === prev.event) {
            consecutive++;
            maxConsecutive = Math.max(maxConsecutive, consecutive);
          } else {
            consecutive = 1;
          }
        }
        if (maxConsecutive > 4) {
          degenerates.push(
            `${eventType}: Game #${String(game.gameNumber)} had ${String(maxConsecutive)} consecutive same-event triggers (seed: ${String(game.gameSeed)})`,
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

  // 5. Triple+ stacking stress tests
  const tripleStacking: Record<string, MatchResult> = {};
  for (const { label, config } of buildTripleStackingConfigs()) {
    tripleStacking[label] = runMatch({
      ...config,
      onGameComplete: onProgress
        ? (record) => { onProgress(`Triple: ${label}`, record.gameNumber, config.gameCount); }
        : undefined,
    });
  }

  // 6. Extra Crazy mode
  const extraCrazy = runMatch({
    ...EXTRA_CRAZY_CONFIG,
    onGameComplete: onProgress
      ? (record) => { onProgress('Extra Crazy', record.gameNumber, EXTRA_CRAZY_CONFIG.gameCount); }
      : undefined,
  });

  // 7. Chaos mode
  const chaosMode = runMatch({
    ...CHAOS_MODE_CONFIG,
    onGameComplete: onProgress
      ? (record) => { onProgress('Chaos Mode', record.gameNumber, CHAOS_MODE_CONFIG.gameCount); }
      : undefined,
  });

  // 8. Performance benchmark
  const performanceBenchmark = runPerformanceBenchmark(onProgress);

  // 9. Degenerate state checks
  const degenerateStates = checkDegenerateStates(perEvent);

  // 10. Aggregate summary
  const allResults = [
    hardVsEasy,
    hardVsHard,
    ...Object.values(perEvent),
    ...Object.values(pairwise),
    ...Object.values(tripleStacking),
    extraCrazy,
    chaosMode,
  ];

  const totalGames = allResults.reduce((sum, r) => sum + r.totalGames, 0) + performanceBenchmark.totalGames;
  const totalErrors = allResults.reduce((sum, r) => sum + r.errorGames, 0);
  const totalAnomalies = allResults.reduce((sum, r) => sum + r.anomalousGames.length, 0);

  const allFrequency = { ...hardVsEasy.eventStats?.eventFrequency, ...hardVsHard.eventStats?.eventFrequency };
  const allEventsTriggered = IMPLEMENTED_EVENTS.every((event) => (allFrequency[event] ?? 0) > 0);

  const tripleStackingErrors = Object.values(tripleStacking).reduce((sum, r) => sum + r.errorGames, 0);

  const summary: ValidationSummary = {
    totalGames,
    totalErrors,
    totalAnomalies,
    hardVsEasyWinRate: hardVsEasy.primaryWinRate,
    allEventsTriggered,
    degenerateStatesFound: degenerateStates,
    pairwiseCoverage: Object.keys(pairwise).length / Math.max(1, (IMPLEMENTED_EVENTS.length * (IMPLEMENTED_EVENTS.length - 1)) / 2),
    tripleStackingErrors,
    extraCrazyErrors: extraCrazy.errorGames,
    chaosModeErrors: chaosMode.errorGames,
    performancePass: performanceBenchmark.passesThreshold,
  };

  return { hardVsEasy, hardVsHard, perEvent, pairwise, summary, tripleStacking, extraCrazy, chaosMode, performanceBenchmark };
}

// ---------------------------------------------------------------------------
// Report Formatting
// ---------------------------------------------------------------------------

/**
 * Formats a CrazyValidationReport as a markdown document suitable for
 * inclusion in the Phase 2 documentation folder.
 */
export function formatValidationReport(report: CrazyValidationReport): string {
  const { hardVsEasy, hardVsHard, perEvent, pairwise, summary, tripleStacking, extraCrazy, chaosMode, performanceBenchmark } = report;
  const overallPass =
    summary.totalErrors === 0 &&
    summary.hardVsEasyWinRate >= 0.70 &&
    summary.tripleStackingErrors === 0 &&
    summary.extraCrazyErrors === 0 &&
    summary.chaosModeErrors === 0 &&
    summary.performancePass;

  const lines: string[] = [];
  lines.push('# Task 16.6 — Full Event Pool Validation Report');
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
  const perEventCount = Object.values(perEvent).reduce((s, r) => s + r.totalGames, 0);
  lines.push(`## 3. Per-Event Forced Matches (${String(perEventCount)} games)`);
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
  const pairwiseCount = Object.values(pairwise).reduce((s, r) => s + r.totalGames, 0);
  lines.push(`## 4. Pairwise Stacking (${String(pairwiseCount)} games)`);
  lines.push('');
  lines.push('| Pair | Games | Errors | Notes |');
  lines.push('|------|-------|--------|-------|');
  for (const [pairKey, result] of Object.entries(pairwise)) {
    lines.push(`| ${pairKey} | ${String(result.totalGames)} | ${String(result.errorGames)} | |`);
  }
  lines.push('');

  // Section 5: Triple+ Stacking
  const tripleCount = Object.values(tripleStacking).reduce((s, r) => s + r.totalGames, 0);
  const tripleErrors = Object.values(tripleStacking).reduce((s, r) => s + r.errorGames, 0);
  lines.push(`## 5. Triple+ Event Stacking (${String(tripleCount)} games)`);
  lines.push('');
  lines.push('| Config | Games | Errors | Avg Length | Notes |');
  lines.push('|--------|-------|--------|------------|-------|');
  for (const [label, result] of Object.entries(tripleStacking)) {
    lines.push(`| ${label} | ${String(result.totalGames)} | ${String(result.errorGames)} | ${result.avgMoveCount.toFixed(1)} | |`);
  }
  lines.push(`\n**Total errors:** ${String(tripleErrors)}`);
  lines.push('');

  // Section 6: Extra Crazy
  lines.push('## 6. Extra Crazy Mode (30 games)');
  lines.push('');
  if (extraCrazy) {
    lines.push(`- Crashes: ${String(extraCrazy.errorGames)}`);
    lines.push(`- Average game length: ${extraCrazy.avgMoveCount.toFixed(1)} moves`);
    lines.push(`- Capped games: ${String(extraCrazy.cappedGames)}`);
  } else {
    lines.push('Skipped.');
  }
  lines.push('');

  // Section 7: Chaos Mode
  lines.push('## 7. Chaos Mode (30 games)');
  lines.push('');
  if (chaosMode) {
    lines.push(`- Crashes: ${String(chaosMode.errorGames)}`);
    lines.push(`- Average game length: ${chaosMode.avgMoveCount.toFixed(1)} moves`);
    lines.push(`- Capped games: ${String(chaosMode.cappedGames)}`);
  } else {
    lines.push('Skipped.');
  }
  lines.push('');

  // Section 8: Performance Benchmark
  lines.push('## 8. Performance Benchmark (5+ events)');
  lines.push('');
  if (performanceBenchmark) {
    lines.push(`- Total games: ${String(performanceBenchmark.totalGames)}`);
    lines.push(`- Total moves: ${String(performanceBenchmark.totalMoves)}`);
    lines.push(`- Avg move time: ${performanceBenchmark.avgMoveTimeMs.toFixed(1)}ms`);
    lines.push(`- P95 move time: ${performanceBenchmark.p95MoveTimeMs.toFixed(1)}ms (threshold: <=3000ms)`);
    lines.push(`- Max move time: ${performanceBenchmark.maxMoveTimeMs.toFixed(1)}ms`);
    lines.push(`- **Result:** ${performanceBenchmark.passesThreshold ? 'PASS' : 'FAIL'}`);
  } else {
    lines.push('Skipped.');
  }
  lines.push('');

  // Section 9: Event Frequency
  lines.push('## 9. Event Frequency Distribution');
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

  // Section 10: Degenerate States
  lines.push('## 10. Degenerate States Found');
  lines.push('');
  if (summary.degenerateStatesFound.length === 0) {
    lines.push('No degenerate states found.');
  } else {
    for (const state of summary.degenerateStatesFound) {
      lines.push(`- ${state}`);
    }
  }
  lines.push('');

  // Section 11: Anomalous Games
  lines.push('## 11. Anomalous Games for Manual Review');
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
  for (const [label, result] of Object.entries(tripleStacking)) {
    collectAnomalous(`Triple: ${label}`, result);
  }
  if (extraCrazy) collectAnomalous('Extra Crazy', extraCrazy);
  if (chaosMode) collectAnomalous('Chaos Mode', chaosMode);

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
  buildTripleStackingConfigs,
  checkDegenerateStates,
  EXTRA_CRAZY_CONFIG,
  CHAOS_MODE_CONFIG,
  PERF_BENCHMARK_CONFIG,
};
