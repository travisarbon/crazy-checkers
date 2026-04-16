/**
 * pdn-8-turkish — PDN 8×8 full-board algebraic adapter. Turkish Draughts
 * uses only orthogonal movement and capture on a full 64-square board, so
 * no per-leg annotation decoration is required; the `×` separator is used
 * uniformly. The distinguishing characteristic from the base PDN adapter
 * is the algebraic labelling surface (a1..h8) delivered by the underlying
 * `BoardGeometry.coordinateLabels`.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import {
  createPdnNotationAdapter,
  type PdnNotationAdapter,
} from '../basePdn';

export function createPdnTurkishAdapter(
  boardGeometry: BoardGeometry,
): PdnNotationAdapter {
  return createPdnNotationAdapter({
    adapterKey: 'pdn-8-turkish',
    boardGeometry,
    captureSeparator: '×',
  });
}
