/**
 * ArcTrackCoordinates — Surakarta.
 *
 * Inner grid `a1..f6` (file = column a..f, rank = 6 - row). Arc nodes
 * labeled `arcNW1..arcNW4`, `arcNE1..arcNE4`, `arcSE1..arcSE4`,
 * `arcSW1..arcSW4`.
 */

import type { CoordinateLabeler, NodeId } from '../boardGeometry';
import { arcNodeId, innerNodeId, isArcNode } from '../adjacency/ArcTrackAdjacency';

const FILES = 'abcdef';
const ARC_CORNERS = ['NW', 'NE', 'SE', 'SW'] as const;

function cornerName(idx: number): string {
  return ARC_CORNERS[idx] ?? `corner${String(idx)}`;
}

export function buildArcTrackCoordinates(): CoordinateLabeler {
  const tokenOf = (node: NodeId): string => {
    if (isArcNode(node)) {
      const arcIndex = (node as unknown as number) - 64;
      const corner = cornerName(Math.floor(arcIndex / 4));
      const slot = (arcIndex % 4) + 1;
      return `arc${corner}${String(slot)}`;
    }
    const idx = node as unknown as number;
    const r = Math.floor(idx / 6);
    const c = idx % 6;
    return `${FILES[c] ?? '?'}${String(6 - r)}`;
  };

  const parse = (token: string): NodeId | null => {
    const trimmed = token.trim();
    const arcMatch = /^arc(NW|NE|SE|SW)(\d)$/.exec(trimmed);
    if (arcMatch) {
      const corner = arcMatch[1] ?? '';
      const slot = Number(arcMatch[2] ?? '');
      const cornerIdx = ARC_CORNERS.indexOf(corner as (typeof ARC_CORNERS)[number]);
      if (cornerIdx < 0 || slot < 1 || slot > 4) return null;
      return arcNodeId(cornerIdx * 4 + (slot - 1));
    }
    const gridMatch = /^([a-f])([1-6])$/.exec(trimmed.toLowerCase());
    if (!gridMatch) return null;
    const fileChar = gridMatch[1] ?? '';
    const rankStr = gridMatch[2] ?? '';
    const c = FILES.indexOf(fileChar);
    const rank = Number(rankStr);
    const r = 6 - rank;
    return innerNodeId(r, c);
  };

  return {
    notationOf: tokenOf,
    displayOf: tokenOf,
    ariaOf: (node) => `surakarta ${tokenOf(node)}`,
    parseNotation: parse,
  };
}
