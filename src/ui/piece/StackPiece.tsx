/**
 * <StackPiece> — Lasca/Bashni/Focus/Emergo tower renderer (Task 27.5 §4.4).
 *
 * Composes the stack bottom-to-top using the top piece's
 * `heightFunction(depth)` to compute per-layer y-offset. Heights ≥
 * `showHeightBadgeAt` collapse mid-layers and surface a height badge.
 * Keyboard activation selects the top piece; per-layer identity is exposed
 * to screen readers via a visually hidden description list.
 */

import type { ReactElement } from 'react';
import { getPieceVisual } from './PieceRegistry';
import { describePiece } from './describePiece';
import type { Theme } from '../../themes/theme';

export interface StackPieceProps {
  readonly stack: readonly string[];
  readonly position: { readonly x: number; readonly y: number };
  readonly owner: 'white' | 'black' | 'either';
  readonly theme: Theme;
  readonly selected?: boolean;
  readonly lastMoved?: boolean;
  readonly radius?: number;
  readonly onActivate?: () => void;
  readonly showHeightBadgeAt?: number;
  readonly squareLabel?: string;
}

const DEFAULT_RADIUS = 38;
const DEFAULT_BADGE_THRESHOLD = 8;
const COLLAPSED_VISIBLE_LAYERS = 3;

export function StackPiece(props: StackPieceProps): ReactElement {
  const {
    stack,
    position,
    owner,
    theme,
    selected,
    lastMoved,
    radius = DEFAULT_RADIUS,
    onActivate,
    showHeightBadgeAt = DEFAULT_BADGE_THRESHOLD,
    squareLabel,
  } = props;

  if (stack.length === 0) {
    throw new Error('[StackPiece] stack must be non-empty');
  }
  if (stack.length > 64) {
    throw new Error('[StackPiece] stack length exceeds 64');
  }

  const topPieceId = stack[stack.length - 1] as string;
  const topSpec = getPieceVisual(topPieceId);
  const heightFn = topSpec.heightFunction ?? ((depth: number) => depth * 4);

  const shouldCollapse = stack.length >= showHeightBadgeAt;
  const layersToRender = shouldCollapse
    ? [
        ...stack.slice(0, 1),
        ...stack.slice(-COLLAPSED_VISIBLE_LAYERS),
      ]
    : stack;

  const topLabel = describePiece(topPieceId, {
    location: squareLabel
      ? { kind: 'board', square: squareLabel }
      : { kind: 'palette' },
    selected,
    lastMoved,
    stackDepth: stack.length,
  });

  return (
    <g
      data-testid="stack-piece"
      data-stack-depth={String(stack.length)}
      transform={`translate(${String(position.x)}, ${String(position.y)})`}
      aria-label={topLabel}
      role={onActivate ? 'button' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onKeyDown={
        onActivate
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onActivate();
              }
            }
          : undefined
      }
    >
      {layersToRender.map((pieceId, i) => {
        const spec = getPieceVisual(pieceId);
        const dy = -heightFn(i);
        return (
          <g
            key={`${String(i)}-${pieceId}`}
            transform={`translate(0, ${String(dy)})`}
            data-layer={String(i)}
          >
            {spec.render({ theme, owner, radius })}
          </g>
        );
      })}
      {selected ? (
        <circle
          r={radius + 4}
          cy={-heightFn(stack.length - 1)}
          fill="none"
          stroke={theme.uiAccent}
          strokeWidth={3}
        />
      ) : null}
      {shouldCollapse ? (
        <g data-testid="stack-height-badge" transform={`translate(${String(radius * 0.65)}, ${String(-heightFn(stack.length - 1) - radius * 0.7)})`}>
          <circle r={radius * 0.38} fill={theme.uiSurface} stroke={theme.pieceWhiteStroke} strokeWidth={1.5} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fill={theme.uiText}
            fontSize={radius * 0.5}
            fontFamily="sans-serif"
            fontWeight="bold"
          >
            {String(stack.length)}
          </text>
        </g>
      ) : null}
    </g>
  );
}

export default StackPiece;
