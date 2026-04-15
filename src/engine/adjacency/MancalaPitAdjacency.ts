/**
 * MancalaPitAdjacency — Oware 2×6 (+2 stores) and Bao 4×8.
 *
 * Pits are indexed row-major: id = row * cols + col. Stores follow the pit
 * block: Oware adds `store-south` = rows*cols and `store-north` = rows*cols+1.
 *
 * Direction kind `pit-chain`: returns the next pit in sowing order. The
 * sowing order is Oware's counter-clockwise (south 0..5 → north 0..5 → back)
 * and Bao's four-row serpentine (front rows 0..cols-1, back rows cols-1..0).
 */

import type { AdjacencyGraph, DirectionKind, NodeId } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export type MancalaPitPreset = 'oware-2x6' | 'bao-4x8';

const DIRECTION_KINDS: readonly DirectionKind[] = ['pit-chain'];

export interface MancalaPitBuildResult {
  readonly dimensions: {
    readonly rows: number;
    readonly cols: number;
    readonly stores: readonly ('north' | 'south')[];
    readonly sowingOrder: readonly NodeId[];
  };
  readonly graph: AdjacencyGraph;
}

function pitId(cols: number, row: number, col: number): NodeId {
  return asNodeId(row * cols + col);
}

function owareSowingOrder(): {
  rows: number;
  cols: number;
  stores: readonly ('north' | 'south')[];
  sowingOrder: NodeId[];
  allNodes: NodeId[];
} {
  const rows = 2;
  const cols = 6;
  const sowingOrder: NodeId[] = [];
  // South row (row 1), left to right — counter-clockwise motion.
  for (let c = 0; c < cols; c += 1) sowingOrder.push(pitId(cols,1, c));
  // Skip south store in pit-chain (stores are captured separately).
  // North row (row 0), right to left.
  for (let c = cols - 1; c >= 0; c -= 1) sowingOrder.push(pitId(cols,0, c));
  const allNodes = [...sowingOrder, asNodeId(rows * cols), asNodeId(rows * cols + 1)];
  return { rows, cols, stores: ['south', 'north'], sowingOrder, allNodes };
}

function baoSowingOrder(): {
  rows: number;
  cols: number;
  stores: readonly ('north' | 'south')[];
  sowingOrder: NodeId[];
  allNodes: NodeId[];
} {
  const rows = 4;
  const cols = 8;
  const sowingOrder: NodeId[] = [];
  // South player: front row (row 3) left→right, back row (row 2) right→left.
  for (let c = 0; c < cols; c += 1) sowingOrder.push(pitId(cols,3, c));
  for (let c = cols - 1; c >= 0; c -= 1) sowingOrder.push(pitId(cols,2, c));
  // North player: front row (row 0) right→left, back row (row 1) left→right.
  for (let c = cols - 1; c >= 0; c -= 1) sowingOrder.push(pitId(cols,0, c));
  for (let c = 0; c < cols; c += 1) sowingOrder.push(pitId(cols,1, c));
  const allNodes = [...sowingOrder];
  return { rows, cols, stores: [], sowingOrder, allNodes };
}

export function buildMancalaPitAdjacency(
  preset: MancalaPitPreset,
): MancalaPitBuildResult {
  const spec = preset === 'oware-2x6' ? owareSowingOrder() : baoSowingOrder();
  const chain = new Map<number, NodeId[]>();
  for (let i = 0; i < spec.sowingOrder.length; i += 1) {
    const here = spec.sowingOrder[i];
    const next = spec.sowingOrder[(i + 1) % spec.sowingOrder.length];
    if (here === undefined || next === undefined) continue;
    chain.set(here as unknown as number, [next]);
  }
  const nodeSet = new Set<number>(spec.allNodes.map((n) => n as unknown as number));

  const graph: AdjacencyGraph = {
    directionKinds: DIRECTION_KINDS,
    ofKind(kind, node): readonly NodeId[] {
      if (kind !== 'pit-chain') return [];
      return chain.get(node as unknown as number) ?? [];
    },
    listAllNodes: () => spec.allNodes,
    hasNode: (id) => nodeSet.has(id as unknown as number),
    nodeCount: () => spec.allNodes.length,
  };

  return {
    dimensions: {
      rows: spec.rows,
      cols: spec.cols,
      stores: spec.stores,
      sowingOrder: spec.sowingOrder,
    },
    graph,
  };
}
