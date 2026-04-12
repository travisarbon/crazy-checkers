/**
 * Tests for the AI worker client (main-thread side).
 *
 * Since jsdom doesn't support real Web Workers, we mock the Worker
 * constructor and Comlink to verify lifecycle and fallback behavior.
 * We also test that the main-thread fallback produces valid moves.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createNewGame } from '../engine/game';
import { createAmericanRules } from '../engine/rules';
import { PlayerType } from '../engine/types';
import type { GameState } from '../engine/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestGameState(): GameState {
  return createNewGame(createAmericanRules(), {
    white: PlayerType.Human,
    black: PlayerType.CpuHard,
  });
}

// ---------------------------------------------------------------------------
// Tests — main-thread fallback (direct integration test)
// ---------------------------------------------------------------------------

describe('workerClient main-thread fallback', () => {
  // The Worker constructor doesn't exist in jsdom, so the client will
  // automatically fall back to main-thread computation. This lets us
  // integration-test requestAIMove without mocking.

  beforeEach(async () => {
    // Dynamic import to reset module state between tests
    const { _resetForTesting } = await import('./workerClient');
    _resetForTesting();
  });

  it('returns a valid move via fallback when Worker is unavailable', async () => {
    const { requestAIMove } = await import('./workerClient');
    const state = createTestGameState();

    const move = await requestAIMove(state, 'easy');

    expect(move).toBeDefined();
    expect(move.from).toBeDefined();
    expect(move.path.length).toBeGreaterThanOrEqual(1);

    // Verify it's a legal move
    const legalMoves = state.ruleSet.getLegalMoves(state.board, state.activeColor);
    const isLegal = legalMoves.some(
      (m) =>
        (m.from as number) === (move.from as number) &&
        m.path.length === move.path.length &&
        m.path.every((sq, i) => (sq as number) === (move.path[i] as number)),
    );
    expect(isLegal).toBe(true);
  });

  it('returns a valid move for hard difficulty via fallback', async () => {
    const { requestAIMove } = await import('./workerClient');
    const state = createTestGameState();

    const move = await requestAIMove(state, 'hard');

    expect(move).toBeDefined();
    expect(move.from).toBeDefined();
    expect(move.path.length).toBeGreaterThanOrEqual(1);
  });

  it('terminateWorker is safe to call when no Worker exists', async () => {
    const { terminateWorker } = await import('./workerClient');

    // Should not throw
    expect(() => {
      terminateWorker();
    }).not.toThrow();
  });

  it('falls back on all subsequent calls after initial Worker failure', async () => {
    const { requestAIMove } = await import('./workerClient');
    const state = createTestGameState();

    // First call triggers fallback
    const move1 = await requestAIMove(state, 'easy');
    expect(move1).toBeDefined();

    // Second call should also succeed via fallback (no retry of Worker creation)
    const move2 = await requestAIMove(state, 'easy');
    expect(move2).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Cogitate analysis fallback tests
// ---------------------------------------------------------------------------

describe('workerClient cogitate fallback', () => {
  beforeEach(async () => {
    const { _resetForTesting } = await import('./workerClient');
    _resetForTesting();
  });

  it('requestEvaluation returns a normalized score for Classic mode', async () => {
    const { requestEvaluation } = await import('./workerClient');
    const { createInitialBoard } = await import('../engine/board');
    const { PieceColor } = await import('../engine/types');
    const ev = await requestEvaluation(createInitialBoard(), PieceColor.White, 'classic', []);
    expect(ev).toBeDefined();
    expect(ev.score).toBeGreaterThanOrEqual(-1);
    expect(ev.score).toBeLessThanOrEqual(1);
    expect(ev.confidence).toBe(1);
  });

  it('requestAnalysis returns an AnalysisResult with a best move and PV', async () => {
    const { requestAnalysis } = await import('./workerClient');
    const { createInitialBoard } = await import('../engine/board');
    const { PieceColor } = await import('../engine/types');
    const result = await requestAnalysis(
      createInitialBoard(),
      PieceColor.White,
      'classic',
      [],
      { maxDepth: 3, timeLimitMs: 500, quiescenceEnabled: false, quiescenceMaxDepth: 0 },
    );
    expect(result.bestMove).not.toBeNull();
    expect(result.bestMoveNotation).toMatch(/\d+-\d+/);
    expect(result.principalVariation.length).toBeGreaterThan(0);
    expect(result.pvNotation.length).toBe(result.principalVariation.length);
    expect(result.alternativeMoves.length).toBeGreaterThan(0);
  });

  it('requestBatchAnalysis returns one result per position', async () => {
    const { requestBatchAnalysis } = await import('./workerClient');
    const { createInitialBoard } = await import('../engine/board');
    const { PieceColor } = await import('../engine/types');
    const board = createInitialBoard();
    const results = await requestBatchAnalysis(
      [
        { board, activeColor: PieceColor.White, activeEvents: [] },
        { board, activeColor: PieceColor.Black, activeEvents: [] },
      ],
      'classic',
      { maxDepth: 2, timeLimitMs: 250, quiescenceEnabled: false, quiescenceMaxDepth: 0 },
    );
    expect(results.length).toBe(2);
    expect(results[0]?.bestMove).not.toBeNull();
  });

  it('cancelAnalysis can be called without side effects when no worker exists', async () => {
    const { cancelAnalysis } = await import('./workerClient');
    expect(() => {
      cancelAnalysis();
    }).not.toThrow();
  });
});
