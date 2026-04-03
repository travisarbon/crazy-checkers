/**
 * Board rendering — SVG-based 8x8 checkers board with piece placement,
 * selection highlighting, legal move indicators, click interaction,
 * and move animation support.
 *
 * Animating pieces are rendered in a separate floating layer above all squares
 * so they don't clip underneath other squares during slide transitions.
 */

import { useState, useRef, useCallback, memo } from 'react';
import type { BoardState, Piece as PieceData, Square } from '../engine/types';
import { getBoardSquare, gridToSquare, squareToGrid } from '../engine/board';
import { PieceColor, PieceType, square } from '../engine/types';
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
  pendingConfirmSquare?: Square | null;
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
  /** Whether to apply drop shadow to pieces (theme-dependent). */
  pieceShadow?: boolean;
}

function describeSquare(sq: Square, piece: PieceData | null): string {
  if (!piece) return `Square ${String(sq)}, empty`;
  const color = piece.color === PieceColor.White ? 'white' : 'black';
  const type = piece.type === PieceType.King ? 'king' : 'pawn';
  return `Square ${String(sq)}, ${color} ${type}`;
}

/**
 * Given a square number, find the next playable square in a grid direction.
 * Arrow key navigation moves visually on the rendered board (respects flip).
 */
function findNextSquare(
  currentSq: Square,
  key: string,
  flipped: boolean,
): Square | null {
  const grid = squareToGrid(currentSq);
  let { row, col } = grid;

  // Map arrow keys to visual direction, then adjust for board flip
  const flipMul = flipped ? -1 : 1;
  switch (key) {
    case 'ArrowUp':    row -= 1 * flipMul; break;
    case 'ArrowDown':  row += 1 * flipMul; break;
    case 'ArrowLeft':  col -= 1; break;
    case 'ArrowRight': col += 1; break;
    default: return null;
  }

  // Clamp and find the nearest dark square
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;

  // If the target cell is a dark (playable) square, use it directly
  const direct = gridToSquare(row, col);
  if (direct !== null) return direct;

  // Otherwise, shift col by 1 in the movement direction to land on a dark square
  const colShift = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
  if (colShift !== 0) {
    const shifted = gridToSquare(row, col + colShift);
    if (shifted !== null) return shifted;
  }

  // For up/down landing on a light square, try both adjacent columns
  const left = gridToSquare(row, col - 1);
  if (left !== null) return left;
  const right = gridToSquare(row, col + 1);
  if (right !== null) return right;

  return null;
}

