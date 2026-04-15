import { describe, it, expect, beforeEach } from 'vitest';
import { describePiece } from './describePiece';
import { _clearPieceRegistry } from './PieceRegistry';
import { registerDraughtsPieces } from './assets/draughts';
import { registerShogiPieces } from './assets/shogi';
import { _resetPieceFamilyRegistration } from './assets';

beforeEach(() => {
  _clearPieceRegistry();
  _resetPieceFamilyRegistration();
  registerDraughtsPieces();
  registerShogiPieces();
});

describe('describePiece', () => {
  it('labels a white king on a board square as selected', () => {
    const label = describePiece('king-white', {
      location: { kind: 'board', square: '22' },
      selected: true,
    });
    expect(label).toBe('White king on square 22 — selected');
  });

  it('labels a black pawn on a board square', () => {
    expect(
      describePiece('pawn-black', { location: { kind: 'board', square: '5' } }),
    ).toBe('Black pawn on square 5');
  });

  it('labels a hand piece with count badge', () => {
    const label = describePiece('shogi-rook-white', {
      location: { kind: 'hand', count: 2 },
    });
    expect(label).toContain('in hand (×2)');
  });

  it('appends stack depth when > 1', () => {
    const label = describePiece('pawn-white', {
      location: { kind: 'board', square: 'a1' },
      stackDepth: 4,
    });
    expect(label).toContain('stack of 4');
  });

  it('labels promotion status', () => {
    const label = describePiece('shogi-pawn-white', {
      location: { kind: 'board', square: '5e' },
      promotionState: 'promoted',
    });
    expect(label).toContain('promoted');
  });

  it('gracefully labels an unknown pieceId', () => {
    const label = describePiece('unknown-foo-white', {
      location: { kind: 'board', square: '1' },
    });
    expect(label).toContain('White');
    expect(label).toContain('unknown-foo-white');
  });

  it('concatenates multiple state parts', () => {
    const label = describePiece('king-white', {
      location: { kind: 'board', square: '1' },
      selected: true,
      lastMoved: true,
    });
    expect(label).toBe('White king on square 1 — selected, last moved');
  });
});
