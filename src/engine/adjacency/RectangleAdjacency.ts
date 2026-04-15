/**
 * RectangleAdjacency — w×h grid where w ≠ h.
 *
 * Direction kinds: orthogonal, diagonal (restricted by optional
 * `diagonalsMask`, which encodes Fanorona's alternating-diagonal pattern), and
 * queen-line.
 */

import type { AdjacencyGraph, DirectionKind, NodeId, Predicate } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export interface BuildRectangleAdjacencyOptions {
  width: number;
  height: number;
  diagonalsMask?: Predicate;
}

const DIRECTION_KINDS: readonly DirectionKind[] = ['orthogonal', 'diagonal', 'queen-line'];

const ORTHO_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const DIAG_DELTAS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

export function buildRectangleAdjacency(
  opts: BuildRectangleAdjacencyOptions,
): AdjacencyGraph {
  const { width, height, diagonalsMask } = opts;
  const total = width * height;
  const ortho: NodeId[][] = Array.from({ length: total }, () => []);
  const diag: NodeId[][] = Array.from({ length: total }, () => []);
  const queen: NodeId[][] = Array.from({ length: total }, () => []);
  const allNodes: NodeId[] = [];

  const inBounds = (r: number, c: number): boolean =>
    r >= 0 && r < height && c >= 0 && c < width;

  const idOf = (r: number, c: number): NodeId => asNodeId(r * width + c);

  const hasDiagonals = (id: NodeId): boolean =>
    diagonalsMask ? diagonalsMask(id) : true;

  for (let r = 0; r < height; r += 1) {
    for (let c = 0; c < width; c += 1) {
      const id = idOf(r, c);
      allNodes.push(id);

      const orthoList: NodeId[] = [];
      for (const [dr, dc] of ORTHO_DELTAS) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) orthoList.push(idOf(nr, nc));
      }
      ortho[id as unknown as number] = orthoList;

      if (hasDiagonals(id)) {
        const diagList: NodeId[] = [];
        for (const [dr, dc] of DIAG_DELTAS) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const nid = idOf(nr, nc);
          if (hasDiagonals(nid)) diagList.push(nid);
        }
        diag[id as unknown as number] = diagList;
      }

      const queenRays: NodeId[] = [];
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ] as const) {
        let nr = r + dr;
        let nc = c + dc;
        while (inBounds(nr, nc)) {
          queenRays.push(idOf(nr, nc));
          nr += dr;
          nc += dc;
        }
      }
      queen[id as unknown as number] = queenRays;
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
          return ortho[idx] ?? [];
        case 'diagonal':
          return diag[idx] ?? [];
        case 'queen-line':
          return queen[idx] ?? [];
        default:
          return [];
      }
    },
    listAllNodes: () => allNodes,
    hasNode: (id) => nodeSet.has(id as unknown as number),
    nodeCount: () => allNodes.length,
  };
}

/** Fanorona's alternating-diagonal pattern: diagonals present only where (row + col) is even. */
export const fanoronaDiagonalsMask =
  (width: number): Predicate =>
  (node: NodeId): boolean => {
    const idx = node as unknown as number;
    const r = Math.floor(idx / width);
    const c = idx % width;
    return (r + c) % 2 === 0;
  };
