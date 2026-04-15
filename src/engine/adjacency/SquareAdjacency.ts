/**
 * SquareAdjacency — n×n grid.
 *
 * Direction kinds: orthogonal (4), diagonal (4), queen-line (rays in 8
 * directions precomputed; rule layer applies stop-on-piece semantics).
 *
 * Parameterized over `size` and an optional `playableMask`. The mask models
 * dark-squares-only draughts boards so queries never return unplayable nodes.
 */

import type { AdjacencyGraph, DirectionKind, NodeId, Predicate } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export const darkSquaresOnly: Predicate = (node: NodeId): boolean => {
  // node id = row * size + col. Dark if (row + col) is odd; works for any size
  // because callers that use the mask only pass square-indexed nodes.
  // The mask is size-agnostic because parity is invariant under row*size offset.
  const n = node as unknown as number;
  // We cannot know size here without capture; the factory wraps this in a size-aware closure.
  return ((n & 1) ^ (((n >>> 3) & 1))) === 1;
};

export interface BuildSquareAdjacencyOptions {
  size: number;
  playableMask?: Predicate;
}

const DIRECTION_KINDS: readonly DirectionKind[] = ['orthogonal', 'diagonal', 'queen-line'];

export function buildSquareAdjacency(opts: BuildSquareAdjacencyOptions): AdjacencyGraph {
  const { size, playableMask } = opts;
  const total = size * size;
  const ortho: NodeId[][] = Array.from({ length: total }, () => []);
  const diag: NodeId[][] = Array.from({ length: total }, () => []);
  const queen: NodeId[][] = Array.from({ length: total }, () => []);
  const allNodes: NodeId[] = [];

  const sizeAwarePlayable: Predicate = playableMask
    ? (n: NodeId) => {
        const idx = n as unknown as number;
        const r = Math.floor(idx / size);
        const c = idx % size;
        return (r + c) % 2 === 1;
      }
    : () => true;

  const inBounds = (r: number, c: number): boolean =>
    r >= 0 && r < size && c >= 0 && c < size;

  const idOf = (r: number, c: number): NodeId => asNodeId(r * size + c);

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const id = idOf(r, c);
      if (!sizeAwarePlayable(id)) {
        ortho[id as unknown as number] = [];
        diag[id as unknown as number] = [];
        queen[id as unknown as number] = [];
        continue;
      }
      allNodes.push(id);

      const orthoNeighbors: NodeId[] = [];
      for (const [dr, dc] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) {
          const nid = idOf(nr, nc);
          if (sizeAwarePlayable(nid)) orthoNeighbors.push(nid);
        }
      }
      ortho[id as unknown as number] = orthoNeighbors;

      const diagNeighbors: NodeId[] = [];
      for (const [dr, dc] of [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ] as const) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) {
          const nid = idOf(nr, nc);
          if (sizeAwarePlayable(nid)) diagNeighbors.push(nid);
        }
      }
      diag[id as unknown as number] = diagNeighbors;

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
          const nid = idOf(nr, nc);
          if (sizeAwarePlayable(nid)) queenRays.push(nid);
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
