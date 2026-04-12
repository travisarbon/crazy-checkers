import { describe, it, expect } from 'vitest';
import { createInitialBoard } from '../../engine/board';
import { CrazyEvent, PieceColor } from '../../engine/types';
import type { ActiveEvent } from '../../engine/types';
import { CRAZY_MODE_ID, createCrazyAdapter } from './crazyAdapter';

describe('CrazyAdapter', () => {
  const adapter = createCrazyAdapter();

  it('uses modeId "crazy"', () => {
    expect(adapter.modeId).toBe(CRAZY_MODE_ID);
  });

  it('returns a rule set that applies provided events', () => {
    const events: ActiveEvent[] = [
      {
        type: CrazyEvent.KingForADay,
        remainingPlies: 4,
        triggeredBy: PieceColor.White,
        triggeredAtPly: 0,
      },
    ];
    const ruleSet = adapter.getRuleSet(events);
    const moves = ruleSet.getLegalMoves(createInitialBoard(), PieceColor.White);
    // KingForADay makes pieces behave as kings → more legal moves than baseline.
    expect(moves.length).toBeGreaterThan(0);
  });

  it('returns the plain base rules when no events are active', () => {
    const ruleSet = adapter.getRuleSet([]);
    const moves = ruleSet.getLegalMoves(createInitialBoard(), PieceColor.White);
    expect(moves.length).toBe(7);
  });

  it('delegates to the MinimaxEvaluationProvider for evaluation', () => {
    const provider = adapter.getEvaluationProvider();
    const ev = provider.evaluate(createInitialBoard(), PieceColor.White);
    expect(ev).not.toBeNull();
    expect(provider.providerType).toBe('minimax');
  });
});
