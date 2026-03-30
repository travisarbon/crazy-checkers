/**
 * Board rendering — SVG-based 8x8 checkers board with piece placement,
 * selection highlighting, legal move indicators, and click interaction.
 */

import type { BoardState, Piece as PieceData, Square } from '../engine/types';
import { getBoardSquare, gridToSquare } from '../engine/board';
import { PieceColor, PieceType } from '../engine/types';
import PieceComponent from './Piece';
import styles from './Board.module.css';

const SQUARE_SIZE = 100;
const LEGAL_DOT_RADIUS = 15;
const CAPTURE_RING_RADIUS = 42;
const CAPTURE_RING_STROKE = 4;

interface BoardProps {
  board: BoardState;
  flipped?: boolean;
  legalMoveSquares?: ReadonlySet<number>;
  selectedSquare?: Square | null;
  lastMoveSquares?: { from: Square; to: Square } | null;
  onSquareClick?: (sq: Square) => void;
  selectablePieces?: ReadonlySet<number>;
}

function describeSquare(sq: Square, piece: PieceData | null): string {
  if (!piece) return `Square ${String(sq)}, empty`;
  const color = piece.color === PieceColor.White ? 'white' : 'black';
  const type = piece.type === PieceType.King ? 'king' : 'pawn';
  return `Square ${String(sq)}, ${color} ${type}`;
}

export default function Board({
  board,
  flipped = false,
  legalMoveSquares,
  selectedSquare,
  onSquareClick,
  selectablePieces,
}: BoardProps) {
  const rows = Array.from({ length: 8 }, (_, i) => i);
  const cols = Array.from({ length: 8 }, (_, i) => i);

  const isClickable = (sq: Square): boolean => {
    return (selectablePieces?.has(sq as number) ?? false)
      || (legalMoveSquares?.has(sq as number) ?? false);
  };

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

              const isSelected =
                sq !== null &&
                selectedSquare !== null &&
                selectedSquare !== undefined &&
                (sq as number) === (selectedSquare as number);

              const isLegalDest = sq !== null && (legalMoveSquares?.has(sq as number) ?? false);
              const clickable = sq !== null && isClickable(sq);

              return (
                <g
                  key={col}
                  onClick={() => sq && onSquareClick?.(sq)}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                  role="gridcell"
                  aria-label={label}
                  tabIndex={0}
                >
                  {/* Base square */}
                  <rect
                    x={x}
                    y={y}
                    width={SQUARE_SIZE}
                    height={SQUARE_SIZE}
                    fill="var(--board-dark)"
                  />

                  {/* Legal move destination highlight (below selected highlight) */}
                  {isLegalDest && (
                    <rect
                      x={x}
                      y={y}
                      width={SQUARE_SIZE}
                      height={SQUARE_SIZE}
                      fill="var(--highlight-legal)"
                      data-testid="highlight-legal"
                    />
                  )}

                  {/* Selected piece highlight */}
                  {isSelected && (
                    <rect
                      x={x}
                      y={y}
                      width={SQUARE_SIZE}
                      height={SQUARE_SIZE}
                      fill="var(--highlight-selected)"
                      data-testid="highlight-selected"
                    />
                  )}

                  {/* Piece (if present) */}
                  {piece && sq && (
                    <PieceComponent
                      piece={piece}
                      sq={sq}
                      cx={x + SQUARE_SIZE / 2}
                      cy={y + SQUARE_SIZE / 2}
                      isSelectable={selectablePieces?.has(sq as number) ?? false}
                      isSelected={isSelected}
                    />
                  )}

                  {/* Legal destination dot (on empty squares) */}
                  {isLegalDest && !piece && (
                    <circle
                      cx={x + SQUARE_SIZE / 2}
                      cy={y + SQUARE_SIZE / 2}
                      r={LEGAL_DOT_RADIUS}
                      fill="var(--highlight-legal)"
                      data-testid="legal-dot"
                    />
                  )}

                  {/* Legal destination ring (on squares with capturable enemy pieces) */}
                  {isLegalDest && piece && (
                    <circle
                      cx={x + SQUARE_SIZE / 2}
                      cy={y + SQUARE_SIZE / 2}
                      r={CAPTURE_RING_RADIUS}
                      fill="none"
                      stroke="var(--highlight-legal)"
                      strokeWidth={CAPTURE_RING_STROKE}
                      data-testid="legal-capture-ring"
                    />
                  )}

                  {/* Transparent click target on top (ensures clicks on pieces are captured) */}
                  <rect
                    x={x}
                    y={y}
                    width={SQUARE_SIZE}
                    height={SQUARE_SIZE}
                    fill="transparent"
                    style={{ cursor: clickable ? 'pointer' : 'default' }}
                  />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
