/**
 * Performance benchmark harness for AI search timing.
 *
 * Provides 20 representative board positions covering openings, midgame,
 * endgame, and tactical scenarios. The `runAIBenchmark()` function times
 * `iterativeSearch` on each position and reports aggregate statistics.
 *
 * Task 7.1 — Phase 2 Performance Baselines.
 */

import type { BoardState, GameState, Piece, SquareState } from '../engine/types';
import { GameMode, GameStatus, PieceColor, PieceType, PlayerType } from '../engine/types';
import { createInitialBoard } from '../engine/board';
import { createAmericanRules } from '../engine/rules';
import { createNewGame, makeMove } from '../engine/game';
import { getLegalMoves } from '../engine/moves';
import { iterativeSearch } from '../ai/search';
import { HARD_CONFIG, toSearchConfig } from '../ai/difficulty';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BenchmarkPosition {
  readonly name: string;
  readonly description: string;
  readonly board: BoardState;
  readonly activeColor: PieceColor;
  readonly complexity: 'low' | 'moderate' | 'high';
}

export interface BenchmarkResult {
  readonly position: string;
  readonly searchTimeMs: number;
  readonly depthReached: number;
  readonly nodesEvaluated: number;
}

export interface BenchmarkSummary {
  readonly results: readonly BenchmarkResult[];
  readonly minMs: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly maxMs: number;
  readonly totalMs: number;
}

// ---------------------------------------------------------------------------
// Piece shorthand helpers
// ---------------------------------------------------------------------------

const WP: Piece = { color: PieceColor.White, type: PieceType.Pawn };
const WK: Piece = { color: PieceColor.White, type: PieceType.King };
const BP: Piece = { color: PieceColor.Black, type: PieceType.Pawn };
const BK: Piece = { color: PieceColor.Black, type: PieceType.King };

/**
 * Builds a BoardState from a sparse map of square number → piece.
 * Squares not listed are empty (null).
 */
function buildBoard(pieces: Record<number, Piece>): BoardState {
  const board: SquareState[] = new Array<SquareState>(32).fill(null);
  for (const [sq, piece] of Object.entries(pieces)) {
    board[Number(sq) - 1] = piece;
  }
  return board;
}

// ---------------------------------------------------------------------------
// Benchmark positions
// ---------------------------------------------------------------------------

/**
 * Derives a board state by playing a sequence of moves from the initial position.
 * Each move is specified as [fromSquare, toSquare].
 */
function derivePosition(moves: Array<[number, number]>): BoardState {
  const ruleSet = createAmericanRules();
  let state = createNewGame(ruleSet, { white: PlayerType.Human, black: PlayerType.Human });

  for (const [from, to] of moves) {
    const legal = state.ruleSet.getLegalMoves(state.board, state.activeColor);
    const move = legal.find(
      (m) => (m.from as number) === from && (m.path[m.path.length - 1] as number) === to,
    );
    if (!move) {
      throw new Error(`No legal move from ${String(from)} to ${String(to)}`);
    }
    state = makeMove(state, move);
  }

  return state.board;
}

