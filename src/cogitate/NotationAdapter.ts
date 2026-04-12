/**
 * NotationAdapter interface and the CheckersNotationAdapter implementation.
 *
 * Wraps src/utils/notation so Cogitate tools are decoupled from the concrete
 * notation module. Phase 4 will add adapters for non-checkers notations.
 */

import type { BoardState, Move } from '../engine/types';
import {
  moveToString as utilMoveToString,
  stringToMove as utilStringToMove,
  formatMoveNumber as utilFormatMoveNumber,
} from '../utils/notation';

export interface NotationAdapter {
  /** Convert a Move to human-readable notation. */
  moveToString(move: Move, board: BoardState): string;
  /** Parse a notation string back to a Move. Returns null if unparseable. */
  stringToMove(notation: string, board: BoardState): Move | null;
  /** Format a move with move-number prefix (e.g., "1. 11-15"). */
  formatMoveNumber(plyIndex: number, notation: string): string;
}

/** Standard American Checkers notation adapter. */
export class CheckersNotationAdapter implements NotationAdapter {
  moveToString(move: Move, _board: BoardState): string {
    void _board;
    return utilMoveToString(move);
  }

  stringToMove(notation: string, board: BoardState): Move | null {
    try {
      return utilStringToMove(notation, board);
    } catch {
      return null;
    }
  }

  formatMoveNumber(plyIndex: number, notation: string): string {
    return utilFormatMoveNumber(plyIndex, notation);
  }
}

let cached: CheckersNotationAdapter | null = null;

/** Returns a shared CheckersNotationAdapter instance. */
export function getCheckersNotationAdapter(): CheckersNotationAdapter {
  if (!cached) cached = new CheckersNotationAdapter();
  return cached;
}
