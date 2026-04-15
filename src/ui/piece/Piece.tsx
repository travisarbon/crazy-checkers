/**
 * <Piece> — registry-driven piece renderer (Task 27.5 §4.3).
 *
 * Replaces the per-piece switch inside the Phase 2/3 single-face renderer
 * (`src/ui/Piece.tsx`) with a `getPieceVisual(pieceId).render(props)` dispatch.
 * The Phase 2/3 Piece.tsx remains the source-of-truth for the live American
 * Checkers game; this file is the Classified-mode counterpart.
 */

import type { CSSProperties, ReactElement } from 'react';
import { getPieceVisual } from './PieceRegistry';
import { describePiece } from './describePiece';
import type { PieceRenderProps } from './PieceVisualSpec';
import type { Theme } from '../../themes/theme';

export interface PieceProps {
  readonly pieceId: string;
  readonly owner: 'white' | 'black' | 'either';
  readonly position: { readonly x: number; readonly y: number };
  readonly theme: Theme;
  readonly selected?: boolean;
  readonly lastMoved?: boolean;
  readonly capturing?: boolean;
  readonly radius?: number;
  readonly promotionState?: 'unpromoted' | 'promoted';
  /** For Shogi-family two-sided pieces — when true, render the flipped face. */
  readonly showFlipped?: boolean;
  readonly ariaLabel?: string;
  readonly onActivate?: () => void;
  readonly squareLabel?: string;
}

export function Piece(props: PieceProps): ReactElement {
  const {
    pieceId,
    owner,
    position,
    theme,
    selected,
    lastMoved,
    capturing,
    radius,
    promotionState,
    showFlipped,
    ariaLabel,
    onActivate,
    squareLabel,
  } = props;

  const baseSpec = getPieceVisual(pieceId);
  const spec =
    showFlipped && baseSpec.flippedPieceId
      ? getPieceVisual(baseSpec.flippedPieceId)
      : baseSpec;

  const renderProps: PieceRenderProps = {
    theme,
    owner,
    selected,
    lastMoved,
    capturing,
    radius,
  };

  const computedLabel =
    ariaLabel ??
    describePiece(spec.pieceId, {
      location: squareLabel
        ? { kind: 'board', square: squareLabel }
        : { kind: 'palette' },
      selected,
      lastMoved,
      capturing,
      promotionState,
    });

  const style: CSSProperties = {
    opacity: capturing ? 0.4 : 1,
    transition: 'transform 120ms ease-out, opacity 160ms ease-out',
    cursor: onActivate ? 'pointer' : undefined,
  };

  return (
    <g
      data-testid="piece"
      data-piece-id={spec.pieceId}
      data-owner={owner}
      data-selected={selected ? 'true' : undefined}
      transform={`translate(${String(position.x)}, ${String(position.y)})`}
      aria-label={computedLabel}
      role={onActivate ? 'button' : undefined}
      tabIndex={onActivate ? 0 : undefined}
      style={style}
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
      {selected ? (
        <circle
          r={(radius ?? 38) + 4}
          fill="none"
          stroke={theme.uiAccent}
          strokeWidth={3}
          data-testid="piece-halo"
        />
      ) : null}
      {lastMoved ? (
        <circle
          r={(radius ?? 38) + 2}
          fill="none"
          stroke={theme.highlightLastMove}
          strokeWidth={2}
          data-testid="piece-last-move"
        />
      ) : null}
      {spec.render(renderProps)}
    </g>
  );
}

export default Piece;
