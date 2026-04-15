/** Mancala family scaffold → Task 32. Seeds render inside pits; count badge. */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const MANCALA_PIECE_VISUALS: readonly PieceVisualSpec[] = makeScaffoldVisuals(
  'mancala-standard',
  [
    { pieceId: 'mancala-seed', glyph: 's', shortLabel: 'Seed', owner: 'either' },
  ],
);

export function registerMancalaPieces(): void {
  registerScaffoldVisuals(MANCALA_PIECE_VISUALS);
}
