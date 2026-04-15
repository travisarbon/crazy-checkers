/**
 * TerrainOverlayAdjacency — decorator over a base adjacency graph.
 *
 * Passes every `ofKind` / `listAllNodes` / `hasNode` / `nodeCount` call
 * straight through to the base. Overlay region queries (trap, camp, throne)
 * are attached to the `BoardGeometry` descriptor itself via the dimensions
 * block; this adjacency is purely a pass-through so rule code can treat
 * terrain-overlay geometries identically to their base at the movement layer.
 */

import type { AdjacencyGraph } from '../boardGeometry';

export function buildTerrainOverlayAdjacency(base: AdjacencyGraph): AdjacencyGraph {
  return {
    directionKinds: base.directionKinds,
    ofKind: (kind, node) => base.ofKind(kind, node),
    listAllNodes: () => base.listAllNodes(),
    hasNode: (id) => base.hasNode(id),
    nodeCount: () => base.nodeCount(),
  };
}
