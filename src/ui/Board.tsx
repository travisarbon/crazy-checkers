/**
 * Board rendering — SVG-based 8x8 checkers board with piece placement,
 * selection highlighting, legal move indicators, click interaction,
 * and move animation support.
 *
 * Animating pieces are rendered in a separate floating layer above all squares
 * so they don't clip underneath other squares during slide transitions.
 */

import type { BoardState, Piece as PieceData, Square } from '../engine/types';
import { getBoardSquare, gridToSquare } from '../engine/board';
import { PieceColor, PieceType } from '../engine/types';
import type { AnimatingPiece } from './useAnimationQueue';
import { ANIM_DURATION } from './useAnimationQueue';
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

  // Animation props (Task 2.3)
  /** Map of square number → animation overrides for pieces currently animating. */
  animatingPieces?: ReadonlyMap<number, AnimatingPiece>;
  /** Set of squares whose pieces are fading out (captured). */
  fadingSquares?: ReadonlySet<number>;
  /** Whether any animation is in progress (disables click handlers). */
  isAnimating?: boolean;
  /** Speed multiplier for animation durations. */
  animSpeedMultiplier?: number;
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
  animatingPieces,
  fadingSquares,
  isAnimating = false,
  animSpeedMultiplier = 1.0,
}: BoardProps) {
  const rows = Array.from({ length: 8 }, (_, i) => i);
  const cols = Array.from({ length: 8 }, (_, i) => i);

  const isClickable = (sq: Square): boolean => {
    if (isAnimating) return false;
    return (selectablePieces?.has(sq as number) ?? false)
      || (legalMoveSquares?.has(sq as number) ?? false);
  };

  // Collect pieces that need to be rendered in the floating animation layer
  // (animating or fading pieces are excluded from their normal square and
  // rendered on top of all squares so they don't clip underneath).
  const floatingPieces: Array<{
    piece: PieceData;
    sq: Square;
    cx: number;
    cy: number;
    animOverride?: AnimatingPiece;
    isFading: boolean;
  }> = [];

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
                !isAnimating &&
                sq !== null &&
                selectedSquare !== null &&
                selectedSquare !== undefined &&
                (sq as number) === (selectedSquare as number);

              const isLegalDest = !isAnimating && sq !== null && (legalMoveSquares?.has(sq as number) ?? false);
              const clickable = sq !== null && isClickable(sq);

              // Check if this piece is animating or fading — if so, render in floating layer
              const animOverride = sq !== null ? animatingPieces?.get(sq as number) : undefined;
              const isFading = sq !== null && (fadingSquares?.has(sq as number) ?? false);
              const isFloating = animOverride != null || isFading;

              if (isFloating && piece && sq) {
                floatingPieces.push({
                  piece,
                  sq,
                  cx: x + SQUARE_SIZE / 2,
                  cy: y + SQUARE_SIZE / 2,
                  animOverride,
                  isFading,
                });
              }

              return (
                <g
                  key={col}
                  onClick={() => {
                    if (isAnimating) return;
                    if (sq) onSquareClick?.(sq);
                  }}
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

                  {/* Piece — only rendered here if NOT floating (animating/fading) */}
                  {piece && sq && !isFloating && (
                    <PieceComponent
                      piece={piece}
                      sq={sq}
                      cx={x + SQUARE_SIZE / 2}
                      cy={y + SQUARE_SIZE / 2}
                      isSelectable={!isAnimating && (selectablePieces?.has(sq as number) ?? false)}
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

        {/* Floating animation layer — rendered above all squares so animating
            pieces don't clip underneath other board squares during slides */}
        {floatingPieces.map(({ piece, sq, cx, cy, animOverride, isFading }) => (
          <PieceComponent
            key={sq as number}
            piece={piece}
            sq={sq}
            cx={cx}
            cy={cy}
            isSelectable={false}
            isSelected={false}
            animTargetCx={animOverride?.overridePosition?.cx}
            animTargetCy={animOverride?.overridePosition?.cy}
            animDurationMs={animOverride ? ANIM_DURATION.SIMPLE_MOVE * animSpeedMultiplier : 0}
            animOpacity={isFading ? 0 : undefined}
            animOpacityDurationMs={isFading ? ANIM_DURATION.CAPTURE_FADE * animSpeedMultiplier : undefined}
            animScale={animOverride?.scale ?? undefined}
          />
        ))}
      </svg>
    </div>
  );
}
