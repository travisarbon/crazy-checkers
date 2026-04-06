/**
 * Time Bomb — production event decorator (Event 26).
 *
 * Condition-based event (remainingPlies: -1). A randomly selected piece
 * receives a bomb marker with a 3-ply countdown. Each ply the countdown
 * decrements. At 0, the marked piece and all diagonally adjacent pieces
 * are destroyed. If the marked piece is captured, the bomb is defused.
 * The bomb follows the piece if it moves.
 *
 * Metadata: { bombSquare: number, countdown: number, bombColor: string }
 */

import type { BoardState, Move, PieceColor, RuleSet, Square } from '../types';
import { CrazyEvent } from '../types';
import { BOARD_SIZE, getBoardSquare, setBoardSquare } from '../board';
import { explodeAdjacentPieces } from './liveGrenade';
import { EventDecorator, EVENT_DECORATOR_REGISTRY, EVENT_METADATA_FACTORIES } from '../events';

/** Metadata stored in ActiveEvent.metadata for Time Bomb. */
export interface TimeBombMetadata {
  readonly bombSquare: number;
  readonly countdown: number;
  readonly bombColor: string;
}

export class TimeBombDecorator extends EventDecorator {
  getEventType(): CrazyEvent {
    return CrazyEvent.TimeBomb;
  }

  withInner(inner: RuleSet): TimeBombDecorator {
    return new TimeBombDecorator(inner);
  }

  override onCapture(board: BoardState, landingSquare: Square, captured: Square[]): BoardState {
    const result = super.onCapture(board, landingSquare, captured);

    const entry = this.getActiveEntry(this.activeEventsContext);
    if (!entry) return result;

    const metadata = entry.metadata as unknown as TimeBombMetadata | undefined;
    if (metadata === undefined || metadata.bombSquare < 0) return result;

    // Check if the bombed piece was captured → defuse
    for (const sq of captured) {
      if ((sq as number) === metadata.bombSquare) {
        this.requestEventRemoval(CrazyEvent.TimeBomb);
        return result;
      }
    }

    return result;
  }

  override onTurnEnd(board: BoardState, activeColor: PieceColor, move: Move): BoardState {
    let result = super.onTurnEnd(board, activeColor, move);

    const entry = this.getActiveEntry(this.activeEventsContext);
    if (!entry) return result;

    const metadata = entry.metadata as unknown as TimeBombMetadata | undefined;
    if (metadata === undefined || metadata.bombSquare < 0) return result;

    let newBombSquare = metadata.bombSquare;

    // Track bomb movement: if the piece at bombSquare moved, update position
    if ((move.from as number) === metadata.bombSquare) {
      const landing = move.path[move.path.length - 1];
      if (landing !== undefined) {
        newBombSquare = landing as number;
      }
    }

    // Verify the piece at bombSquare still matches bombColor
    const bombPiece = getBoardSquare(result, newBombSquare as Square);
    if (bombPiece === null || bombPiece.color !== metadata.bombColor) {
      // Bomb piece was displaced or destroyed — defuse silently
      this.requestEventRemoval(CrazyEvent.TimeBomb);
      return result;
    }

    // Decrement countdown
    const newCountdown = metadata.countdown - 1;

    if (newCountdown <= 0) {
      // BOOM: destroy the bombed piece and all adjacent pieces
      result = setBoardSquare(result, newBombSquare as Square, null);
      result = explodeAdjacentPieces(result, newBombSquare as Square);
      this.requestEventRemoval(CrazyEvent.TimeBomb);
    } else {
      // Update metadata with new position and countdown
      this.requestMetadataUpdate(CrazyEvent.TimeBomb, {
        bombSquare: newBombSquare,
        countdown: newCountdown,
        bombColor: metadata.bombColor,
      });
    }

    return result;
  }
}

// Register decorator factory
EVENT_DECORATOR_REGISTRY.set(
  CrazyEvent.TimeBomb,
  (base: RuleSet) => new TimeBombDecorator(base),
);

// Register metadata factory: randomly select one piece on the board
EVENT_METADATA_FACTORIES.set(
  CrazyEvent.TimeBomb,
  (board: BoardState, _activeColor, randomFn) => {
    const allPieces: Array<{ square: number; color: string }> = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      const piece = board[i];
      if (piece !== null && piece !== undefined) {
        allPieces.push({ square: i + 1, color: piece.color });
      }
    }

    if (allPieces.length === 0) {
      return { bombSquare: -1, countdown: 0, bombColor: '' };
    }

    const rng = randomFn ?? Math.random;
    const index = Math.floor(rng() * allPieces.length);
    const selected = allPieces[index];

    if (selected === undefined) {
      return { bombSquare: -1, countdown: 0, bombColor: '' };
    }

    return {
      bombSquare: selected.square,
      countdown: 3,
      bombColor: selected.color,
    };
  },
);
