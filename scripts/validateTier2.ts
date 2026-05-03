/**
 * Tier 2 self-play validation harness (Task 29.7).
 *
 * For each of the 10 Tier 2 games, plays Hard vs. Easy at the configured
 * depth presets and reports the Hard-win-rate. Exits 1 if any game falls
 * below the threshold (default 0.65 per Phase 4 plan §29.7 acceptance).
 *
 * Usage:
 *   npx tsx scripts/validateTier2.ts                 # default 100 games/side, threshold 0.65
 *   npx tsx scripts/validateTier2.ts --quick         # 20 games/side
 *   npx tsx scripts/validateTier2.ts --threshold 0.7 # custom threshold
 *
 * Per the Phase 4 plan §1.1, the ≥65% gate is Task 29.7's bar; the ≥70%
 * gate is per-game subtask C-12's bar. Both can be exercised by varying
 * --threshold.
 */

import { TIER_2_GAME_IDS } from '../src/engine/classified/tier2/ids';
import {
  getTier2Dispatch,
  getTier2DifficultyConfig,
  tier2IterativeSearch,
} from '../src/ai/evaluators/tier2';
import { GameResultType } from '../src/engine/types';
import type {
  ClassifiedGameId,
  ClassifiedMove,
} from '../src/engine/classified/ClassifiedRuleSet';
import type { ClassifiedGameState } from '../src/engine/classified/state';

interface CliOpts {
  readonly gamesPerSide: number;
  readonly threshold: number;
  readonly seed: number;
  readonly maxPlies: number;
  readonly verbose: boolean;
}

function parseArgs(argv: readonly string[]): CliOpts {
  let gamesPerSide = 100;
  let threshold = 0.65;
  let seed = 42;
  let maxPlies = 200;
  let verbose = false;
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--quick') {
      gamesPerSide = 20;
    } else if (arg === '--smoke') {
      gamesPerSide = 5;
      threshold = 0.50;
    } else if (arg === '--threshold' && argv[i + 1] !== undefined) {
      threshold = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--seed' && argv[i + 1] !== undefined) {
      seed = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--maxPlies' && argv[i + 1] !== undefined) {
      maxPlies = Number(argv[i + 1]);
      i += 1;
    } else if (arg === '--verbose') {
      verbose = true;
    }
  }
  return { gamesPerSide, threshold, seed, maxPlies, verbose };
}

interface GameResult {
  readonly winner: 'hard' | 'easy' | 'draw';
  readonly plies: number;
}

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playGame(
  gameId: ClassifiedGameId,
  hardSide: 'white' | 'black',
  seed: number,
  maxPlies: number,
): GameResult {
  const dispatch = getTier2Dispatch(gameId);
  const easyConfig = getTier2DifficultyConfig({ gameId, level: 'easy' });
  const hardConfig = getTier2DifficultyConfig({ gameId, level: 'hard' });
  const rng = makeRng(seed);
  let state: ClassifiedGameState = dispatch.ruleSet.startingPosition();
  let plies = 0;
  while (plies < maxPlies) {
    const result = dispatch.ruleSet.checkGameOver(state);
    if (result !== null) {
      if (
        result.type ===
        (hardSide === 'white' ? GameResultType.WhiteWin : GameResultType.BlackWin)
      ) {
        return { winner: 'hard', plies };
      }
      if (
        result.type ===
        (hardSide === 'white' ? GameResultType.BlackWin : GameResultType.WhiteWin)
      ) {
        return { winner: 'easy', plies };
      }
      return { winner: 'draw', plies };
    }
    const mover = state.turn ?? 'white';
    const isHard = mover === hardSide;
    const config = isHard ? hardConfig : easyConfig;
    const search = tier2IterativeSearch(state, dispatch.ruleSet, dispatch.evaluate, config);
    let move: ClassifiedMove | null = search.move;
    if (move === null) {
      const moves = dispatch.ruleSet.getLegalMoves(state);
      if (moves.length === 0) {
        return { winner: mover === hardSide ? 'easy' : 'hard', plies };
      }
      move = moves[Math.floor(rng() * moves.length)] as ClassifiedMove;
    }
    state = dispatch.ruleSet.applyMove(state, move);
    plies += 1;
  }
  return { winner: 'draw', plies };
}

interface PerGameReport {
  readonly gameId: ClassifiedGameId;
  readonly hardWins: number;
  readonly easyWins: number;
  readonly draws: number;
  readonly total: number;
  readonly hardWinRate: number;
  readonly pass: boolean;
}

function runValidation(opts: CliOpts): readonly PerGameReport[] {
  const reports: PerGameReport[] = [];
  for (const gameId of TIER_2_GAME_IDS) {
    let hardWins = 0;
    let easyWins = 0;
    let draws = 0;
    let total = 0;
    for (let i = 0; i < opts.gamesPerSide; i += 1) {
      const r = playGame(gameId, 'white', opts.seed + i, opts.maxPlies);
      if (r.winner === 'hard') hardWins += 1;
      else if (r.winner === 'easy') easyWins += 1;
      else draws += 1;
      total += 1;
      if (opts.verbose) {
        console.log(`  ${gameId} W=hard ${i + 1}/${opts.gamesPerSide}: ${r.winner} (${r.plies} plies)`);
      }
    }
    for (let i = 0; i < opts.gamesPerSide; i += 1) {
      const r = playGame(gameId, 'black', opts.seed + 1000 + i, opts.maxPlies);
      if (r.winner === 'hard') hardWins += 1;
      else if (r.winner === 'easy') easyWins += 1;
      else draws += 1;
      total += 1;
      if (opts.verbose) {
        console.log(`  ${gameId} B=hard ${i + 1}/${opts.gamesPerSide}: ${r.winner} (${r.plies} plies)`);
      }
    }
    const hardWinRate = total === 0 ? 0 : (hardWins + 0.5 * draws) / total;
    reports.push({
      gameId,
      hardWins,
      easyWins,
      draws,
      total,
      hardWinRate,
      pass: hardWinRate >= opts.threshold,
    });
  }
  return reports;
}

function printReport(reports: readonly PerGameReport[], threshold: number): void {
  const passCount = reports.filter((r) => r.pass).length;
  console.log('Tier 2 Self-Play Validation');
  console.log('═'.repeat(72));
  console.log('Game                  Hard   Easy   Draws   WinRate   Pass');
  console.log('─'.repeat(72));
  for (const r of reports) {
    const id = (r.gameId as unknown as string).padEnd(20);
    const hard = String(r.hardWins).padStart(5);
    const easy = String(r.easyWins).padStart(5);
    const draws = String(r.draws).padStart(6);
    const rate = r.hardWinRate.toFixed(3).padStart(8);
    const pass = r.pass ? '✓' : '✗';
    console.log(`${id}  ${hard}  ${easy}  ${draws}  ${rate}    ${pass}`);
  }
  console.log('─'.repeat(72));
  console.log(
    `THRESHOLD: ${threshold.toFixed(2)}   PASS: ${String(passCount)}/${String(reports.length)}`,
  );
}

function main(): void {
  const opts = parseArgs(process.argv);
  console.log(
    `[validateTier2] gamesPerSide=${String(opts.gamesPerSide)} threshold=${String(opts.threshold)} seed=${String(opts.seed)} maxPlies=${String(opts.maxPlies)}`,
  );
  const reports = runValidation(opts);
  printReport(reports, opts.threshold);
  const allPass = reports.every((r) => r.pass);
  process.exit(allPass ? 0 : 1);
}

main();
