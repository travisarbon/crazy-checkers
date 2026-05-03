/**
 * Tier 2 notation aggregator (Phase 4 Task 29.8).
 *
 * Single entry point `getTier2NotationAdapter(gameId, boardGeometry)`
 * that returns the correct per-game `NotationAdapter` for any of the 10
 * Tier 2 games. Mirrors the Tier 1 layout in
 * `src/cogitate/notation/index.ts`.
 *
 * Per plan §3 — Cogitate Replay consumes the adapter via the rule-set's
 * `notationAdapter` field; this aggregator is the source of truth for
 * which factory to call when constructing a per-game registration.
 */

import type { BoardGeometry } from '../../../engine/boardGeometry';
import type { ClassifiedGameId } from '../../../engine/classified/ClassifiedRuleSet';
import type { Tier2NotationAdapter } from './dameo';

import { createDameoNotationAdapter } from './dameo';
import { createHarzdameNotationAdapter } from './harzdame';
import { createLascaStackingNotationAdapter } from './lasca';
import { createBashniStackingNotationAdapter } from './bashni';
import { createZammaNotationAdapter } from './zamma';
import { createMakYekNotationAdapter } from './makYek';
import { createHasamiShogiNotationAdapter } from './hasamiShogi';
import { createRekNotationAdapter } from './rek';
import { createDaiHasamiShogiNotationAdapter } from './daiHasamiShogi';
import { createCheskersNotationAdapter } from './cheskers';

export {
  createDameoNotationAdapter,
  createHarzdameNotationAdapter,
  createLascaStackingNotationAdapter,
  createBashniStackingNotationAdapter,
  createZammaNotationAdapter,
  createMakYekNotationAdapter,
  createHasamiShogiNotationAdapter,
  createRekNotationAdapter,
  createDaiHasamiShogiNotationAdapter,
  createCheskersNotationAdapter,
};
export { shogiCoordinateLabeler } from './shogiCoords';
export type { Tier2NotationAdapter };

export function getTier2NotationAdapter(
  gameId: ClassifiedGameId,
  boardGeometry: BoardGeometry,
): Tier2NotationAdapter {
  const id = gameId as unknown as string;
  switch (id) {
    case 'dameo':
      return createDameoNotationAdapter(boardGeometry);
    case 'harzdame':
      return createHarzdameNotationAdapter(boardGeometry);
    case 'lasca':
      return createLascaStackingNotationAdapter(boardGeometry);
    case 'bashni':
      return createBashniStackingNotationAdapter(boardGeometry);
    case 'zamma':
      return createZammaNotationAdapter(boardGeometry);
    case 'mak-yek':
      return createMakYekNotationAdapter(boardGeometry);
    case 'hasami-shogi':
      return createHasamiShogiNotationAdapter(boardGeometry);
    case 'rek':
      return createRekNotationAdapter(boardGeometry);
    case 'dai-hasami-shogi':
      return createDaiHasamiShogiNotationAdapter(boardGeometry);
    case 'cheskers':
      return createCheskersNotationAdapter(boardGeometry);
    default:
      throw new Error(`getTier2NotationAdapter: unknown Tier 2 gameId "${id}"`);
  }
}
