/**
 * RingBoardRenderer — Nine Men's Morris + Morabaraba.
 *
 * Three concentric squares with spoke lines at the four cardinal mid-edges.
 * Morabaraba adds corner-diagonal strokes between adjacent rings when
 * `dimensions.ring.hasCornerDiagonals` is set.
 */

import { memo, useMemo } from 'react';
import styles from './RingBoardRenderer.module.css';
import type { BoardRendererProps } from './types';
import { usePreviewMode } from './usePreviewMode';
import { InteractionLayer } from './InteractionLayer';
import type { HitTarget } from './InteractionLayer';
import { PieceLayer } from './PieceLayer';
import type { NodePosition } from './PieceLayer';
import { decodeRingNode } from '../../engine/adjacency/RingAdjacency';

const POSITIONS: readonly [number, number][] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

function RingBoardRendererImpl(props: BoardRendererProps) {
  const { geometry, state, selection, onNodeInteract, overlays, theme, mode, size, ariaLabel } = props;
  const preview = usePreviewMode(mode, size);
  const ringDim = geometry.dimensions.ring;
  if (!ringDim) {
    throw new Error(`RingBoardRenderer: geometry ${geometry.serializedKey} missing ring dimensions`);
  }

  const side = preview.size;
  const margin = side * 0.08;

  const geom = useMemo(() => {
    const ringSpans = [
      side - 2 * margin,
      side - 2 * margin - side * 0.15,
      side - 2 * margin - side * 0.3,
    ];
    const positionFor = (ring: number, pos: number): { x: number; y: number } => {
      const half = (ringSpans[ring] ?? ringSpans[0] ?? side) / 2;
      const cx = side / 2;
      const cy = side / 2;
      const [dx, dy] = POSITIONS[pos] ?? [0, 0];
      return { x: cx + dx * half, y: cy + dy * half };
    };
    const layout = geometry.adjacency.listAllNodes().map((node) => {
      const { ring, pos } = decodeRingNode(node);
      const { x, y } = positionFor(ring, pos);
      return { node, x, y, ring, pos };
    });
    const rings = [0, 1, 2].map((ring) => {
      const half = (ringSpans[ring] ?? ringSpans[0] ?? side) / 2;
      const cx = side / 2;
      const cy = side / 2;
      return { x: cx - half, y: cy - half, w: 2 * half, h: 2 * half };
    });
    const spokes = [0, 2, 4, 6].map((pos) => {
      const outer = positionFor(0, pos);
      const inner = positionFor(2, pos);
      return { x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y };
    });
    const cornerDiagonals = ringDim.hasCornerDiagonals
      ? [1, 3, 5, 7].map((pos) => {
          const outer = positionFor(0, pos);
          const inner = positionFor(2, pos);
          return { x1: outer.x, y1: outer.y, x2: inner.x, y2: inner.y };
        })
      : [];
    return { layout, rings, spokes, cornerDiagonals };
  }, [side, margin, geometry, ringDim.hasCornerDiagonals]);

  const pointRadius = side * 0.025;
  const hitSize = side * 0.1;

  const positions: readonly NodePosition[] = geom.layout.map((l) => ({
    node: l.node,
    x: l.x,
    y: l.y,
    radius: pointRadius * 2.5,
  }));
  const targets: readonly HitTarget[] = geom.layout.map((l) => ({
    node: l.node,
    x: l.x - hitSize / 2,
    y: l.y - hitSize / 2,
    width: hitSize,
    height: hitSize,
    ariaLabel: geometry.coordinateLabels.ariaOf(l.node),
  }));

  return (
    <svg
      role={preview.interactive ? 'application' : 'img'}
      aria-label={ariaLabel}
      width={side}
      height={side}
      viewBox={`0 0 ${String(side)} ${String(side)}`}
      className={styles.board}
      style={{ ['--preview-saturation' as string]: String(preview.saturation) }}
      data-testid="ring-board-renderer"
      data-mode={mode}
    >
      <rect x={0} y={0} width={side} height={side} fill={theme.boardLight} />
      {geom.rings.map((r, i) => (
        <rect
          key={`ring-${String(i)}`}
          x={r.x}
          y={r.y}
          width={r.w}
          height={r.h}
          fill="none"
          stroke={theme.boardBorder}
          strokeWidth={2}
        />
      ))}
      {geom.spokes.map((s, i) => (
        <line
          key={`spoke-${String(i)}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={theme.boardBorder}
          strokeWidth={2}
        />
      ))}
      {geom.cornerDiagonals.map((s, i) => (
        <line
          key={`diag-${String(i)}`}
          x1={s.x1}
          y1={s.y1}
          x2={s.x2}
          y2={s.y2}
          stroke={theme.boardBorder}
          strokeWidth={2}
        />
      ))}
      {geom.layout.map((l) => (
        <circle
          key={`pt-${String(l.node)}`}
          cx={l.x}
          cy={l.y}
          r={pointRadius}
          fill={
            selection.selected === l.node
              ? theme.highlightSelected
              : selection.legalTargets.has(l.node)
                ? theme.highlightLegal
                : theme.boardBorder
          }
        />
      ))}

      {overlays}

      <PieceLayer geometry={geometry} state={state} positions={positions} theme={theme} />

      <InteractionLayer
        targets={targets}
        primaryDirection="ring-around"
        adjacency={geometry.adjacency}
        interactive={preview.interactive}
        tabbable={preview.tabbable}
        onNodeInteract={onNodeInteract}
      />
    </svg>
  );
}

export const RingBoardRenderer = memo(RingBoardRendererImpl);
