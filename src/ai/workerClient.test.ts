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
