/** Shogi scaffold → Task 34 (T7-08, T7-09). Two-sided flip pairs established. */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const SHOGI_PIECE_VISUALS: readonly PieceVisualSpec[] = (() => {
  const specs = makeScaffoldVisuals('shogi-standard', [
    { pieceId: 'shogi-pawn-white', glyph: '歩', shortLabel: 'Pawn', owner: 'white' },
    { pieceId: 'shogi-pawn-black', glyph: '歩', shortLabel: 'Pawn', owner: 'black' },
    { pieceId: 'shogi-tokin-white', glyph: 'と', shortLabel: 'Tokin', owner: 'white' },
    { pieceId: 'shogi-tokin-black', glyph: 'と', shortLabel: 'Tokin', owner: 'black' },
    { pieceId: 'shogi-rook-white', glyph: '飛', shortLabel: 'Rook', owner: 'white' },
    { pieceId: 'shogi-rook-black', glyph: '飛', shortLabel: 'Rook', owner: 'black' },
    { pieceId: 'shogi-dragon-white', glyph: '龍', shortLabel: 'Dragon', owner: 'white' },
    { pieceId: 'shogi-dragon-black', glyph: '龍', shortLabel: 'Dragon', owner: 'black' },
    { pieceId: 'shogi-king-white', glyph: '王', shortLabel: 'King', owner: 'white' },
    { pieceId: 'shogi-king-black', glyph: '玉', shortLabel: 'King', owner: 'black' },
  ]);
  const flipMap: Record<string, string> = {
    'shogi-pawn-white': 'shogi-tokin-white',
    'shogi-pawn-black': 'shogi-tokin-black',
    'shogi-tokin-white': 'shogi-pawn-white',
    'shogi-tokin-black': 'shogi-pawn-black',
    'shogi-rook-white': 'shogi-dragon-white',
    'shogi-rook-black': 'shogi-dragon-black',
    'shogi-dragon-white': 'shogi-rook-white',
    'shogi-dragon-black': 'shogi-rook-black',
  };
  return specs.map((spec) => {
    const flipped = flipMap[spec.pieceId];
    return flipped !== undefined ? { ...spec, flippedPieceId: flipped } : spec;
  });
})();

export function registerShogiPieces(): void {
  registerScaffoldVisuals(SHOGI_PIECE_VISUALS);
}
