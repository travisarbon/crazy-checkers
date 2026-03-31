/**
 * Individual piece component — SVG circle with optional king crown indicator.
 * Supports visual feedback for selection, selectability, and move animations.
 *
 * Rendering uses origin-based positioning: the circle and crown are drawn at
 * (0, 0) and the wrapping <g> element's transform positions the piece. This
 * enables smooth CSS transitions on the transform property for slide animations.
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

  // Animation props
  /** Override SVG position for slide animation. When set, piece renders here instead of (cx, cy). */
  animTargetCx?: number;
  animTargetCy?: number;
  /** Transition duration for the current slide (ms). 0 = no transition. */
  animDurationMs?: number;
  /** Easing function for the slide transition. Default: 'ease-out'. */
  animEasing?: string;
  /** Opacity override (0–1). Used for capture fade-out. */
  animOpacity?: number;
  /** Scale override. Used for king pulse. */
  animScale?: number;
  /** Transition duration for opacity changes (ms). */
  animOpacityDurationMs?: number;
  /** Called when the slide transition completes. */
  onTransitionEnd?: () => void;
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
  animTargetCx,
  animTargetCy,
  animDurationMs = 0,
  animEasing = 'ease-out',
  animOpacity,
  animScale,
  animOpacityDurationMs,
  onTransitionEnd,
}: PieceProps) {
  const { fill, stroke } = getPieceColors(piece);
  const isKing = piece.type === PieceType.King;

  const className = isSelectable ? styles.pieceSelectable : undefined;

  // Determine the render position: animation target overrides default position
  const renderCx = animTargetCx ?? cx;
  const renderCy = animTargetCy ?? cy;

  // Build the transform: translate to center, then scale if needed
  const scale = animScale ?? 1;
  const transform = `translate(${String(renderCx)}, ${String(renderCy)}) scale(${String(scale)})`;

  // Build transition string
  const transitions: string[] = [];
  if (animDurationMs > 0) {
    transitions.push(`transform ${String(animDurationMs)}ms ${animEasing}`);
  }
  if (animOpacityDurationMs != null && animOpacityDurationMs > 0) {
    transitions.push(`opacity ${String(animOpacityDurationMs)}ms ease-out`);
  }

  const style: React.CSSProperties = {
    transition: transitions.length > 0 ? transitions.join(', ') : 'none',
    opacity: animOpacity ?? 1,
  };

  const hasAnimation = animDurationMs > 0 || animOpacityDurationMs != null;

  return (
    <g
      aria-label={describePiece(piece, sq)}
      data-testid="piece"
      className={[className, hasAnimation ? styles.pieceAnimating : ''].filter(Boolean).join(' ') || undefined}
      transform={transform}
      style={style}
      onTransitionEnd={onTransitionEnd}
    >
      {/* Circle centered at origin (0,0) — the <g> transform positions it */}
      <circle
        cx={0}
        cy={0}
        r={PIECE_RADIUS}
        fill={fill}
        stroke={isSelected ? 'var(--ui-accent)' : stroke}
        strokeWidth={isSelected ? PIECE_STROKE_WIDTH + SELECTED_STROKE_EXTRA : PIECE_STROKE_WIDTH}
      />
      {isKing && (
        <path
          d="M -12,6 L -8,-6 L -4,2 L 0,-6 L 4,2 L 8,-6 L 12,6 Z"
          transform="translate(0, 4)"
          fill="var(--ui-accent)"
          data-testid="crown"
        />
      )}
    </g>
  );
}
