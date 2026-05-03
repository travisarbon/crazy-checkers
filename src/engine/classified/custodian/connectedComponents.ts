/**
 * Connected-components flood-fill for the custodian engine (Task 29.4).
 *
 * Pure helper used by `captureDetectors.findImmobilizationCaptures` (Rek)
 * and exported under a stable name for per-game subtask 29.G.8-B's
 * immobilization-warning overlay. Adjacency is 4-neighbor orthogonal
 * (matching Rek's slide movement primitive — no diagonal connections in
 * the immobilization graph).
 *
 * Pure function: input pieces map is never mutated; output components are
 * sorted (component-internal NodeIds ascending; component order by
 * lowest NodeId of each component).
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { CustodianOwner } from './types';

export interface Component {
  readonly owner: CustodianOwner;
  /** Sorted list of NodeIds in this component. */
  readonly nodes: readonly NodeId[];
}

/**
 * Partition the pieces of `owner` into 4-neighbor connected components.
 * `boardSize` controls the row/col arithmetic.
 */
export function findConnectedComponents(
  pieces: ReadonlyMap<NodeId, ClassifiedPiece>,
  owner: CustodianOwner,
  boardSize: number,
): readonly Component[] {
  const ownerNodes = new Set<number>();
  for (const [nodeId, piece] of pieces) {
    if (piece.owner === owner) ownerNodes.add(nodeId as unknown as number);
  }

  const visited = new Set<number>();
  const components: Component[] = [];

  // Sort start nodes ascending so component order is deterministic.
  const sortedStarts = [...ownerNodes].sort((a, b) => a - b);

  for (const start of sortedStarts) {
    if (visited.has(start)) continue;
    const componentNodes: number[] = [];
    const queue: number[] = [start];
    while (queue.length > 0) {
      const cur = queue.shift() as number;
      if (visited.has(cur)) continue;
      visited.add(cur);
      componentNodes.push(cur);
      const r = Math.floor(cur / boardSize);
      const c = cur % boardSize;
      const neighbors: number[] = [];
      if (r > 0) neighbors.push((r - 1) * boardSize + c);
      if (r < boardSize - 1) neighbors.push((r + 1) * boardSize + c);
      if (c > 0) neighbors.push(r * boardSize + (c - 1));
      if (c < boardSize - 1) neighbors.push(r * boardSize + (c + 1));
      for (const n of neighbors) {
        if (ownerNodes.has(n) && !visited.has(n)) queue.push(n);
      }
    }
    componentNodes.sort((a, b) => a - b);
    components.push({
      owner,
      nodes: Object.freeze(componentNodes.map((n) => n as unknown as NodeId)),
    });
  }

  return components;
}
