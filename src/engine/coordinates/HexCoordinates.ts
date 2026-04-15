/**
 * HexCoordinates — axial (q, r) with pointy-top orientation.
 *
 * Notation: `q,r` canonical form. Display: `${fileLetter}${rank}` aliases
 * where file = q (a..k for 11×11 Hex) and rank = r + 1.
 *
 * Reference: Red Blob Games, "Hexagonal Grids" (pointy-top, axial).
 */

import type { CoordinateLabeler, NodeId } from '../boardGeometry';
import { decodeAxial, encodeAxial } from '../adjacency/HexAdjacency';

const FILE_LETTERS = 'abcdefghijklmnopqrs';

export function buildHexRhombusCoordinates(size: number): CoordinateLabeler {
  const family = `hex-rhombus-${String(size)}`;
  return {
    notationOf: (node: NodeId) => {
      const { q, r } = decodeAxial(node);
      return `${String(q)},${String(r)}`;
    },
    displayOf: (node: NodeId) => {
      const { q, r } = decodeAxial(node);
      const file = FILE_LETTERS[q] ?? `col${String(q)}`;
      return `${file}${String(r + 1)}`;
    },
    ariaOf: (node: NodeId) => {
      const { q, r } = decodeAxial(node);
      return `${family} q${String(q)} r${String(r)}`;
    },
    parseNotation: (token) => {
      const trimmed = token.trim().toLowerCase();
      const axial = /^(-?\d+),(-?\d+)$/.exec(trimmed);
      if (axial) {
        const q = Number(axial[1] ?? '');
        const r = Number(axial[2] ?? '');
        if (q < 0 || q >= size || r < 0 || r >= size) return null;
        return encodeAxial(q, r);
      }
      const alias = /^([a-s])(\d{1,2})$/.exec(trimmed);
      if (alias) {
        const q = FILE_LETTERS.indexOf(alias[1] ?? '');
        const r = Number(alias[2] ?? '') - 1;
        if (q < 0 || q >= size || r < 0 || r >= size) return null;
        return encodeAxial(q, r);
      }
      return null;
    },
  };
}

export function buildHexTriangularCoordinates(
  size: 5 | 6 | 8,
): CoordinateLabeler {
  const family = `hex-triangular-${String(size)}`;
  const k = size - 1;
  return {
    notationOf: (node: NodeId) => {
      const { q, r } = decodeAxial(node);
      return `${String(q)},${String(r)}`;
    },
    displayOf: (node: NodeId) => {
      const { q, r } = decodeAxial(node);
      return `${String(q)},${String(r)}`;
    },
    ariaOf: (node: NodeId) => {
      const { q, r } = decodeAxial(node);
      return `${family} q${String(q)} r${String(r)}`;
    },
    parseNotation: (token) => {
      const trimmed = token.trim().toLowerCase();
      const axial = /^(-?\d+),(-?\d+)$/.exec(trimmed);
      if (!axial) return null;
      const q = Number(axial[1] ?? '');
      const r = Number(axial[2] ?? '');
      const s = -q - r;
      if (Math.abs(q) > k || Math.abs(r) > k || Math.abs(s) > k) return null;
      return encodeAxial(q, r);
    },
  };
}
