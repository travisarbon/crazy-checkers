import { describe, expect, it } from 'vitest';
import {
  createBashniRuleSet,
  createLascaRuleSet,
  createStackingDraughtsRuleSet,
} from '../StackingDraughtsRules';
import { createLascaConfig } from '../types';

describe('createStackingDraughtsRuleSet', () => {
  it('Lasca rule set carries the right identity + capability flags', () => {
    const rs = createLascaRuleSet();
    expect(rs.gameId).toBe('lasca');
    expect(rs.ruleSetFamily).toBe('stacking');
    expect(rs.hasStacks).toBe(true);
    expect(rs.hasPlacementPhase).toBe(false);
    expect(rs.hasPiecesInHand).toBe(false);
    expect(rs.isAsymmetric).toBe(false);
    expect(rs.hasMutableGeometry).toBe(false);
    expect(rs.hasPiecesOfDistinctTypes).toBe(false);
  });

  it('Bashni rule set carries the right identity', () => {
    const rs = createBashniRuleSet();
    expect(rs.gameId).toBe('bashni');
    expect(rs.boardGeometry.dimensions.square).toEqual({ size: 8 });
  });

  it('factory caches per-config', () => {
    const config = createLascaConfig();
    const a = createStackingDraughtsRuleSet(config);
    const b = createStackingDraughtsRuleSet(config);
    expect(a).toBe(b);
  });

  it('startingPosition produces a valid initial state', () => {
    const rs = createLascaRuleSet();
    const state = rs.startingPosition();
    expect(state.pieces.size).toBe(22);
    expect(state.turn).toBe('white');
  });

  it('getLegalMoves returns step moves from the starting position', () => {
    const rs = createLascaRuleSet();
    const state = rs.startingPosition();
    const moves = rs.getLegalMoves(state);
    // Lasca starting position: 11 white men in rows 4..6. Front-row pieces (row 4) should each have a forward step.
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.every((m) => m.kind === 'step')).toBe(true);
  });

  it('applyMove + checkGameOver play one ply without errors', () => {
    const rs = createLascaRuleSet();
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
    const rs = createLascaRuleSet();
    const state = rs.startingPosition();
    const json = rs.serializer.toJSON(state);
    const restored = rs.serializer.fromJSON(json);
    expect(rs.serializer.toJSON(restored)).toEqual(json);
  });

  it('pieceVocabulary defines the man + king pair', () => {
    const rs = createLascaRuleSet();
    expect(rs.pieceVocabulary.onBoard.map((p) => p.pieceId)).toEqual(['man', 'king']);
  });
});
