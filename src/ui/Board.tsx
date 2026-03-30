/**
 * Board rendering — SVG-based 8x8 checkers board with piece placement.
 *
 * Renders a resolution-independent SVG board using a viewBox of 800x800.
 * Pieces are positioned on dark (playable) squares using the engine's
 * coordinate conversion functions.
 */

import type { BoardState, Piece as PieceData, Square } from '../engine/types';
import { getBoardSquare, gridToSquare } from '../engine/board';
import { PieceColor, PieceType } from '../engine/types';
import PieceComponent from './Piece';
import styles from './Board.module.css';

const SQUARE_SIZE = 100;

interface BoardProps {
  board: BoardState;
  flipped?: boolean;

  // Stubbed for Task 2.2 / 2.6
  legalMoveSquares?: ReadonlySet<number>;
  selectedSquare?: Square | null;
  lastMoveSquares?: { from: Square; to: Square } | null;
  onSquareClick?: (sq: Square) => void;
}

function describeSquare(sq: Square, piece: PieceData | null): string {
  if (!piece) return `Square ${String(sq)}, empty`;
  const color = piece.color === PieceColor.White ? 'white' : 'black';
  const type = piece.type === PieceType.King ? 'king' : 'pawn';
  return `Square ${String(sq)}, ${color} ${type}`;
}

export default function Board({ board, flipped = false }: BoardProps) {
  const rows = Array.from({ length: 8 }, (_, i) => i);
  const cols = Array.from({ length: 8 }, (_, i) => i);

  return (
    <div className={styles.boardContainer}>
      <svg
        viewBox="0 0 800 800"
        role="grid"
        aria-label="Checkers board"
        data-testid="board"
      >
        {rows.map((row) => (
          <g key={row} role="row">
            {cols.map((col) => {
              const isDark = (row + col) % 2 === 1;
              const renderRow = flipped ? 7 - row : row;
              const x = col * SQUARE_SIZE;
              const y = renderRow * SQUARE_SIZE;

              if (!isDark) {
                return (
                  <rect
                    key={col}
                    x={x}
                    y={y}
                    width={SQUARE_SIZE}
                    height={SQUARE_SIZE}
                    fill="var(--board-light)"
                    aria-hidden="true"
                  />
                );
              }

              const sq = gridToSquare(row, col);
              const piece = sq ? getBoardSquare(board, sq) : null;
              const label = sq
                ? describeSquare(sq, piece ?? null)
                : 'Empty square';

              return (
                <g key={col}>
                  <rect
                    x={x}
                    y={y}
                    width={SQUARE_SIZE}
                    height={SQUARE_SIZE}
                    fill="var(--board-dark)"
                    role="gridcell"
                    aria-label={label}
                  />
                  {piece && sq && (
                    <PieceComponent
                      piece={piece}
                      sq={sq}
                      cx={x + SQUARE_SIZE / 2}
                      cy={y + SQUARE_SIZE / 2}
                    />
                  )}
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
