/**
 * ArcTrackAdjacency — Surakarta.
 *
 * Layout: a 6×6 inner grid plus eight corner arc-nodes per corner pair
 * (16 arc nodes total — two "loops" at each of four corners, two nodes each
 * to represent the inbound and outbound segments).
 *
 * Node id space:
 *   - Inner grid: 0..35 (row * 6 + col).
 *   - Arc nodes: 64 + arcIndex (0..15). Kept above the inner-grid range so no
 *     collision occurs.
 *
 * Direction kinds:
 *   - `orthogonal`: standard 4-way neighbors within the inner grid.
 *   - `arc-loop`: traversal along an arc. Returns the next node on the same
 *     arc ring (inner-grid nodes expose their arc entry if they sit on an
 *     arc's endpoint; arc nodes expose the following arc node; the last arc
 *     node returns the re-entry inner-grid square).
 */

import type { AdjacencyGraph, DirectionKind, NodeId } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

const INNER_SIZE = 6;
const ARC_BASE = 64;
const DIRECTION_KINDS: readonly DirectionKind[] = ['orthogonal', 'arc-loop'];

export const innerNodeId = (r: number, c: number): NodeId => asNodeId(r * INNER_SIZE + c);
export const arcNodeId = (arcIndex: number): NodeId => asNodeId(ARC_BASE + arcIndex);

export const isArcNode = (node: NodeId): boolean =>
  (node as unknown as number) >= ARC_BASE;

/**
 * Arc-loop definitions. Each arc is an ordered list of inner-grid endpoints
 * and the two arc nodes that sit on the arc between them. Traversal order is
 * entry → arcA → arcB → exit.
 */
interface ArcLoopDef {
  entry: NodeId;
  arcA: NodeId;
  arcB: NodeId;
  exit: NodeId;
}

function defineArcs(): readonly ArcLoopDef[] {
  // Surakarta has 8 arcs (2 per corner × 4 corners). Each corner pair links
  // the outer row/column into itself via a loop at that corner.
  // For this adjacency module, we encode two arcs per corner:
  //   - outer-ring arc: joins (0, 0)↔(0, 5) via NW-arcA/B on the top side
  //     (representing the large outer loop).
  //   - inner-ring arc: joins (1, 0)↔(0, 1) via NW-arcA2/B2.
  // The encoding is schematic but internally consistent: it preserves the
  // key property that one arc traversal returns to the inner grid via a
  // specific entry square, and that capturing requires at least one arc hop.
  const arcs: ArcLoopDef[] = [];
  let arcIdx = 0;
  const corners: Array<{ r1: number; c1: number; r2: number; c2: number }> = [
    { r1: 0, c1: 0, r2: 0, c2: 5 }, // NW outer
    { r1: 1, c1: 0, r2: 0, c2: 1 }, // NW inner
    { r1: 0, c1: 5, r2: 5, c2: 5 }, // NE outer
    { r1: 0, c1: 4, r2: 1, c2: 5 }, // NE inner
    { r1: 5, c1: 5, r2: 5, c2: 0 }, // SE outer
    { r1: 4, c1: 5, r2: 5, c2: 4 }, // SE inner
    { r1: 5, c1: 0, r2: 0, c2: 0 }, // SW outer
    { r1: 5, c1: 1, r2: 4, c2: 0 }, // SW inner
  ];
  for (const corner of corners) {
    arcs.push({
      entry: innerNodeId(corner.r1, corner.c1),
      arcA: arcNodeId(arcIdx++),
      arcB: arcNodeId(arcIdx++),
      exit: innerNodeId(corner.r2, corner.c2),
    });
  }
  return arcs;
}

export function buildArcTrackAdjacency(): AdjacencyGraph {
  const ortho = new Map<number, NodeId[]>();
  const arc = new Map<number, NodeId[]>();
  const allNodes: NodeId[] = [];

  for (let r = 0; r < INNER_SIZE; r += 1) {
    for (let c = 0; c < INNER_SIZE; c += 1) {
      const id = innerNodeId(r, c);
      allNodes.push(id);
      const neighbors: NodeId[] = [];
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < INNER_SIZE && nc >= 0 && nc < INNER_SIZE) {
          neighbors.push(innerNodeId(nr, nc));
        }
      }
      ortho.set(id as unknown as number, neighbors);
      arc.set(id as unknown as number, []);
    }
  }

  const arcDefs = defineArcs();
  for (const { entry, arcA, arcB, exit } of arcDefs) {
    allNodes.push(arcA, arcB);
    arc.set(entry as unknown as number, [
      ...(arc.get(entry as unknown as number) ?? []),
      arcA,
    ]);
    arc.set(arcA as unknown as number, [arcB]);
    arc.set(arcB as unknown as number, [exit]);
    arc.set(exit as unknown as number, [...(arc.get(exit as unknown as number) ?? [])]);
    ortho.set(arcA as unknown as number, []);
    ortho.set(arcB as unknown as number, []);
  }

  const nodeSet = new Set<number>(allNodes.map((n) => n as unknown as number));

  return {
    directionKinds: DIRECTION_KINDS,
    ofKind(kind, node): readonly NodeId[] {
      const idx = node as unknown as number;
      if (!nodeSet.has(idx)) return [];
      switch (kind) {
        case 'orthogonal':
          return ortho.get(idx) ?? [];
        case 'arc-loop':
          return arc.get(idx) ?? [];
        default:
          return [];
      }
    },
    listAllNodes: () => allNodes,
    hasNode: (id) => nodeSet.has(id as unknown as number),
    nodeCount: () => allNodes.length,
  };
}
