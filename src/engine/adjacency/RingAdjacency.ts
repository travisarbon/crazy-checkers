/**
 * RingAdjacency — Nine Men's Morris and Morabaraba.
 *
 * Three concentric rings (outer=0, middle=1, inner=2) of 8 points each.
 * Point index within a ring uses clockwise order starting from the top:
 * 0=top, 1=top-right, 2=right, 3=bottom-right, 4=bottom, 5=bottom-left,
 * 6=left, 7=top-left.
 *
 * NodeId = ring * 8 + position-within-ring. 24 nodes total.
 *
 * Direction kinds:
 *   - `ring-around`: clockwise/counter-clockwise neighbors on the same ring.
 *   - `ring-spoke`: cross-ring neighbors on the four spokes (positions 0, 2,
 *     4, 6). Morabaraba additionally adds diagonal spokes on positions 1, 3,
 *     5, 7 between adjacent rings.
 */

import type { AdjacencyGraph, DirectionKind, NodeId } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export interface BuildRingAdjacencyOptions {
  hasCornerDiagonals: boolean;
}

const DIRECTION_KINDS: readonly DirectionKind[] = ['ring-around', 'ring-spoke'];

export const ringNodeId = (ring: number, pos: number): NodeId => asNodeId(ring * 8 + pos);

export const decodeRingNode = (node: NodeId): { ring: number; pos: number } => {
  const idx = node as unknown as number;
  return { ring: Math.floor(idx / 8), pos: idx % 8 };
};

export function buildRingAdjacency(opts: BuildRingAdjacencyOptions): AdjacencyGraph {
  const around = new Map<number, NodeId[]>();
  const spoke = new Map<number, NodeId[]>();
  const allNodes: NodeId[] = [];

  const spokePositions = new Set<number>([0, 2, 4, 6]);
  const cornerPositions = new Set<number>([1, 3, 5, 7]);

  for (let ring = 0; ring < 3; ring += 1) {
    for (let pos = 0; pos < 8; pos += 1) {
      const id = ringNodeId(ring, pos);
      allNodes.push(id);

      const aroundList: NodeId[] = [
        ringNodeId(ring, (pos + 7) % 8),
        ringNodeId(ring, (pos + 1) % 8),
      ];
      around.set(id as unknown as number, aroundList);

      const spokeList: NodeId[] = [];
      if (spokePositions.has(pos)) {
        if (ring > 0) spokeList.push(ringNodeId(ring - 1, pos));
        if (ring < 2) spokeList.push(ringNodeId(ring + 1, pos));
      }
      if (opts.hasCornerDiagonals && cornerPositions.has(pos)) {
        if (ring > 0) spokeList.push(ringNodeId(ring - 1, pos));
        if (ring < 2) spokeList.push(ringNodeId(ring + 1, pos));
      }
      spoke.set(id as unknown as number, spokeList);
    }
  }

  const nodeSet = new Set<number>(allNodes.map((n) => n as unknown as number));

  return {
    directionKinds: DIRECTION_KINDS,
    ofKind(kind, node): readonly NodeId[] {
      const idx = node as unknown as number;
      if (!nodeSet.has(idx)) return [];
      switch (kind) {
        case 'ring-around':
          return around.get(idx) ?? [];
        case 'ring-spoke':
          return spoke.get(idx) ?? [];
        default:
          return [];
      }
    },
    listAllNodes: () => allNodes,
    hasNode: (id) => nodeSet.has(id as unknown as number),
    nodeCount: () => allNodes.length,
  };
}
