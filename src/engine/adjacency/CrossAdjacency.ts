/**
 * CrossAdjacency — Fox and Geese 33-point Greek cross.
 *
 * Layout (row, col) where (0, 0) is the top-left of a 7×7 bounding grid. The
 * cross covers rows/cols 2..4 fully and rows 0..1 + 5..6 only at cols 2..4.
 *
 * NodeId = row * 7 + col for points that are on the cross; absent cells are
 * not added to the graph.
 *
 * Direction kinds: orthogonal (always), diagonal (Geese variants), cross-arm
 * (movement along the arm centerline; duplicates orthogonal for the cross
 * layout and is exposed for engines that want to distinguish center-axis
 * motion from peripheral orthogonal motion).
 */

import type { AdjacencyGraph, DirectionKind, NodeId } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export interface BuildCrossAdjacencyOptions {
  includeDiagonals: boolean;
}

const DIRECTION_KINDS: readonly DirectionKind[] = ['orthogonal', 'cross-arm', 'diagonal'];

const SIZE = 7;

const onCross = (r: number, c: number): boolean => {
  if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return false;
  const inMiddle = r >= 2 && r <= 4;
  const inCenter = c >= 2 && c <= 4;
  return inMiddle || inCenter;
};

export const crossNodeId = (r: number, c: number): NodeId => asNodeId(r * SIZE + c);

export const decodeCrossNode = (node: NodeId): { r: number; c: number } => {
  const idx = node as unknown as number;
  return { r: Math.floor(idx / SIZE), c: idx % SIZE };
};

export function buildCrossAdjacency(opts: BuildCrossAdjacencyOptions): AdjacencyGraph {
  const ortho = new Map<number, NodeId[]>();
  const diag = new Map<number, NodeId[]>();
  const arm = new Map<number, NodeId[]>();
  const allNodes: NodeId[] = [];

  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      if (!onCross(r, c)) continue;
      const id = crossNodeId(r, c);
      allNodes.push(id);

      const orthoList: NodeId[] = [];
      const armList: NodeId[] = [];
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (onCross(nr, nc)) {
          orthoList.push(crossNodeId(nr, nc));
          if (c === 3 || r === 3) armList.push(crossNodeId(nr, nc));
        }
      }
      ortho.set(id as unknown as number, orthoList);
      arm.set(id as unknown as number, armList);

      const diagList: NodeId[] = [];
      if (opts.includeDiagonals) {
        for (const [dr, dc] of [
          [-1, -1],
          [-1, 1],
          [1, -1],
          [1, 1],
        ] as const) {
          const nr = r + dr;
          const nc = c + dc;
          if (onCross(nr, nc)) diagList.push(crossNodeId(nr, nc));
        }
      }
      diag.set(id as unknown as number, diagList);
    }
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
        case 'cross-arm':
          return arm.get(idx) ?? [];
        case 'diagonal':
          return diag.get(idx) ?? [];
        default:
          return [];
      }
    },
    listAllNodes: () => allNodes,
    hasNode: (id) => nodeSet.has(id as unknown as number),
    nodeCount: () => allNodes.length,
  };
}