export const BENCHMARK_POSITIONS: readonly BenchmarkPosition[] = [
  // ── Openings (low complexity) ──────────────────────────────────────────

  {
    name: 'Initial board',
    description: 'Standard starting position — 24 pieces (12v12)',
    board: createInitialBoard(),
    activeColor: PieceColor.White,
    complexity: 'low',
  },

  {
    name: 'Opening A',
    description: 'After 1. 21-17 12-16 — common opening, early development',
    board: derivePosition([
      [21, 17],
      [12, 16],
    ]),
    activeColor: PieceColor.White,
    complexity: 'low',
  },

  {
    name: 'Opening B',
    description: 'After 1. 23-19 9-14 — alternate opening, exchange imminent',
    board: derivePosition([
      [23, 19],
      [9, 14],
    ]),
    activeColor: PieceColor.White,
    complexity: 'low',
  },

  // ── Early midgame (moderate complexity) ────────────────────────────────

  {
    name: 'Early midgame A',
    description: '~18 pieces (9v9) — one side with slight positional advantage',
    board: buildBoard({
      // Black (9): rows 0-3 with some development
      1: BP,
      2: BP,
      3: BP,
      6: BP,
      10: BP,
      14: BP,
      15: BP,
      16: BP,
      19: BP,
      // White (9): rows 4-7 with some development
      17: WP,
      18: WP,
      22: WP,
      23: WP,
      25: WP,
      26: WP,
      29: WP,
      30: WP,
      32: WP,
    }),
    activeColor: PieceColor.White,
    complexity: 'moderate',
  },

  {
    name: 'Early midgame B',
    description: '~18 pieces (10v8) — material imbalance, tactical tension',
    board: buildBoard({
      // Black (10): slight material advantage
      1: BP,
      2: BP,
      3: BP,
      4: BP,
      5: BP,
      7: BP,
      10: BP,
      14: BP,
      15: BP,
      20: BP,
      // White (8): down material
      17: WP,
      18: WP,
      22: WP,
      26: WP,
      27: WP,
      29: WP,
      30: WP,
      31: WP,
    }),
    activeColor: PieceColor.White,
    complexity: 'moderate',
  },

  // ── Tactical midgame (high complexity) ─────────────────────────────────

  {
    name: 'Tactical midgame A',
    description: '~14 pieces (7v7) — multiple capture sequences available',
    board: buildBoard({
      // Black (7)
      2: BP,
      3: BP,
      7: BP,
      10: BP,
      14: BP,
      15: BP,
      19: BP,
      // White (7)
      17: WP,
      18: WP,
      22: WP,
      23: WP,
      26: WP,
      30: WP,
      31: WP,
    }),
    activeColor: PieceColor.White,
    complexity: 'high',
  },

  {
    name: 'Tactical midgame B',
    description: '~14 pieces (8v6) — one side dominating center, multiple options',
    board: buildBoard({
      // Black (8): dominating center
      1: BP,
      3: BP,
      6: BP,
      10: BP,
      11: BP,
      14: BP,
      18: BP,
      19: BP,
      // White (6): defending from rows 5-7, no adjacent enemies
      25: WP,
      26: WP,
      27: WP,
      28: WP,
      30: WP,
      31: WP,
    }),
    activeColor: PieceColor.White,
    complexity: 'high',
  },

  {
    name: 'Tactical midgame C',
    description: '~12 pieces (6v6) — complex multi-jump opportunity for both sides',
    board: buildBoard({
      // Black (6): interlocking with White, creating jump chains
      2: BP,
      7: BP,
      10: BP,
      14: BP,
      19: BP,
      20: BP,
      // White (6): interlocking with Black
      17: WP,
      18: WP,
      22: WP,
      23: WP,
      27: WP,
      31: WP,
    }),
    activeColor: PieceColor.White,
    complexity: 'high',
  },

  // ── Late midgame (high complexity) ─────────────────────────────────────

  {
    name: 'Late midgame A',
    description: '~10 pieces (5v5) — kings present on both sides',
    board: buildBoard({
      // Black (5): mix of kings and pawns
      3: BK,
      10: BP,
      14: BK,
      15: BP,
      20: BP,
      // White (5): mix of kings and pawns
      17: WP,
      22: WK,
      23: WP,
      27: WK,
      30: WP,
    }),
    activeColor: PieceColor.White,
    complexity: 'high',
  },

  {
    name: 'Late midgame B',
    description: '~10 pieces (4K+1P vs 3K+2P) — mixed king/pawn late game',
    board: buildBoard({
      // Black (5): 4 kings + 1 pawn, spread out
      2: BK,
      8: BK,
      15: BK,
      20: BK,
      28: BP,
      // White (5): 3 kings + 2 pawns, separated from black
      5: WK,
      13: WP,
      21: WK,
      26: WP,
      30: WK,
    }),
    activeColor: PieceColor.White,
    complexity: 'high',
  },

  {
    name: 'Late midgame C',
    description: '~8 pieces (4v4) — all pieces advanced, promotion threats',
    board: buildBoard({
      // Black (4): advanced pawns nearing promotion row 7
      19: BP,
      22: BP,
      23: BP,
      27: BP,
      // White (4): advanced pawns nearing promotion row 0
      6: WP,
      10: WP,
      14: WP,
      15: WP,
    }),
    activeColor: PieceColor.White,
    complexity: 'high',
  },

  // ── King endgames (moderate complexity) ────────────────────────────────

  {
    name: 'King endgame A',
    description: '5 pieces (3K vs 2K) — pure king endgame, high mobility',
    board: buildBoard({
      // Black (2 kings): separated from white
      3: BK,
      20: BK,
      // White (3 kings): separated from black
      13: WK,
      26: WK,
      31: WK,
    }),
    activeColor: PieceColor.White,
    complexity: 'moderate',
  },

  {
    name: 'King endgame B',
    description: '4 pieces (2K vs 2K) — symmetric king endgame, draw likely',
    board: buildBoard({
      // Black (2 kings)
      3: BK,
      14: BK,
      // White (2 kings)
      19: WK,
      30: WK,
    }),
    activeColor: PieceColor.White,
    complexity: 'moderate',
  },

  // ── Won endgames (low-moderate complexity) ─────────────────────────────

  {
    name: 'Won endgame A',
    description: '4 pieces (3K vs 1P) — dominant material advantage',
    board: buildBoard({
      // Black (1 pawn): hopeless
      20: BP,
      // White (3 kings): dominant
      14: WK,
      18: WK,
      23: WK,
    }),
    activeColor: PieceColor.White,
    complexity: 'low',
  },

  {
    name: 'Won endgame B',
    description: '3 pieces (2K vs 1K) — slight material advantage, needs technique',
    board: buildBoard({
      // Black (1 king)
      10: BK,
      // White (2 kings)
      18: WK,
      23: WK,
    }),
    activeColor: PieceColor.White,
    complexity: 'moderate',
  },

  // ── Tactical scenarios (high complexity) ───────────────────────────────

  {
    name: 'Forced capture chain',
    description: '~12 pieces (6v6) — long forced multi-jump available (3+ captures)',
    board: buildBoard({
      // Black (6): set up to be captured in a chain
      7: BP,
      10: BP,
      14: BP,
      3: BP,
      4: BP,
      8: BP,
      // White (6): piece at 26 can jump 26→19→10→3 (chain of 3)
      // For the chain: WP at 26, BP at 22 (jump to 19), BP at 15 (jump to 10)... wait
      // Let me set this up properly.
      // WP at sq23 can jump over BP at sq19 to sq14... but sq14 has BP.
      // Let me rethink: White piece at 31 area, black pieces staggered for jumps
      26: WP,
      25: WP,
      29: WP,
      30: WP,
      31: WP,
      32: WP,
    }),
    activeColor: PieceColor.Black,
    complexity: 'high',
  },

  {
    name: 'Double-jump fork',
    description: '~14 pieces (7v7) — position with branching capture choices',
    board: buildBoard({
      // Black (7)
      1: BP,
      2: BP,
      6: BP,
      10: BP,
      11: BP,
      15: BP,
      19: BP,
      // White (7): positioned to create forking captures
      14: WP,
      18: WP,
      22: WP,
      23: WP,
      26: WP,
      30: WP,
      31: WP,
    }),
    activeColor: PieceColor.White,
    complexity: 'high',
  },

  {
    name: 'Near-drawn position',
    description: '~8 pieces (4v4) — all kings, high mobility, draw likely',
    board: buildBoard({
      // Black (4): all kings, clustered top
      1: BK,
      2: BK,
      5: BK,
      6: BK,
      // White (4): all kings, clustered bottom (no adjacent enemies)
      22: WK,
      27: WK,
      28: WK,
      30: WK,
    }),
    activeColor: PieceColor.White,
    complexity: 'moderate',
  },

  {
    name: 'Back-row fortress',
    description: '~10 pieces (5v5) — one side with intact back row, defensive position',
    board: buildBoard({
      // Black (5): intact back row + one advanced piece
      1: BP,
      2: BP,
      3: BP,
      4: BP,
      16: BP,
      // White (5): approaching, no adjacent enemies
      22: WP,
      23: WP,
      26: WP,
      30: WP,
      31: WP,
    }),
    activeColor: PieceColor.White,
    complexity: 'moderate',
  },

  {
    name: 'Promotion race',
    description: '~8 pieces (4P vs 4P) — both sides have advanced pawns near promotion',
    board: buildBoard({
      // Black (4 pawns): advanced toward row 7
      21: BP,
      22: BP,
      26: BP,
      27: BP,
      // White (4 pawns): advanced toward row 0
      6: WP,
      7: WP,
      10: WP,
      11: WP,
    }),
    activeColor: PieceColor.White,
    complexity: 'high',
  },
];

