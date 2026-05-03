/**
 * Harzdame notation adapter — Tier 2 (Task 29.8).
 *
 * Standard PDN with Harzdame's `K+` senior-king token.
 *  - **Step / capture:** standard PDN.
 *  - **Promotion to regular king:** appended `=K`.
 *  - **Promotion to senior king:** appended `=K+` (per playbook + per-game
 *    subtask 29.G.2-C wording). Senior promotion fires when a king
 *    completes a max-chain capture, so `=K+` appears on `'capture'` moves
 *    where `move.promotion === 'senior'`.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import { createPdnNotationAdapter } from '../basePdn';
import type { Tier2NotationAdapter } from './dameo';

const SENIOR_SUFFIX = '=K+';
const KING_SUFFIX = '=K';

export function createHarzdameNotationAdapter(
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  const base = createPdnNotationAdapter({
    adapterKey: 'harzdame-pdn',
    boardGeometry,
    captureSeparator: '×',
  });

  return {
    adapterKey: 'harzdame-pdn',
    notate(state, move) {
      const baseText = base.notate(state, move);
      if (move.promotion === 'senior') return baseText + SENIOR_SUFFIX;
      if (move.promotion === 'king') return baseText + KING_SUFFIX;
      return baseText;
    },
    parse(state, notation) {
      let core = notation.trim();
      let promotion: 'king' | 'senior' | undefined;
      if (core.endsWith(SENIOR_SUFFIX)) {
        core = core.slice(0, -SENIOR_SUFFIX.length);
        promotion = 'senior';
      } else if (core.endsWith(KING_SUFFIX)) {
        core = core.slice(0, -KING_SUFFIX.length);
        promotion = 'king';
      }
      const baseMove = base.parse(state, core);
      if (baseMove === null) return null;
      return promotion !== undefined ? { ...baseMove, promotion } : baseMove;
    },
  };
}
