/**
 * Harzdame starting-position generator (Phase 4 Task 29.5).
 *
 * Per playbook §4.2: 12 men per side. Same starting layout as American Rules.
 * Convention (matches Tier 1 + Tasks 29.2/29.3/29.4): white starts at the
 * BOTTOM and moves toward lower row index (toward black at top).
 *
 * Layout:
 *   - Black: 12 men on dark squares of rows 0..2 (PDN squares 1..12, top).
 *   - White: 12 men on dark squares of rows 5..7 (PDN squares 21..32, bottom).
 *   - Empty: rows 3 and 4 (PDN squares 13..20).
 *
 * Harzdame's defining quirk is asymmetric men movement: per `types.ts` white
 * men move on `['ne', 'se']` and black men on `['sw', 'nw']`. NE = forward
 * (toward black at the top) for white; SE = backward-right. Captures fire
 * on all four diagonals for both sides, regardless of the movement set —
 * see `moveGen.ts` for the gate.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import { asNodeId } from '../../boardGeometry';
import type {
  HarzdameConfig,
  HarzdameGameState,
  HarzdameMeta,
  HarzdameOwner,
} from './types';
import { hashPosition, hashToHex } from './harzdameZobrist';

export class HarzdameStartingPositionMismatchError extends Error {
  readonly expected: number;
  readonly actual: number;
  constructor(expected: number, actual: number) {
    super(
      `[harzdame] starting-position piece count mismatch: expected ${String(expected)}, got ${String(actual)}`,
    );
    this.name = 'HarzdameStartingPositionMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

export function buildStartingState(config: HarzdameConfig): HarzdameGameState {
  const { boardSize, piecesPerSide } = config;
  const pieces = new Map<NodeId, ClassifiedPiece>();

  // Black: dark squares in rows 0..2 (top of the board).
  placeManRows(pieces, boardSize, 'black', 0, 2);
  // White: dark squares in rows 5..7 (bottom of the board).
  placeManRows(pieces, boardSize, 'white', 5, 7);

  const totalExpected = piecesPerSide * 2;
  if (pieces.size !== totalExpected) {
    throw new HarzdameStartingPositionMismatchError(totalExpected, pieces.size);
  }

  const initialHash = hashPosition(pieces, 'white', config);
  const seededEntry: readonly [string, number] = Object.freeze([
    hashToHex(initialHash),
    1,
  ]);
  const meta: HarzdameMeta = {
    turnTag: 'white',
    halfMoveClock: 0,
    repetitionTable: Object.freeze([seededEntry]),
    seniorKings: Object.freeze([]),
  };

  return {
    pieces,
    turn: 'white',
    plyCount: 0,
    moveHistory: Object.freeze([] as const),
    meta,
  };
}

function placeManRows(
  pieces: Map<NodeId, ClassifiedPiece>,
  size: number,
  owner: HarzdameOwner,
  rowStart: number,
  rowEnd: number,
): void {
  for (let r = rowStart; r <= rowEnd; r += 1) {
    for (let c = 0; c < size; c += 1) {
      // Dark squares: (r + c) % 2 === 1 per the standard convention used by
      // every other 8×8 draughts variant in the codebase.
      if ((r + c) % 2 !== 1) continue;
      pieces.set(asNodeId(r * size + c), manFor(owner));
    }
  }
}

function manFor(owner: HarzdameOwner): ClassifiedPiece {
  return Object.freeze({ owner, kind: 'man' });
}