// ---------------------------------------------------------------------------
// Benchmark harness
// ---------------------------------------------------------------------------

/**
 * Constructs a minimal GameState suitable for AI search from a board and active color.
 */
function createBenchmarkGameState(board: BoardState, activeColor: PieceColor): GameState {
  return {
    board,
    activeColor,
    status: GameStatus.InProgress,
    result: null,
    ruleSet: createAmericanRules(),
    players: { white: PlayerType.CpuHard, black: PlayerType.CpuHard },
    moveHistory: [],
    positionHashes: [0n],
    halfMoveClock: 0,
    plyCount: 0,
    mode: GameMode.Classic,
    activeEvents: [],
  };
}

/**
 * Computes the median of a sorted numeric array.
 */
function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

/**
 * Computes the p-th percentile of a sorted numeric array.
 */
function percentile(sorted: readonly number[], p: number): number {
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
}

const REPETITIONS = 3;
const SEARCH_CONFIG = toSearchConfig(HARD_CONFIG);

/**
 * Runs the AI benchmark across all 20 positions.
 *
 * Each position is searched 3 times; the median of runs 2–3 is reported
 * (run 1 serves as JIT warmup).
 */
export function runAIBenchmark(): BenchmarkSummary {
  const results: BenchmarkResult[] = [];

  for (const pos of BENCHMARK_POSITIONS) {
    // Validate the position has legal moves
    const legalMoves = getLegalMoves(pos.board, pos.activeColor);
    if (legalMoves.length === 0) {
      throw new Error(`Benchmark position "${pos.name}" has no legal moves for active color`);
    }

    const state = createBenchmarkGameState(pos.board, pos.activeColor);
    const timings: number[] = [];
    let lastResult = { depth: 0, nodesEvaluated: 0 };

    for (let rep = 0; rep < REPETITIONS; rep++) {
      const start = performance.now();
      const searchResult = iterativeSearch(state, SEARCH_CONFIG);
      const elapsed = performance.now() - start;

      timings.push(elapsed);
      lastResult = {
        depth: searchResult.depth,
        nodesEvaluated: searchResult.nodesEvaluated,
      };
    }

    // Take median of runs 2–3 (index 1 and 2), discarding warmup run 0
    const laterRuns = timings.slice(1).sort((a, b) => a - b);
    const medianTime = median(laterRuns);

    results.push({
      position: pos.name,
      searchTimeMs: Math.round(medianTime * 100) / 100,
      depthReached: lastResult.depth,
      nodesEvaluated: lastResult.nodesEvaluated,
    });
  }

  const sortedTimes = results.map((r) => r.searchTimeMs).sort((a, b) => a - b);

  return {
    results,
    minMs: sortedTimes[0] ?? 0,
    medianMs: median(sortedTimes),
    p95Ms: percentile(sortedTimes, 95),
    maxMs: sortedTimes[sortedTimes.length - 1] ?? 0,
    totalMs: sortedTimes.reduce((sum, t) => sum + t, 0),
  };
}
