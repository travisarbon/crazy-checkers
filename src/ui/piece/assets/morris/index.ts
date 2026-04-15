/** Nine/Six/Three Men's Morris scaffold → Task 30. */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const MORRIS_PIECE_VISUALS: readonly PieceVisualSpec[] = makeScaffoldVisuals(
  'morris-standard',
  [
    { pieceId: 'morris-man-white', glyph: '·', shortLabel: 'Man', owner: 'white' },
    { pieceId: 'morris-man-black', glyph: '·', shortLabel: 'Man', owner: 'black' },
  ],
);

export function registerMorrisPieces(): void {
  registerScaffoldVisuals(MORRIS_PIECE_VISUALS);
}
