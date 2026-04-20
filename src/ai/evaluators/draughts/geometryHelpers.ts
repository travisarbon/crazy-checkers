/**
 * Pre-computed geometry tables for the DraughtsEvaluator (Task 28.5).
 *
 * Builds board-size-aware and geometry-aware sets of center squares, edge
 * squares, and back rows. Each set is lazily computed once per DraughtsConfig
 * and then cached for the lifetime of the process.
 *
 * Design: all sets contain `NodeId` values so the evaluator can do O(1)
 * lookups via `Set.has()`. No heap allocations in the evaluation hot path.
 */

import type { NodeId } from '../../../engine/boardGeometry';
import { asNodeId } from '../../../engine/boardGeometry';
import type { DraughtsConfig } from '../../../engine/classified/draughts/DraughtsConfig';
import { boardSizeOf } from '../../../engine/classified/draughts/DraughtsConfig';

// ---------------------------------------------------------------------------
// Public type
// ---------------------------------------------------------------------------

export interface DraughtsGeometryTables {
  readonly boardSize: 8 | 10 | 12;
  /** Core center squares (inner 2×2 on 8×8, inner 2×2 on 10×10, etc.). */
  readonly centerSquares: ReadonlySet<NodeId>;
  /** Expanded center ring around core center. */
  readonly expandedCenterSquares: ReadonlySet<NodeId>;
  /** Edge (perimeter) squares. */
  readonly edgeSquares: ReadonlySet<NodeId>;
  /** White's starting back row nodes. */
  readonly whiteBackRow: ReadonlySet<NodeId>;
  /** Black's starting back row nodes. */
  readonly blackBackRow: ReadonlySet<NodeId>;
  /** All playable node IDs. */
  readonly playableNodes: ReadonlySet<NodeId>;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const cache = new WeakMap<DraughtsConfig, DraughtsGeometryTables>();

/**
 * Returns pre-computed geometry tables for the given variant config.
 * Cached per config reference (DraughtsConfig instances are frozen singletons).
 */
export function getGeometryTables(config: DraughtsConfig): DraughtsGeometryTables {
  const cached = cache.get(config);
  if (cached) return cached;
  const tables = buildTables(config);
  cache.set(config, tables);
  return tables;
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

function buildTables(config: DraughtsConfig): DraughtsGeometryTables {
  const size = boardSizeOf(config);
  const hasMask = config.boardGeometry.playableMask !== undefined;
  const mask = config.boardGeometry.playableMask;

  // Enumerate playable nodes.
  const playable = new Set<NodeId>();
  for (let idx = 0; idx < size * size; idx++) {
    const node = asNodeId(idx);
    if (!hasMask || (mask !== undefined && mask(node))) {
      playable.add(node);
    }
  }

  // Center squares: inner 2×2 region (or 2×2 core for larger boards).
  const center = computeCenterSquares(size, playable);
  const expandedCenter = computeExpandedCenter(size, playable, center);

  // Edge squares: perimeter of the board.
  const edge = computeEdgeSquares(size, playable);

  // Back rows: row 0 for black, row (size-1) for white.
  const whiteBack = computeRowNodes(size - 1, size, playable);
  const blackBack = computeRowNodes(0, size, playable);

  return {
    boardSize: size,
    centerSquares: center,
    expandedCenterSquares: expandedCenter,
    edgeSquares: edge,
    whiteBackRow: whiteBack,
    blackBackRow: blackBack,
    playableNodes: playable,
  };
}

// ---------------------------------------------------------------------------
// Center computation
// ---------------------------------------------------------------------------

/**
 * Core center squares: the innermost 2×2 area of the board.
 * For even-sized boards (all Tier 1), this is rows [N/2-1, N/2],
 * cols [N/2-1, N/2], filtered to playable squares.
 */
function computeCenterSquares(
  size: number,
  playable: ReadonlySet<NodeId>,
): ReadonlySet<NodeId> {
  const mid = size / 2;
  const result = new Set<NodeId>();
  for (let r = mid - 1; r <= mid; r++) {
    for (let c = mid - 1; c <= mid; c++) {
      const node = asNodeId(r * size + c);
      if (playable.has(node)) result.add(node);
    }
  }
  return result;
}

/**
 * Expanded center: one ring beyond the core center.
 * Rows [N/2-2, N/2+1], cols [N/2-2, N/2+1], minus the core center itself.
 */
function computeExpandedCenter(
  size: number,
  playable: ReadonlySet<NodeId>,
  core: ReadonlySet<NodeId>,
): ReadonlySet<NodeId> {
  const mid = size / 2;
  const result = new Set<NodeId>();
  for (let r = mid - 2; r <= mid + 1; r++) {
    for (let c = mid - 2; c <= mid + 1; c++) {
      if (r < 0 || r >= size || c < 0 || c >= size) continue;
      const node = asNodeId(r * size + c);
      if (playable.has(node) && !core.has(node)) result.add(node);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Edge computation
// ---------------------------------------------------------------------------

function computeEdgeSquares(
  size: number,
  playable: ReadonlySet<NodeId>,
): ReadonlySet<NodeId> {
  const result = new Set<NodeId>();
  for (let idx = 0; idx < size * size; idx++) {
    const r = Math.floor(idx / size);
    const c = idx % size;
    if (r === 0 || r === size - 1 || c === 0 || c === size - 1) {
      const node = asNodeId(idx);
      if (playable.has(node)) result.add(node);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Row computation
// ---------------------------------------------------------------------------

function computeRowNodes(
  row: number,
  size: number,
  playable: ReadonlySet<NodeId>,
): ReadonlySet<NodeId> {
  const result = new Set<NodeId>();
  for (let c = 0; c < size; c++) {
    const node = asNodeId(row * size + c);
    if (playable.has(node)) result.add(node);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Advancement helpers
// ---------------------------------------------------------------------------

/**
 * Returns pawn advancement (0-based row progress toward promotion).
 *
 * White advances from high rows toward row 0 (promotion row).
 * Black advances from low rows toward row (size-1) (promotion row).
 *
 * Returns a value in [0, size-1]; the evaluator multiplies by
 * `advancementPerRow / advancementBoardSizeNormaliser`.
 */
export function getPawnAdvancement(
  nodeId: NodeId,
  owner: 'white' | 'black',
  boardSize: number,
): number {
  const row = Math.floor((nodeId as number) / boardSize);
  if (owner === 'white') {
    // White starts at high rows, advances toward row 0.
    return boardSize - 1 - row;
  }
  // Black starts at low rows, advances toward the last row.
  return row;
}

/**
 * Returns the number of reachable empty squares in all directions from a
 * king's position. Used for flying king mobility bonus.
 *
 * Counts steps along each direction until hitting a piece or the board edge.
 * Only counts empty squares (stops at the first occupied square).
 */
export function countKingRayMobility(
  nodeId: NodeId,
  directions: readonly (readonly [number, number])[],
  boardSize: number,
  occupied: ReadonlySet<NodeId>,
  playable: ReadonlySet<NodeId>,
): number {
  let count = 0;
  const idx = nodeId as number;
  const r = Math.floor(idx / boardSize);
  const c = idx % boardSize;

  for (const [dr, dc] of directions) {
    let nr = r + dr;
    let nc = c + dc;
    while (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
      const target = asNodeId(nr * boardSize + nc);
      if (!playable.has(target)) break;
      if (occupied.has(target)) break;
      count++;
      nr += dr;
      nc += dc;
    }
  }

  return count;
}

/**
 * Direction deltas for diagonal movement.
 */
export const DIAGONAL_DELTAS: readonly (readonly [number, number])[] = Object.freeze([
  [-1, -1], [-1, 1], [1, -1], [1, 1],
]);

/**
 * Direction deltas for orthogonal movement.
 */
export const ORTHOGONAL_DELTAS: readonly (readonly [number, number])[] = Object.freeze([
  [-1, 0], [1, 0], [0, -1], [0, 1],
]);

/**
 * Direction deltas for all 8 directions.
 */
export const ALL_DELTAS: readonly (readonly [number, number])[] = Object.freeze([
  ...DIAGONAL_DELTAS,
  ...ORTHOGONAL_DELTAS,
]);

/**
 * Returns the appropriate direction deltas for a king based on the config's
 * kingMoveDirections.
 */
export function getKingDirectionDeltas(
  config: DraughtsConfig,
): readonly (readonly [number, number])[] {
  const dirs = config.kingMoveDirections;
  const deltas: [number, number][] = [];

  const DELTA_MAP: Record<string, [number, number]> = {
    nw: [-1, -1],
    n: [-1, 0],
    ne: [-1, 1],
    w: [0, -1],
    e: [0, 1],
    sw: [1, -1],
    s: [1, 0],
    se: [1, 1],
  };

  for (const dir of dirs) {
    const delta = DELTA_MAP[dir];
    if (delta) deltas.push(delta);
  }
  return deltas;
}

/**
 * Counts king escape squares (adjacent empty playable squares).
 * Used for trapped king penalty.
 */
export function countKingEscapes(
  nodeId: NodeId,
  directionDeltas: readonly (readonly [number, number])[],
  boardSize: number,
  occupied: ReadonlySet<NodeId>,
  playableNodes: ReadonlySet<NodeId>,
): number {
  let escapes = 0;
  const idx = nodeId as number;
  const r = Math.floor(idx / boardSize);
  const c = idx % boardSize;

  for (const [dr, dc] of directionDeltas) {
    const nr = r + dr;
    const nc = c + dc;
    if (nr >= 0 && nr < boardSize && nc >= 0 && nc < boardSize) {
      const target = asNodeId(nr * boardSize + nc);
      if (playableNodes.has(target) && !occupied.has(target)) {
        escapes++;
      }
    }
  }
  return escapes;
}
