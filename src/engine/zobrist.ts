/**
 * Zobrist hashing for position identification and threefold repetition detection.
 *
 * Produces a pseudo-random 64-bit hash for a board position by XORing
 * pre-generated random values for each (piece-type x square) combination.
 * Supports incremental updates for efficient hash maintenance during search.
 */

import { BOARD_SIZE } from './board';
import type { BoardState, Move, Piece, Square } from './types';
import { PieceColor, PieceType } from './types';

// ---------------------------------------------------------------------------
// Hash table generation
// ---------------------------------------------------------------------------

/** Number of distinct piece kinds: WhitePawn, WhiteKing, BlackPawn, BlackKing. */
const PIECE_KIND_COUNT = 4;

/** Maps a (color, type) pair to an index 0-3 for the Zobrist table. */
function pieceIndex(color: PieceColor, type: PieceType): number {
  const colorOffset = color === PieceColor.White ? 0 : 2;
  const typeOffset = type === PieceType.Pawn ? 0 : 1;
  return colorOffset + typeOffset;
}

/**
 * Pre-generated table of random bigint values.
 * Dimensions: [squareIndex 0-31][pieceIndex 0-3]
 * Stored as a flat array: index = squareIndex * PIECE_KIND_COUNT + pieceIndex
 */
const ZOBRIST_TABLE: bigint[] = [];

/** Random value XORed in when it is Black's turn to move. */
let ZOBRIST_BLACK_TO_MOVE: bigint = 0n;

/** Looks up a Zobrist value for a piece on a given square index (0-based). */
function zobristValue(squareIndex: number, color: PieceColor, type: PieceType): bigint {
  const idx = squareIndex * PIECE_KIND_COUNT + pieceIndex(color, type);
  return ZOBRIST_TABLE[idx] ?? 0n;
}

/**
 * Initializes the Zobrist table using a deterministic splitmix64 PRNG.
 * Fixed seed ensures hashes are reproducible across sessions.
 */
function initializeZobristTable(): void {
  let state = 0x12345678ABCDEF01n; // fixed seed

  function nextRandom(): bigint {
    state += 0x9E3779B97F4A7C15n;
    let z = state;
    z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n;
    z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn;
    z = z ^ (z >> 31n);
    return z & 0xFFFFFFFFFFFFFFFFn; // mask to 64 bits
  }

  for (let sq = 0; sq < BOARD_SIZE; sq++) {
    for (let p = 0; p < PIECE_KIND_COUNT; p++) {
      ZOBRIST_TABLE[sq * PIECE_KIND_COUNT + p] = nextRandom();
    }
  }
  ZOBRIST_BLACK_TO_MOVE = nextRandom();
}

// Initialize at module load
initializeZobristTable();

// ---------------------------------------------------------------------------
// Hash computation
// ---------------------------------------------------------------------------

/**
 * Computes the full Zobrist hash for a board position from scratch.
 * Used for the initial position and for verification.
 */
export function computeZobristHash(board: BoardState, activeColor: PieceColor): bigint {
  let hash = 0n;

  for (let i = 0; i < BOARD_SIZE; i++) {
    const piece = board[i];
    if (piece != null) {
      hash ^= zobristValue(i, piece.color, piece.type);
    }
  }

  if (activeColor === PieceColor.Black) {
    hash ^= ZOBRIST_BLACK_TO_MOVE;
  }

  return hash;
}

/**
 * Incrementally updates a Zobrist hash after a move.
 * Much faster than recomputing from scratch - XORs out old state
 * and XORs in new state for only the affected squares.
 */
export function updateZobristHash(
  previousHash: bigint,
  move: Move,
  movingPiece: Piece,
  landingPiece: Piece,
  capturedPieces: ReadonlyArray<{ sq: Square; piece: Piece }>,
): bigint {
  let hash = previousHash;

  // Toggle side to move (always flips)
  hash ^= ZOBRIST_BLACK_TO_MOVE;

  // XOR out the piece from its origin square
  hash ^= zobristValue((move.from as number) - 1, movingPiece.color, movingPiece.type);

  // XOR in the piece at its destination square (possibly promoted)
  const finalSquare = move.path[move.path.length - 1];
  if (finalSquare === undefined) {
    throw new Error('updateZobristHash: move has empty path');
  }
  hash ^= zobristValue((finalSquare as number) - 1, landingPiece.color, landingPiece.type);

  // XOR out each captured piece
  for (const { sq, piece } of capturedPieces) {
    hash ^= zobristValue((sq as number) - 1, piece.color, piece.type);
  }

  return hash;
}

// ---------------------------------------------------------------------------
// Repetition detection
// ---------------------------------------------------------------------------

/**
 * Checks whether the given hash has occurred `threshold` or more times
 * in the position history.
 */
export function isRepetition(
  positionHashes: readonly bigint[],
  currentHash: bigint,
  threshold: number,
): boolean {
  let count = 0;
  for (const hash of positionHashes) {
    if (hash === currentHash) {
      count++;
      if (count >= threshold) return true;
    }
  }
  return false;
}
