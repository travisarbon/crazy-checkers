import { describe, expect, it } from 'vitest';
import { createMakYekRuleSet } from '../makYek';

describe('createMakYekRuleSet', () => {
  it('produces a custodian rule set with the correct identity flags', () => {
    const rs = createMakYekRuleSet();
    expect(rs.gameId).toBe('mak-yek');
    expect(rs.ruleSetFamily).toBe('custodian');
    expect(rs.hasPiecesOfDistinctTypes).toBe(false);
  });

  it('uses an 8×8 full-board geometry', () => {
    const rs = createMakYekRuleSet();
    expect(rs.boardGeometry.dimensions.square).toEqual({ size: 8 });
    expect(rs.boardGeometry.adjacency.nodeCount()).toBe(64);
  });

  it('startingPosition produces 32 pieces, white moves first', () => {
    const rs = createMakYekRuleSet();
    const state = rs.startingPosition();
    expect(state.pieces.size).toBe(32);
    expect(state.turn).toBe('white');
  });

  it('plays one ply without errors', () => {
    const rs = createMakYekRuleSet();
    let state = rs.startingPosition();
    const moves = rs.getLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
    state = rs.applyMove(state, moves[0] as Parameters<typeof rs.applyMove>[1]);
    expect(state.turn).toBe('black');
  });

  it('serializer round-trips the starting state', () => {
    const rs = createMakYekRuleSet();
    const state = rs.startingPosition();
    const json = rs.serializer.toJSON(state);
    const restored = rs.serializer.fromJSON(json);
    expect(rs.serializer.toJSON(restored)).toEqual(json);
  });
});
