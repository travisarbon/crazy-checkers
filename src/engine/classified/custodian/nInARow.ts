/**
 * n-in-a-row detector for the custodian engine (Task 29.4).
 *
 * Used by Dai Hasami Shogi (`'reduce-below-or-line-formation'` win condition)
 * to detect 5-in-a-row formations. Configurable axes (horizontal, vertical,
 * diagonal), configurable `n`, and an `excludeRows` predicate that lets
 * Dai Hasami exclude lines lying entirely within the player's own starting
 * two ranks.
 *
 * @dedupe-with src/engine/classified/(future-tier4-gomoku)/nInARow.ts
 *
 * When Tier 4 Task 31.2 (Gomoku) ships its own n-in-a-row helper, this
 * module should be replaced by that one in a single follow-up commit. The
 * Gomoku helper is expected to be a strict superset (adding open-N counting
 * for threat detection); the Dai Hasami caller signature here is a subset.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type { CustodianOwner } from './types';

export type NInARowAxis = 'horizontal' | 'vertical' | 'diagonal';

export interface FindLinesOptions {
  readonly pieces: ReadonlyMap<NodeId, ClassifiedPiece>;
  readonly owner: CustodianOwner;
  /** Number of consecutive pieces required (5 for Dai Hasami). */
  readonly n: number;
  readonly axes: readonly NInARowAxis[];
  readonly boardSize: number;
  /**
   * Predicate returning true iff the (r, c) coordinate is "excluded" — any
   * line entirely contained within excluded squares does not count. For Dai
   * Hasami: white excludes rows 0..1, black excludes rows (size-2)..(size-1).
   */
  readonly excludeRow?: (row: number) => boolean;
}

/**
 * Returns the list of qualifying lines, each as a sorted array of NodeIds
 * (sorted ascending). A line is "qualifying" iff it consists of exactly `n`
 * consecutive friendly pieces along one of the enabled axes AND at least
 * one of its squares is NOT excluded by `excludeRow`.
 *
 * Note: a line of length > n contributes multiple n-windows (each is a
 * separate qualifying line — Dai Hasami treats any 5-window in a 6-line as
 * a winning line, but the win triggers once).
 */
export function findNInARowLines(opts: FindLinesOptions): readonly (readonly number[])[] {
  const { pieces, owner, n, axes, boardSize, excludeRow } = opts;
  if (n < 1) return [];

  const occupied = new Set<number>();
  for (const [node, piece] of pieces) {
    if (piece.owner === owner) occupied.add(node as unknown as number);
  }

  const lines: number[][] = [];

  const tryLine = (windowNodes: number[]): void => {
    if (windowNodes.length !== n) return;
    for (const idx of windowNodes) {
      if (!occupied.has(idx)) return;
    }
    if (excludeRow) {
      const allExcluded = windowNodes.every((idx) =>
        excludeRow(Math.floor(idx / boardSize)),
      );
      if (allExcluded) return;
    }
    lines.push([...windowNodes]);
  };

  if (axes.includes('horizontal')) {
    for (let r = 0; r < boardSize; r += 1) {
      for (let cStart = 0; cStart + n <= boardSize; cStart += 1) {
        const window: number[] = [];
        for (let i = 0; i < n; i += 1) window.push(r * boardSize + (cStart + i));
        tryLine(window);
      }
    }
  }
  if (axes.includes('vertical')) {
    for (let c = 0; c < boardSize; c += 1) {
      for (let rStart = 0; rStart + n <= boardSize; rStart += 1) {
        const window: number[] = [];
        for (let i = 0; i < n; i += 1) window.push((rStart + i) * boardSize + c);
        tryLine(window);
      }
    }
  }
  if (axes.includes('diagonal')) {
    // SE-diagonal (rows + cols both increasing).
    for (let r = 0; r + n <= boardSize; r += 1) {
      for (let c = 0; c + n <= boardSize; c += 1) {
        const window: number[] = [];
        for (let i = 0; i < n; i += 1) window.push((r + i) * boardSize + (c + i));
        tryLine(window);
      }
    }
    // NE-diagonal (rows decreasing, cols increasing).
    for (let r = n - 1; r < boardSize; r += 1) {
      for (let c = 0; c + n <= boardSize; c += 1) {
        const window: number[] = [];
        for (let i = 0; i < n; i += 1) window.push((r - i) * boardSize + (c + i));
        tryLine(window);
      }
    }
  }

  return Object.freeze(lines.map((l) => Object.freeze(l)));
}
