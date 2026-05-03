/**
 * Dameo phalanx-selection helper (Phase 4 Task 29.G.1-B §8.1).
 *
 * Pure-TypeScript helpers consumed by the `<PhalanxHighlightOverlay>`
 * UI component (deferred to a follow-up subtask) and by the Cogitate
 * Replay's hover-aware move-list rendering.
 *
 * The helpers wrap `detectPhalanxes` (from the engine) with a
 * **hover-aware filter**: given a hovered NodeId, return every phalanx
 * containing that node whose head-target is on-board + empty (i.e., the
 * advance is legal). Filters out off-board / blocked heads.
 *
 * Per plan §8.1: the React component (`PhalanxHighlightOverlay.tsx`)
 * consumes these helpers via a thin wrapper. This file ships the
 * algorithmic core so it can be unit-tested without rendering.
 */

import type { NodeId } from '../../engine/boardGeometry';
import type {
  LinearGameState,
  LinearMovementConfig,
  LinearOwner,
} from '../../engine/classified/linear/types';
import {
  detectPhalanxes,
  type Phalanx,
} from '../../engine/classified/linear/Phalanx';

export interface PhalanxSelectionState {
  readonly hoveredNodeId: NodeId | null;
  readonly availablePhalanxes: readonly Phalanx[];
}

export const EMPTY_PHALANX_SELECTION: PhalanxSelectionState = Object.freeze({
  hoveredNodeId: null,
  availablePhalanxes: Object.freeze([]),
});

/**
 * Compute the available phalanxes that include the hovered NodeId AND
 * whose head-target square is empty (i.e., the phalanx-advance would be
 * legal). Off-board / blocked heads are filtered out.
 *
 * If `hoveredNodeId` is null, returns the empty selection.
 *
 * The function does NOT consider capture obligation — the move
 * generator's filter at the top level decides whether the phalanx-
 * advance survives the capture-mandatory rule. The overlay shows
 * the geometric availability; the user clicks to commit and the
 * engine validates legality.
 */
export function computePhalanxSelection(
  state: LinearGameState,
  config: LinearMovementConfig,
  owner: LinearOwner,
  hoveredNodeId: NodeId | null,
): PhalanxSelectionState {
  if (hoveredNodeId === null) return EMPTY_PHALANX_SELECTION;
  const allPhalanxes = detectPhalanxes(state, config, owner);
  const hoveredIdx = hoveredNodeId as unknown as number;
  const matching = allPhalanxes.filter((p) => {
    if (p.headTarget === null) return false;
    if (state.pieces.has(p.headTarget)) return false;
    return p.members.some((m) => (m as unknown as number) === hoveredIdx);
  });
  return Object.freeze({
    hoveredNodeId,
    availablePhalanxes: Object.freeze(matching),
  });
}

/**
 * Returns true iff the position has at least one phalanx of size ≥ 2 for
 * the given owner — useful for skipping the overlay rendering when the
 * board has no candidate phalanxes (early-game positions on a sparse
 * board).
 */
export function hasAnyPhalanx(
  state: LinearGameState,
  config: LinearMovementConfig,
  owner: LinearOwner,
): boolean {
  const all = detectPhalanxes(state, config, owner);
  return all.some((p) => p.members.length >= 2);
}
