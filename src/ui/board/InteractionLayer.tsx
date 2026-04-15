/**
 * InteractionLayer — shared hit-testing + roving tabindex for every renderer.
 *
 * Renderers compose this layer on top of their SVG. Each renderer supplies a
 * list of hit targets (`HitTarget[]`) with a geometry NodeId and a
 * client-space rectangle. The layer:
 *
 *   - Dispatches pointer events (click, alt-click, drag start/end, hover).
 *   - Walks neighbours via a primary DirectionKind for arrow-key navigation.
 *   - Maintains roving tabindex (single tabbable node at a time).
 *   - Fires `keyboard-activate` on Space/Enter (handled identically to click).
 *
 * `interactive=false` (preview/replay) suppresses all handlers and tabindex.
 */

import { memo, useCallback, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { DirectionKind, NodeId } from './BoardGeometry';
import type { AdjacencyGraph } from './BoardGeometry';
import type { InteractionKind } from './types';

export interface HitTarget {
  readonly node: NodeId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly ariaLabel: string;
}

export interface InteractionLayerProps {
  readonly targets: readonly HitTarget[];
  readonly primaryDirection: DirectionKind;
  readonly adjacency: AdjacencyGraph;
  readonly interactive: boolean;
  readonly tabbable: boolean;
  readonly onNodeInteract?: (node: NodeId, kind: InteractionKind) => void;
  readonly focusedNode?: NodeId | null;
}

function InteractionLayerImpl({
  targets,
  primaryDirection,
  adjacency,
  interactive,
  tabbable,
  onNodeInteract,
  focusedNode,
}: InteractionLayerProps) {
  const [internalRoving, setRoving] = useState<NodeId | null>(() => targets[0]?.node ?? null);
  const roving = focusedNode ?? internalRoving;
  const ref = useRef<SVGGElement | null>(null);

  const dispatch = useCallback(
    (node: NodeId, kind: InteractionKind) => {
      if (!interactive) return;
      onNodeInteract?.(node, kind);
    },
    [interactive, onNodeInteract],
  );

  const onKey = useCallback(
    (event: KeyboardEvent<SVGRectElement>, node: NodeId) => {
      if (!interactive) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        dispatch(node, 'keyboard-activate');
        return;
      }
      if (!event.key.startsWith('Arrow')) return;
      const neighbours = adjacency.ofKind(primaryDirection, node);
      if (neighbours.length === 0) return;
      event.preventDefault();
      const next = neighbours[0];
      if (next !== undefined) {
        setRoving(next);
      }
    },
    [interactive, adjacency, primaryDirection, dispatch],
  );

  if (!interactive) return null;

  return (
    <g ref={ref} data-testid="interaction-layer" role="grid">
      {targets.map((target) => {
        const isTabbable = tabbable && roving === target.node;
        return (
          <rect
            key={String(target.node)}
            x={target.x}
            y={target.y}
            width={target.width}
            height={target.height}
            fill="transparent"
            aria-label={target.ariaLabel}
            role="gridcell"
            tabIndex={isTabbable ? 0 : -1}
            data-node={String(target.node)}
            onClick={(e: ReactMouseEvent<SVGRectElement>) => {
              if (e.altKey || e.button === 2) {
                dispatch(target.node, 'alt-click');
              } else {
                dispatch(target.node, 'click');
              }
            }}
            onMouseEnter={() => {
              dispatch(target.node, 'hover-enter');
            }}
            onMouseLeave={() => {
              dispatch(target.node, 'hover-leave');
            }}
            onFocus={() => {
              dispatch(target.node, 'focus');
            }}
            onKeyDown={(e) => {
              onKey(e, target.node);
            }}
            style={{ outline: 'none', cursor: 'pointer' }}
          />
        );
      })}
    </g>
  );
}

export const InteractionLayer = memo(InteractionLayerImpl);
