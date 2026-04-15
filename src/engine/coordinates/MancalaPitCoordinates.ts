/**
 * MancalaPitCoordinates — Oware (A..F / a..f + stores) and Bao (row-col).
 */

import type { CoordinateLabeler, NodeId } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';
import type { MancalaPitPreset } from '../adjacency/MancalaPitAdjacency';

export function buildMancalaPitCoordinates(preset: MancalaPitPreset): CoordinateLabeler {
  if (preset === 'oware-2x6') {
    const SOUTH = 'ABCDEF';
    const NORTH = 'abcdef';
    const tokenOf = (node: NodeId): string => {
      const idx = node as unknown as number;
      if (idx === 12) return 'store-S';
      if (idx === 13) return 'store-N';
      const row = Math.floor(idx / 6);
      const col = idx % 6;
      return row === 1 ? (SOUTH[col] ?? '?') : (NORTH[col] ?? '?');
    };
    const parse = (token: string): NodeId | null => {
      const trimmed = token.trim();
      if (trimmed === 'store-S') return asNodeId(12);
      if (trimmed === 'store-N') return asNodeId(13);
      const southIdx = SOUTH.indexOf(trimmed);
      if (southIdx >= 0) return asNodeId(6 + southIdx);
      const northIdx = NORTH.indexOf(trimmed);
      if (northIdx >= 0) return asNodeId(northIdx);
      return null;
    };
    return {
      notationOf: tokenOf,
      displayOf: tokenOf,
      ariaOf: (node) => `oware ${tokenOf(node)}`,
      parseNotation: parse,
    };
  }

  const tokenOf = (node: NodeId): string => {
    const idx = node as unknown as number;
    const row = Math.floor(idx / 8);
    const col = idx % 8;
    return `r${String(row)}c${String(col)}`;
  };
  const parse = (token: string): NodeId | null => {
    const match = /^r(\d)c(\d)$/.exec(token.trim().toLowerCase());
    if (!match) return null;
    const row = Number(match[1] ?? '');
    const col = Number(match[2] ?? '');
    if (row < 0 || row > 3 || col < 0 || col > 7) return null;
    return asNodeId(row * 8 + col);
  };
  return {
    notationOf: tokenOf,
    displayOf: tokenOf,
    ariaOf: (node) => `bao ${tokenOf(node)}`,
    parseNotation: parse,
  };
}
