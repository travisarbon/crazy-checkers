/**
 * ArcTrackBoardRenderer — Surakarta.
 *
 * Inner 6×6 grid rendered on intersections; corner arc loops rendered as SVG
 * arcs (decorative only — interaction targets remain inner-grid intersections).
 * Reference: Pritchard, "Encyclopedia of Chess Variants" (Surakarta).
 */

import { memo, useMemo } from 'react';
import styles from './ArcTrackBoardRenderer.module.css';
import type { BoardRendererProps } from './types';
import type { NodeId } from './BoardGeometry';
import { usePreviewMode } from './usePreviewMode';
import { InteractionLayer } from './InteractionLayer';
import type { HitTarget } from './InteractionLayer';
import { PieceLayer } from './PieceLayer';
import type { NodePosition } from './PieceLayer';
import { innerNodeId, isArcNode } from '../../engine/adjacency/ArcTrackAdjacency';

const INNER_SIZE = 6;

function ArcTrackBoardRendererImpl(props: BoardRendererProps) {
  const { geometry, state, selection, onNodeInteract, overlays, theme, mode, size, ariaLabel } = props;
  const preview = usePreviewMode(mode, size);
  const side = preview.size;
  const cell = side / (INNER_SIZE + 1);

  const innerNodes = useMemo(() => {
    const arr: NodeId[] = [];
    for (let r = 0; r < INNER_SIZE; r += 1) {
      for (let c = 0; c < INNER_SIZE; c += 1) arr.push(innerNodeId(r, c));
    }
    return arr;
  }, []);

  const layout = useMemo(
    () =>
      innerNodes.map((node) => {
        const idx = node as unknown as number;
        const r = Math.floor(idx / INNER_SIZE);
        const c = idx % INNER_SIZE;
        return {
          node,
          x: (c + 0.5) * cell,
          y: (r + 0.5) * cell,
          r,
          c,
        };
      }),
    [innerNodes, cell],
  );

  const positions: readonly NodePosition[] = layout.map((l) => ({
    node: l.node,
    x: l.x,
    y: l.y,
    radius: cell * 0.3,
  }));

  const targets: readonly HitTarget[] = layout.map((l) => ({
    node: l.node,
    x: l.x - cell / 2,
    y: l.y - cell / 2,
    width: cell,
    height: cell,
    ariaLabel: geometry.coordinateLabels.ariaOf(l.node),
  }));

  // Skip arc nodes in piece/hit rendering (they're internal to adjacency).
  const pieceEntries = Array.from(state.pieces.entries()).filter(
    ([node]) => !isArcNode(node),
  );
  const innerState = {
    ...state,
    pieces: new Map(pieceEntries),
  };

  const arcPaths = useMemo(() => {
    const paths: string[] = [];
    const corners = [
      { cx: 0.5 * cell, cy: 0.5 * cell },
      { cx: (INNER_SIZE - 0.5) * cell, cy: 0.5 * cell },
      { cx: 0.5 * cell, cy: (INNER_SIZE - 0.5) * cell },
      { cx: (INNER_SIZE - 0.5) * cell, cy: (INNER_SIZE - 0.5) * cell },
    ];
    const radii = [cell * 0.75, cell * 1.5];
    for (const corner of corners) {
      for (const radius of radii) {
        paths.push(
          `M ${String(corner.cx - radius)} ${String(corner.cy)} A ${String(radius)} ${String(radius)} 0 0 1 ${String(corner.cx)} ${String(corner.cy - radius)}`,
        );
        paths.push(
          `M ${String(corner.cx + radius)} ${String(corner.cy)} A ${String(radius)} ${String(radius)} 0 0 0 ${String(corner.cx)} ${String(corner.cy - radius)}`,
        );
        paths.push(
          `M ${String(corner.cx - radius)} ${String(corner.cy)} A ${String(radius)} ${String(radius)} 0 0 0 ${String(corner.cx)} ${String(corner.cy + radius)}`,
        );
        paths.push(
          `M ${String(corner.cx + radius)} ${String(corner.cy)} A ${String(radius)} ${String(radius)} 0 0 1 ${String(corner.cx)} ${String(corner.cy + radius)}`,
        );
      }
    }
    return paths;
  }, [cell]);

  return (
    <svg
      role={preview.interactive ? 'application' : 'img'}
      aria-label={ariaLabel}
      width={side}
      height={side}
      viewBox={`0 0 ${String(side)} ${String(side)}`}
      className={styles.board}
      style={{ ['--preview-saturation' as string]: String(preview.saturation) }}
      data-testid="arc-track-board-renderer"
      data-mode={mode}
    >
      <rect x={0} y={0} width={side} height={side} fill={theme.boardLight} />
      {layout.map((l) => (
        <g key={`grid-${String(l.node)}`}>
          {l.c < INNER_SIZE - 1 ? (
            <line x1={l.x} y1={l.y} x2={l.x + cell} y2={l.y} stroke={theme.boardBorder} strokeWidth={1} />
          ) : null}
          {l.r < INNER_SIZE - 1 ? (
            <line x1={l.x} y1={l.y} x2={l.x} y2={l.y + cell} stroke={theme.boardBorder} strokeWidth={1} />
          ) : null}
        </g>
      ))}
      {arcPaths.map((d, i) => (
        <path key={`arc-${String(i)}`} d={d} fill="none" stroke={theme.boardBorder} strokeWidth={1} opacity={0.6} />
      ))}

      {selection.selected !== null ? (() => {
        const l = layout.find((x) => x.node === selection.selected);
        return l ? <circle cx={l.x} cy={l.y} r={cell * 0.4} fill={theme.highlightSelected} opacity={0.4} /> : null;
      })() : null}

      {[...selection.legalTargets].map((t) => {
        const l = layout.find((x) => x.node === t);
        return l ? <circle key={`legal-${String(t)}`} cx={l.x} cy={l.y} r={cell * 0.15} fill={theme.highlightLegal} /> : null;
      })}

      {overlays}

      <PieceLayer geometry={geometry} state={innerState} positions={positions} theme={theme} />

      <InteractionLayer
        targets={targets}
        primaryDirection="orthogonal"
        adjacency={geometry.adjacency}
        interactive={preview.interactive}
        tabbable={preview.tabbable}
        onNodeInteract={onNodeInteract}
      />
    </svg>
  );
}

export const ArcTrackBoardRenderer = memo(ArcTrackBoardRendererImpl);
