/**
 * T2-S3 stack-aware PDN base — shared by Lasca + Bashni (Task 29.8 §6.3).
 *
 * The most complex notation in Tier 2. Each capture move record carries
 * the destination's post-move stack composition because a stacking move
 * can change the stack's owner (the captured commander is added to the
 * bottom of the capturing stack).
 *
 *  - **Step move (no capture):** `<from>-<to>` — same as base PDN.
 *  - **Capture move:** `<from>×<jump1>×...×<to> [stacks: <fromStack>→<toStack>]`
 *    where:
 *    - `<fromStack>` = post-move composition at `<from>` (empty if the
 *      source stack moved away entirely).
 *    - `<toStack>` = post-move composition at `<to>` (the moving piece
 *      + acquired prisoners).
 *    - Composition format: `T[<layer1><layer2>...]` per Task 29.1 binary
 *      serializer (`m`/`M`/`b`/`B` for white-man/white-king/black-man/
 *      black-king, bottom-first). Empty stack = `T[]`.
 *  - **Promotion:** appended `=K` (commander promotion).
 *
 * The `[stacks: ...]` annotation is verbose for typical play. A future
 * compressed form is per-game-subtask 29.G.3-C / 29.G.4-C territory.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import type { ClassifiedMove } from '../../../engine/classified/ClassifiedRuleSet';
import { createPdnNotationAdapter } from '../basePdn';
import type { Tier2NotationAdapter } from './dameo';

const STACKS_ANNOTATION_RE = /\s*\[stacks:\s*(T\[[^\]]*\])→(T\[[^\]]*\])\]\s*$/;
const PROMOTION_SUFFIX = '=K';

interface StackingOpts {
  readonly adapterKey: string;
  readonly boardGeometry: BoardGeometry;
}

export function createStackingPdnAdapter(
  opts: StackingOpts,
): Tier2NotationAdapter {
  const base = createPdnNotationAdapter({
    adapterKey: opts.adapterKey,
    boardGeometry: opts.boardGeometry,
    captureSeparator: '×',
  });

  return {
    adapterKey: opts.adapterKey,
    notate(state, move) {
      let text = base.notate(state, move);
      const captures = move.capture ?? [];
      if (captures.length > 0) {
        const fromStack = (move.meta?.['fromStack'] as string | undefined) ?? 'T[]';
        const toStack = (move.meta?.['toStack'] as string | undefined) ?? 'T[]';
        text += ` [stacks: ${fromStack}→${toStack}]`;
      }
      if (move.promotion === 'king') text += PROMOTION_SUFFIX;
      return text;
    },
    parse(state, notation) {
      let core = notation.trim();
      let promotion: 'king' | undefined;
      if (core.endsWith(PROMOTION_SUFFIX)) {
        core = core.slice(0, -PROMOTION_SUFFIX.length);
        promotion = 'king';
      }
      let fromStack: string | undefined;
      let toStack: string | undefined;
      const stacksMatch = STACKS_ANNOTATION_RE.exec(core);
      if (stacksMatch !== null) {
        fromStack = stacksMatch[1];
        toStack = stacksMatch[2];
        core = core.slice(0, stacksMatch.index);
      }
      const baseMove = base.parse(state, core);
      if (baseMove === null) return null;
      const result: ClassifiedMove = {
        ...baseMove,
        ...(promotion !== undefined ? { promotion } : {}),
      };
      if (fromStack !== undefined && toStack !== undefined) {
        return { ...result, meta: { fromStack, toStack } };
      }
      return result;
    },
  };
}

export function createLascaStackingNotationAdapter(
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  return createStackingPdnAdapter({
    adapterKey: 'lasca-stacking-pdn',
    boardGeometry,
  });
}

export function createBashniStackingNotationAdapter(
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  return createStackingPdnAdapter({
    adapterKey: 'bashni-stacking-pdn',
    boardGeometry,
  });
}
