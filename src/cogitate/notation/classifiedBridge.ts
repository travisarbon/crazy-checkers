/**
 * Phase 3 ↔ Phase 4 NotationAdapter bridge (Task 28.6 §4).
 *
 * Phase 3 Cogitate tools call `NotationAdapter.moveToString(move, board)`
 * where `board` is a Phase 1 `BoardState` (array). Phase 4 Classified
 * games provide `NotationAdapter<S, M>.notate(state, move)` where `S` is
 * `ClassifiedGameState` (Map-based).
 *
 * This bridge lifts a Phase 4 adapter into the Phase 3 surface by casting
 * the board parameter to the Phase 4 state type. A runtime duck-type
 * check in debug mode catches misuse when a raw Phase 1 BoardState is
 * passed instead of a ClassifiedGameState.
 */

import type { NotationAdapter as Phase3NotationAdapter } from '../NotationAdapter';
import type {
  ClassifiedMove,
  NotationAdapter as Phase4NotationAdapter,
} from '../../engine/classified/ClassifiedRuleSet';
import type { ClassifiedGameState } from '../../engine/classified/state';
import { isClassifiedGameState } from '../../engine/classified/state';
import type { BoardState, Move } from '../../engine/types';
import { PieceColor } from '../../engine/types';

/**
 * Creates a Phase 3 NotationAdapter that delegates to a Phase 4 adapter.
 *
 * @param phase4 - The Phase 4 notation adapter from the ClassifiedRuleSet.
 * @returns A Phase 3 NotationAdapter suitable for Cogitate tools.
 */
export function createClassifiedNotationBridge(
  phase4: Phase4NotationAdapter<ClassifiedGameState, ClassifiedMove>,
): Phase3NotationAdapter {
  return {
    moveToString(move: Move, board: BoardState): string {
      assertClassifiedState(board);
      const state = board as unknown as ClassifiedGameState;
      const classified = moveToClassified(move);
      return phase4.notate(state, classified);
    },

    stringToMove(notation: string, board: BoardState): Move | null {
      assertClassifiedState(board);
      const state = board as unknown as ClassifiedGameState;
      const parsed = phase4.parse(state, notation);
      if (!parsed) return null;
      return classifiedToMove(parsed);
    },

    formatMoveNumber(plyIndex: number, notation: string): string {
      const moveNumber = Math.floor(plyIndex / 2) + 1;
      const color = plyIndex % 2 === 0 ? PieceColor.White : PieceColor.Black;
      const prefix = color === PieceColor.Black
        ? `${String(moveNumber)}...`
        : `${String(moveNumber)}.`;
      return `${prefix} ${notation}`;
    },
  };
}

/**
 * Runtime guard: verifies the board parameter is actually a
 * ClassifiedGameState. Throws a clear error if Phase 1 code
 * accidentally passes a raw BoardState array.
 */
function assertClassifiedState(board: unknown): void {
  if (!isClassifiedGameState(board)) {
    throw new Error(
      'ClassifiedNotationBridge invoked with a non-ClassifiedGameState board. ' +
      'Ensure the Cogitate adapter passes the ClassifiedGameState, not a Phase 1 BoardState.',
    );
  }
}

/**
 * Converts a Phase 1 Move to a ClassifiedMove shape.
 * Phase 1 Move: { from: Square, path: Square[], captured: Square[] }
 * ClassifiedMove: { kind: string, from?: string, to?: string, capture?: string[] }
 */
function moveToClassified(move: Move): ClassifiedMove {
  const from = String(move.from);
  const to = move.path.length > 0
    ? String(move.path[move.path.length - 1])
    : from;
  const capture = move.captured.map(String);
  return {
    kind: capture.length > 0 ? 'jump' : 'simple',
    from,
    to,
    capture,
  };
}

/**
 * Converts a ClassifiedMove back to a Phase 1 Move shape.
 */
function classifiedToMove(cm: ClassifiedMove): Move | null {
  if (cm.from === undefined || cm.to === undefined) return null;
  const from = Number(cm.from);
  const to = Number(cm.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;

  const captured = (cm.capture ?? []).map(Number).filter(Number.isFinite);
  return {
    from: from as unknown as import('../../engine/types').Square,
    path: [to as unknown as import('../../engine/types').Square],
    captured: captured as unknown as import('../../engine/types').Square[],
  };
}
