/**
 * SquareBoardRenderer — Task 27.3 canonical square/rectangle renderer.
 *
 * Consumes `geometry.dimensions.square` (preferred) or
 * `geometry.dimensions.rectangle` (via RectangleBoardRenderer delegation). The
 * indexing mode toggles between cell-centred pieces (draughts, Shogi) and
 * crossing-point pieces (Go, Gomoku, alquerque). Dark-squares-only variants
 * expose a `playableMask` that suppresses non-playable cells visually.
 */

import { memo, useMemo } from 'react';
import styles from './SquareBoardRenderer.module.css';
import type { BoardGeometry, NodeId } from './BoardGeometry';
import { asNodeId } from './BoardGeometry';
import type { BoardRendererProps } from './types';
import { usePreviewMode } from './usePreviewMode';
import { InteractionLayer } from './InteractionLayer';
import type { HitTarget } from './InteractionLayer';
import { PieceLayer } from './PieceLayer';
import type { NodePosition } from './PieceLayer';

interface SquareDims {
  readonly width: number;
  readonly height: number;
}

function dimsOf(geometry: BoardGeometry): SquareDims {
  const s = geometry.dimensions.square;
  if (s) return { width: s.size, height: s.size };
  const r = geometry.dimensions.rectangle;
  if (r) return { width: r.width, height: r.height };
  throw new Error(
    `SquareBoardRenderer: geometry ${geometry.serializedKey} has no square/rectangle dimensions`,
  );
}

function SquareBoardRendererImpl(props: BoardRendererProps) {
  const {
    geometry,
    state,
    selection,
    onNodeInteract,
    overlays,
    theme,
    mode,
    size,
    ariaLabel,
  } = props;

  const { width: cols, height: rows } = dimsOf(geometry);
  const preview = usePreviewMode(mode, size);
  const cell = preview.size / Math.max(cols, rows);
  const boardWidth = cell * cols;
  const boardHeight = cell * rows;

  const indexing = geometry.indexing;
  const playable = geometry.playableMask;

  const { targets, positions, cells } = useMemo(() => {
    const hitTargets: HitTarget[] = [];
    const piecePositions: NodePosition[] = [];
    const cellData: {
      readonly node: NodeId;
      readonly row: number;
      readonly col: number;
      readonly isPlayable: boolean;
    }[] = [];

    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const node = asNodeId(r * cols + c);
        const isPlayable = playable ? playable(node) : true;
        cellData.push({ node, row: r, col: c, isPlayable });
        if (!isPlayable) continue;
        const cx = indexing === 'intersections' ? c * cell : c * cell + cell / 2;
        const cy = indexing === 'intersections' ? r * cell : r * cell + cell / 2;
        const radius = indexing === 'intersections' ? cell * 0.4 : cell * 0.42;
        piecePositions.push({ node, x: cx, y: cy, radius });
        hitTargets.push({
          node,
          x: indexing === 'intersections' ? cx - cell / 2 : c * cell,
          y: indexing === 'intersections' ? cy - cell / 2 : r * cell,
          width: cell,
          height: cell,
          ariaLabel: geometry.coordinateLabels.ariaOf(node),
        });
      }
    }
    return { targets: hitTargets, positions: piecePositions, cells: cellData };
  }, [rows, cols, cell, indexing, playable, geometry.coordinateLabels]);

  const lastMoveFrom = selection.lastMove?.from ?? null;
  const lastMoveTo = selection.lastMove?.to ?? null;

  return (
    <svg
      role={preview.interactive ? 'application' : 'img'}
      aria-label={ariaLabel}
      width={boardWidth}
      height={boardHeight}
      viewBox={`0 0 ${String(boardWidth)} ${String(boardHeight)}`}
      className={styles.board}
      style={{ ['--preview-saturation' as string]: String(preview.saturation) }}
      data-testid="square-board-renderer"
      data-mode={mode}
      data-indexing={indexing}
    >
      {indexing === 'intersections' ? (
        <rect
          x={0}
          y={0}
          width={boardWidth}
          height={boardHeight}
          fill={theme.boardLight}
          stroke={theme.boardBorder}
        />
      ) : null}
      {indexing !== 'intersections'
        ? cells.map(({ node, row, col, isPlayable }) => {
            const fill = !isPlayable
              ? theme.boardLight
              : (row + col) % 2 === 0
                ? theme.boardLight
                : theme.boardDark;
            return (
              <rect
                key={String(node)}
                x={col * cell}
                y={row * cell}
                width={cell}
                height={cell}
                fill={fill}
                stroke={theme.boardBorder}
                strokeWidth={0.5}
              />
            );
          })
        : null}

      {indexing === 'intersections'
        ? cells.map(({ node, row, col, isPlayable }) => {
            if (!isPlayable) return null;
            const x = col * cell;
            const y = row * cell;
            return (
              <g key={String(node)}>
                {col < cols - 1 ? (
                  <line
                    x1={x}
                    y1={y}
                    x2={x + cell}
                    y2={y}
                    stroke={theme.boardBorder}
                    strokeWidth={1}
                  />
                ) : null}
                {row < rows - 1 ? (
                  <line
                    x1={x}
                    y1={y}
                    x2={x}
                    y2={y + cell}
                    stroke={theme.boardBorder}
                    strokeWidth={1}
                  />
                ) : null}
              </g>
            );
          })
        : null}

      {lastMoveFrom !== null
        ? (() => {
            const cellIdx = cells.find((cd) => cd.node === lastMoveFrom);
            if (!cellIdx) return null;
            return (
              <rect
                x={cellIdx.col * cell}
                y={cellIdx.row * cell}
                width={cell}
                height={cell}
                fill={theme.highlightLastMove}
                opacity={0.4}
              />
            );
          })()
        : null}
      {lastMoveTo !== null
        ? (() => {
            const cellIdx = cells.find((cd) => cd.node === lastMoveTo);
            if (!cellIdx) return null;
            return (
              <rect
                x={cellIdx.col * cell}
                y={cellIdx.row * cell}
                width={cell}
                height={cell}
                fill={theme.highlightLastMove}
                opacity={0.55}
              />
            );
          })()
        : null}

      {selection.selected !== null
        ? (() => {
            const cellIdx = cells.find((cd) => cd.node === selection.selected);
            if (!cellIdx) return null;
            return (
              <rect
                x={cellIdx.col * cell}
                y={cellIdx.row * cell}
                width={cell}
                height={cell}
                fill={theme.highlightSelected}
                opacity={0.4}
              />
            );
          })()
        : null}

      {[...selection.legalTargets].map((target) => {
        const cellIdx = cells.find((cd) => cd.node === target);
        if (!cellIdx) return null;
        return (
          <circle
            key={String(target)}
            cx={cellIdx.col * cell + cell / 2}
            cy={cellIdx.row * cell + cell / 2}
            r={cell * 0.15}
            fill={theme.highlightLegal}
            opacity={0.6}
          />
        );
      })}

      {overlays}

      <PieceLayer
        geometry={geometry}
        state={state}
        positions={positions}
        theme={theme}
      />

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

export const SquareBoardRenderer = memo(SquareBoardRendererImpl);
