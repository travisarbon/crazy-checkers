/**
 * Puzzle Generation Pipeline
 *
 * Build-time Node.js script that produces src/data/puzzleData.ts containing
 * 100 validated checkers puzzles of monotonically increasing difficulty.
 *
 * Usage: npx tsx scripts/generatePuzzles.ts [--verbose] [--quick]
 *
 * The --quick flag generates fewer games (50) for rapid iteration/testing.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  MASTER_SEED,
  TOTAL_GAMES,
  TARGET_PUZZLE_COUNT,
  DIFFICULTY_PAIRINGS,
} from './puzzleGenConfig.ts';
import type {
  InstrumentedGameRecord,
  CandidatePuzzle,
  ValidatedPuzzle,
  RatedPuzzle,
  PuzzleDefinition,
} from './puzzleGenUtils.ts';
import {
  createSeededRandom,
  instrumentedPlayGame,
  extractCandidates,
  validateCandidate,
  classifyPuzzleType,
  generateGoalText,
  computeDifficultyScore,
  computeBranchingScore,
  computeTimeThresholds,
  assignDifficultyTier,
  runQAChecks,
} from './puzzleGenUtils.ts';
import { PieceColor } from '../src/engine/types.ts';

// ---------------------------------------------------------------------------
// CLI flags
// ---------------------------------------------------------------------------

const verbose = process.argv.includes('--verbose');
const quick = process.argv.includes('--quick');

function log(msg: string): void {
  console.log(msg);
}

function logVerbose(msg: string): void {
  if (verbose) console.log(`  [verbose] ${msg}`);
}

// ---------------------------------------------------------------------------
// Stage 0: Initialization
// ---------------------------------------------------------------------------

function initializeSeeds(totalGames: number): number[] {
  const masterRandom = createSeededRandom(MASTER_SEED);
  const seeds: number[] = [];
  for (let i = 0; i < totalGames; i++) {
    seeds.push(Math.floor(masterRandom() * 4294967296));
  }
  return seeds;
}

// ---------------------------------------------------------------------------
// Stage 1: Instrumented Self-Play Game Generation
// ---------------------------------------------------------------------------

function generateGames(gameSeeds: number[], totalGames: number): InstrumentedGameRecord[] {
  const games: InstrumentedGameRecord[] = [];
  const startTime = performance.now();

  // Build flat list of game assignments from pairings
  interface GameAssignment {
    white: 'easy' | 'hard';
    black: 'easy' | 'hard';
  }
  const assignments: GameAssignment[] = [];

  // Scale pairings proportionally if quick mode
  const scaleFactor = totalGames / TOTAL_GAMES;
  for (const pairing of DIFFICULTY_PAIRINGS) {
    const count = Math.max(1, Math.round(pairing.count * scaleFactor));
    for (let i = 0; i < count; i++) {
      assignments.push({ white: pairing.white, black: pairing.black });
    }
  }

  // Trim or pad to exact total
  while (assignments.length > totalGames) assignments.pop();
  while (assignments.length < totalGames) {
    assignments.push({ white: 'hard', black: 'easy' });
  }

  for (let i = 0; i < totalGames; i++) {
    const assignment = assignments[i]!;
    const seed = gameSeeds[i]!;
    const gameId = `game-${String(i)}`;

    if (i % 50 === 0 || i === totalGames - 1) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      const eta =
        i > 0
          ? (((performance.now() - startTime) / i) * (totalGames - i) / 1000).toFixed(0)
          : '?';
      log(
        `  Stage 1: Game ${String(i + 1)}/${String(totalGames)} ` +
          `(${assignment.white} vs ${assignment.black}) ` +
          `[${elapsed}s elapsed, ~${eta}s remaining]`,
      );
    }

    const record = instrumentedPlayGame(
      assignment.white,
      assignment.black,
      seed,
      gameId,
    );

    games.push(record);
    logVerbose(
      `${gameId}: ${record.result} in ${String(record.plyCount)} plies ` +
        `(${record.reason})`,
    );
  }

  const totalElapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  log(`  Stage 1 complete: ${String(games.length)} games in ${totalElapsed}s`);

  return games;
}

// ---------------------------------------------------------------------------
// Stage 2: Position Extraction
// ---------------------------------------------------------------------------

function extractPositions(games: InstrumentedGameRecord[]): CandidatePuzzle[] {
  const startTime = performance.now();
  const candidates = extractCandidates(games);
  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  log(`  Stage 2 complete: ${String(candidates.length)} unique candidates in ${elapsed}s`);
  return candidates;
}

// ---------------------------------------------------------------------------
// Stage 3: Solution Validation
// ---------------------------------------------------------------------------

function validatePositions(candidates: CandidatePuzzle[]): ValidatedPuzzle[] {
  const validated: ValidatedPuzzle[] = [];
  const startTime = performance.now();

  for (let i = 0; i < candidates.length; i++) {
    if (i % 50 === 0 || i === candidates.length - 1) {
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
      log(
        `  Stage 3: Validating ${String(i + 1)}/${String(candidates.length)} ` +
          `(${String(validated.length)} accepted) [${elapsed}s]`,
      );
    }

    const result = validateCandidate(candidates[i]!);
    if (result) {
      validated.push(result);
      logVerbose(
        `Accepted: ${result.sourceGameId} ply ${String(result.sourcePly)} ` +
          `(depth=${String(result.solutionDepth)}, margin=${String(result.margin)})`,
      );
    }

    // Early exit if we have enough (with 2× headroom for selection)
    if (validated.length >= TARGET_PUZZLE_COUNT * 3) {
      log(`  Stage 3: Early exit — sufficient candidates (${String(validated.length)})`);
      break;
    }
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  log(
    `  Stage 3 complete: ${String(validated.length)}/${String(candidates.length)} ` +
      `validated in ${elapsed}s`,
  );
  return validated;
}

// ---------------------------------------------------------------------------
// Stage 4: Difficulty Calibration
// ---------------------------------------------------------------------------

function calibrateDifficulty(validated: ValidatedPuzzle[]): RatedPuzzle[] {
  const startTime = performance.now();
  const rated: RatedPuzzle[] = [];

  for (const puzzle of validated) {
    const difficultyRating = computeDifficultyScore(puzzle);
    const puzzleType = classifyPuzzleType(puzzle);
    const goal = generateGoalText(puzzleType, puzzle.solutionDepth);

    rated.push({
      ...puzzle,
      difficultyRating,
      difficultyTier: 'easy', // placeholder — assigned after sorting
      puzzleType,
      goal,
      thresholdFastMs: 0, // placeholder — computed after sorting
      thresholdSlowMs: 0,
    });
  }

  // Sort by ascending difficulty
  rated.sort((a, b) => a.difficultyRating - b.difficultyRating);

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  log(`  Stage 4 complete: ${String(rated.length)} puzzles rated in ${elapsed}s`);
  return rated;
}

// ---------------------------------------------------------------------------
// Stage 5: Quality Assurance & Final Selection
// ---------------------------------------------------------------------------

function selectAndFinalize(rated: RatedPuzzle[]): RatedPuzzle[] {
  const startTime = performance.now();

  if (rated.length < TARGET_PUZZLE_COUNT) {
    log(
      `  WARNING: Only ${String(rated.length)} puzzles available ` +
        `(need ${String(TARGET_PUZZLE_COUNT)}). Using all.`,
    );
  }

  // Divide into 5 buckets of equal size
  const bucketSize = Math.floor(rated.length / 5);
  const buckets: RatedPuzzle[][] = [];
  for (let b = 0; b < 5; b++) {
    const start = b * bucketSize;
    const end = b === 4 ? rated.length : (b + 1) * bucketSize;
    buckets.push(rated.slice(start, end));
  }

  // Select from each bucket, prioritizing diversity
  const targetPerBucket = Math.min(20, Math.ceil(TARGET_PUZZLE_COUNT / 5));
  const selected: RatedPuzzle[] = [];

  for (const bucket of buckets) {
    // Sort within bucket: prefer higher margin (more decisive), diverse types
    const typesSeen = new Set<string>();
    const bucketSelected: RatedPuzzle[] = [];

    // First pass: pick diverse types
    for (const puzzle of bucket) {
      if (bucketSelected.length >= targetPerBucket) break;
      if (!typesSeen.has(puzzle.puzzleType)) {
        typesSeen.add(puzzle.puzzleType);
        bucketSelected.push(puzzle);
      }
    }

    // Second pass: fill remaining with highest margin
    const remaining = bucket
      .filter((p) => !bucketSelected.includes(p))
      .sort((a, b) => b.margin - a.margin);

    for (const puzzle of remaining) {
      if (bucketSelected.length >= targetPerBucket) break;
      bucketSelected.push(puzzle);
    }

    selected.push(...bucketSelected);
  }

  // Sort final selection by difficulty rating
  selected.sort((a, b) => a.difficultyRating - b.difficultyRating);

  // Trim to exactly TARGET_PUZZLE_COUNT
  const final = selected.slice(0, TARGET_PUZZLE_COUNT);

  // Assign tiers and compute thresholds based on final position
  for (let i = 0; i < final.length; i++) {
    const puzzle = final[i]!;
    puzzle.difficultyTier = assignDifficultyTier(i + 1);
    const branchingScore = computeBranchingScore(puzzle);
    const thresholds = computeTimeThresholds(i + 1, puzzle.solutionDepth, branchingScore);
    puzzle.thresholdFastMs = thresholds.thresholdFastMs;
    puzzle.thresholdSlowMs = thresholds.thresholdSlowMs;
  }

  // Color balance check and rebalancing
  const whiteCount = final.filter((p) => p.activeColor === PieceColor.White).length;
  const blackCount = final.filter((p) => p.activeColor === PieceColor.Black).length;
  log(
    `  Color balance: ${String(whiteCount)} white, ${String(blackCount)} black`,
  );

  // Run QA checks
  const qaErrors = runQAChecks(final);
  if (qaErrors.length > 0) {
    log('  QA warnings:');
    for (const err of qaErrors) {
      log(`    - ${err}`);
    }
  } else {
    log('  QA: All checks passed');
  }

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
  log(`  Stage 5 complete: ${String(final.length)} puzzles selected in ${elapsed}s`);
  return final;
}

// ---------------------------------------------------------------------------
// Output generation
// ---------------------------------------------------------------------------

function writePuzzleData(puzzles: RatedPuzzle[]): void {
  const definitions: PuzzleDefinition[] = puzzles.map((p, i) => ({
    id: i + 1,
    boardState: p.boardState,
    activeColor: p.activeColor === PieceColor.White ? 'white' as const : 'black' as const,
    goal: p.goal,
    solutionPath: p.solutionPath,
    solutionDepth: p.solutionDepth,
    difficultyRating: Math.round(p.difficultyRating * 1000) / 1000,
    difficultyTier: p.difficultyTier,
    pieceCount: p.pieceCount,
    puzzleType: p.puzzleType,
    sourceGameId: p.sourceGameId,
    sourcePly: p.sourcePly,
    thresholdFastMs: p.thresholdFastMs,
    thresholdSlowMs: p.thresholdSlowMs,
  }));

  const now = new Date().toISOString();

  const lines: string[] = [
    '/**',
    ` * Auto-generated by scripts/generatePuzzles.ts`,
    ` * Master seed: ${String(MASTER_SEED)} | Games: ${String(quick ? Math.round(TOTAL_GAMES * 0.08) : TOTAL_GAMES)} | Generated: ${now}`,
    ' * DO NOT EDIT MANUALLY — re-run the pipeline to regenerate.',
    ' */',
    '',
    'export interface PuzzleDefinition {',
    '  readonly id: number;',
    '  readonly boardState: string;',
    "  readonly activeColor: 'white' | 'black';",
    '  readonly goal: string;',
    '  readonly solutionPath: readonly string[];',
    '  readonly solutionDepth: number;',
    '  readonly difficultyRating: number;',
    "  readonly difficultyTier: 'easy' | 'medium' | 'hard';",
    '  readonly pieceCount: number;',
    '  readonly puzzleType: string;',
    '  readonly sourceGameId: string;',
    '  readonly sourcePly: number;',
    '  readonly thresholdFastMs: number;',
    '  readonly thresholdSlowMs: number;',
    '}',
    '',
    'export const PUZZLE_DATA: readonly PuzzleDefinition[] = [',
  ];

  for (const def of definitions) {
    lines.push('  {');
    lines.push(`    id: ${String(def.id)},`);
    lines.push(`    boardState: '${def.boardState}',`);
    lines.push(`    activeColor: '${def.activeColor}',`);
    lines.push(`    goal: '${def.goal}',`);
    lines.push(`    solutionPath: [${def.solutionPath.map((s) => `'${s}'`).join(', ')}],`);
    lines.push(`    solutionDepth: ${String(def.solutionDepth)},`);
    lines.push(`    difficultyRating: ${String(def.difficultyRating)},`);
    lines.push(`    difficultyTier: '${def.difficultyTier}',`);
    lines.push(`    pieceCount: ${String(def.pieceCount)},`);
    lines.push(`    puzzleType: '${def.puzzleType}',`);
    lines.push(`    sourceGameId: '${def.sourceGameId}',`);
    lines.push(`    sourcePly: ${String(def.sourcePly)},`);
    lines.push(`    thresholdFastMs: ${String(def.thresholdFastMs)},`);
    lines.push(`    thresholdSlowMs: ${String(def.thresholdSlowMs)},`);
    lines.push('  },');
  }

  lines.push('] as const;');
  lines.push('');
  lines.push('export const PUZZLE_GENERATION_META = {');
  lines.push(`  masterSeed: ${String(MASTER_SEED)},`);
  lines.push(`  totalGames: ${String(quick ? Math.round(TOTAL_GAMES * 0.08) : TOTAL_GAMES)},`);
  lines.push(`  generatedAt: '${now}',`);
  lines.push("  pipelineVersion: '1.0.0',");
  lines.push('} as const;');
  lines.push('');

  const outputPath = path.resolve(import.meta.dirname, '../src/data/puzzleData.ts');
  fs.writeFileSync(outputPath, lines.join('\n'), 'utf-8');
  log(`Output written to: ${outputPath}`);

  // Size check
  const sizeBytes = Buffer.byteLength(lines.join('\n'), 'utf-8');
  log(`  File size: ${String((sizeBytes / 1024).toFixed(1))} KB`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  const totalGames = quick ? Math.round(TOTAL_GAMES * 0.08) : TOTAL_GAMES;
  const targetCount = quick ? Math.min(TARGET_PUZZLE_COUNT, 20) : TARGET_PUZZLE_COUNT;

  log('=== Puzzle Generation Pipeline ===');
  log(`  Master seed: ${String(MASTER_SEED)}`);
  log(`  Total games: ${String(totalGames)}${quick ? ' (quick mode)' : ''}`);
  log(`  Target puzzles: ${String(targetCount)}`);
  log('');

  // Stage 0: Initialize seeds
  log('Stage 0: Initializing seeds...');
  const gameSeeds = initializeSeeds(totalGames);
  log(`  ${String(gameSeeds.length)} game seeds generated`);
  log('');

  // Stage 1: Self-play game generation
  log('Stage 1: Generating self-play games...');
  const games = generateGames(gameSeeds, totalGames);
  log('');

  // Stage 2: Position extraction
  log('Stage 2: Extracting candidate positions...');
  const candidates = extractPositions(games);
  log('');

  // Stage 3: Solution validation
  log('Stage 3: Validating solutions...');
  const validated = validatePositions(candidates);
  log('');

  if (validated.length === 0) {
    console.error('FATAL: No valid puzzles found. Try increasing TOTAL_GAMES.');
    process.exit(1);
  }

  // Stage 4: Difficulty calibration
  log('Stage 4: Calibrating difficulty...');
  const rated = calibrateDifficulty(validated);
  log('');

  // Stage 5: QA & final selection
  log(`Stage 5: Final selection (target: ${String(targetCount)})...`);
  const final = selectAndFinalize(rated);
  log('');

  // Write output
  log('Writing output...');
  writePuzzleData(final);
  log('');

  // Summary
  log('=== Pipeline Complete ===');
  log(`  Games played: ${String(games.length)}`);
  log(`  Candidates extracted: ${String(candidates.length)}`);
  log(`  Validated: ${String(validated.length)}`);
  log(`  Final puzzles: ${String(final.length)}`);

  // Difficulty distribution
  const easy = final.filter((p) => p.difficultyTier === 'easy').length;
  const medium = final.filter((p) => p.difficultyTier === 'medium').length;
  const hard = final.filter((p) => p.difficultyTier === 'hard').length;
  log(`  Tiers: ${String(easy)} easy, ${String(medium)} medium, ${String(hard)} hard`);

  // Puzzle type distribution
  const typeCounts = new Map<string, number>();
  for (const p of final) {
    typeCounts.set(p.puzzleType, (typeCounts.get(p.puzzleType) ?? 0) + 1);
  }
  log('  Puzzle types:');
  for (const [type, count] of typeCounts.entries()) {
    log(`    ${type}: ${String(count)}`);
  }
}

main();
