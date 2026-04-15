/**
 * CrossBoardRenderer — Greek cross 33-point Fox and Geese board.
 *
 * Arm regions are tinted distinctly from the hub so the asymmetric Fox and
 * Geese setup reads at a glance. Reference: Bell, "Board and Table Games
 * from Many Civilizations" (cross-board classical layout).
 */

import { memo, useMemo } from 'react';
import styles from './CrossBoardRenderer.module.css';
import type { BoardRendererProps } from './types';
import { usePreviewMode } from './usePreviewMode';
import { InteractionLayer } from './InteractionLayer';
import type { HitTarget } from './InteractionLayer';
import { PieceLayer } from './PieceLayer';
import type { NodePosition } from './PieceLayer';
import { decodeCrossNode } from '../../engine/adjacency/CrossAdjacency';

const GRID = 7;

function CrossBoardRendererImpl(props: BoardRendererProps) {
  const { geometry, state, selection, onNodeInteract, overlays, theme, mode, size, ariaLabel } = props;
  const preview = usePreviewMode(mode, size);
  const side = preview.size;
  const cell = side / GRID;

  const nodes = useMemo(() => geometry.adjacency.listAllNodes(), [geometry]);

  const layout = useMemo(() => nodes.map((node) => {
    const { r, c } = decodeCrossNode(node);
    return {
      node,
      x: c * cell + cell / 2,
      y: r * cell + cell / 2,
      r,
      c,
    };
  }), [nodes, cell]);

  const positions: readonly NodePosition[] = layout.map((l) => ({
    node: l.node,
    x: l.x,
    y: l.y,
    radius: cell * 0.35,
  }));

  const targets: readonly HitTarget[] = layout.map((l) => ({
    node: l.node,
    x: l.c * cell,
    y: l.r * cell,
    width: cell,
    height: cell,
    ariaLabel: geometry.coordinateLabels.ariaOf(l.node),
  }));

  const isHub = (r: number, c: number): boolean => r >= 2 && r <= 4 && c >= 2 && c <= 4;

  return (
    <svg
      role={preview.interactive ? 'application' : 'img'}
      aria-label={ariaLabel}
      width={side}
      height={side}
      viewBox={`0 0 ${String(side)} ${String(side)}`}
      className={styles.board}
      style={{ ['--preview-saturation' as string]: String(preview.saturation) }}
      data-testid="cross-board-renderer"
      data-mode={mode}
    >
      {layout.map((l) => {
        const isSelected = selection.selected === l.node;
        const isLegal = selection.legalTargets.has(l.node);
        const fill = isSelected
          ? theme.highlightSelected
          : isLegal
            ? theme.highlightLegal
            : isHub(l.r, l.c)
              ? theme.boardDark
              : theme.boardLight;
        return (
          <rect
            key={String(l.node)}
            x={l.c * cell}
            y={l.r * cell}
            width={cell}
            height={cell}
            fill={fill}
            stroke={theme.boardBorder}
            strokeWidth={0.5}
          />
        );
      })}

      {overlays}

      <PieceLayer geometry={geometry} state={state} positions={positions} theme={theme} />

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

export const CrossBoardRenderer = memo(CrossBoardRendererImpl);
