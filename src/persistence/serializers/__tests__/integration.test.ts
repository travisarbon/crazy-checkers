import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { asNodeId } from '../../../engine/boardGeometry';
import {
  _clearClassifiedRegistry,
  registerClassifiedGame,
} from '../../../engine/classified/registry';
import { registerTier0 } from '../../../engine/classified/tier0';
import {
  TEST_CHECKERS_CLONE_ID,
  testCheckersCloneRuleSet,
} from '../../../engine/classified/tier0/testCheckersClone';
import {
  TEST_SHOGI_CLONE_ID,
  testShogiCloneRuleSet,
} from '../../../engine/classified/tier0/testShogiClone';
import {
  asClassifiedGameId,
  type ClassifiedRuleSet,
} from '../../../engine/classified/ClassifiedRuleSet';
import type { ClassifiedGameState } from '../../../engine/classified/state';
import {
  clearSerializers__TEST_ONLY,
  getSerializer,
  hasSerializer,
  listRegisteredSerializers,
} from '../registry';
import { createDefaultSerializer } from '../default';
import { assertByteIdenticalRoundTrip, roundTrip } from './roundTrip';
import { asAudioPackId } from '../../../engine/classified/pieceVocabulary';

beforeEach(() => {
  _clearClassifiedRegistry();
  clearSerializers__TEST_ONLY();
});

afterEach(() => {
  _clearClassifiedRegistry();
  clearSerializers__TEST_ONLY();
});

describe('registerClassifiedGame auto-registers the per-game serializer', () => {
  it('Tier 0 checkers fixture lands in the serializer registry', () => {
    registerTier0();
    expect(hasSerializer(TEST_CHECKERS_CLONE_ID)).toBe(true);
    expect(hasSerializer(TEST_SHOGI_CLONE_ID)).toBe(true);
    expect(listRegisteredSerializers()).toEqual(
      expect.arrayContaining([TEST_CHECKERS_CLONE_ID, TEST_SHOGI_CLONE_ID]),
    );
  });

  it('fetched serializer round-trips the Tier 0 checkers starting position', () => {
    registerTier0();
    const ser = getSerializer(TEST_CHECKERS_CLONE_ID);
    const start = testCheckersCloneRuleSet.startingPosition();
    const { rehydrated, first, second } = roundTrip(ser, start);
    expect(second).toBe(first);
    expect(rehydrated.pieces.size).toBe(24);
  });

  it('fetched Tier 0 shogi serializer round-trips the starting position with hands', () => {
    registerTier0();
    const ser = getSerializer(TEST_SHOGI_CLONE_ID);
    const start = testShogiCloneRuleSet.startingPosition();
    assertByteIdenticalRoundTrip(ser, start);
    const { rehydrated } = roundTrip(ser, start);
    expect(rehydrated.hands?.white.get('pawn-in-hand')).toBe(1);
    expect(rehydrated.hands?.black.get('pawn-in-hand')).toBe(1);
  });

  it('serializer registration is rolled back when downstream registration fails', () => {
    // Pre-register the checkers fixture.
    registerTier0();
    expect(hasSerializer(TEST_CHECKERS_CLONE_ID)).toBe(true);

    // Attempt to re-register with a conflicting classifiedNumber — forces
    // an atomic rollback before the serializer is swapped.
    const badId = asClassifiedGameId('classified-tier-zero-bad');
    expect(() =>
      registerClassifiedGame(
        {
          gameId: badId,
          classifiedNumber: 0, // already claimed by TEST_CHECKERS_CLONE_ID
          wave: 1,
          tier: 1,
          family: 'Test',
          displayName: 'Test Tier 0 Checkers Clone',
          ruleSet: testCheckersCloneRuleSet,
          boardGeometry: testCheckersCloneRuleSet.boardGeometry,
          pieceVocabularyId: testCheckersCloneRuleSet.pieceVocabulary.id,
          audioPackId: asAudioPackId('default-draughts'),
          codeUnlockKey: 'TESTTIERZERO-ALT',
          narrativeFlavor: { wave: 'x', family: 'x', connection: 'x' },
        },
        { allowTierZero: true },
      ),
    ).toThrow();
    expect(hasSerializer(badId)).toBe(false);
  });

  it('SerializerIdentityError is raised if spec.gameId and serializer.gameId disagree', () => {
    // Build a ruleset with a serializer explicitly carrying a mismatched gameId.
    const mismatched = asClassifiedGameId('classified-mismatch');
    const defaultSer = createDefaultSerializer({
      gameId: mismatched,
      vocabularyPieceIds: ['pawn-white', 'pawn-black', 'king-white', 'king-black'],
    });
    const ruleSet: ClassifiedRuleSet = {
      ...testCheckersCloneRuleSet,
      gameId: asClassifiedGameId('classified-test-tier-0'),
      serializer: defaultSer,
    };
    expect(() =>
      registerClassifiedGame(
        {
          gameId: asClassifiedGameId('classified-test-tier-0'),
          classifiedNumber: 0,
          wave: 1,
          tier: 1,
          family: 'Test',
          displayName: 'Test Tier 0 Checkers Clone',
          ruleSet,
          boardGeometry: ruleSet.boardGeometry,
          pieceVocabularyId: ruleSet.pieceVocabulary.id,
          audioPackId: asAudioPackId('default-draughts'),
          codeUnlockKey: 'TESTTIERZERO',
          narrativeFlavor: { wave: 'x', family: 'x', connection: 'x' },
        },
        { allowTierZero: true, replace: true },
      ),
    ).toThrow(
      /downstream registration failed|SerializerIdentityError|identity mismatch/,
    );
  });
});

describe('default serializer end-to-end via a mid-game state', () => {
  it('round-trips a 10-move-deep state with one promotion and one capture', () => {
    // Use the shared default serializer directly — the Tier 0 fixture's
    // legacy serializer drops moveHistory on decode, so a mid-game
    // round-trip test is only meaningful against the default serializer.
    const ser = createDefaultSerializer({
      gameId: asClassifiedGameId('classified-test-tier-0'),
      vocabularyPieceIds: ['pawn-white', 'pawn-black', 'king-white', 'king-black', 'pawn', 'king'],
    });
    const start = testCheckersCloneRuleSet.startingPosition();
    const piecesMap = new Map(start.pieces);
    // Simulate a capture + promotion.
    piecesMap.delete(asNodeId(9));
    piecesMap.set(asNodeId(14), { owner: 'white', kind: 'pawn' });
    piecesMap.set(asNodeId(29), { owner: 'white', kind: 'pawn', promoted: true });

    const midGame: ClassifiedGameState = {
      pieces: piecesMap,
      turn: 'black',
      plyCount: 10,
      moveHistory: [
        { kind: 'move', from: '21', to: '17' },
        { kind: 'move', from: '5', to: '9' },
        { kind: 'move', from: '22', to: '18' },
        { kind: 'capture', from: '9', to: '18', capture: ['18'] },
        { kind: 'move', from: '23', to: '19' },
        { kind: 'move', from: '18', to: '23' },
        { kind: 'move', from: '24', to: '20' },
        { kind: 'move', from: '23', to: '27' },
        { kind: 'move', from: '25', to: '21' },
        { kind: 'move', from: '27', to: '32', promotion: 'king' },
      ],
    };
    assertByteIdenticalRoundTrip(ser, midGame);

    // Deep-equal check: Maps compare by reference, but entries are equal.
    const { rehydrated } = roundTrip(ser, midGame);
    expect(rehydrated.moveHistory?.length).toBe(10);
    expect(rehydrated.turn).toBe('black');
    expect(rehydrated.plyCount).toBe(10);
  });
});
