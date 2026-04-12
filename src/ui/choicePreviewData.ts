/**
 * Shared data for Choice mode board preview positions and highlight squares.
 * Used by both ChoiceGalleryScreen (card previews) and ChoiceDetailScreen
 * (hero board preview) to show event effects visually.
 */

import { CrazyEvent, PieceColor, PieceType } from '../engine/types';
import type { BoardState, SquareState } from '../engine/types';
import { createInitialBoard } from '../engine/board';

// ---------------------------------------------------------------------------
// Event-modified board positions
// ---------------------------------------------------------------------------

/**
 * Returns a board position that visually reflects the permanent event effect.
 * Used to show each Choice mode's effect in board previews.
 */
export function getEventModifiedPosition(event: CrazyEvent | null): BoardState | undefined {
  if (event === null) return undefined;

  switch (event) {
    case CrazyEvent.KingForADay: {
      // Revolution: all pieces are kings
      const board = createInitialBoard();
      const modified = [...board] as SquareState[];
      for (let i = 0; i < modified.length; i++) {
        const piece = modified[i];
        if (piece != null && piece.type === PieceType.Pawn) {
          modified[i] = { color: piece.color, type: PieceType.King };
        }
      }
      return modified;
    }

    case CrazyEvent.Demotion: {
      // Common Folk: all kings demoted — show a mid-game position
      // with no kings (even pieces that would normally be kinged)
      return undefined; // Standard board (no kings exist at start anyway)
    }

    case CrazyEvent.FlippedScript: {
      // Turned Tables: promotion rows swapped — show pieces facing "wrong" way
      // Use standard position since the visual effect is about promotion rules
      return undefined;
    }

    case CrazyEvent.ChecksMix: {
      // Blender: shuffled board — show a scrambled mid-game position
      const board: SquareState[] = new Array<SquareState>(32).fill(null);
      // Place white pieces scattered
      board[0] = { color: PieceColor.White, type: PieceType.Pawn };  // sq 1
      board[6] = { color: PieceColor.White, type: PieceType.Pawn };  // sq 7
      board[10] = { color: PieceColor.White, type: PieceType.King }; // sq 11
      board[14] = { color: PieceColor.White, type: PieceType.Pawn }; // sq 15
      board[19] = { color: PieceColor.White, type: PieceType.Pawn }; // sq 20
      board[24] = { color: PieceColor.White, type: PieceType.Pawn }; // sq 25
      // Place black pieces scattered
      board[4] = { color: PieceColor.Black, type: PieceType.Pawn };  // sq 5
      board[11] = { color: PieceColor.Black, type: PieceType.Pawn }; // sq 12
      board[17] = { color: PieceColor.Black, type: PieceType.King }; // sq 18
      board[21] = { color: PieceColor.Black, type: PieceType.Pawn }; // sq 22
      board[26] = { color: PieceColor.Black, type: PieceType.Pawn }; // sq 27
      board[30] = { color: PieceColor.Black, type: PieceType.Pawn }; // sq 31
      return board;
    }

    case CrazyEvent.OppositeDay: {
      // Mirror World: anti-checkers — show a position where white has more
      // pieces (losing in anti-checkers)
      const board: SquareState[] = new Array<SquareState>(32).fill(null);
      // White has many pieces (bad in anti-checkers)
      board[8] = { color: PieceColor.White, type: PieceType.Pawn };
      board[9] = { color: PieceColor.White, type: PieceType.Pawn };
      board[12] = { color: PieceColor.White, type: PieceType.Pawn };
      board[13] = { color: PieceColor.White, type: PieceType.Pawn };
      board[16] = { color: PieceColor.White, type: PieceType.Pawn };
      board[17] = { color: PieceColor.White, type: PieceType.Pawn };
      board[20] = { color: PieceColor.White, type: PieceType.Pawn };
      // Black has few pieces (good in anti-checkers)
      board[5] = { color: PieceColor.Black, type: PieceType.Pawn };
      board[14] = { color: PieceColor.Black, type: PieceType.Pawn };
      return board;
    }

    case CrazyEvent.Conscription: {
      // Draft Day: captured pieces switch sides — show mixed colors in
      // unusual positions
      const board: SquareState[] = new Array<SquareState>(32).fill(null);
      // White pieces deep in black territory
      board[1] = { color: PieceColor.White, type: PieceType.King };
      board[5] = { color: PieceColor.White, type: PieceType.Pawn };
      board[10] = { color: PieceColor.White, type: PieceType.Pawn };
      board[22] = { color: PieceColor.White, type: PieceType.Pawn };
      board[25] = { color: PieceColor.White, type: PieceType.Pawn };
      // Black pieces deep in white territory
      board[19] = { color: PieceColor.Black, type: PieceType.Pawn };
      board[27] = { color: PieceColor.Black, type: PieceType.King };
      board[30] = { color: PieceColor.Black, type: PieceType.Pawn };
      return board;
    }

    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Highlight squares for specific Choice modes
// ---------------------------------------------------------------------------

/**
 * Optional highlight squares for specific Choice modes.
 * Highlights visually indicate special squares affected by the event.
 */
export const CHOICE_HIGHLIGHT_SQUARES: ReadonlyMap<number, readonly number[]> = new Map([
  // Sanctuary (#12): near-corner safe haven squares
  [12, [1, 4, 29, 32]],
  // Tar Pit (#14): edge squares (simplified representation)
  [14, [1, 2, 3, 4, 5, 12, 13, 20, 21, 28, 29, 30, 31, 32]],
  // Minefield (#26): center squares
  [26, [14, 15, 18, 19]],
  // Portal (#37): example wormhole-linked squares
  [37, [10, 23, 7, 26]],
]);
