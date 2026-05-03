/**
 * Promotion-area predicate (Phase 4 Task 29.5).
 *
 * Pure helper that consults `config.promotionArea[owner]` to decide whether
 * a destination NodeId qualifies as a promotion square for the given side.
 *
 * Per Task 29.5 plan §1.3 / §19, the default 11-square sets per side are
 * placeholders pending Rosenau 2010 source validation. The predicate is
 * config-driven so a future correction is one config-line edit.
 */

import type { NodeId } from '../../boardGeometry';
import type { HarzdameConfig, HarzdameOwner } from './types';

export function isInPromotionArea(
  node: NodeId,
  owner: HarzdameOwner,
  config: HarzdameConfig,
): boolean {
  return config.promotionArea[owner].has(node);
}
