/**
 * Serialization and deserialization of GameState for localStorage persistence.
 *
 * GameState contains non-JSON-safe values (RuleSet methods, bigint hashes),
 * so we convert to/from a plain JSON-safe representation.
 */

import type { BoardState, GameState, Move } from '../engine/types';
import type {
  GameEndReason,
  GameResultType,
  GameStatus,
  PieceColor,
  PieceType,
  PlayerType,
} from '../engine/types';
import { square } from '../engine/types';
import { createAmericanRules } from '../engine/rules';

// ---------------------------------------------------------------------------
// Serializable types
// ---------------------------------------------------------------------------

/**
 * A JSON-safe snapshot of a GameState, suitable for localStorage.
 * Excludes the RuleSet (reconstructed on deserialization)
 * and converts bigint hashes to hex strings.
 */
export interface SerializedGameState {
  board: (SerializedPiece | null)[];
  activeColor: string;
  status: string;
  result: { type: string; reason: string } | null;
  players: { white: string; black: string };
  moveHistory: SerializedMove[];
  positionHashes: string[];
  halfMoveClock: number;
  plyCount: number;
}

interface SerializedPiece {
  color: string;
  type: string;
}

interface SerializedMove {
  from: number;
  path: number[];
  captured: number[];
}

// ---------------------------------------------------------------------------
// Serialize
// ---------------------------------------------------------------------------

/**
 * Converts a live GameState to a JSON-safe object.
 * The RuleSet is intentionally excluded — it is reconstructed
 * from the game mode on deserialization.
 */
export function serializeGameState(state: GameState): SerializedGameState {
  return {
    board: state.board.map((sq) => (sq === null ? null : { color: sq.color, type: sq.type })),
    activeColor: state.activeColor,
    status: state.status,
    result: state.result ? { type: state.result.type, reason: state.result.reason } : null,
    players: { white: state.players.white, black: state.players.black },
    moveHistory: state.moveHistory.map((m) => ({
      from: m.from as number,
      path: m.path.map((sq) => sq as number),
      captured: m.captured.map((sq) => sq as number),
    })),
    positionHashes: state.positionHashes.map((h) => h.toString(16)),
    halfMoveClock: state.halfMoveClock,
    plyCount: state.plyCount,
  };
}

// ---------------------------------------------------------------------------
// Deserialize
// ---------------------------------------------------------------------------

/**
 * Reconstructs a live GameState from a serialized snapshot.
 * Re-attaches the American rules RuleSet (the only mode in Phase 1).
 * Converts hex hash strings back to bigint values.
 */
export function deserializeGameState(data: SerializedGameState): GameState {
  const board: BoardState = data.board.map((sq) =>
    sq === null ? null : { color: sq.color as PieceColor, type: sq.type as PieceType },
  );

  const moveHistory: Move[] = data.moveHistory.map((m) => ({
    from: square(m.from),
    path: m.path.map((s) => square(s)),
    captured: m.captured.map((s) => square(s)),
  }));

  const positionHashes: bigint[] = data.positionHashes.map((h) => BigInt('0x' + h));

  return {
    board,
    activeColor: data.activeColor as PieceColor,
    status: data.status as GameStatus,
    result: data.result
      ? { type: data.result.type as GameResultType, reason: data.result.reason as GameEndReason }
      : null,
    ruleSet: createAmericanRules(),
    players: {
      white: data.players.white as PlayerType,
      black: data.players.black as PlayerType,
    },
    moveHistory,
    positionHashes,
    halfMoveClock: data.halfMoveClock,
    plyCount: data.plyCount,
  };
}

// ---------------------------------------------------------------------------
// Board snapshot encoding
// ---------------------------------------------------------------------------

/**
 * Serializes a BoardState to a compact string representation.
 * Each of the 32 squares is encoded as a single character:
 *   '.' = empty, 'w' = white pawn, 'W' = white king,
 *   'b' = black pawn, 'B' = black king.
 * Result is a 32-character string.
 */
export function serializeBoard(board: BoardState): string {
  return board
    .map((sq) => {
      if (sq === null) return '.';
      if (sq.color === 'WHITE') return sq.type === 'KING' ? 'W' : 'w';
      return sq.type === 'KING' ? 'B' : 'b';
    })
    .join('');
}
