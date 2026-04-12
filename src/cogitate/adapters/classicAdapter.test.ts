import { describe, it, expect } from 'vitest';
import { createInitialBoard } from '../../engine/board';
import { PieceColor } from '../../engine/types';
import { CLASSIC_MODE_ID, createClassicAdapter } from './classicAdapter';

describe('ClassicAdapter', () => {
  const adapter = createClassicAdapter();

  it('uses modeId "classic"', () => {
    expect(adapter.modeId).toBe(CLASSIC_MODE_ID);
  });

  it('ignores event context and returns the plain American rule set', () => {
    const ruleSet = adapter.getRuleSet([
      {
        type: 'KING_FOR_A_DAY',
        remainingPlies: 10,
        triggeredBy: PieceColor.White,
        triggeredAtPly: 0,
      },
    ] as unknown as Parameters<typeof adapter.getRuleSet>[0]);
    // Classic ignores events — White has the standard 7 opening moves.
    const moves = ruleSet.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBe(7);
  });
});
