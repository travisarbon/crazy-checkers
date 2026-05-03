/**
 * Dameo notation adapter — Tier 2 (Task 29.8).
 *
 * Per playbook §7.2 / plan §6.1: standard PDN with phalanx-move extension.
 *  - **Step:** `<from>-<to>` (algebraic, e.g., `c3-c4`).
 *  - **Capture:** `<from>×<intermediate>×...×<to>` — base PDN.
 *  - **Group-advance (phalanx):** `(<m1>,<m2>,...,<mN>)→<headDest>` — explicit
 *    rear→head member list, arrow, head destination. The arrow disambiguates
 *    from PDN step. Member list is taken from `move.meta.groupMembers`.
 *  - **Promotion:** appended `=K` for man-to-king promotion.
 *
 * Round-trip parse: detect parens-arrow pattern → parse member list →
 * reconstruct `LinearMove` with `kind: 'group-advance'`. Detect trailing
 * `=K` → set `move.promotion = 'king'`.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import type {
  ClassifiedMove,
  NotationAdapter,
} from '../../../engine/classified/ClassifiedRuleSet';
import type { ClassifiedGameState } from '../../../engine/classified/state';
import { createPdnNotationAdapter } from '../basePdn';

export interface Tier2NotationAdapter
  extends NotationAdapter<ClassifiedGameState, ClassifiedMove> {
  readonly adapterKey: string;
}

const PROMOTION_SUFFIX = '=K';
const GROUP_ADVANCE_RE = /^\(([^)]+)\)→(.+)$/;

export function createDameoNotationAdapter(
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  const base = createPdnNotationAdapter({
    adapterKey: 'dameo-pdn',
    boardGeometry,
    captureSeparator: '×',
  });

  return {
    adapterKey: 'dameo-pdn',
    notate(state, move) {
      // Phalanx group-advance (Dameo-specific). `groupMembers` lives at the
      // top level of `LinearMove` (not inside `meta`); access via cast.
      if (move.kind === 'group-advance') {
        const moveAny = move as unknown as { groupMembers?: readonly string[] };
        const members = moveAny.groupMembers ?? [];
        const memberList = members.join(',');
        const head = move.to ?? '?';
        const text = `(${memberList})→${head}`;
        return move.promotion === 'king' ? text + PROMOTION_SUFFIX : text;
      }
      const baseText = base.notate(state, move);
      return move.promotion === 'king' ? baseText + PROMOTION_SUFFIX : baseText;
    },
    parse(state, notation) {
      const trimmed = notation.trim();
      let core = trimmed;
      let promotion: 'king' | undefined;
      if (core.endsWith(PROMOTION_SUFFIX)) {
        core = core.slice(0, -PROMOTION_SUFFIX.length);
        promotion = 'king';
      }
      // Phalanx group-advance.
      const ga = GROUP_ADVANCE_RE.exec(core);
      if (ga !== null) {
        const memberList = (ga[1] ?? '').split(',').map((s) => s.trim()).filter((s) => s.length > 0);
        const headDest = (ga[2] ?? '').trim();
        if (memberList.length === 0 || headDest.length === 0) return null;
        const head = memberList[0];
        if (head === undefined) return null;
        const moveOut = {
          kind: 'group-advance',
          from: head,
          to: headDest,
          capture: [],
          groupMembers: memberList,
          ...(promotion !== undefined ? { promotion } : {}),
        } as unknown as ClassifiedMove;
        return moveOut;
      }
      const baseMove = base.parse(state, core);
      if (baseMove === null) return null;
      return promotion !== undefined ? { ...baseMove, promotion } : baseMove;
    },
  };
}
