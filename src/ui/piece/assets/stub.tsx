/**
 * Placeholder stub renderer used by every scaffold family (Task 27.5).
 *
 * Scaffold families (stacking, chess, shogi, go, etc.) register a single
 * stub entry flagged `__PIECE_STUB__: true` so tier tasks find a runtime-
 * stable pieceId to replace. The `__PIECE_STUB__` production guard
 * (`scripts/check-piece-stubs.ts`) fails the build if any stub is reachable
 * from a registered Classified game.
 */

import type { ReactElement } from 'react';
import type { PieceRenderProps } from '../PieceVisualSpec';

export function renderStubPiece(
  props: PieceRenderProps,
  glyph: string,
  side: 'white' | 'black' | 'either',
): ReactElement {
  const { theme, radius = 38 } = props;
  const isBlack = side === 'black';
  const fill = isBlack ? theme.pieceBlack : theme.pieceWhite;
  const stroke = isBlack ? theme.pieceBlackStroke : theme.pieceWhiteStroke;
  const textFill = isBlack ? theme.pieceWhite : theme.pieceBlack;
  return (
    <g data-piece="stub" data-glyph={glyph}>
      <circle
        cx={0}
        cy={0}
        r={radius}
        fill={fill}
        stroke={stroke}
        strokeWidth={3}
        strokeDasharray="4 2"
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill={textFill}
        fontSize={radius * 0.8}
        fontFamily="sans-serif"
        fontWeight="bold"
        pointerEvents="none"
      >
        {glyph}
      </text>
    </g>
  );
}
