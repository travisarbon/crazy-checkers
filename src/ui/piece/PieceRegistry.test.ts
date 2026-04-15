import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerPieceVisual,
  getPieceVisual,
  tryGetPieceVisual,
  listVocabularyVisuals,
  listRegisteredPieceIds,
  hasStubbedPieces,
  _clearPieceRegistry,
  resolvePieceFill,
} from './PieceRegistry';
import {
  PieceVisualCollisionError,
  PieceVisualMissingError,
  type PieceVisualSpec,
} from './PieceVisualSpec';
import { asPieceVocabularyId } from '../../engine/classified/pieceVocabulary';
import { crazyTheme } from '../../themes/crazy';

const VOCAB = asPieceVocabularyId('test-vocab');

function makeSpec(pieceId: string, overrides?: Partial<PieceVisualSpec>): PieceVisualSpec {
  return {
    pieceId,
    vocabularyId: VOCAB,
    viewBox: [-50, -50, 100, 100] as const,
    colorPolicy: { kind: 'theme-driven' },
    shortLabel: 'Test',
    render: () => {
      return { type: 'g', props: {}, key: null } as unknown as never;
    },
    ...overrides,
  };
}

beforeEach(() => {
  _clearPieceRegistry();
});

describe('PieceRegistry', () => {
  it('registers and retrieves a spec', () => {
    const spec = makeSpec('alpha');
    registerPieceVisual(spec);
    expect(getPieceVisual('alpha')).toBe(spec);
  });

  it('throws PieceVisualMissingError on miss', () => {
    expect(() => getPieceVisual('nope')).toThrow(PieceVisualMissingError);
  });

  it('tryGetPieceVisual returns undefined on miss', () => {
    expect(tryGetPieceVisual('nope')).toBeUndefined();
  });

  it('bit-identical re-registration is a no-op', () => {
    const spec = makeSpec('alpha');
    registerPieceVisual(spec);
    expect(() => {
      registerPieceVisual(spec);
    }).not.toThrow();
  });

  it('differing re-registration throws PieceVisualCollisionError', () => {
    registerPieceVisual(makeSpec('alpha'));
    expect(() => {
      registerPieceVisual(makeSpec('alpha'));
    }).toThrow(PieceVisualCollisionError);
  });

  it('listVocabularyVisuals returns registered specs in order', () => {
    const a = makeSpec('a');
    const b = makeSpec('b');
    registerPieceVisual(a);
    registerPieceVisual(b);
    expect(listVocabularyVisuals(VOCAB)).toEqual([a, b]);
  });

  it('listRegisteredPieceIds returns ids in registration order', () => {
    registerPieceVisual(makeSpec('a'));
    registerPieceVisual(makeSpec('b'));
    expect(listRegisteredPieceIds()).toEqual(['a', 'b']);
  });

  it('hasStubbedPieces reports stubs', () => {
    registerPieceVisual(makeSpec('stub', { __PIECE_STUB__: true }));
    expect(hasStubbedPieces()).toBe(true);
  });

  it('resolvePieceFill resolves theme-driven white body', () => {
    const spec = makeSpec('alpha');
    registerPieceVisual(spec);
    expect(resolvePieceFill(spec, crazyTheme, 'white', 'body')).toBe(crazyTheme.pieceWhite);
    expect(resolvePieceFill(spec, crazyTheme, 'black', 'body')).toBe(crazyTheme.pieceBlack);
  });

  it('resolvePieceFill resolves absolute body while theme halo', () => {
    const spec = makeSpec('stone', {
      colorPolicy: { kind: 'absolute', light: '#FFFFFF', dark: '#000000' },
    });
    registerPieceVisual(spec);
    expect(resolvePieceFill(spec, crazyTheme, 'white', 'body')).toBe('#FFFFFF');
    expect(resolvePieceFill(spec, crazyTheme, 'black', 'body')).toBe('#000000');
    expect(resolvePieceFill(spec, crazyTheme, 'white', 'halo')).toBe(
      crazyTheme.highlightSelected,
    );
  });

  it('resolvePieceFill hybrid splits body absolute / stroke themed', () => {
    const spec = makeSpec('disc', {
      colorPolicy: {
        kind: 'hybrid',
        themeParts: ['stroke'],
        absoluteParts: ['body'],
        light: '#EEEEEE',
        dark: '#222222',
      },
    });
    registerPieceVisual(spec);
    expect(resolvePieceFill(spec, crazyTheme, 'white', 'body')).toBe('#EEEEEE');
    expect(resolvePieceFill(spec, crazyTheme, 'white', 'stroke')).toBe(crazyTheme.pieceWhiteStroke);
  });
});
