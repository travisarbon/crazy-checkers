/**
 * pdn-8-armenian — PDN 8×8 full-board algebraic adapter with orthogonal-
 * capture annotation. Orthogonal legs carry `×−`, diagonal legs the standard
 * `×`. Men captures in Armenian Draughts are diagonal-forward or horizontal;
 * king captures add vertical + diagonal-backward, so both annotation forms
 * appear in real play.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import {
  createPdnNotationAdapter,
  type PdnNotationAdapter,
} from '../basePdn';

export function createPdnArmenianAdapter(
  boardGeometry: BoardGeometry,
): PdnNotationAdapter {
  return createPdnNotationAdapter({
    adapterKey: 'pdn-8-armenian',
    boardGeometry,
    legSeparator: (fromId, toId, size) => {
      const fr = Math.floor(fromId / size);
      const fc = fromId % size;
      const tr = Math.floor(toId / size);
      const tc = toId % size;
      if (fr === tr || fc === tc) return '×−';
      return '×';
    },
  });
}
