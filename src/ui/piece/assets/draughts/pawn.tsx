/**
 * Draughts pawn SVG — the reference `theme-driven` piece (Task 27.5).
 *
 * Visually equivalent to the Phase 2/3 `src/ui/Piece.tsx` pawn output:
 * a disc of radius 38 with stroke-width 3, both colours sourced from the
 * Theme tokens (pieceWhite/pieceWhiteStroke/pieceBlack/pieceBlackStroke).
 */

import type { ReactElement } from 'react';
import type { PieceRenderProps } from '../../PieceVisualSpec';

const PIECE_RADIUS = 38;
const PIECE_STROKE_WIDTH = 3;

export function renderDraughtsPawn(
  props: PieceRenderProps,
  side: 'white' | 'black',
): ReactElement {
  const { theme, radius = PIECE_RADIUS } = props;
  const fill = side === 'white' ? theme.pieceWhite : theme.pieceBlack;
  const stroke = side === 'white' ? theme.pieceWhiteStroke : theme.pieceBlackStroke;
  return (
    <g data-piece="draughts-pawn" data-side={side}>
      <circle
        cx={0}
        cy={0}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={PIECE_STROKE_WIDTH}
      />
    </g>
  );
}
