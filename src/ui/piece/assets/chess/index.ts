/** Chess family scaffold → Task 33. */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const CHESS_PIECE_VISUALS: readonly PieceVisualSpec[] = makeScaffoldVisuals(
  'chess-standard',
  [
    { pieceId: 'chess-pawn-white', glyph: 'P', shortLabel: 'Pawn', owner: 'white' },
    { pieceId: 'chess-pawn-black', glyph: 'P', shortLabel: 'Pawn', owner: 'black' },
    { pieceId: 'chess-rook-white', glyph: 'R', shortLabel: 'Rook', owner: 'white' },
    { pieceId: 'chess-rook-black', glyph: 'R', shortLabel: 'Rook', owner: 'black' },
    { pieceId: 'chess-knight-white', glyph: 'N', shortLabel: 'Knight', owner: 'white' },
    { pieceId: 'chess-knight-black', glyph: 'N', shortLabel: 'Knight', owner: 'black' },
    { pieceId: 'chess-bishop-white', glyph: 'B', shortLabel: 'Bishop', owner: 'white' },
    { pieceId: 'chess-bishop-black', glyph: 'B', shortLabel: 'Bishop', owner: 'black' },
    { pieceId: 'chess-queen-white', glyph: 'Q', shortLabel: 'Queen', owner: 'white' },
    { pieceId: 'chess-queen-black', glyph: 'Q', shortLabel: 'Queen', owner: 'black' },
    { pieceId: 'chess-king-white', glyph: 'K', shortLabel: 'King', owner: 'white' },
    { pieceId: 'chess-king-black', glyph: 'K', shortLabel: 'King', owner: 'black' },
  ],
);

export function registerChessPieces(): void {
  registerScaffoldVisuals(CHESS_PIECE_VISUALS);
}
