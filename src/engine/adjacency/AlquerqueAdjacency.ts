/**
 * AlquerqueAdjacency — intersection-based graph for alquerque-family boards
 * (Phase 4 Task 29.3).
 *
 * Direction kinds: orthogonal (always present between in-bounds neighbors in
 * the same row or column) and diagonal (present only where the
 * `diagonalPattern` predicate returns true on the source endpoint; for the
 * canonical Zamma `'alternating'` pattern, this is `(r + c) % 2 === 0`).
 *
 * The diagonal pattern is parameterised so Bagh-Chal (5×5) and any future
 * full-diagonal alquerque variant can flip a config flag rather than fork
 * the module. `'queen-line'` is intentionally NOT exposed — alquerque
 * movement is single-step only; flying-piece variants build flying logic on
 * top of the orthogonal/diagonal sub-graph at the engine layer.
 *
 * Authoritative references:
 *  - Documentation/Phase 4/Task 29/Task_29_3_AlquerqueGridEngine_Implementation_Plan.md §5.1
 *  - Documentation/Playbooks/Crazy_Checkers_Phase_4_Tier_2_Classified_Playbook.md §3.5, §5.2
 *  - src/engine/adjacency/RectangleAdjacency.ts — `fanoronaDiagonalsMask` precedent.
 */

import type { AdjacencyGraph, DirectionKind, NodeId } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export type AlquerqueDiagonalPattern = 'alternating' | 'full';

export interface BuildAlquerqueAdjacencyOptions {
  /** Board side length (9 for Zamma, 5 for Bagh-Chal). */
  readonly size: number;
  readonly diagonalPattern: AlquerqueDiagonalPattern;
}

const DIRECTION_KINDS: readonly DirectionKind[] = Object.freeze(['orthogonal', 'diagonal']);

const ORTHO_DELTAS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]);
const DIAG_DELTAS: ReadonlyArray<readonly [number, number]> = Object.freeze([
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
]);

/**
 * Returns true iff the alternating-diagonal pattern places a diagonal at
 * `(r, c)` — i.e., `(r + c) % 2 === 0`. The parity is preserved across
 * diagonal moves (`(r ± 1) + (c ± 1) ≡ r + c (mod 2)`), so the predicate
 * suffices on the source endpoint alone.
 */
export function alternatingDiagonalAt(r: number, c: number): boolean {
  return (r + c) % 2 === 0;
}

export function buildAlquerqueAdjacency(
  opts: BuildAlquerqueAdjacencyOptions,
): AdjacencyGraph {
  const { size, diagonalPattern } = opts;
  const total = size * size;
  const ortho: NodeId[][] = Array.from({ length: total }, () => []);
  const diag: NodeId[][] = Array.from({ length: total }, () => []);
  const allNodes: NodeId[] = [];

  const inBounds = (r: number, c: number): boolean =>
    r >= 0 && r < size && c >= 0 && c < size;
  const idOf = (r: number, c: number): NodeId => asNodeId(r * size + c);

  const hasDiagonalsAt = (r: number, c: number): boolean => {
    if (diagonalPattern === 'full') return true;
    return alternatingDiagonalAt(r, c);
  };

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const id = idOf(r, c);
      allNodes.push(id);

      const orthoList: NodeId[] = [];
      for (const [dr, dc] of ORTHO_DELTAS) {
        const nr = r + dr;
        const nc = c + dc;
        if (inBounds(nr, nc)) orthoList.push(idOf(nr, nc));
      }
      ortho[id as unknown as number] = orthoList;

      if (hasDiagonalsAt(r, c)) {
        const diagList: NodeId[] = [];
        for (const [dr, dc] of DIAG_DELTAS) {
          const nr = r + dr;
          const nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          if (!hasDiagonalsAt(nr, nc)) continue;
          diagList.push(idOf(nr, nc));
        }
        diag[id as unknown as number] = diagList;
      }
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
        default:
          return [];
      }
    },
    listAllNodes: () => allNodes,
    hasNode: (id) => nodeSet.has(id as unknown as number),
    nodeCount: () => allNodes.length,
  };
}
