/**
 * RingCoordinates — Nine Men's Morris.
 *
 * 24 points labeled by ring (outer/middle/inner) and position (top,
 * top-right, right, bottom-right, bottom, bottom-left, left, top-left).
 */

import type { CoordinateLabeler, NodeId } from '../boardGeometry';
import { decodeRingNode, ringNodeId } from '../adjacency/RingAdjacency';

const RINGS = ['outer', 'middle', 'inner'] as const;
const POSITIONS = [
  'top',
  'top-right',
  'right',
  'bottom-right',
  'bottom',
  'bottom-left',
  'left',
  'top-left',
] as const;

function ringName(idx: number): string {
  return RINGS[idx] ?? `ring${String(idx)}`;
}

function posName(idx: number): string {
  return POSITIONS[idx] ?? `pos${String(idx)}`;
}

export function buildRingCoordinates(): CoordinateLabeler {
  const tokenOf = (node: NodeId): string => {
    const { ring, pos } = decodeRingNode(node);
    return `${ringName(ring)}-${posName(pos)}`;
  };

  const parse = (token: string): NodeId | null => {
    const trimmed = token.trim().toLowerCase();
    for (let ring = 0; ring < RINGS.length; ring += 1) {
      for (let pos = 0; pos < POSITIONS.length; pos += 1) {
        if (`${ringName(ring)}-${posName(pos)}` === trimmed) return ringNodeId(ring, pos);
      }
    }
    return null;
  };

  return {
    notationOf: tokenOf,
    displayOf: tokenOf,
    ariaOf: (node) => `NMM ${tokenOf(node).replace(/-/g, ' ')}`,
    parseNotation: parse,
  };
}
