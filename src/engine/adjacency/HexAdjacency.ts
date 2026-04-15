/**
 * HexAdjacency — axial coordinates (q, r) with pointy-top orientation.
 *
 * Supports two shapes:
 *   - hex-rhombus: an n×n axial parallelogram (Hex 11×11).
 *   - hex-triangular: a triangular hex board (Havannah sizes 5, 6, 8).
 *
 * Neighbors: six directions (±q, ±r, ±(q + r)). NodeId encoding: `q * 32 + r`
 * (axial values are offset by +16 to stay non-negative; both dimensions max
 * out well below 32 within the scope of Tiers 1–7).
 */

import type { AdjacencyGraph, DirectionKind, NodeId } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export interface HexAxial {
  readonly q: number;
  readonly r: number;
}

const DIRECTION_KINDS: readonly DirectionKind[] = ['hex'];

const AXIAL_OFFSET = 16;
const AXIAL_STRIDE = 64;

export const encodeAxial = (q: number, r: number): NodeId =>
  asNodeId((q + AXIAL_OFFSET) * AXIAL_STRIDE + (r + AXIAL_OFFSET));

export const decodeAxial = (node: NodeId): HexAxial => {
  const idx = node as unknown as number;
  const q = Math.floor(idx / AXIAL_STRIDE) - AXIAL_OFFSET;
  const r = (idx % AXIAL_STRIDE) - AXIAL_OFFSET;
  return { q, r };
};

const HEX_DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, -1],
  [-1, 1],
];

function buildGraph(
  nodes: readonly HexAxial[],
  inShape: (q: number, r: number) => boolean,
): AdjacencyGraph {
  const neighbors = new Map<number, NodeId[]>();
  const allNodes: NodeId[] = [];
  const nodeSet = new Set<number>();
  for (const { q, r } of nodes) {
    const id = encodeAxial(q, r);
    allNodes.push(id);
    nodeSet.add(id as unknown as number);
    const list: NodeId[] = [];
    for (const [dq, dr] of HEX_DIRS) {
      const nq = q + dq;
      const nr = r + dr;
      if (inShape(nq, nr)) list.push(encodeAxial(nq, nr));
    }
    neighbors.set(id as unknown as number, list);
  }
  return {
    directionKinds: DIRECTION_KINDS,
    ofKind(kind, node): readonly NodeId[] {
      if (kind !== 'hex') return [];
      return neighbors.get(node as unknown as number) ?? [];
    },
    listAllNodes: () => allNodes,
    hasNode: (id) => nodeSet.has(id as unknown as number),
    nodeCount: () => allNodes.length,
  };
}

export function buildHexRhombusAdjacency(size: number): AdjacencyGraph {
  const inShape = (q: number, r: number): boolean =>
    q >= 0 && q < size && r >= 0 && r < size;
  const nodes: HexAxial[] = [];
  for (let q = 0; q < size; q += 1) {
    for (let r = 0; r < size; r += 1) {
      nodes.push({ q, r });
    }
  }
  return buildGraph(nodes, inShape);
}

/**
 * Havannah hex-triangular board of `size` (edge length). Axial (q, r, s)
 * with s = -q - r; node present when max(|q|, |r|, |s|) < size.
 */
export function buildHexTriangularAdjacency(size: number): AdjacencyGraph {
  const inShape = (q: number, r: number): boolean => {
    const s = -q - r;
    const k = size - 1;
    return Math.abs(q) <= k && Math.abs(r) <= k && Math.abs(s) <= k;
  };
  const nodes: HexAxial[] = [];
  const k = size - 1;
  for (let q = -k; q <= k; q += 1) {
    for (let r = Math.max(-k, -q - k); r <= Math.min(k, -q + k); r += 1) {
      nodes.push({ q, r });
    }
  }
  return buildGraph(nodes, inShape);
}
