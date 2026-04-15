/**
 * Stacking family scaffold → Task 29 (T2-11). Lasca/Bashni/Focus/Emergo etc.
 * Single stub entry per side; tier tasks replace with TowerPiece art.
 */
import { makeScaffoldVisuals, registerScaffoldVisuals } from '../scaffoldFactory';
import type { PieceVisualSpec } from '../../PieceVisualSpec';

export const STACKING_PIECE_VISUALS: readonly PieceVisualSpec[] =
  makeScaffoldVisuals('stacking-standard', [
    { pieceId: 'stack-officer-white', glyph: 'O', shortLabel: 'Officer', owner: 'white' },
    { pieceId: 'stack-officer-black', glyph: 'O', shortLabel: 'Officer', owner: 'black' },
    { pieceId: 'stack-soldier-white', glyph: 'S', shortLabel: 'Soldier', owner: 'white' },
    { pieceId: 'stack-soldier-black', glyph: 'S', shortLabel: 'Soldier', owner: 'black' },
  ]).map((spec) => ({
    ...spec,
    heightFunction: (depth: number) => depth * 4,
  }));

export function registerStackingPieces(): void {
  registerScaffoldVisuals(STACKING_PIECE_VISUALS);
}
