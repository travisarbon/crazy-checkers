/**
 * Zamma notation adapter — Tier 2 (Task 29.8).
 *
 * Standard PDN over alquerque coordinates.
 *  - **Step:** `<from>-<to>`.
 *  - **Capture:** `<from>×<intermediate>×...×<to>`.
 *  - **Promotion to Mullah:** appended `=M` (`M` for Mullah).
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import { createPdnNotationAdapter } from '../basePdn';
import type { Tier2NotationAdapter } from './dameo';

const MULLAH_SUFFIX = '=M';

export function createZammaNotationAdapter(
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  const base = createPdnNotationAdapter({
    adapterKey: 'zamma-pdn',
    boardGeometry,
    captureSeparator: '×',
  });

  return {
    adapterKey: 'zamma-pdn',
    notate(state, move) {
      const baseText = base.notate(state, move);
      if (move.promotion === 'king') return baseText + MULLAH_SUFFIX;
      return baseText;
    },
    parse(state, notation) {
      let core = notation.trim();
      let promotion: 'king' | undefined;
      if (core.endsWith(MULLAH_SUFFIX)) {
        core = core.slice(0, -MULLAH_SUFFIX.length);
        promotion = 'king';
      }
      const baseMove = base.parse(state, core);
      if (baseMove === null) return null;
      return promotion !== undefined ? { ...baseMove, promotion } : baseMove;
    },
  };
}
