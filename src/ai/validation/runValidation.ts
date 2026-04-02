/**
 * Full AI validation suite.
 * Run with: npx tsx src/ai/validation/runValidation.ts
 * Or via npm script: npm run validate:ai
 */

import { runMatch, type MatchResult } from './selfPlay';

const MASTER_SEED = 42;

function main(): void {
  console.log('=== Crazy Checkers — AI Strength Validation ===\n');

  // --- Match 1: Hard vs. Easy (100 games) ---
  console.log('Match 1: Hard vs. Easy (100 games, alternating colors)');
  console.log('Target: Hard wins ≥80%\n');

  const hardVsEasy = runMatch({
    gameCount: 100,
    whiteDifficulty: 'hard',
    blackDifficulty: 'easy',
    alternateColors: true,
    maxMovesPerGame: 300,
    seed: MASTER_SEED,
    onGameComplete: (record) => {
      const marker =
        record.result === 'draw'
          ? '½'
          : (record.whiteDifficulty === 'hard' && record.result === 'white') ||
              (record.blackDifficulty === 'hard' && record.result === 'black')
            ? '■'
            : '□';
      process.stdout.write(marker);
      if (record.gameNumber % 50 === 0) process.stdout.write('\n');
    },
  });

  console.log('\n');
  printMatchReport('Hard vs. Easy', hardVsEasy, 0.8);

  // --- Match 2: Hard vs. Hard (50 games) ---
  console.log('\nMatch 2: Hard vs. Hard (50 games)');
  console.log('Target: 0 crashes, 0 illegal moves, all games terminate\n');

  const hardVsHard = runMatch({
    gameCount: 50,
    whiteDifficulty: 'hard',
    blackDifficulty: 'hard',
    alternateColors: false,
    maxMovesPerGame: 300,
    seed: MASTER_SEED + 100_000,
    onGameComplete: (record) => {
      const marker =
        record.result === 'draw'
          ? '½'
          : record.result === 'white'
            ? 'W'
            : 'B';
      process.stdout.write(marker);
      if (record.gameNumber % 50 === 0) process.stdout.write('\n');
    },
  });

  console.log('\n');
  printMatchReport('Hard vs. Hard', hardVsHard, null);

  // --- Final verdict ---
  console.log('\n=== VERDICT ===');
  const pass =
    hardVsEasy.primaryWinRate >= 0.8 &&
    hardVsHard.cappedGames === 0 &&
    hardVsHard.anomalousGames.length === 0;

  if (pass) {
    console.log('✓ PASS — All validation targets met.');
  } else {
    console.log('✗ FAIL — One or more targets missed:');
    if (hardVsEasy.primaryWinRate < 0.8) {
      console.log(
        `  - Hard win rate: ${(hardVsEasy.primaryWinRate * 100).toFixed(1)}% (target: ≥80%)`,
      );
    }
    if (hardVsHard.cappedGames > 0) {
      console.log(
        `  - ${hardVsHard.cappedGames} Hard-vs-Hard game(s) hit the move limit cap.`,
      );
    }
    if (hardVsHard.anomalousGames.length > 0) {
      console.log(
        `  - Anomalous games: ${hardVsHard.anomalousGames.join(', ')}`,
      );
    }
    process.exitCode = 1;
  }
}

function printMatchReport(
  label: string,
  result: MatchResult,
  winRateTarget: number | null,
): void {
  console.log(`--- ${label} ---`);
  console.log(`Games played: ${result.totalGames}`);
  console.log(
    `White wins: ${result.wins.white}  |  Black wins: ${result.wins.black}  |  Draws: ${result.wins.draw}`,
  );
  console.log(
    `Primary win rate: ${(result.primaryWinRate * 100).toFixed(1)}%`,
  );
  if (winRateTarget !== null) {
    const met = result.primaryWinRate >= winRateTarget ? '✓' : '✗';
    console.log(
      `Target (≥${(winRateTarget * 100).toFixed(0)}%): ${met}`,
    );
  }
  console.log(
    `Game length — avg: ${result.avgMoveCount.toFixed(1)}, min: ${result.minMoveCount}, max: ${result.maxMoveCount}`,
  );
  console.log(`Capped games: ${result.cappedGames}`);
  console.log(
    `Anomalous games: ${result.anomalousGames.length > 0 ? result.anomalousGames.join(', ') : 'none'}`,
  );
  console.log(`Total time: ${(result.totalElapsedMs / 1000).toFixed(1)}s`);
}

main();
