import { describe, expect, it } from 'vitest';
import {
  createDameoRuleSet,
  createLinearMovementRuleSet,
} from '../LinearMovementEngine';
import { createDameoConfig } from '../types';

describe('createLinearMovementRuleSet', () => {
  it('Dameo rule set carries the right identity + capability flags', () => {
    const rs = createDameoRuleSet();
    expect(rs.gameId).toBe('dameo');
    expect(rs.ruleSetFamily).toBe('other');
    expect(rs.hasPlacementPhase).toBe(false);
    expect(rs.hasPiecesInHand).toBe(false);
    expect(rs.hasStacks).toBe(false);
    expect(rs.isAsymmetric).toBe(false);
    expect(rs.hasMutableGeometry).toBe(false);
    expect(rs.hasPiecesOfDistinctTypes).toBe(false);
  });

  it('Dameo rule set uses the full-board 8×8 geometry', () => {
    const rs = createDameoRuleSet();
    expect(rs.boardGeometry.dimensions.square).toEqual({ size: 8 });
    expect(rs.boardGeometry.playableMask).toBeUndefined();
    expect(rs.boardGeometry.adjacency.nodeCount()).toBe(64);
  });

  it('factory caches per-config', () => {
    const config = createDameoConfig();
    const a = createLinearMovementRuleSet(config);
    const b = createLinearMovementRuleSet(config);
    expect(a).toBe(b);
  });

  it('startingPosition produces a valid initial state with 36 pieces', () => {
    const rs = createDameoRuleSet();
    const state = rs.startingPosition();
    expect(state.pieces.size).toBe(36);
    expect(state.turn).toBe('white');
  });

  it('getLegalMoves returns moves from the starting position', () => {
    const rs = createDameoRuleSet();
    const state = rs.startingPosition();
    const moves = rs.getLegalMoves(state);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('applyMove + checkGameOver play one ply without errors', () => {
    const rs = createDameoRuleSet();
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
    const rs = createDameoRuleSet();
    const state = rs.startingPosition();
    const json = rs.serializer.toJSON(state);
    const restored = rs.serializer.fromJSON(json);
    expect(rs.serializer.toJSON(restored)).toEqual(json);
  });

  it('pieceVocabulary defines the man + king pair', () => {
    const rs = createDameoRuleSet();
    expect(rs.pieceVocabulary.onBoard.map((p) => p.pieceId)).toEqual(['man', 'king']);
  });
});
