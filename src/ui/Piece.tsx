/**
 * Individual piece component — SVG circle with optional king crown indicator.
 */

import type { Piece as PieceData, Square } from '../engine/types';
import { PieceColor, PieceType } from '../engine/types';

const PIECE_RADIUS = 38;
const PIECE_STROKE_WIDTH = 3;

interface PieceProps {
  piece: PieceData;
  sq: Square;
  cx: number;
  cy: number;
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

export default function Piece({ piece, sq, cx, cy }: PieceProps) {
  const { fill, stroke } = getPieceColors(piece);
  const isKing = piece.type === PieceType.King;

  return (
    <g aria-label={describePiece(piece, sq)} data-testid="piece">
      <circle
        cx={cx}
        cy={cy}
        r={PIECE_RADIUS}
        fill={fill}
        stroke={stroke}
        strokeWidth={PIECE_STROKE_WIDTH}
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
