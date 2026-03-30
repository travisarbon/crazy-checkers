/**
 * Individual piece component — SVG circle with optional king crown indicator.
 * Supports visual feedback for selection and selectability.
 */

import type { Piece as PieceData, Square } from '../engine/types';
import { PieceColor, PieceType } from '../engine/types';
import styles from './Board.module.css';

const PIECE_RADIUS = 38;
const PIECE_STROKE_WIDTH = 3;
const SELECTED_STROKE_EXTRA = 2;

interface PieceProps {
  piece: PieceData;
  sq: Square;
  cx: number;
  cy: number;
  isSelectable?: boolean;
  isSelected?: boolean;
}

function getPieceColors(piece: PieceData) {
  const isWhite = piece.color === PieceColor.White;
  return {
    fill: isWhite ? 'var(--piece-white)' : 'var(--piece-black)',
    stroke: isWhite ? 'var(--piece-white-stroke)' : 'var(--piece-black-stroke)',
  };
}

function describePiece(piece: PieceData, sq: Square): string {
  const color = piece.color === PieceColor.White ? 'White' : 'Black';
  const type = piece.type === PieceType.King ? 'king' : 'pawn';
  return `${color} ${type} on square ${String(sq)}`;
}

export default function Piece({
  piece,
  sq,
  cx,
  cy,
  isSelectable = false,
  isSelected = false,
}: PieceProps) {
  const { fill, stroke } = getPieceColors(piece);
  const isKing = piece.type === PieceType.King;

  const className = isSelectable ? styles.pieceSelectable : undefined;

  return (
    <g
      aria-label={describePiece(piece, sq)}
      data-testid="piece"
      className={className}
    >
      <circle
        cx={cx}
        cy={cy}
        r={PIECE_RADIUS}
        fill={fill}
        stroke={isSelected ? 'var(--ui-accent)' : stroke}
        strokeWidth={isSelected ? PIECE_STROKE_WIDTH + SELECTED_STROKE_EXTRA : PIECE_STROKE_WIDTH}
      />
      {isKing && (
        <path
          d="M -12,-6 L -8,6 L -4,-2 L 0,6 L 4,-2 L 8,6 L 12,-6 Z"
          transform={`translate(${String(cx)}, ${String(cy - 4)})`}
          fill="var(--ui-accent)"
          data-testid="crown"
        />
      )}
    </g>
  );
}
