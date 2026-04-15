/**
 * Draughts king SVG — pawn disc + crown glyph (Task 27.5).
 *
 * Pixel-equivalent to the Phase 2/3 `src/ui/Piece.tsx` king output: same disc,
 * same crown path `M -12,6 L -8,-6 L -4,2 L 0,-6 L 4,2 L 8,-6 L 12,6 Z`,
 * translated by (0, 4). The crown fill is `theme.uiAccent`.
 */

import type { ReactElement } from 'react';
import type { PieceRenderProps } from '../../PieceVisualSpec';
import { renderDraughtsPawn } from './pawn';

export function renderDraughtsKing(
  props: PieceRenderProps,
  side: 'white' | 'black',
): ReactElement {
  return (
    <g data-piece="draughts-king" data-side={side}>
      {renderDraughtsPawn(props, side)}
      <path
        d="M -12,6 L -8,-6 L -4,2 L 0,-6 L 4,2 L 8,-6 L 12,6 Z"
        transform="translate(0, 4)"
        fill={props.theme.uiAccent}
        data-testid="crown"
      />
    </g>
  );
}
