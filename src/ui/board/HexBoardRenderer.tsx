/**
 * HexBoardRenderer — pointy-top axial (q,r) hex renderer for both
 * `hex-rhombus` (Hex 11×11) and `hex-triangular` (Havannah 5/6/8).
 *
 * Reference: Red Blob Games, "Hexagonal Grids" (pointy-top axial layout).
 */

import { memo, useMemo } from 'react';
import styles from './HexBoardRenderer.module.css';
import type { BoardRendererProps } from './types';
import type { NodeId } from './BoardGeometry';
import { usePreviewMode } from './usePreviewMode';
import { InteractionLayer } from './InteractionLayer';
import type { HitTarget } from './InteractionLayer';
import { PieceLayer } from './PieceLayer';
import type { NodePosition } from './PieceLayer';
import { decodeAxial, encodeAxial } from '../../engine/adjacency/HexAdjacency';

function HexBoardRendererImpl(props: BoardRendererProps) {
  const { geometry, state, selection, onNodeInteract, overlays, theme, mode, size, ariaLabel } = props;

  const preview = usePreviewMode(mode, size);
  const isTriangular = geometry.kind === 'hex-triangular';
  const dim = isTriangular
    ? geometry.dimensions.hexTriangular
    : geometry.dimensions.hexRhombus;
  if (!dim) {
    throw new Error(
      `HexBoardRenderer: geometry ${geometry.serializedKey} missing hex dimensions`,
    );
  }

  const sizeN = dim.size;

  const nodes: readonly NodeId[] = useMemo(() => {
    const all: NodeId[] = [];
    if (isTriangular) {
      const k = sizeN - 1;
      for (let q = -k; q <= k; q += 1) {
        for (let r = -k; r <= k; r += 1) {
          const s = -q - r;
          if (Math.abs(s) <= k) all.push(encodeAxial(q, r));
        }
      }
    } else {
      for (let q = 0; q < sizeN; q += 1) {
        for (let r = 0; r < sizeN; r += 1) {
          all.push(encodeAxial(q, r));
        }
      }
    }
    return all;
  }, [sizeN, isTriangular]);

  const hexRadius = preview.size / (sizeN * 2.3);
  const hexW = Math.sqrt(3) * hexRadius;
  const hexH = 2 * hexRadius;
  const vSpacing = hexH * 0.75;

  const positioned = useMemo(() => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const arr = nodes.map((node) => {
      const { q, r } = decodeAxial(node);
      const x = hexW * (q + r / 2);
      const y = vSpacing * r;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      return { node, x, y };
    });
    const offX = -minX + hexW / 2;
    const offY = -minY + hexH / 2;
    const totalW = maxX - minX + hexW;
    const totalH = maxY - minY + hexH;
    return {
      points: arr.map((p) => ({ node: p.node, x: p.x + offX, y: p.y + offY })),
      width: totalW,
      height: totalH,
    };
  }, [nodes, hexW, hexH, vSpacing]);

  const positions: readonly NodePosition[] = useMemo(
    () => positioned.points.map((p) => ({ node: p.node, x: p.x, y: p.y, radius: hexRadius * 0.7 })),
    [positioned, hexRadius],
  );

  const targets: readonly HitTarget[] = useMemo(
    () => positioned.points.map((p) => ({
      node: p.node,
      x: p.x - hexW / 2,
      y: p.y - hexH / 2,
      width: hexW,
      height: hexH,
      ariaLabel: geometry.coordinateLabels.ariaOf(p.node),
    })),
    [positioned, hexW, hexH, geometry.coordinateLabels],
  );

  const hexPath = (cx: number, cy: number): string => {
    const pts: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const px = cx + hexRadius * Math.cos(angle);
      const py = cy + hexRadius * Math.sin(angle);
      pts.push(`${px.toFixed(2)},${py.toFixed(2)}`);
    }
    return `M${pts.join(' L')} Z`;
  };

  return (
    <svg
      role={preview.interactive ? 'application' : 'img'}
      aria-label={ariaLabel}
      width={positioned.width}
      height={positioned.height}
      viewBox={`0 0 ${String(positioned.width)} ${String(positioned.height)}`}
      className={styles.board}
      style={{ ['--preview-saturation' as string]: String(preview.saturation) }}
      data-testid="hex-board-renderer"
      data-mode={mode}
    >
      {positioned.points.map(({ node, x, y }) => {
        const isSelected = selection.selected === node;
        const isLegal = selection.legalTargets.has(node);
        const fill = isSelected
          ? theme.highlightSelected
          : isLegal
            ? theme.highlightLegal
            : theme.boardLight;
        return (
          <path
            key={String(node)}
            d={hexPath(x, y)}
            fill={fill}
            stroke={theme.boardBorder}
            strokeWidth={1}
          />
        );
      })}

      {overlays}

      <PieceLayer geometry={geometry} state={state} positions={positions} theme={theme} />

      <InteractionLayer
        targets={targets}
        primaryDirection="hex"
        adjacency={geometry.adjacency}
        interactive={preview.interactive}
        tabbable={preview.tabbable}
        onNodeInteract={onNodeInteract}
      />
    </svg>
  );
}

export const HexBoardRenderer = memo(HexBoardRendererImpl);
