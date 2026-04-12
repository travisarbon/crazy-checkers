import { describe, it, expect } from 'vitest';
import { createInitialBoard } from '../../engine/board';
import { PieceColor } from '../../engine/types';
import { CHAOS_MODE_ID, createChaosAdapter } from './chaosAdapter';

describe('ChaosAdapter', () => {
  const adapter = createChaosAdapter();

  it('uses modeId "chaos"', () => {
    expect(adapter.modeId).toBe(CHAOS_MODE_ID);
  });

  it('behaves like the Crazy adapter — composite rule set, no permanent event', () => {
    const ruleSet = adapter.getRuleSet();
    const moves = ruleSet.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBe(7);
  });
});
