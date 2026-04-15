/** Cheskers scaffold → Task 29. */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const CHESKERS_PIECE_VISUALS: readonly PieceVisualSpec[] = makeScaffoldVisuals(
  'cheskers-standard',
  [
    { pieceId: 'cheskers-pawn-white', glyph: 'P', shortLabel: 'Pawn', owner: 'white' },
    { pieceId: 'cheskers-pawn-black', glyph: 'P', shortLabel: 'Pawn', owner: 'black' },
    { pieceId: 'cheskers-bishop-white', glyph: 'B', shortLabel: 'Bishop', owner: 'white' },
    { pieceId: 'cheskers-bishop-black', glyph: 'B', shortLabel: 'Bishop', owner: 'black' },
    { pieceId: 'cheskers-knight-white', glyph: 'N', shortLabel: 'Knight', owner: 'white' },
    { pieceId: 'cheskers-knight-black', glyph: 'N', shortLabel: 'Knight', owner: 'black' },
  ],
);

export function registerCheskersPieces(): void {
  registerScaffoldVisuals(CHESKERS_PIECE_VISUALS);
}
