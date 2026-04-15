/**
 * SquareCoordinates — PDN numbering for dark-squares-only draughts boards and
 * algebraic `a1..` labels for full-square games (Go, Tak, Shogi, etc.).
 *
 * PDN: squares numbered 1..32 for 8×8, 1..50 for 10×10, 1..72 for 12×12
 * (Canadian), counting dark squares row by row starting from the top row
 * (Black's back rank).
 *
 * Algebraic: files a..* left-to-right, ranks 1..n bottom-to-top.
 *
 * ARIA labels: "${family} ${alias}".
 */

import type { CoordinateLabeler, NodeId, Predicate } from '../boardGeometry';
import { asNodeId } from '../boardGeometry';

export interface BuildSquareCoordinatesOptions {
  size: number;
  indexing: 'squares' | 'intersections';
  playableMask?: Predicate;
  variant?: 'standard' | 'pdn-8' | 'pdn-10' | 'pdn-12';
}

const FILE_LETTERS = 'abcdefghijklmnopqrs';

export function buildSquareCoordinates(
  opts: BuildSquareCoordinatesOptions,
): CoordinateLabeler {
  const { size, playableMask, variant } = opts;
  const family = playableMask ? 'draughts' : 'square';
  const isPdn = variant !== undefined && variant.startsWith('pdn-');

  const pdnByNode = new Map<number, number>();
  const nodeByPdn = new Map<number, NodeId>();
  if (isPdn) {
    let counter = 1;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if ((r + c) % 2 !== 1) continue;
        const id = asNodeId(r * size + c);
        pdnByNode.set(id as unknown as number, counter);
        nodeByPdn.set(counter, id);
        counter += 1;
      }
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
    const match = /^([a-s])(\d{1,2})$/.exec(token.trim().toLowerCase());
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
      if (isPdn) {
        const n = pdnByNode.get(node as unknown as number);
        return n !== undefined ? String(n) : algebraicOf(node);
      }
      return algebraicOf(node);
    },
    displayOf: (node) => algebraicOf(node),
    ariaOf: (node) => `${family} ${algebraicOf(node)}`,
    parseNotation: (token) => {
      if (isPdn) {
        const n = Number(token);
        if (Number.isInteger(n)) {
          const found = nodeByPdn.get(n);
          if (found !== undefined) return found;
        }
      }
      return parseAlgebraic(token);
    },
  };
}
