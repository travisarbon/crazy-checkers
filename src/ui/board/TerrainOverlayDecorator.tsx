/**
 * TerrainOverlayDecorator — HOC-style renderer that composes terrain overlays
 * on top of a base geometry's registered renderer.
 *
 * Consumes `geometry.dimensions.terrainOverlay.baseKey` to rebuild the base
 * geometry descriptor for the inner renderer, then paints region fills + trap
 * / camp / throne markers into the `overlays` slot. Used by Arimaa traps,
 * Hnefatafl/Tablut throne + corners, Halma/Chinese-Checkers camps.
 */

import { createElement, memo } from 'react';
import type { BoardGeometry, NodeId, OverlayRegion } from './BoardGeometry';
import type { BoardRendererProps } from './types';
import { getBoardRenderer } from './BoardRendererRegistry';
import { getRegisteredBaseGeometry } from './baseGeometryRegistry';

export interface TerrainOverlayDecoratorProps extends BoardRendererProps {
  /**
   * Caller may supply the base geometry explicitly (used by Task 27.4
   * registration sites and tests). If omitted, the decorator resolves it via
   * the overlay's `baseKey` against the base-geometry registry.
   */
  readonly baseGeometry?: BoardGeometry;
}

const REGION_FILL_OPACITY = 0.28;

function regionFillFor(region: OverlayRegion): string {
  const name = region.name.toLowerCase();
  if (name.includes('trap')) return '#b8342a';
  if (name.includes('throne') || name.includes('king')) return '#f2c744';
  if (name.includes('corner') || name.includes('escape')) return '#4db8c4';
  if (name.includes('camp') || name.includes('base')) return '#6fa661';
  return '#9879c4';
}

function findNodePositions(
  geometry: BoardGeometry,
): ReadonlyMap<NodeId, { row: number; col: number }> {
  const map = new Map<NodeId, { row: number; col: number }>();
  const dim = geometry.dimensions;
  if (dim.square) {
    const size = dim.square.size;
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        map.set(((r * size + c) as unknown as NodeId), { row: r, col: c });
      }
    }
  } else if (dim.rectangle) {
    const { width, height } = dim.rectangle;
    for (let r = 0; r < height; r += 1) {
      for (let c = 0; c < width; c += 1) {
        map.set(((r * width + c) as unknown as NodeId), { row: r, col: c });
      }
    }
  }
  return map;
}

function TerrainOverlayDecoratorImpl(props: TerrainOverlayDecoratorProps) {
  const { baseGeometry: providedBase, ...rest } = props;
  const overlayDim = rest.geometry.dimensions.terrainOverlay;
  const resolvedBase =
    providedBase ??
    (overlayDim ? getRegisteredBaseGeometry(overlayDim.baseKey) : null);
  if (!resolvedBase) {
    throw new Error(
      `TerrainOverlayDecorator: no base geometry found for baseKey="${overlayDim?.baseKey ?? '(missing)'}" — call registerBaseGeometry first.`,
    );
  }
  const baseGeometry = resolvedBase;

  const baseRenderer = getBoardRenderer(baseGeometry);

  const overlayPaint = (() => {
    if (!overlayDim) return null;
    const dims = baseGeometry.dimensions;
    const cols = dims.square?.size ?? dims.rectangle?.width ?? 0;
    const rows = dims.square?.size ?? dims.rectangle?.height ?? 0;
    if (cols === 0 || rows === 0) return null;
    const previewSize = rest.size ?? 640;
    const cell = previewSize / Math.max(cols, rows);
    const positions = findNodePositions(baseGeometry);
    return (
      <g data-testid="terrain-overlay">
        {overlayDim.overlays.map((region) => {
          const fill = regionFillFor(region);
          return (
            <g key={region.name}>
              {region.nodes.map((node) => {
                const pos = positions.get(node);
                if (!pos) return null;
                return (
                  <rect
                    key={`${region.name}-${String(node)}`}
                    x={pos.col * cell}
                    y={pos.row * cell}
                    width={cell}
                    height={cell}
                    fill={fill}
                    opacity={REGION_FILL_OPACITY}
                  />
                );
              })}
            </g>
          );
        })}
      </g>
    );
  })();

  const composedOverlays = (
    <>
      {overlayPaint}
      {rest.overlays}
    </>
  );

  return createElement(baseRenderer, {
    ...rest,
    geometry: baseGeometry,
    overlays: composedOverlays,
  });
}

export const TerrainOverlayDecorator = memo(TerrainOverlayDecoratorImpl);
