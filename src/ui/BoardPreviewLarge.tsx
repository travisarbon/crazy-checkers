/**
 * Full 8x8 board preview with arbitrary positions and square highlights.
 * Used by EventDiagram, mode sub-menu screens, and gallery detail screens.
 */

import { createInitialBoard, squareToGrid } from '../engine/board';
import { PieceType, PieceColor, square } from '../engine/types';
import type { BoardState } from '../engine/types';
import type { Theme } from '../themes/theme';
import styles from './BoardPreviewLarge.module.css';

export interface BoardPreviewLargeProps {
  position?: BoardState;
  size?: number;
  theme?: Theme;
  boardType?: string;
  highlightSquares?: number[];
  label: string;
}

const DEFAULT_POSITION = createInitialBoard();

export default function BoardPreviewLarge({
  position = DEFAULT_POSITION,
  size = 240,
  theme,
  boardType = '8x8',
  highlightSquares = [],
  label,
}: BoardPreviewLargeProps) {
  if (boardType !== '8x8') {
    return (
      <div
        className={styles.fallback}
        style={{ width: size, height: size }}
        role="img"
        aria-label={label}
      >
        Board type: {boardType}
      </div>
    );
  }

  const cellSize = size / 8;

  // Use theme prop colors directly, or CSS custom properties
  const lightColor = theme ? theme.boardLight : 'var(--board-light)';
  const darkColor = theme ? theme.boardDark : 'var(--board-dark)';
  const borderColor = theme ? theme.boardBorder : 'var(--board-border, var(--board-dark))';
  const whiteColor = theme ? theme.pieceWhite : 'var(--piece-white)';
  const whiteStroke = theme ? theme.pieceWhiteStroke : 'var(--piece-white-stroke)';
  const blackColor = theme ? theme.pieceBlack : 'var(--piece-black)';
  const blackStroke = theme ? theme.pieceBlackStroke : 'var(--piece-black-stroke)';
  const highlightColor = 'var(--highlight-selected, rgba(255, 215, 0, 0.4))';

  // Build highlight set for fast lookup (square indices are 1-based)
  const highlightSet = new Set(highlightSquares);

  const squares: React.ReactNode[] = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const isDark = (row + col) % 2 === 1;
      squares.push(
        <rect
          key={`sq-${String(row)}-${String(col)}`}
          x={col * cellSize}
          y={row * cellSize}
          width={cellSize}
          height={cellSize}
          fill={isDark ? darkColor : lightColor}
        />,
      );
    }
  }

  // Highlight overlays
  const highlights: React.ReactNode[] = [];
  for (const sqIndex of highlightSet) {
    const { row, col } = squareToGrid(square(sqIndex));
    highlights.push(
      <rect
        key={`hl-${String(sqIndex)}`}
        x={col * cellSize}
        y={row * cellSize}
        width={cellSize}
        height={cellSize}
        fill={highlightColor}
        opacity={0.4}
        data-testid={`highlight-${String(sqIndex)}`}
      />,
    );
  }

  // Pieces
  const pieces: React.ReactNode[] = [];
  for (let i = 0; i < position.length; i++) {
    const piece = position[i];
    if (!piece) continue;

    const sq = square(i + 1); // squareToGrid uses 1-based indexing
    const { row, col } = squareToGrid(sq);
    const cx = (col + 0.5) * cellSize;
    const cy = (row + 0.5) * cellSize;
    const radius = cellSize * 0.38;

    const isWhite = piece.color === PieceColor.White;
    const fill = isWhite ? whiteColor : blackColor;
    const stroke = isWhite ? whiteStroke : blackStroke;

    pieces.push(
      <circle
        key={`piece-${String(sq)}`}
        cx={cx}
        cy={cy}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        data-testid={`piece-${String(sq)}`}
      />,
    );

    // King indicator — concentric inner circle
    if (piece.type === PieceType.King) {
      pieces.push(
        <circle
          key={`king-${String(sq)}`}
          cx={cx}
          cy={cy}
          r={radius * 0.5}
          fill="none"
          stroke={stroke}
          strokeWidth={1.5}
          data-testid={`king-${String(sq)}`}
        />,
      );
    }
  }

  return (
    <div className={styles.container}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${String(size)} ${String(size)}`}
        role="img"
        aria-label={label}
        style={{ maxWidth: '100%', height: 'auto' }}
      >
        {squares}
        {highlights}
        {pieces}
        {/* Board border */}
        <rect
          x={0}
          y={0}
          width={size}
          height={size}
          fill="none"
          stroke={borderColor}
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}
