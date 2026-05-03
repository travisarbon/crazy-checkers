/**
 * Cheskers starting-position generator (Phase 4 Task 29.6).
 *
 * Per playbook §4.10:
 *  - **White:** Kings c1, e1; Bishop a1; Camel g1; Pawns a3, b2, c3, d2,
 *    e3, f2, g3, h2.
 *  - **Black:** Kings d8, f8; Bishop h8; Camel b8; Pawns a7, b6, c7, d6,
 *    e7, f6, g7, h6.
 *  - **Black moves first** (§1.5).
 *
 * Per-side count: 8 Pawns + 2 Kings + 1 Bishop + 1 Camel = 12.
 *
 * All 24 squares above are dark squares (verified at spike time and asserted
 * by `validateCheskersConfig`'s requirement that the geometry uses the
 * `darkSquaresOnly` mask). The placements use chess algebraic notation
 * (file + rank); the geometry's `parseNotation` resolves them to NodeIds.
 */

import type { ClassifiedPiece } from '../state';
import type { NodeId } from '../../boardGeometry';
import type {
  CheskersConfig,
  CheskersGameState,
  CheskersMeta,
  CheskersOwner,
  CheskersPieceKind,
} from './types';
import { hashPosition, hashToHex } from './cheskersZobrist';

export class CheskersStartingPositionMismatchError extends Error {
  readonly expected: number;
  readonly actual: number;
  constructor(expected: number, actual: number) {
    super(
      `[cheskers] starting-position piece count mismatch: expected ${String(expected)}, got ${String(actual)}`,
    );
    this.name = 'CheskersStartingPositionMismatchError';
    this.expected = expected;
    this.actual = actual;
  }
}

interface StartingPiece {
  readonly square: string;
  readonly owner: CheskersOwner;
  readonly kind: CheskersPieceKind;
}

const WHITE_PIECES: readonly StartingPiece[] = Object.freeze([
  // Back rank — Bishop, Kings, Camel.
  { square: 'a1', owner: 'white', kind: 'bishop' },
  { square: 'c1', owner: 'white', kind: 'king' },
  { square: 'e1', owner: 'white', kind: 'king' },
  { square: 'g1', owner: 'white', kind: 'camel' },
  // Pawns on dark squares of ranks 2 + 3.
  { square: 'b2', owner: 'white', kind: 'pawn' },
  { square: 'd2', owner: 'white', kind: 'pawn' },
  { square: 'f2', owner: 'white', kind: 'pawn' },
  { square: 'h2', owner: 'white', kind: 'pawn' },
  { square: 'a3', owner: 'white', kind: 'pawn' },
  { square: 'c3', owner: 'white', kind: 'pawn' },
  { square: 'e3', owner: 'white', kind: 'pawn' },
  { square: 'g3', owner: 'white', kind: 'pawn' },
] as const);

const BLACK_PIECES: readonly StartingPiece[] = Object.freeze([
  // Back rank — Camel, Kings, Bishop.
  { square: 'b8', owner: 'black', kind: 'camel' },
  { square: 'd8', owner: 'black', kind: 'king' },
  { square: 'f8', owner: 'black', kind: 'king' },
  { square: 'h8', owner: 'black', kind: 'bishop' },
  // Pawns on dark squares of ranks 6 + 7.
  { square: 'a7', owner: 'black', kind: 'pawn' },
  { square: 'c7', owner: 'black', kind: 'pawn' },
  { square: 'e7', owner: 'black', kind: 'pawn' },
  { square: 'g7', owner: 'black', kind: 'pawn' },
  { square: 'b6', owner: 'black', kind: 'pawn' },
  { square: 'd6', owner: 'black', kind: 'pawn' },
  { square: 'f6', owner: 'black', kind: 'pawn' },
  { square: 'h6', owner: 'black', kind: 'pawn' },
] as const);

export function buildStartingState(config: CheskersConfig): CheskersGameState {
  const pieces = new Map<NodeId, ClassifiedPiece>();

  for (const spec of WHITE_PIECES) placePiece(pieces, config, spec);
  for (const spec of BLACK_PIECES) placePiece(pieces, config, spec);

  const totalExpected = config.piecesPerSide * 2;
  if (pieces.size !== totalExpected) {
    throw new CheskersStartingPositionMismatchError(totalExpected, pieces.size);
  }

  const startingTurn = config.startingTurn;
  const initialHash = hashPosition(pieces, startingTurn, config);
  const seededEntry: readonly [string, number] = Object.freeze([
    hashToHex(initialHash),
    1,
  ]);
  const meta: CheskersMeta = {
    turnTag: startingTurn,
    halfMoveClock: 0,
    repetitionTable: Object.freeze([seededEntry]),
    kingCount: Object.freeze({ white: 2, black: 2 }),
  };

  return {
    pieces,
    turn: startingTurn,
    plyCount: 0,
    moveHistory: Object.freeze([] as const),
    meta,
  };
}

function placePiece(
  pieces: Map<NodeId, ClassifiedPiece>,
  config: CheskersConfig,
  spec: StartingPiece,
): void {
  const node = config.boardGeometry.coordinateLabels.parseNotation(spec.square);
  if (node === null) {
    throw new CheskersStartingPositionMismatchError(
      0,
      0,
    );
  }
  pieces.set(node, Object.freeze({ owner: spec.owner, kind: spec.kind }));
}
