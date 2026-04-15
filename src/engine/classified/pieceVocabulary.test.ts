import { describe, expect, it } from 'vitest';
import {
  asAudioPackId,
  asPieceVocabularyId,
  createPieceVocabulary,
  DRAUGHTS_PIECE_VOCABULARY,
} from './pieceVocabulary';

describe('PieceVocabulary', () => {
  it('brands PieceVocabularyId strings without a runtime cast', () => {
    const id = asPieceVocabularyId('x-vocab');
    expect(id).toBe('x-vocab');
  });

  it('brands AudioPackId strings', () => {
    expect(asAudioPackId('default-draughts')).toBe('default-draughts');
  });

  it('DRAUGHTS_PIECE_VOCABULARY exposes the four pawn/king pieces', () => {
    expect(DRAUGHTS_PIECE_VOCABULARY.onBoard).toHaveLength(4);
    const ids = DRAUGHTS_PIECE_VOCABULARY.onBoard.map((p) => p.pieceId);
    expect(ids).toContain('pawn-white');
    expect(ids).toContain('pawn-black');
    expect(ids).toContain('king-white');
    expect(ids).toContain('king-black');
  });

  it('DRAUGHTS_PIECE_VOCABULARY has an empty in-hand list', () => {
    expect(DRAUGHTS_PIECE_VOCABULARY.inHand).toHaveLength(0);
  });

  it('createPieceVocabulary defaults inHand to an empty list', () => {
    const v = createPieceVocabulary(asPieceVocabularyId('plain'), []);
    expect(v.onBoard).toHaveLength(0);
    expect(v.inHand).toHaveLength(0);
  });

  it('createPieceVocabulary preserves onBoard/inHand ordering', () => {
    const v = createPieceVocabulary(
      asPieceVocabularyId('split'),
      [{ pieceId: 'p1', displayName: 'One' }],
      [{ pieceId: 'h1', displayName: 'Hand One' }],
    );
    expect(v.onBoard[0]?.pieceId).toBe('p1');
    expect(v.inHand[0]?.pieceId).toBe('h1');
  });

  it('createPieceVocabulary produces a frozen descriptor', () => {
    const v = createPieceVocabulary(asPieceVocabularyId('frozen'), []);
    expect(Object.isFrozen(v)).toBe(true);
  });

  it('onBoard piece definitions can declare a promotion target', () => {
    const whitePawn = DRAUGHTS_PIECE_VOCABULARY.onBoard.find(
      (p) => p.pieceId === 'pawn-white',
    );
    expect(whitePawn?.promotesTo).toBe('king-white');
  });

  it('owners include white, black, and either', () => {
    const v = createPieceVocabulary(
      asPieceVocabularyId('owners'),
      [
        { pieceId: 'w', displayName: 'W', owner: 'white' },
        { pieceId: 'b', displayName: 'B', owner: 'black' },
        { pieceId: 'e', displayName: 'E', owner: 'either' },
      ],
    );
    expect(v.onBoard.map((p) => p.owner)).toEqual(['white', 'black', 'either']);
  });

  it('flipIsPromotion is opt-in and defaults to undefined', () => {
    const v = createPieceVocabulary(asPieceVocabularyId('flip'), [
      { pieceId: 'x', displayName: 'X' },
    ]);
    expect(v.onBoard[0]?.flipIsPromotion).toBeUndefined();
  });
});
