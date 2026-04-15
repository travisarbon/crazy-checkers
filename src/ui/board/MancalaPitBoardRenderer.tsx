/**
 * MancalaPitBoardRenderer — Oware (2×6) and Bao (4×8).
 *
 * Pits render as ovals with integer seed counts (read from `piece.count`).
 * Stores render as elongated end-pits for Oware; Bao has no stores. Optional
 * sowing-order arrows render in the `overlays` slot when Cogitate Replay
 * toggles them on. Reference: De Voogt, Oware and Bao rulesets.
 */

import { memo } from 'react';
import styles from './MancalaPitBoardRenderer.module.css';
import type { BoardRendererProps } from './types';
import type { NodeId } from './BoardGeometry';
import { asNodeId } from './BoardGeometry';
import { usePreviewMode } from './usePreviewMode';
import { InteractionLayer } from './InteractionLayer';
import type { HitTarget } from './InteractionLayer';
import { PieceLayer } from './PieceLayer';
import type { NodePosition } from './PieceLayer';

function MancalaPitBoardRendererImpl(props: BoardRendererProps) {
  const { geometry, state, selection, onNodeInteract, overlays, theme, mode, size, ariaLabel } = props;
  const preview = usePreviewMode(mode, size);
  const dim = geometry.dimensions.mancalaPit;
  if (!dim) {
    throw new Error(`MancalaPitBoardRenderer: geometry ${geometry.serializedKey} missing mancalaPit dimensions`);
  }
  const { rows, cols, stores } = dim;
  const hasStores = stores.length > 0;
  const width = preview.size;
  const pitWidth = width / (cols + (hasStores ? 2 : 0));
  const pitHeight = pitWidth * 0.9;
  const height = rows * pitHeight;

  const storeLeftX = 0;
  const storeRightX = hasStores ? width - pitWidth : width;
  const pitsLeftX = hasStores ? pitWidth : 0;

  const positions: NodePosition[] = [];
  const targets: HitTarget[] = [];

  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const node = asNodeId(r * cols + c);
      const cx = pitsLeftX + (c + 0.5) * pitWidth;
      const cy = (r + 0.5) * pitHeight;
      positions.push({ node, x: cx, y: cy, radius: pitWidth * 0.35 });
      targets.push({
        node,
        x: pitsLeftX + c * pitWidth,
        y: r * pitHeight,
        width: pitWidth,
        height: pitHeight,
        ariaLabel: geometry.coordinateLabels.ariaOf(node),
      });
    }
  }

  const storeNodes: { node: NodeId; x: number; y: number }[] = [];
  if (hasStores) {
    const storeBase = rows * cols;
    storeNodes.push({ node: asNodeId(storeBase), x: storeLeftX, y: 0 });
    storeNodes.push({ node: asNodeId(storeBase + 1), x: storeRightX, y: 0 });
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
      data-testid="mancala-pit-board-renderer"
      data-mode={mode}
    >
      <rect x={0} y={0} width={width} height={height} fill={theme.boardDark} />

      {hasStores
        ? storeNodes.map((s) => (
            <rect
              key={`store-${String(s.node)}`}
              x={s.x + pitWidth * 0.1}
              y={pitHeight * 0.15}
              width={pitWidth * 0.8}
              height={height - pitHeight * 0.3}
              rx={pitWidth * 0.3}
              ry={pitWidth * 0.3}
              fill={theme.boardLight}
              stroke={theme.boardBorder}
              strokeWidth={1}
            />
          ))
        : null}

      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const node = asNodeId(r * cols + c);
          const cx = pitsLeftX + (c + 0.5) * pitWidth;
          const cy = (r + 0.5) * pitHeight;
          const isSelected = selection.selected === node;
          const isLegal = selection.legalTargets.has(node);
          return (
            <ellipse
              key={`pit-${String(node)}`}
              cx={cx}
              cy={cy}
              rx={pitWidth * 0.42}
              ry={pitHeight * 0.4}
              fill={isSelected ? theme.highlightSelected : isLegal ? theme.highlightLegal : theme.boardLight}
              stroke={theme.boardBorder}
              strokeWidth={1}
            />
          );
        }),
      )}

      {hasStores
        ? storeNodes.map((s) => {
            const piece = state.pieces.get(s.node);
            const count = piece?.count ?? 0;
            return (
              <text
                key={`store-count-${String(s.node)}`}
                x={s.x + pitWidth / 2}
                y={height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fill={theme.pieceBlack}
                fontSize={pitWidth * 0.45}
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                {String(count)}
              </text>
            );
          })
        : null}

      {overlays}

      <PieceLayer geometry={geometry} state={state} positions={positions} theme={theme} showSeedCounts />

      <InteractionLayer
        targets={targets}
        primaryDirection="pit-chain"
        adjacency={geometry.adjacency}
        interactive={preview.interactive}
        tabbable={preview.tabbable}
        onNodeInteract={onNodeInteract}
      />
    </svg>
  );
}

export const MancalaPitBoardRenderer = memo(MancalaPitBoardRendererImpl);
