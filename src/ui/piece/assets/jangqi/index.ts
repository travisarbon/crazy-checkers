/** Janggi scaffold → Task 33. */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const JANGQI_PIECE_VISUALS: readonly PieceVisualSpec[] = makeScaffoldVisuals(
  'janggi-standard',
  [
    { pieceId: 'janggi-general-white', glyph: '楚', shortLabel: 'General', owner: 'white' },
    { pieceId: 'janggi-general-black', glyph: '漢', shortLabel: 'General', owner: 'black' },
    { pieceId: 'janggi-soldier-white', glyph: '兵', shortLabel: 'Soldier', owner: 'white' },
    { pieceId: 'janggi-soldier-black', glyph: '卒', shortLabel: 'Soldier', owner: 'black' },
  ],
);

export function registerJangqiPieces(): void {
  registerScaffoldVisuals(JANGQI_PIECE_VISUALS);
}
