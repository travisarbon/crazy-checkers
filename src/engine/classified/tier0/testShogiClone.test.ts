import { beforeEach, describe, expect, it } from 'vitest';
import { _clearClassifiedRegistry, isClassifiedRegistered } from '../registry';
import { loadClassifiedTier, _clearTierLoaderCache } from '../tierLoader';
import {
  testShogiCloneRuleSet,
  TEST_SHOGI_CLONE_ID,
  TEST_SHOGI_VOCABULARY,
} from './testShogiClone';

beforeEach(() => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
});

describe('testShogiClone fixture — hand pathway (T7-08)', () => {
  it('registers via loadClassifiedTier(0)', async () => {
    await loadClassifiedTier(0);
    expect(isClassifiedRegistered(TEST_SHOGI_CLONE_ID)).toBe(true);
  });

  it('hasPiecesInHand: true and hasPiecesOfDistinctTypes: true', () => {
    expect(testShogiCloneRuleSet.hasPiecesInHand).toBe(true);
    expect(testShogiCloneRuleSet.hasPiecesOfDistinctTypes).toBe(true);
  });

  it('getLegalDrops is present', () => {
    expect(typeof testShogiCloneRuleSet.getLegalDrops).toBe('function');
  });

  it('startingPosition seeds the 3×3 board with two rooks', () => {
    const s = testShogiCloneRuleSet.startingPosition();
    expect(s.pieces.size).toBe(2);
  });

  it('starting hands contain one pawn per side', () => {
    const s = testShogiCloneRuleSet.startingPosition();
    expect(s.hands?.white.get('pawn-in-hand')).toBe(1);
    expect(s.hands?.black.get('pawn-in-hand')).toBe(1);
  });

  it('getLegalDrops returns one entry per empty square × hand piece', () => {
    const s = testShogiCloneRuleSet.startingPosition();
    const drops = testShogiCloneRuleSet.getLegalDrops?.(s) ?? [];
    // 7 empty squares × 1 hand piece available for white
    expect(drops).toHaveLength(7);
  });

  it('getLegalDrops honours turn (black sees black hand on black turn)', () => {
    const s = { ...testShogiCloneRuleSet.startingPosition(), turn: 'black' };
    const drops = testShogiCloneRuleSet.getLegalDrops?.(s) ?? [];
    expect(drops.length).toBeGreaterThan(0);
  });

  it('PieceVocabulary id is stable', () => {
    expect(TEST_SHOGI_VOCABULARY.id).toBe('test-tier-shogi');
  });

  it('PieceVocabulary.onBoard has rook + pawn', () => {
    expect(TEST_SHOGI_VOCABULARY.onBoard.map((p) => p.pieceId)).toEqual(['rook', 'pawn']);
  });

  it('PieceVocabulary.inHand has two reserve entries', () => {
    expect(TEST_SHOGI_VOCABULARY.inHand.map((p) => p.pieceId)).toEqual([
      'rook-in-hand',
      'pawn-in-hand',
    ]);
  });

  it('checkGameOver returns null on the fresh position', () => {
    const s = testShogiCloneRuleSet.startingPosition();
    expect(testShogiCloneRuleSet.checkGameOver(s)).toBeNull();
  });
});
