/**
 * Zamma starting-position generator (Phase 4 Task 29.3).
 *
 * Per playbook §4.5: 40 men per side. The playbook does not pin which half
 * of the board is white's; this engine follows the project-wide convention
 * (Tier 1 + Task 29.2 LinearMovementEngine): white starts at the BOTTOM
 * and moves toward row 0 (algebraic rank 9). With this orientation
 * `config.promotionRow = { white: 0, black: 8 }` is consistent — promotion
 * fires when a man arrives at the opponent's back row.
 *
 * Layout:
 *   - Black home: rows 0..3 (full, 36 pieces) + row 4 cols 0..3 (4 pieces) → 40.
 *   - White home: rows 5..8 (full, 36 pieces) + row 4 cols 5..8 (4 pieces) → 40.
 *   - Center intersection (4, 4) = NodeId 40 is empty at the start.
 *
 * Total occupancy: 80 of 81 intersections.
 *
 * Algebraic ↔ NodeId convention (matches `alquerqueGeometry({ size: 9 })`):
 *   - Row 0 → algebraic rank 9 (top of board, NodeIds 0..8 = a9..i9). Black's home.
 *   - Row 8 → algebraic rank 1 (bottom of board, NodeIds 72..80 = a1..i1). White's home.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import { asNodeId } from '../../boardGeometry';
import type {
  AlquerqueConfig,
  AlquerqueGameState,
  AlquerqueMeta,
  AlquerqueOwner,
} from './types';
import { hashPosition, hashToHex } from './alquerqueZobrist';

export class AlquerqueStartingPositionMismatchError extends Error {
  readonly gameId: string;
  readonly expected: number;
  readonly actual: number;
  constructor(gameId: string, expected: number, actual: number) {
    super(
      `[${gameId}] starting-position piece count mismatch: expected ${String(expected)}, got ${String(actual)}`,
    );
    this.name = 'AlquerqueStartingPositionMismatchError';
    this.gameId = gameId;
    this.expected = expected;
    this.actual = actual;
  }
}

export function buildStartingState(config: AlquerqueConfig): AlquerqueGameState {
  const { boardSize, piecesPerSide, gameId } = config;
  const pieces = new Map<NodeId, ClassifiedPiece>();

  // White owns rows 0..3 in full (4 rows × 9 cols = 36) + row 4 cols 0..3 (4) = 40.
  placeWhiteHome(pieces, boardSize);
  // Black owns rows 5..8 in full (4 × 9 = 36) + row 4 cols 5..8 (4) = 40.
  placeBlackHome(pieces, boardSize);

  const totalExpected = piecesPerSide * 2;
  if (pieces.size !== totalExpected) {
    throw new AlquerqueStartingPositionMismatchError(gameId, totalExpected, pieces.size);
  }
  // Center intersection (4, 4) = NodeId 40 must be empty.
  const center = asNodeId(4 * boardSize + 4);
  if (pieces.has(center)) {
    throw new AlquerqueStartingPositionMismatchError(gameId, totalExpected, pieces.size);
  }

  const initialHash = hashPosition(pieces, 'white', config);
  const seededEntry: readonly [string, number] = Object.freeze([
    hashToHex(initialHash),
    1,
  ]);
  const meta: AlquerqueMeta = {
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

function placeWhiteHome(pieces: Map<NodeId, ClassifiedPiece>, size: number): void {
  // White home: rows 5..8 full.
  for (let r = 5; r <= 8; r += 1) {
    for (let c = 0; c < size; c += 1) {
      pieces.set(asNodeId(r * size + c), manFor('white'));
    }
  }
  // Row 4 cols 5..8 (east half of the middle rank).
  for (let c = 5; c < size; c += 1) {
    pieces.set(asNodeId(4 * size + c), manFor('white'));
  }
}

function placeBlackHome(pieces: Map<NodeId, ClassifiedPiece>, size: number): void {
  // Black home: rows 0..3 full.
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < size; c += 1) {
      pieces.set(asNodeId(r * size + c), manFor('black'));
    }
  }
  // Row 4 cols 0..3 (west half of the middle rank).
  for (let c = 0; c < 4; c += 1) {
    pieces.set(asNodeId(4 * size + c), manFor('black'));
  }
}

function manFor(owner: AlquerqueOwner): ClassifiedPiece {
  return Object.freeze({ owner, kind: 'man' });
}
