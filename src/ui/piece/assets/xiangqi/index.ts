/** Xiangqi scaffold → Task 33. */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const XIANGQI_PIECE_VISUALS: readonly PieceVisualSpec[] = makeScaffoldVisuals(
  'xiangqi-standard',
  [
    { pieceId: 'xiangqi-general-white', glyph: '帥', shortLabel: 'General', owner: 'white' },
    { pieceId: 'xiangqi-general-black', glyph: '將', shortLabel: 'General', owner: 'black' },
    { pieceId: 'xiangqi-soldier-white', glyph: '兵', shortLabel: 'Soldier', owner: 'white' },
    { pieceId: 'xiangqi-soldier-black', glyph: '卒', shortLabel: 'Soldier', owner: 'black' },
  ],
);

export function registerXiangqiPieces(): void {
  registerScaffoldVisuals(XIANGQI_PIECE_VISUALS);
}
