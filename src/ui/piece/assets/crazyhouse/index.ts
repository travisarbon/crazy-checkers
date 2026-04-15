/** Crazyhouse scaffold → Task 34. */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const CRAZYHOUSE_PIECE_VISUALS: readonly PieceVisualSpec[] = makeScaffoldVisuals(
  'crazyhouse-standard',
  [
    { pieceId: 'crazyhouse-pawn-white', glyph: 'p', shortLabel: 'Pawn', owner: 'white' },
    { pieceId: 'crazyhouse-pawn-black', glyph: 'p', shortLabel: 'Pawn', owner: 'black' },
  ],
);

export function registerCrazyhousePieces(): void {
  registerScaffoldVisuals(CRAZYHOUSE_PIECE_VISUALS);
}
