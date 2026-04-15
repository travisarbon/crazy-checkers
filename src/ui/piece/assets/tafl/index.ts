/** Tafl scaffold → Task 30 (asymmetric: attacker/defender/king). */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const TAFL_PIECE_VISUALS: readonly PieceVisualSpec[] = makeScaffoldVisuals(
  'tafl-standard',
  [
    { pieceId: 'tafl-attacker', glyph: 'A', shortLabel: 'Attacker', owner: 'black' },
    { pieceId: 'tafl-defender', glyph: 'D', shortLabel: 'Defender', owner: 'white' },
    { pieceId: 'tafl-king', glyph: 'K', shortLabel: 'King', owner: 'white' },
  ],
);

export function registerTaflPieces(): void {
  registerScaffoldVisuals(TAFL_PIECE_VISUALS);
}
