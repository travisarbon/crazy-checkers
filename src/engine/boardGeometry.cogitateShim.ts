/**
 * Cogitate compatibility shim for the new BoardGeometry descriptor.
 *
 * The Phase 3 Cogitate subsystem consumes a tiny display-sizing struct:
 *   `{ gridType, rows, cols, playableSquares, darkSquaresOnly }`
 *
 * This shim converts between it and the Phase 4 engine-layer descriptor so
 * Phase 3 callers keep working until tier tasks migrate them.
 */

import type { BoardGeometry as PhaseFourBoardGeometry } from './boardGeometry';
import { squareGeometry, darkSquaresOnly } from './boardGeometry';
import type { BoardGeometry as CogitateBoardGeometry } from '../cogitate/types';

export class NotCogitateCompatibleError extends Error {
  constructor(geometry: PhaseFourBoardGeometry) {
    super(
      `BoardGeometry kind '${geometry.kind}' cannot be projected onto the Cogitate struct; only 'square' is supported.`,
    );
    this.name = 'NotCogitateCompatibleError';
  }
}

export function toCogitateGeometry(
  g: PhaseFourBoardGeometry,
): CogitateBoardGeometry {
  if (g.kind === 'square' && g.dimensions.square) {
    const size = g.dimensions.square.size;
    const darkOnly = !!g.playableMask;
    return {
      gridType: darkOnly ? 'diagonal-square' : 'full-square',
      rows: size,
      cols: size,
      playableSquares: darkOnly ? (size * size) / 2 : size * size,
      darkSquaresOnly: darkOnly,
    };
  }
  throw new NotCogitateCompatibleError(g);
}

export function fromCogitateGeometry(
  c: CogitateBoardGeometry,
): PhaseFourBoardGeometry {
  if (c.gridType === 'diagonal-square' || c.gridType === 'full-square') {
    return squareGeometry({
      size: c.rows,
      indexing: 'squares',
      playableMask: c.darkSquaresOnly ? darkSquaresOnly : undefined,
    });
  }
  return squareGeometry({
    size: c.rows,
    indexing: 'squares',
    playableMask: c.darkSquaresOnly ? darkSquaresOnly : undefined,
  });
}

/** Phase 4 equivalent of the legacy `DRAUGHTS_BOARD_GEOMETRY` constant. */
export const DRAUGHTS_BOARD_GEOMETRY_V2: PhaseFourBoardGeometry = squareGeometry({
  size: 8,
  indexing: 'squares',
  playableMask: darkSquaresOnly,
  variant: 'pdn-8',
});
