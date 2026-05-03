import { describe, expect, it } from 'vitest';
import { createAlquerqueRuleSet } from '../AlquerqueEngine';
import { createZammaRuleSet } from '../ZammaRules';
import { createZammaConfig } from '../types';

describe('createZammaRuleSet', () => {
  it('Zamma rule set carries the right identity + capability flags', () => {
    const rs = createZammaRuleSet();
    expect(rs.gameId).toBe('zamma');
    expect(rs.ruleSetFamily).toBe('alquerque');
    expect(rs.hasPlacementPhase).toBe(false);
    expect(rs.hasPiecesInHand).toBe(false);
    expect(rs.hasStacks).toBe(false);
    expect(rs.isAsymmetric).toBe(false);
    expect(rs.hasMutableGeometry).toBe(false);
    expect(rs.hasPiecesOfDistinctTypes).toBe(false);
  });

  it('Zamma rule set uses the alquerque 9×9 geometry', () => {
    const rs = createZammaRuleSet();
    expect(rs.boardGeometry.kind).toBe('alquerque');
    expect(rs.boardGeometry.dimensions.alquerque).toEqual({
      size: 9,
      diagonalPattern: 'alternating',
    });
    expect(rs.boardGeometry.adjacency.nodeCount()).toBe(81);
  });

  it('factory caches per-config', () => {
    const config = createZammaConfig();
    const a = createAlquerqueRuleSet(config);
    const b = createAlquerqueRuleSet(config);
    expect(a).toBe(b);
  });

  it('startingPosition produces a valid initial state with 80 pieces', () => {
    const rs = createZammaRuleSet();
    const state = rs.startingPosition();
    expect(state.pieces.size).toBe(80);
    expect(state.turn).toBe('white');
  });

  it('getLegalMoves returns moves from the starting position', () => {
    const rs = createZammaRuleSet();
    const state = rs.startingPosition();
    const moves = rs.getLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('applyMove + checkGameOver play one ply without errors', () => {
    const rs = createZammaRuleSet();
    let state = rs.startingPosition();
    const moves = rs.getLegalMoves(state);
    const firstMove = moves[0];
    expect(firstMove).toBeDefined();
    if (!firstMove) throw new Error('unreachable');
    state = rs.applyMove(state, firstMove);
    expect(rs.checkGameOver(state)).toBeNull();
    expect(state.turn).toBe('black');
  });

  it('serializer round-trips the starting state', () => {
    const rs = createZammaRuleSet();
    const state = rs.startingPosition();
    const json = rs.serializer.toJSON(state);
    const restored = rs.serializer.fromJSON(json);
    expect(rs.serializer.toJSON(restored)).toEqual(json);
  });

  it('pieceVocabulary defines the man + mullah pair', () => {
    const rs = createZammaRuleSet();
    expect(rs.pieceVocabulary.onBoard.map((p) => p.pieceId)).toEqual(['man', 'mullah']);
  });
});
