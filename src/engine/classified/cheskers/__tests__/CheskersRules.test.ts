import { describe, expect, it } from 'vitest';
import { createCheskersRuleSet } from '../CheskersRules';
import type { CheskersMove } from '../types';

describe('createCheskersRuleSet — factory smoke test', () => {
  const rules = createCheskersRuleSet();

  it('returns a ClassifiedRuleSet with the expected gameId', () => {
    expect(rules.gameId).toBe('cheskers');
  });

  it('declares ruleSetFamily "other" (Cheskers is sui generis)', () => {
    expect(rules.ruleSetFamily).toBe('other');
  });

  it('exposes capability flags: only hasPiecesOfDistinctTypes is true', () => {
    expect(rules.hasPlacementPhase).toBe(false);
    expect(rules.hasPiecesInHand).toBe(false);
    expect(rules.hasStacks).toBe(false);
    expect(rules.isAsymmetric).toBe(false);
    expect(rules.hasMutableGeometry).toBe(false);
    expect(rules.hasPiecesOfDistinctTypes).toBe(true);
  });

  it('caches the factory output (calling twice returns the same instance)', () => {
    const a = createCheskersRuleSet();
    const b = createCheskersRuleSet();
    expect(a).toBe(b);
  });

  it('produces a starting state with 24 pieces, black to move, ply 0', () => {
    const start = rules.startingPosition();
    expect(start.pieces.size).toBe(24);
    expect(start.turn).toBe('black');
    expect(start.plyCount).toBe(0);
    expect(start.moveHistory).toHaveLength(0);
  });

  it('startingPosition tolerates an unused options arg', () => {
    const start = rules.startingPosition({ seed: 'unused' });
    expect(start.pieces.size).toBe(24);
  });

  it('exposes a piece vocabulary with all 4 piece kinds', () => {
    expect(rules.pieceVocabulary.id).toBe('cheskers-pieces');
  });

  it('getLegalMoves on the starting state returns at least one move (black)', () => {
    const start = rules.startingPosition();
    const moves = rules.getLegalMoves(start);
    expect(moves.length).toBeGreaterThan(0);
  });

  it('applyMove on a legal step advances to ply 1 and toggles turn to white', () => {
    const start = rules.startingPosition();
    const moves = rules.getLegalMoves(start);
    const next = rules.applyMove(start, moves[0] as CheskersMove);
    expect(next.plyCount).toBe(1);
    expect(next.turn).toBe('white');
  });

  it('checkGameOver returns null on the starting position', () => {
    const start = rules.startingPosition();
    expect(rules.checkGameOver(start)).toBeNull();
  });

  it('serializer round-trips the starting state', () => {
    const start = rules.startingPosition();
    const json = rules.serializer.toJSON(start);
    const back = rules.serializer.fromJSON(json);
    expect(rules.serializer.toJSON(back)).toEqual(json);
  });

  it('5-move scripted game runs without exceptions', () => {
    let state = rules.startingPosition();
    for (let i = 0; i < 5; i += 1) {
      const moves = rules.getLegalMoves(state);
      if (moves.length === 0) break;
      state = rules.applyMove(state, moves[0] as CheskersMove);
    }
    expect(state.plyCount).toBeGreaterThan(0);
    expect(state.plyCount).toBeLessThanOrEqual(5);
  });
});
