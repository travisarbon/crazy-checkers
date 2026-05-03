import { describe, expect, it } from 'vitest';
import { createHasamiShogiRuleSet } from '../hasamiShogi';

describe('createHasamiShogiRuleSet', () => {
  it('uses a 9×9 full-board geometry', () => {
    const rs = createHasamiShogiRuleSet();
    expect(rs.gameId).toBe('hasami-shogi');
    expect(rs.boardGeometry.dimensions.square).toEqual({ size: 9 });
    expect(rs.boardGeometry.adjacency.nodeCount()).toBe(81);
  });

  it('startingPosition places 18 pieces (9 per side)', () => {
    const rs = createHasamiShogiRuleSet();
    expect(rs.startingPosition().pieces.size).toBe(18);
  });

  it('serializer round-trips the starting state', () => {
    const rs = createHasamiShogiRuleSet();
    const state = rs.startingPosition();
    const json = rs.serializer.toJSON(state);
    expect(rs.serializer.toJSON(rs.serializer.fromJSON(json))).toEqual(json);
  });
});
