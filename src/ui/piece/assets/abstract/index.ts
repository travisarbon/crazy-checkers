/** Abstract / Hunt / Connection token scaffold → Task 30. */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const ABSTRACT_PIECE_VISUALS: readonly PieceVisualSpec[] = makeScaffoldVisuals(
  'abstract-standard',
  [
    { pieceId: 'abstract-token-white', glyph: 'T', shortLabel: 'Token', owner: 'white' },
    { pieceId: 'abstract-token-black', glyph: 'T', shortLabel: 'Token', owner: 'black' },
  ],
);

export function registerAbstractPieces(): void {
  registerScaffoldVisuals(ABSTRACT_PIECE_VISUALS);
}
