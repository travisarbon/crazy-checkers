import { describe, expect, it } from 'vitest';
import { createDaiHasamiShogiRuleSet } from '../daiHasamiShogi';

describe('createDaiHasamiShogiRuleSet', () => {
  it('uses a 9×9 full-board geometry', () => {
    const rs = createDaiHasamiShogiRuleSet();
    expect(rs.gameId).toBe('dai-hasami-shogi');
    expect(rs.boardGeometry.dimensions.square).toEqual({ size: 9 });
  });

  it('startingPosition places 36 pieces (18 per side)', () => {
    const rs = createDaiHasamiShogiRuleSet();
    expect(rs.startingPosition().pieces.size).toBe(36);
  });

  it('legal moves at the start include both slides AND jumps', () => {
    const rs = createDaiHasamiShogiRuleSet();
    const state = rs.startingPosition();
    const moves = rs.getLegalMoves(state);
    const slides = moves.filter((m) => m.kind === 'slide');
    const jumps = moves.filter((m) => m.kind === 'jump');
    expect(slides.length).toBeGreaterThan(0);
    expect(jumps.length).toBeGreaterThan(0);
  });
});
