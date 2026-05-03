/**
 * Dameo starting-position generator (Phase 4 Task 29.2).
 *
 * Per playbook §4.1: 18 men per side in a trapezoid. White on the bottom
 * three rows: row 1 full (8 pieces, files a–h), row 2 inner 6 (b–g),
 * row 3 inner 4 (c–f). Black mirrored on the top three rows.
 *
 * Algebraic ↔ NodeId convention (matches `squareGeometry({ size: 8 })`):
 *   - Row 0 (highest NodeId at file h) corresponds to algebraic rank 8.
 *   - Row 7 (NodeId 56..63) corresponds to algebraic rank 1.
 *   - White's home rows = ranks 1–3 = NodeId rows r=5..7.
 *   - Black's home rows = ranks 6–8 = NodeId rows r=0..2.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import { asNodeId } from '../../boardGeometry';
import type {
  LinearGameState,
  LinearMeta,
  LinearMovementConfig,
  LinearOwner,
} from './types';
import { hashPosition, hashToHex } from './linearZobrist';

export class LinearStartingPositionMismatchError extends Error {
  readonly gameId: string;
  readonly expected: number;
  readonly actual: number;
  constructor(gameId: string, expected: number, actual: number) {
    super(
      `[${gameId}] starting-position piece count mismatch: expected ${String(expected)}, got ${String(actual)}`,
    );
    this.name = 'LinearStartingPositionMismatchError';
    this.gameId = gameId;
    this.expected = expected;
    this.actual = actual;
  }
}

export function buildStartingState(config: LinearMovementConfig): LinearGameState {
  const { boardSize, piecesPerSide, gameId } = config;
  const pieces = new Map<NodeId, ClassifiedPiece>();

  // Black on rows 0..2 (ranks 8..6):
  //   r=0: full (cols 0..7)
  //   r=1: inner (cols 1..6)
  //   r=2: inner (cols 2..5)
  placeBlackTrapezoid(pieces, boardSize);

  // White on rows 5..7 (ranks 3..1):
  //   r=5: inner (cols 2..5)
  //   r=6: inner (cols 1..6)
  //   r=7: full (cols 0..7)
  placeWhiteTrapezoid(pieces, boardSize);

  const total = piecesPerSide * 2;
  if (pieces.size !== total) {
    throw new LinearStartingPositionMismatchError(gameId, total, pieces.size);
  }

  const initialHash = hashPosition(pieces, 'white', config);
  const seededEntry: readonly [string, number] = Object.freeze([
    hashToHex(initialHash),
    1,
  ]);
  const meta: LinearMeta = {
    turnTag: 'white',
    halfMoveClock: 0,
    repetitionTable: Object.freeze([seededEntry]),
  };

  return {
    pieces,
    turn: 'white',
    plyCount: 0,
    moveHistory: Object.freeze([] as const),
    meta,
  };
}

function placeBlackTrapezoid(pieces: Map<NodeId, ClassifiedPiece>, size: number): void {
  // r=0: full row 0..7
  for (let c = 0; c < size; c += 1) {
    pieces.set(asNodeId(0 * size + c), manFor('black'));
  }
  // r=1: cols 1..6
  for (let c = 1; c <= 6; c += 1) {
    pieces.set(asNodeId(1 * size + c), manFor('black'));
  }
  // r=2: cols 2..5
  for (let c = 2; c <= 5; c += 1) {
    pieces.set(asNodeId(2 * size + c), manFor('black'));
  }
}

function placeWhiteTrapezoid(pieces: Map<NodeId, ClassifiedPiece>, size: number): void {
  // r=5: cols 2..5
  for (let c = 2; c <= 5; c += 1) {
    pieces.set(asNodeId(5 * size + c), manFor('white'));
  }
  // r=6: cols 1..6
  for (let c = 1; c <= 6; c += 1) {
    pieces.set(asNodeId(6 * size + c), manFor('white'));
  }
  // r=7: full row 0..7
  for (let c = 0; c < size; c += 1) {
    pieces.set(asNodeId(7 * size + c), manFor('white'));
  }
}

function manFor(owner: LinearOwner): ClassifiedPiece {
  return Object.freeze({ owner, kind: 'man' });
}