function Board({
  board,
  flipped = false,
  pendingConfirmSquare,
  legalMoveSquares,
  selectedSquare,
  lastMoveSquares,
  onSquareClick,
  selectablePieces,
  animatingPieces,
  fadingSquares,
  isAnimating = false,
  animSpeedMultiplier = 1.0,
  pieceShadow = false,
}: BoardProps) {
  const rows = Array.from({ length: 8 }, (_, i) => i);
  const cols = Array.from({ length: 8 }, (_, i) => i);

  // Roving tabindex: track which square currently holds tab focus
  const [focusedSquare, setFocusedSquare] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);

  const isClickable = (sq: Square): boolean => {
    if (isAnimating) return false;
    return (selectablePieces?.has(sq as number) ?? false)
      || (legalMoveSquares?.has(sq as number) ?? false);
  };

  const handleBoardKeyDown = useCallback(
    (e: React.KeyboardEvent<SVGSVGElement>) => {
      const currentSq = focusedSquare;

      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextSq = findNextSquare(square(currentSq), e.key, flipped);
        if (nextSq !== null) {
          setFocusedSquare(nextSq as number);
          // Focus the DOM element for the new square
          const el = svgRef.current?.querySelector<SVGElement>(`[data-square="${String(nextSq)}"]`);
          el?.focus();
        }
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (!isAnimating) {
          onSquareClick?.(square(currentSq));
        }
        return;
      }

      if (e.key === 'Escape') {
        // Escape is handled by GameScreen's global handler
        return;
      }
    },
    [focusedSquare, flipped, isAnimating, onSquareClick],
  );

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
        ref={svgRef}
        viewBox="-4 -4 808 808"
        role="grid"
        aria-label="Checkers board"
        data-testid="board"
        onKeyDown={handleBoardKeyDown}
      >
        {/* SVG filter definitions */}
        <defs>
          <filter id="piece-shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.15" />
          </filter>
        </defs>

        {/* Board border/frame */}
        <rect x="-4" y="-4" width="808" height="808" fill="var(--board-border)" rx="6" />

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

              const isLastMoveSquare =
                sq !== null &&
                lastMoveSquares != null &&
                ((sq as number) === (lastMoveSquares.from as number) ||
                 (sq as number) === (lastMoveSquares.to as number));

              const isSelected =
                !isAnimating &&
                sq !== null &&
                selectedSquare !== null &&
                selectedSquare !== undefined &&
                (sq as number) === (selectedSquare as number);

              const isPendingConfirm =
                !isAnimating &&
                sq !== null &&
                pendingConfirmSquare !== null &&
                pendingConfirmSquare !== undefined &&
                (sq as number) === (pendingConfirmSquare as number);

              const isLegalDest = !isAnimating && sq !== null && (legalMoveSquares?.has(sq as number) ?? false);
              const clickable = sq !== null && isClickable(sq);
              const isInteractive = !isAnimating && sq !== null && (
                (selectablePieces?.has(sq as number) ?? false) ||
                (legalMoveSquares?.has(sq as number) ?? false)
              );

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
                  onFocus={() => {
                    if (sq) setFocusedSquare(sq as number);
                  }}
                  style={{ cursor: clickable ? 'pointer' : 'default' }}
                  role="gridcell"
                  aria-label={label}
                  tabIndex={sq !== null && (sq as number) === focusedSquare ? 0 : -1}
                  data-square={sq !== null ? String(sq) : undefined}
                  className={[styles.boardSquare, isInteractive ? styles.boardSquareInteractive : ''].filter(Boolean).join(' ')}
                >
                  {/* Base square */}
                  <rect
                    x={x}
                    y={y}
                    width={SQUARE_SIZE}
                    height={SQUARE_SIZE}
                    fill="var(--board-dark)"
                  />

                  {/* Last-move highlight (lowest visual priority) */}
                  {isLastMoveSquare && (
                    <rect
                      x={x}
                      y={y}
                      width={SQUARE_SIZE}
                      height={SQUARE_SIZE}
                      fill="var(--highlight-last-move)"
                      data-testid="highlight-last-move"
                    />
                  )}

                  {/* Legal move destination highlight (middle priority) */}
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

                  {/* Pending confirmation highlight (pulsing) */}
                  {isPendingConfirm && (
                    <rect
                      x={x}
                      y={y}
                      width={SQUARE_SIZE}
                      height={SQUARE_SIZE}
                      fill="var(--highlight-selected)"
                      data-testid="highlight-pending-confirm"
                      className={styles.pendingConfirm}
                    />
                  )}

                  {/* Hover overlay for interactive squares */}
                  {isInteractive && (
                    <rect
                      x={x}
                      y={y}
                      width={SQUARE_SIZE}
                      height={SQUARE_SIZE}
                      fill="var(--highlight-hover)"
                      className={styles.hoverOverlay}
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
                      svgFilter={pieceShadow ? 'url(#piece-shadow)' : undefined}
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
                      className={styles.legalDot}
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
                      className={styles.legalDot}
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
            animDurationMs={animOverride?.transitionDurationMs ?? 0}
            animEasing={animOverride?.easing}
            animOpacity={isFading ? 0 : undefined}
            animOpacityDurationMs={isFading ? ANIM_DURATION.CAPTURE_FADE * animSpeedMultiplier : undefined}
            animScale={animOverride?.scale ?? undefined}
          />
        ))}
      </svg>
    </div>
  );
}

export default memo(Board);
