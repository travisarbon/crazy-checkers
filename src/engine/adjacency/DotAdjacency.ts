/**
 * DotAdjacency — Dots and Boxes on an `boxesAcross × boxesDown` grid.
 *
 * Node families (disjoint id ranges encoded with base offsets):
 *   - dots:           id = r * (w+1) + c                             (0..)
 *   - horizontal edges: id = DOT_COUNT + r * w + c                    (one per dot-row, one per box-col)
 *   - vertical edges:   id = DOT_COUNT + H_EDGE_COUNT + r * (w+1) + c
 *   - boxes:          id = DOT_COUNT + H_EDGE_COUNT + V_EDGE_COUNT + r * w + c
 *
 * Direction kinds:
 *   - `dot-edge`: from a dot, the incident edge nodes.
 *   - `box-neighbor`: from a box, the four bounding edge nodes.
 *   - `orthogonal`: from a box, the up-to-4 orthogonally adjacent box nodes.
 */

import type { AdjacencyGraph, DirectionKind, NodeId } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export interface BuildDotAdjacencyOptions {
  boxesAcross: number;
  boxesDown: number;
}

const DIRECTION_KINDS: readonly DirectionKind[] = [
  'dot-edge',
  'box-neighbor',
  'orthogonal',
];

export interface DotLayout {
  readonly boxesAcross: number;
  readonly boxesDown: number;
  readonly dotCount: number;
  readonly hEdgeCount: number;
  readonly vEdgeCount: number;
  readonly boxCount: number;
  readonly H_BASE: number;
  readonly V_BASE: number;
  readonly BOX_BASE: number;
}

export function dotLayout(opts: BuildDotAdjacencyOptions): DotLayout {
  const w = opts.boxesAcross;
  const h = opts.boxesDown;
  const dotCount = (w + 1) * (h + 1);
  const hEdgeCount = w * (h + 1);
  const vEdgeCount = (w + 1) * h;
  const boxCount = w * h;
  return {
    boxesAcross: w,
    boxesDown: h,
    dotCount,
    hEdgeCount,
    vEdgeCount,
    boxCount,
    H_BASE: dotCount,
    V_BASE: dotCount + hEdgeCount,
    BOX_BASE: dotCount + hEdgeCount + vEdgeCount,
  };
}

export const dotId = (layout: DotLayout, r: number, c: number): NodeId =>
  asNodeId(r * (layout.boxesAcross + 1) + c);

export const hEdgeId = (layout: DotLayout, r: number, c: number): NodeId =>
  asNodeId(layout.H_BASE + r * layout.boxesAcross + c);

export const vEdgeId = (layout: DotLayout, r: number, c: number): NodeId =>
  asNodeId(layout.V_BASE + r * (layout.boxesAcross + 1) + c);

export const boxId = (layout: DotLayout, r: number, c: number): NodeId =>
  asNodeId(layout.BOX_BASE + r * layout.boxesAcross + c);

export function buildDotAdjacency(opts: BuildDotAdjacencyOptions): AdjacencyGraph {
  const layout = dotLayout(opts);
  const w = layout.boxesAcross;
  const h = layout.boxesDown;
  const dotEdges = new Map<number, NodeId[]>();
  const boxEdges = new Map<number, NodeId[]>();
  const boxOrtho = new Map<number, NodeId[]>();
  const allNodes: NodeId[] = [];

  for (let r = 0; r <= h; r += 1) {
    for (let c = 0; c <= w; c += 1) {
      const id = dotId(layout, r, c);
      allNodes.push(id);
      const edges: NodeId[] = [];
      if (c < w) edges.push(hEdgeId(layout, r, c));
      if (c > 0) edges.push(hEdgeId(layout, r, c - 1));
      if (r < h) edges.push(vEdgeId(layout, r, c));
      if (r > 0) edges.push(vEdgeId(layout, r - 1, c));
      dotEdges.set(id as unknown as number, edges);
    }
  }

  for (let r = 0; r <= h; r += 1) {
    for (let c = 0; c < w; c += 1) {
      allNodes.push(hEdgeId(layout, r, c));
    }
  }
  for (let r = 0; r < h; r += 1) {
    for (let c = 0; c <= w; c += 1) {
      allNodes.push(vEdgeId(layout, r, c));
    }
  }

  for (let r = 0; r < h; r += 1) {
    for (let c = 0; c < w; c += 1) {
      const id = boxId(layout, r, c);
      allNodes.push(id);
      boxEdges.set(id as unknown as number, [
        hEdgeId(layout, r, c),
        hEdgeId(layout, r + 1, c),
        vEdgeId(layout, r, c),
        vEdgeId(layout, r, c + 1),
      ]);
      const neighbors: NodeId[] = [];
      if (r > 0) neighbors.push(boxId(layout, r - 1, c));
      if (r < h - 1) neighbors.push(boxId(layout, r + 1, c));
      if (c > 0) neighbors.push(boxId(layout, r, c - 1));
      if (c < w - 1) neighbors.push(boxId(layout, r, c + 1));
      boxOrtho.set(id as unknown as number, neighbors);
    }
  }

  const nodeSet = new Set<number>(allNodes.map((n) => n as unknown as number));

  return {
    directionKinds: DIRECTION_KINDS,
    ofKind(kind, node): readonly NodeId[] {
      const idx = node as unknown as number;
      if (!nodeSet.has(idx)) return [];
      switch (kind) {
        case 'dot-edge':
          return dotEdges.get(idx) ?? [];
        case 'box-neighbor':
          return boxEdges.get(idx) ?? [];
        case 'orthogonal':
          return boxOrtho.get(idx) ?? [];
        default:
          return [];
      }
    },
    listAllNodes: () => allNodes,
    hasNode: (id) => nodeSet.has(id as unknown as number),
    nodeCount: () => allNodes.length,
  };
}
