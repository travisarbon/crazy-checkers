/**
 * Stacking-draughts board geometries (Phase 4 Task 29.1).
 *
 * Provides the two `BoardGeometry` instances Lasca (7×7) and Bashni (8×8) need
 * to construct their rule sets and unit-test. The 8×8 case reuses the engine's
 * `squareGeometry({ size: 8, indexing: 'squares', playableMask: …, variant:
 * 'pdn-8' })` helper unchanged. The 7×7 case is hand-built because the
 * existing `SquareAdjacency` and `SquareCoordinates` helpers hardcode
 * `(r+c) % 2 === 1` as the dark predicate, which yields 24 dark squares on a
 * 7×7 board — the wrong parity for Lasca, which uses 25 dark squares with the
 * bottom-left corner as a playable dark square (parity 0).
 *
 * Hand-building Lasca's geometry inside the stacking module avoids touching
 * the shared `SquareAdjacency`/`SquareCoordinates` helpers (the Task 29.1 plan
 * §13 explicitly limits cross-cutting changes). For other 7×7 boards in
 * future tiers, lifting this geometry into `boardGeometry.ts` would be the
 * natural follow-up — the implementation here is intentionally close to the
 * shared helpers' shape so that promotion is mechanical.
 */

import type {
  AdjacencyGraph,
  BoardGeometry,
  CoordinateLabeler,
  DirectionKind,
  NodeId,
  Predicate,
} from '../../boardGeometry';
import { asNodeId, squareGeometry } from '../../boardGeometry';

const DIRECTION_KINDS: readonly DirectionKind[] = ['orthogonal', 'diagonal', 'queen-line'];

const FILE_LETTERS = 'abcdefg';

interface CustomSquareGeometryOpts {
  readonly size: number;
  readonly darkParity: 0 | 1;
  readonly serializedKey: string;
  readonly familyLabel: string;
}

function buildCustomSquareGeometry(opts: CustomSquareGeometryOpts): BoardGeometry {
  const { size, darkParity, serializedKey, familyLabel } = opts;

  const playableMask: Predicate = (n) => {
    const idx = n as unknown as number;
    const r = Math.floor(idx / size);
    const c = idx % size;
    return (r + c) % 2 === darkParity;
  };

  const adjacency = buildSquareAdjacencyWithMask({ size, playableMask });
  const coordinateLabels = buildSquareCoordinatesWithMask({
    size,
    familyLabel,
    playableMask,
  });

  return {
    kind: 'square',
    dimensions: { square: { size } },
    indexing: 'squares',
    adjacency,
    coordinateLabels,
    serializedKey,
    playableMask,
  };
}

interface AdjacencyOpts {
  readonly size: number;
  readonly playableMask: Predicate;
}

function buildSquareAdjacencyWithMask(opts: AdjacencyOpts): AdjacencyGraph {
  const { size, playableMask } = opts;
  const total = size * size;
  const ortho: NodeId[][] = Array.from({ length: total }, () => []);
  const diag: NodeId[][] = Array.from({ length: total }, () => []);
  const queen: NodeId[][] = Array.from({ length: total }, () => []);
  const allNodes: NodeId[] = [];

  const inBounds = (r: number, c: number): boolean =>
    r >= 0 && r < size && c >= 0 && c < size;
  const idOf = (r: number, c: number): NodeId => asNodeId(r * size + c);

  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const id = idOf(r, c);
      if (!playableMask(id)) continue;
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
        if (!inBounds(nr, nc)) continue;
        const nid = idOf(nr, nc);
        if (playableMask(nid)) orthoNeighbors.push(nid);
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
        if (!inBounds(nr, nc)) continue;
        const nid = idOf(nr, nc);
        if (playableMask(nid)) diagNeighbors.push(nid);
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
          if (playableMask(nid)) queenRays.push(nid);
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

interface CoordsOpts {
  readonly size: number;
  readonly familyLabel: string;
  readonly playableMask: Predicate;
}

function buildSquareCoordinatesWithMask(opts: CoordsOpts): CoordinateLabeler {
  const { size, familyLabel, playableMask } = opts;

  const pdnByNode = new Map<number, number>();
  const nodeByPdn = new Map<number, NodeId>();
  let counter = 1;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const id = asNodeId(r * size + c);
      if (!playableMask(id)) continue;
      pdnByNode.set(id as unknown as number, counter);
      nodeByPdn.set(counter, id);
      counter += 1;
    }
  }

  const algebraicOf = (node: NodeId): string => {
    const idx = node as unknown as number;
    const r = Math.floor(idx / size);
    const c = idx % size;
    const file = FILE_LETTERS[c] ?? `col${String(c)}`;
    const rank = size - r;
    return `${file}${String(rank)}`;
  };

  const parseAlgebraic = (token: string): NodeId | null => {
    const match = /^([a-g])(\d{1,2})$/.exec(token.trim().toLowerCase());
    if (!match) return null;
    const fileChar = match[1] ?? '';
    const rankStr = match[2] ?? '';
    const file = FILE_LETTERS.indexOf(fileChar);
    const rank = Number(rankStr);
    if (file < 0 || file >= size) return null;
    if (!Number.isFinite(rank) || rank < 1 || rank > size) return null;
    const r = size - rank;
    return asNodeId(r * size + file);
  };

  return {
    notationOf: (node) => {
      const n = pdnByNode.get(node as unknown as number);
      return n !== undefined ? String(n) : algebraicOf(node);
    },
    displayOf: (node) => algebraicOf(node),
    ariaOf: (node) => `${familyLabel} ${algebraicOf(node)}`,
    parseNotation: (token) => {
      const n = Number(token);
      if (Number.isInteger(n)) {
        const found = nodeByPdn.get(n);
        if (found !== undefined) return found;
      }
      return parseAlgebraic(token);
    },
  };
}

// ---------------------------------------------------------------------------
// Singleton accessors
// ---------------------------------------------------------------------------

let LASCA_GEOM_CACHE: BoardGeometry | null = null;
let BASHNI_GEOM_CACHE: BoardGeometry | null = null;

/** 7×7 dark-only board for Lasca. Parity 0 ⇒ 25 playable dark squares. */
export function lascaBoardGeometry(): BoardGeometry {
  if (LASCA_GEOM_CACHE) return LASCA_GEOM_CACHE;
  LASCA_GEOM_CACHE = buildCustomSquareGeometry({
    size: 7,
    darkParity: 0,
    serializedKey: 'square-7x7-dark-pdn',
    familyLabel: 'lasca',
  });
  return LASCA_GEOM_CACHE;
}

/**
 * 8×8 dark-only board for Bashni. Reuses the shared `squareGeometry` helper
 * (parity 1 matches the helper's hardcoded check, so the call returns the
 * standard 32-square draughts geometry).
 */
export function bashniBoardGeometry(): BoardGeometry {
  if (BASHNI_GEOM_CACHE) return BASHNI_GEOM_CACHE;
  const playableMask: Predicate = (n) => {
    const idx = n as unknown as number;
    const r = Math.floor(idx / 8);
    const c = idx % 8;
    return (r + c) % 2 === 1;
  };
  BASHNI_GEOM_CACHE = squareGeometry({
    size: 8,
    indexing: 'squares',
    playableMask,
    variant: 'pdn-8',
  });
  return BASHNI_GEOM_CACHE;
}
