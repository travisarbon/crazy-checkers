/**
 * pdn-frisian — PDN 10×10 dark-squares adapter with dual-axis capture
 * annotation. Each capture leg carries `×⊥` when the leg is orthogonal or
 * `×/` when the leg is diagonal. Serves both Frisian Draughts and Frysk!.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import {
  createPdnNotationAdapter,
  type PdnNotationAdapter,
} from '../basePdn';

export function createPdnFrisianAdapter(
  boardGeometry: BoardGeometry,
): PdnNotationAdapter {
  return createPdnNotationAdapter({
    adapterKey: 'pdn-frisian',
    boardGeometry,
    legSeparator: (fromId, toId, size) => {
      const fr = Math.floor(fromId / size);
      const fc = fromId % size;
      const tr = Math.floor(toId / size);
      const tc = toId % size;
      if (fr === tr || fc === tc) return '×⊥';
      return '×/';
    },
  });
}
