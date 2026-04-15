import { describe, expect, it } from 'vitest';
import {
  asClassifiedGameId,
  type ClassifiedRuleSet,
} from './ClassifiedRuleSet';
import { testCheckersCloneRuleSet } from './tier0/testCheckersClone';
import { testShogiCloneRuleSet } from './tier0/testShogiClone';

describe('ClassifiedRuleSet — runtime shape guarantees', () => {
  it('asClassifiedGameId returns the string as-is (branded cast)', () => {
    expect(asClassifiedGameId('foo')).toBe('foo');
  });

  it('every capability flag on a concrete rule set is boolean', () => {
    const rs: ClassifiedRuleSet = testCheckersCloneRuleSet;
    expect(typeof rs.hasPlacementPhase).toBe('boolean');
    expect(typeof rs.hasPiecesInHand).toBe('boolean');
    expect(typeof rs.hasStacks).toBe('boolean');
    expect(typeof rs.isAsymmetric).toBe('boolean');
    expect(typeof rs.hasMutableGeometry).toBe('boolean');
    expect(typeof rs.hasPiecesOfDistinctTypes).toBe('boolean');
  });

  it('required lifecycle hooks are present on the checkers-clone fixture', () => {
    expect(typeof testCheckersCloneRuleSet.startingPosition).toBe('function');
    expect(typeof testCheckersCloneRuleSet.getLegalMoves).toBe('function');
    expect(typeof testCheckersCloneRuleSet.applyMove).toBe('function');
    expect(typeof testCheckersCloneRuleSet.checkGameOver).toBe('function');
  });

  it('serializer with version 1 is required', () => {
    expect(testCheckersCloneRuleSet.serializer.version).toBe(1);
    expect(typeof testCheckersCloneRuleSet.serializer.toJSON).toBe('function');
    expect(typeof testCheckersCloneRuleSet.serializer.fromJSON).toBe('function');
  });

  it('hand-bearing fixture declares getLegalDrops', () => {
    expect(testShogiCloneRuleSet.hasPiecesInHand).toBe(true);
    expect(typeof testShogiCloneRuleSet.getLegalDrops).toBe('function');
  });

  it('starting position for the checkers clone places 24 pieces', () => {
    const s = testCheckersCloneRuleSet.startingPosition();
    expect(s.pieces.size).toBe(24);
  });

  it('boardGeometry is the Task 27.2 descriptor with a serializedKey', () => {
    expect(testCheckersCloneRuleSet.boardGeometry.serializedKey).toMatch(/square-8x8/);
  });

  it('pieceVocabulary exposes the onBoard/inHand split', () => {
    expect(testCheckersCloneRuleSet.pieceVocabulary.onBoard.length).toBeGreaterThan(0);
    expect(Array.isArray(testCheckersCloneRuleSet.pieceVocabulary.inHand)).toBe(true);
  });

  it('optional hooks are absent on the checkers clone (flags all false)', () => {
    expect(testCheckersCloneRuleSet.getLegalDrops).toBeUndefined();
    expect(testCheckersCloneRuleSet.getPlacementZones).toBeUndefined();
    expect(testCheckersCloneRuleSet.getRoleLabels).toBeUndefined();
  });

  it('serializer round-trips the checkers-clone starting state', () => {
    const start = testCheckersCloneRuleSet.startingPosition();
    const json = testCheckersCloneRuleSet.serializer.toJSON(start);
    const restored = testCheckersCloneRuleSet.serializer.fromJSON(json);
    expect(restored.pieces.size).toBe(start.pieces.size);
    expect(restored.turn).toBe(start.turn);
  });

  it('hand-clone starting position includes per-side hands', () => {
    const s = testShogiCloneRuleSet.startingPosition();
    expect(s.hands?.white.get('pawn-in-hand')).toBe(1);
    expect(s.hands?.black.get('pawn-in-hand')).toBe(1);
  });

  it('hand-clone getLegalDrops returns a drop list for empty squares', () => {
    const s = testShogiCloneRuleSet.startingPosition();
    const drops = testShogiCloneRuleSet.getLegalDrops?.(s) ?? [];
    expect(drops.length).toBeGreaterThan(0);
    expect(drops.every((m) => m.kind === 'drop')).toBe(true);
  });
});
