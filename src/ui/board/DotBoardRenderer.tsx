/**
 * DotBoardRenderer — Dots and Boxes.
 *
 * Unique renderer in the Task 27.3 set where the interactive target is an
 * **edge** rather than a square. Claimed edges render thick; completed boxes
 * render with the claiming player's colour. Reference: Berlekamp, "The Dots
 * and Boxes Game".
 */

import { memo, useMemo } from 'react';
import styles from './DotBoardRenderer.module.css';
import type { BoardRendererProps } from './types';
import { usePreviewMode } from './usePreviewMode';
import { InteractionLayer } from './InteractionLayer';
import type { HitTarget } from './InteractionLayer';
import {
  dotLayout,
  hEdgeId,
  vEdgeId,
  boxId,
  dotId,
} from '../../engine/adjacency/DotAdjacency';

function DotBoardRendererImpl(props: BoardRendererProps) {
  const { geometry, state, selection, onNodeInteract, overlays, theme, mode, size, ariaLabel } = props;
  const preview = usePreviewMode(mode, size);
  const dim = geometry.dimensions.dotGrid;
  if (!dim) {
    throw new Error(`DotBoardRenderer: geometry ${geometry.serializedKey} missing dotGrid dimensions`);
  }
  const layout = useMemo(() => dotLayout({ boxesAcross: dim.boxesAcross, boxesDown: dim.boxesDown }), [dim]);
  const side = preview.size;
  const cell = side / (Math.max(dim.boxesAcross, dim.boxesDown) + 1);
  const width = cell * (dim.boxesAcross + 1);
  const height = cell * (dim.boxesDown + 1);

  const dots: { x: number; y: number }[] = [];
  for (let r = 0; r <= dim.boxesDown; r += 1) {
    for (let c = 0; c <= dim.boxesAcross; c += 1) {
      dots.push({ x: (c + 0.5) * cell, y: (r + 0.5) * cell });
    }
  }

  const edgeHitWidth = cell * 0.4;
  const targets: HitTarget[] = [];
  const hEdges: { node: ReturnType<typeof hEdgeId>; x1: number; y1: number; x2: number; y2: number; claimed: boolean }[] = [];
  const vEdges: { node: ReturnType<typeof vEdgeId>; x1: number; y1: number; x2: number; y2: number; claimed: boolean }[] = [];

  for (let r = 0; r <= dim.boxesDown; r += 1) {
    for (let c = 0; c < dim.boxesAcross; c += 1) {
      const n = hEdgeId(layout, r, c);
      const x1 = (c + 0.5) * cell;
      const x2 = (c + 1.5) * cell;
      const y = (r + 0.5) * cell;
      hEdges.push({ node: n, x1, y1: y, x2, y2: y, claimed: state.pieces.has(n) });
      targets.push({
        node: n,
        x: x1,
        y: y - edgeHitWidth / 2,
        width: cell,
        height: edgeHitWidth,
        ariaLabel: geometry.coordinateLabels.ariaOf(n),
      });
    }
  }
  for (let r = 0; r < dim.boxesDown; r += 1) {
    for (let c = 0; c <= dim.boxesAcross; c += 1) {
      const n = vEdgeId(layout, r, c);
      const x = (c + 0.5) * cell;
      const y1 = (r + 0.5) * cell;
      const y2 = (r + 1.5) * cell;
      vEdges.push({ node: n, x1: x, y1, x2: x, y2, claimed: state.pieces.has(n) });
      targets.push({
        node: n,
        x: x - edgeHitWidth / 2,
        y: y1,
        width: edgeHitWidth,
        height: cell,
        ariaLabel: geometry.coordinateLabels.ariaOf(n),
      });
    }
  }

  return (
    <svg
      role={preview.interactive ? 'application' : 'img'}
      aria-label={ariaLabel}
      width={width}
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className={styles.board}
      style={{ ['--preview-saturation' as string]: String(preview.saturation) }}
      data-testid="dot-board-renderer"
      data-mode={mode}
    >
      <rect x={0} y={0} width={width} height={height} fill={theme.boardLight} />

      {Array.from({ length: dim.boxesDown }, (_, r) =>
        Array.from({ length: dim.boxesAcross }, (_, c) => {
          const node = boxId(layout, r, c);
          const owner = state.pieces.get(node);
          if (!owner) return null;
          const fill = owner.owner.toLowerCase() === 'white' ? theme.pieceWhite : theme.pieceBlack;
          return (
            <rect
              key={`box-${String(node)}`}
              x={(c + 0.5) * cell}
              y={(r + 0.5) * cell}
              width={cell}
              height={cell}
              fill={fill}
              opacity={0.35}
            />
          );
        }),
      )}

      {hEdges.map((e) => (
        <line
          key={`h-${String(e.node)}`}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke={e.claimed ? theme.pieceBlackStroke : theme.boardBorder}
          strokeWidth={e.claimed ? 4 : 1}
          opacity={e.claimed ? 1 : 0.4}
        />
      ))}
      {vEdges.map((e) => (
        <line
          key={`v-${String(e.node)}`}
          x1={e.x1}
          y1={e.y1}
          x2={e.x2}
          y2={e.y2}
          stroke={e.claimed ? theme.pieceBlackStroke : theme.boardBorder}
          strokeWidth={e.claimed ? 4 : 1}
          opacity={e.claimed ? 1 : 0.4}
        />
      ))}

      {[...selection.legalTargets].map((n) => {
        const h = hEdges.find((e) => e.node === n);
        if (h) {
          return (
            <line
              key={`legal-${String(n)}`}
              x1={h.x1}
              y1={h.y1}
              x2={h.x2}
              y2={h.y2}
              stroke={theme.highlightLegal}
              strokeWidth={3}
            />
          );
        }
        const v = vEdges.find((e) => e.node === n);
        return v ? (
          <line
            key={`legal-${String(n)}`}
            x1={v.x1}
            y1={v.y1}
            x2={v.x2}
            y2={v.y2}
            stroke={theme.highlightLegal}
            strokeWidth={3}
          />
        ) : null;
      })}

      {dots.map((d, i) => {
        const r = Math.floor(i / (dim.boxesAcross + 1));
        const c = i % (dim.boxesAcross + 1);
        return (
          <circle
            key={`dot-${String(dotId(layout, r, c))}`}
            cx={d.x}
            cy={d.y}
            r={Math.max(2, cell * 0.08)}
            fill={theme.boardBorder}
          />
        );
      })}

      {overlays}

      <InteractionLayer
        targets={targets}
        primaryDirection="dot-edge"
        adjacency={geometry.adjacency}
        interactive={preview.interactive}
        tabbable={preview.tabbable}
        onNodeInteract={onNodeInteract}
      />
    </svg>
  );
}

export const DotBoardRenderer = memo(DotBoardRendererImpl);
