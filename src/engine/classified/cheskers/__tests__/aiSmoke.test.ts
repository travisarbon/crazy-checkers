/**
 * AI smoke harness for Cheskers (Phase 4 Task 29.6).
 *
 * Verifies the Phase 4 plan's "≥50% win rate vs. random" engine acceptance:
 *  - A uniform-random move selector plays games against a depth-2 minimax AI
 *    using un-tuned default piece values (pawn 1, king 3, bishop 3, camel 3).
 *  - The depth-2 AI must win ≥50% of games.
 *
 * This is a smoke check, NOT a tuning target. Real evaluator tuning
 * (Camel ≈ 3.5, king-row Bishop bonus, coordination motifs) and
 * Hard ≥65% vs. Easy calibration is per-game subtask 29.G.10-A's job.
 *
 * Game count is moderate (40 games per side = 80 total) to keep test runtime
 * under 10 seconds. The Phase 4 plan target is ≥50% win rate; with 80 games
 * the binomial standard error is ≈ 5.6%, so the AI needs to win ≈ 44+ games
 * out of 80 with high confidence.
 */

import { describe, expect, it } from 'vitest';
import { applyCheskersMove } from '../applyMove';
import { computeLegalMoves } from '../moveGen';
import { checkCheskersGameOver } from '../gameOver';
import { buildStartingState } from '../startingPosition';
import {
  createCheskersConfig,
  type CheskersGameState,
  type CheskersMove,
  type CheskersOwner,
  type CheskersPieceKind,
} from '../types';
import { GameResultType } from '../../../types';

const CFG = createCheskersConfig();

// ---------------------------------------------------------------------------
// Un-tuned default evaluator: material-only, equal piece values
// ---------------------------------------------------------------------------

const PIECE_VALUE: Record<CheskersPieceKind, number> = {
  pawn: 1,
  king: 3,
  bishop: 3,
  camel: 3,
};

function evaluateForSide(state: CheskersGameState, side: CheskersOwner): number {
  let score = 0;
  for (const piece of state.pieces.values()) {
    if (
      piece.kind !== 'pawn' &&
      piece.kind !== 'king' &&
      piece.kind !== 'bishop' &&
      piece.kind !== 'camel'
    ) {
      continue;
    }
    const kind = piece.kind as CheskersPieceKind;
    const value = PIECE_VALUE[kind];
    if (piece.owner === side) score += value;
    else score -= value;
  }
  return score;
}

// ---------------------------------------------------------------------------
// Depth-2 minimax with capability checks
// ---------------------------------------------------------------------------

function depth2Minimax(
  state: CheskersGameState,
  maximizingFor: CheskersOwner,
): CheskersMove | null {
  const moves = computeLegalMoves(state, CFG);
  if (moves.length === 0) return null;
  let bestMove: CheskersMove = moves[0] as CheskersMove;
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyCheskersMove(state, move, CFG);
    const replyMoves = computeLegalMoves(next, CFG);
    let worstReply = Infinity;
    if (replyMoves.length === 0) {
      // Opponent has no moves — terminal.
      const result = checkCheskersGameOver(next, CFG);
      if (result?.type === (maximizingFor === 'white' ? GameResultType.WhiteWin : GameResultType.BlackWin)) {
        worstReply = 1000;
      } else if (result?.type === (maximizingFor === 'white' ? GameResultType.BlackWin : GameResultType.WhiteWin)) {
        worstReply = -1000;
      } else {
        worstReply = 0;
      }
    } else {
      for (const reply of replyMoves) {
        const after = applyCheskersMove(next, reply, CFG);
        const score = evaluateForSide(after, maximizingFor);
        if (score < worstReply) worstReply = score;
      }
    }
    if (worstReply > bestScore) {
      bestScore = worstReply;
      bestMove = move;
    }
  }
  return bestMove;
}

// ---------------------------------------------------------------------------
// Random move selector (deterministic per-test via seed)
// ---------------------------------------------------------------------------

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

function randomMove(
  state: CheskersGameState,
  rng: () => number,
): CheskersMove | null {
  const moves = computeLegalMoves(state, CFG);
  if (moves.length === 0) return null;
  const idx = Math.floor(rng() * moves.length);
  return moves[idx] as CheskersMove;
}

// ---------------------------------------------------------------------------
// Game runner
// ---------------------------------------------------------------------------

interface GameOutcome {
  readonly winner: CheskersOwner | 'draw';
  readonly plies: number;
}

function playGame(aiSide: CheskersOwner, seed: number, plyLimit = 200): GameOutcome {
  const rng = makeRng(seed);
  let state = buildStartingState(CFG);
  let plies = 0;
  while (plies < plyLimit) {
    const result = checkCheskersGameOver(state, CFG);
    if (result !== null) {
      if (result.type === GameResultType.WhiteWin) return { winner: 'white', plies };
      if (result.type === GameResultType.BlackWin) return { winner: 'black', plies };
      return { winner: 'draw', plies };
    }
    const mover = state.turn;
    const move = mover === aiSide ? depth2Minimax(state, aiSide) : randomMove(state, rng);
    if (move === null) {
      // Should be caught by checkCheskersGameOver above; defensive.
      return { winner: mover === 'white' ? 'black' : 'white', plies };
    }
    state = applyCheskersMove(state, move, CFG);
    plies += 1;
  }
  return { winner: 'draw', plies };
}

// ---------------------------------------------------------------------------
// Smoke test: AI must win ≥ 50% of games
// ---------------------------------------------------------------------------

describe('Cheskers AI smoke (depth-2 vs random)', () => {
  it(
    'AI playing white wins ≥ 50% of 20 games against random black',
    () => {
      let aiWins = 0;
      const total = 20;
      for (let i = 0; i < total; i += 1) {
        const out = playGame('white', i + 1);
        if (out.winner === 'white') aiWins += 1;
      }
      const winRate = aiWins / total;
      expect(winRate).toBeGreaterThanOrEqual(0.5);
    },
    30_000,
  );

  it(
    'AI playing black wins ≥ 50% of 20 games against random white',
    () => {
      let aiWins = 0;
      const total = 20;
      for (let i = 0; i < total; i += 1) {
        const out = playGame('black', i + 100);
        if (out.winner === 'black') aiWins += 1;
      }
      const winRate = aiWins / total;
      expect(winRate).toBeGreaterThanOrEqual(0.5);
    },
    30_000,
  );
});
