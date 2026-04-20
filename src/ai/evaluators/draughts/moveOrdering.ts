/**
 * Variant-aware move ordering for Tier 1 Classified draughts search
 * (Task 28.5).
 *
 * Specialised `orderDraughtsMoves()` function for alpha-beta search
 * efficiency. Injected into the search via the `moveOrderingFn` hook.
 *
 * Priority (highest first):
 *  1. Previous iteration's best move (hash move) — 100,000
 *  2. King captures (more forcing than pawn captures) — 20,000+
 *  3. Multi-jump captures (sorted by capture count) — 10,000+
 *  4. Single captures — 10,000
 *  5. Promotion moves — 5,000
 *  6. Center-advancing non-capture moves — 10–20
 *  7. Other non-capture moves — 0
 */

import type { NodeId } from '../../../engine/boardGeometry';
import type { DraughtsConfig } from '../../../engine/classified/draughts/DraughtsConfig';
import type { DraughtsMove } from '../../../engine/classified/draughts/moveGen';
import { getGeometryTables } from './geometryHelpers';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Orders draughts moves for alpha-beta search efficiency.
 *
 * @param moves - Legal moves to order.
 * @param previousBestMove - Best move from the previous iteration (if any).
 * @param config - The DraughtsConfig for geometry-aware center detection.
 * @returns A new array of moves sorted by descending priority.
 */
export function orderDraughtsMoves(
  moves: readonly DraughtsMove[],
  previousBestMove: DraughtsMove | null,
  config: DraughtsConfig,
): readonly DraughtsMove[] {
  const geo = getGeometryTables(config);

  const scored: Array<{ move: DraughtsMove; sortKey: number }> = [];

  for (const move of moves) {
    let sortKey = 0;

    // 1. Previous best move.
    if (previousBestMove !== null && draughtsMoveEquals(move, previousBestMove)) {
      sortKey = 100_000;
    } else if (move.kind === 'jump') {
      // 2–4. Captures.
      const isKingCapture = move.piece === 'king';
      const captureCount = move.capture.length;

      sortKey = 10_000 + captureCount * 100;
      if (isKingCapture) {
        sortKey += 10_000;
      }
    } else {
      // 5. Promotion moves.
      if (move.promotion === 'king') {
        sortKey = 5_000;
      } else {
        // 6–7. Center-seeking heuristic for simple moves.
        const dest = parseNodeFromNotation(move.to, config);
        if (dest !== null) {
          if (geo.centerSquares.has(dest)) {
            sortKey = 20;
          } else if (geo.expandedCenterSquares.has(dest)) {
            sortKey = 10;
          }
        }
      }
    }

    scored.push({ move, sortKey });
  }

  scored.sort((a, b) => b.sortKey - a.sortKey);
  return scored.map(({ move }) => move);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Shallow equality check for DraughtsMove (from, to, capture list).
 */
function draughtsMoveEquals(a: DraughtsMove, b: DraughtsMove): boolean {
  if (a.from !== b.from || a.to !== b.to || a.kind !== b.kind) return false;
  if (a.capture.length !== b.capture.length) return false;
  for (let i = 0; i < a.capture.length; i++) {
    if (a.capture[i] !== b.capture[i]) return false;
  }
  return true;
}

/**
 * Parses a notation string into a NodeId using the config's coordinate labels.
 * Returns null if parsing fails.
 */
function parseNodeFromNotation(
  notation: string,
  config: DraughtsConfig,
): NodeId | null {
  return config.boardGeometry.coordinateLabels.parseNotation(notation);
}

export { draughtsMoveEquals };
