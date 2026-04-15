import { beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry, isClassifiedRegistered } from '../registry';
import { loadClassifiedTier, _clearTierLoaderCache } from '../tierLoader';
import {
  testCheckersCloneRuleSet,
  TEST_CHECKERS_CLONE_ID,
} from './testCheckersClone';

beforeEach(() => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
});

describe('testCheckersClone fixture', () => {
  it('registers via loadClassifiedTier(0)', async () => {
    await loadClassifiedTier(0);
    expect(isClassifiedRegistered(TEST_CHECKERS_CLONE_ID)).toBe(true);
  });

  it('startingPosition places 24 pawns', () => {
    const s = testCheckersCloneRuleSet.startingPosition();
    expect(s.pieces.size).toBe(24);
  });

  it('white pieces occupy node ids 21..32', () => {
    const s = testCheckersCloneRuleSet.startingPosition();
    const whiteNodes = [...s.pieces.entries()]
      .filter(([, p]) => p.owner === 'white')
      .map(([n]) => n as unknown as number);
    expect(Math.min(...whiteNodes)).toBe(21);
    expect(Math.max(...whiteNodes)).toBe(32);
  });

  it('black pieces occupy node ids 1..12', () => {
    const s = testCheckersCloneRuleSet.startingPosition();
    const blackNodes = [...s.pieces.entries()]
      .filter(([, p]) => p.owner === 'black')
      .map(([n]) => n as unknown as number);
    expect(Math.min(...blackNodes)).toBe(1);
    expect(Math.max(...blackNodes)).toBe(12);
  });

  it('checkGameOver returns null on the fresh position', () => {
    const s = testCheckersCloneRuleSet.startingPosition();
    expect(testCheckersCloneRuleSet.checkGameOver(s)).toBeNull();
  });

  it('getLegalMoves returns an empty list (fixture is not playable)', () => {
    const s = testCheckersCloneRuleSet.startingPosition();
    expect(testCheckersCloneRuleSet.getLegalMoves(s)).toHaveLength(0);
  });

  it('applyMove is identity (fixture)', () => {
    const s = testCheckersCloneRuleSet.startingPosition();
    expect(testCheckersCloneRuleSet.applyMove(s, { kind: 'pass' })).toBe(s);
  });

  it('every capability flag is false', () => {
    expect(testCheckersCloneRuleSet.hasPlacementPhase).toBe(false);
    expect(testCheckersCloneRuleSet.hasPiecesInHand).toBe(false);
    expect(testCheckersCloneRuleSet.hasStacks).toBe(false);
    expect(testCheckersCloneRuleSet.isAsymmetric).toBe(false);
    expect(testCheckersCloneRuleSet.hasMutableGeometry).toBe(false);
    expect(testCheckersCloneRuleSet.hasPiecesOfDistinctTypes).toBe(false);
  });

  it('serializer round-trips the starting state', () => {
    const s = testCheckersCloneRuleSet.startingPosition();
    const json = testCheckersCloneRuleSet.serializer.toJSON(s);
    const restored = testCheckersCloneRuleSet.serializer.fromJSON(json);
    expect(restored.pieces.size).toBe(24);
    expect(restored.turn).toBe('white');
  });
});
