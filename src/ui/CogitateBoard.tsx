/**
 * CogitateBoard — wraps the standard Board component and adds an overlay SVG
 * layer for diagram arrows, highlights, and annotations.
 *
 * Phase 3 scope: 8×8 diagonal (standard draughts) grid only.
 *
 * Task 21.5 extends this component with an editor mode that routes square
 * clicks to a distinct callback (`onEditorSquareClick`) and exposes an
 * `svgRef` handle for PNG export.
 */

import { memo, useMemo, type RefObject } from 'react';
import type { BoardState, PieceColor, PieceType, Square } from '../engine/types';
import { squareToGrid } from '../engine/board';
import { extSquareToGrid } from '../engine/events/marchingOrders';
import Board from './Board';
import type { DragState } from './useDragAndDrop';
import type { BoardGeometry, DiagramOverlayState } from '../cogitate/types';
import { DRAUGHTS_BOARD_GEOMETRY } from '../cogitate/types';
import type { EventOverlayState } from './useEventOverlays';
import type {
  AnimatingPiece,
  FlashingSquaresState,
  ExplosionState,
  OverlayState,
} from './useAnimationQueue';
import styles from './CogitateBoard.module.css';

const SQUARE_SIZE = 100;
const BOARD_EXTENT = 800;

const ALL_PLAYABLE_SQUARES: ReadonlySet<number> = new Set(
  Array.from({ length: 32 }, (_, i) => i + 1),
);

/** Extended 64-square set used in Marching Orders mode (dark + light). */
const ALL_PLAYABLE_SQUARES_EXT: ReadonlySet<number> = new Set(
  Array.from({ length: 64 }, (_, i) => i + 1),
);

export interface CogitateBoardProps {
  board: BoardState;
  geometry?: BoardGeometry;
  interactive?: boolean;
  onSquareClick?: (sq: Square) => void;
  selectedSquare?: Square | null;
  legalMoveSquares?: ReadonlySet<number>;
  flipped?: boolean;
  overlays?: DiagramOverlayState | null;
  eventOverlayState?: EventOverlayState;
  className?: string;

  // Task 21.5 — editor mode extensions.
  /** Whether the board is in editor mode (piece placement/cycling). */
  editorMode?: boolean;
  /** Callback when a square is clicked in editor mode. */
  onEditorSquareClick?: (square: Square) => void;
  /** Callback when a piece is dragged to a new square. */
  onEditorDragDrop?: (from: Square, to: Square) => void;
  /** Callback when a piece is dragged off-board. */
  onEditorRemovePiece?: (square: Square) => void;
  /** Squares with placement validity indicators. */
  validPlacementSquares?: ReadonlySet<number>;
  /** SVG ref exposed for PNG export of the overlay layer. */
  svgRef?: RefObject<SVGSVGElement | null>;
  /** Square currently selected as arrow origin (for diagram arrow drawing). */
  pendingArrowFrom?: Square | null;

  // Move animation pass-through (Task 11.1 / Free Play integration).
  animatingPieces?: ReadonlyMap<number, AnimatingPiece>;
  fadingSquares?: ReadonlySet<number>;
  isAnimating?: boolean;
  animSpeedMultiplier?: number;
  pieceShadow?: boolean;
  flashingSquares?: FlashingSquaresState | null;
  explosionState?: ExplosionState | null;
  overlayState?: OverlayState | null;
  lastMoveSquares?: { from: Square; to: Square } | null;

  /**
   * Optional 64-element grid that, when supplied, makes light squares
   * interactive in editor mode (used by the Free Play editor when
   * Marching Orders is active). When omitted, only dark squares (1-32)
   * are clickable as in standard American Rules.
   */
  editorMarchingOrdersGrid?: readonly ({ color: PieceColor; type: PieceType } | null)[];

  // Drag-and-drop pass-through (Task 23.2)
  dragState?: DragState;
  pointerHandlers?: {
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => void;
  };
}

const OVERLAY_COLOR_MAP: Record<'green' | 'red' | 'blue', string> = {
  green: '#2ecc71',
  red: '#e74c3c',
  blue: '#3498db',
};

interface Pos {
  cx: number;
  cy: number;
}

function squareCenter(sq: Square, flipped: boolean): Pos {
  // Support extended squares 33-64 used by Marching Orders for light squares.
  const sqNum = sq as number;
  const { row, col } =
    sqNum > 32 ? extSquareToGrid(sqNum) : squareToGrid(sq);
  const renderRow = flipped ? 7 - row : row;
  return {
    cx: col * SQUARE_SIZE + SQUARE_SIZE / 2,
    cy: renderRow * SQUARE_SIZE + SQUARE_SIZE / 2,
  };
}

function CogitateBoard({
  board,
  geometry = DRAUGHTS_BOARD_GEOMETRY,
  interactive = false,
  onSquareClick,
  selectedSquare,
  legalMoveSquares,
  flipped = false,
  overlays = null,
  eventOverlayState,
  className,
  editorMode = false,
  onEditorSquareClick,
  onEditorDragDrop,
  onEditorRemovePiece,
  validPlacementSquares,
  svgRef,
  pendingArrowFrom = null,
  animatingPieces,
  fadingSquares,
  isAnimating,
  animSpeedMultiplier,
  pieceShadow,
  flashingSquares,
  explosionState,
  overlayState,
  lastMoveSquares,
  editorMarchingOrdersGrid,
  dragState,
  pointerHandlers,
}: CogitateBoardProps) {
  void geometry;
  void onEditorDragDrop;
  void onEditorRemovePiece;

  const overlayElements = useMemo(() => {
    const hasOverlays = overlays !== null;
    const hasPlacement = (validPlacementSquares?.size ?? 0) > 0;
    const hasPending = pendingArrowFrom !== null;
    if (!hasOverlays && !hasPlacement && !hasPending) return null;
    return (
      <g>
        <defs>
          <marker
            id="cogitate-arrowhead-green"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill={OVERLAY_COLOR_MAP.green} />
          </marker>
          <marker
            id="cogitate-arrowhead-red"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill={OVERLAY_COLOR_MAP.red} />
          </marker>
          <marker
            id="cogitate-arrowhead-blue"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill={OVERLAY_COLOR_MAP.blue} />
          </marker>
        </defs>

        {validPlacementSquares && validPlacementSquares.size > 0 && (
          <g data-testid="valid-placement-indicators">
            {Array.from(validPlacementSquares).map((n) => {
              const { cx, cy } = squareCenter(n as Square, flipped);
              return (
                <rect
                  key={`placement-${String(n)}`}
                  x={cx - SQUARE_SIZE / 2 + 4}
                  y={cy - SQUARE_SIZE / 2 + 4}
                  width={SQUARE_SIZE - 8}
                  height={SQUARE_SIZE - 8}
                  fill="none"
                  stroke="#2ecc71"
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  opacity={0.6}
                />
              );
            })}
          </g>
        )}

        {overlays?.highlights.map((h, idx) => {
          const { cx, cy } = squareCenter(h.square, flipped);
          return (
            <rect
              key={`highlight-${String(idx)}`}
              x={cx - SQUARE_SIZE / 2}
              y={cy - SQUARE_SIZE / 2}
              width={SQUARE_SIZE}
              height={SQUARE_SIZE}
              fill={OVERLAY_COLOR_MAP[h.color]}
              opacity={0.35}
              data-testid="cogitate-overlay-highlight"
            />
          );
        })}

        {overlays?.arrows.map((a, idx) => {
          const from = squareCenter(a.from, flipped);
          const to = squareCenter(a.to, flipped);
          return (
            <line
              key={`arrow-${String(idx)}`}
              x1={from.cx}
              y1={from.cy}
              x2={to.cx}
              y2={to.cy}
              stroke={OVERLAY_COLOR_MAP[a.color]}
              strokeWidth={8}
              strokeOpacity={0.85}
              markerEnd={`url(#cogitate-arrowhead-${a.color})`}
              data-testid="cogitate-overlay-arrow"
            />
          );
        })}

        {pendingArrowFrom !== null && (() => {
          const { cx, cy } = squareCenter(pendingArrowFrom, flipped);
          return (
            <circle
              cx={cx}
              cy={cy}
              r={SQUARE_SIZE / 2 - 6}
              fill="none"
              stroke="#f1c40f"
              strokeWidth={4}
              strokeDasharray="6 4"
              opacity={0.9}
              data-testid="cogitate-arrow-pending"
            />
          );
        })()}

        {overlays?.annotations.map((a, idx) => {
          const { cx, cy } = squareCenter(a.square, flipped);
          return (
            <text
              key={`annotation-${String(idx)}`}
              x={cx}
              y={cy}
              className={styles.annotation}
              data-testid="cogitate-overlay-annotation"
            >
              {a.text}
            </text>
          );
        })}
      </g>
    );
  }, [overlays, flipped, validPlacementSquares, pendingArrowFrom]);

  const boardClickHandler = editorMode
    ? onEditorSquareClick
    : interactive
      ? onSquareClick
      : undefined;

  const wrapperClass = [
    styles.wrapper,
    editorMode ? styles.editorMode : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={wrapperClass}
      data-testid="cogitate-board"
      data-editor-mode={editorMode ? 'true' : undefined}
    >
      <div className={styles.boardWrap}>
        <Board
          board={board}
          flipped={flipped}
          selectedSquare={selectedSquare ?? null}
          legalMoveSquares={legalMoveSquares}
          selectablePieces={
            editorMode
              ? editorMarchingOrdersGrid
                ? ALL_PLAYABLE_SQUARES_EXT
                : ALL_PLAYABLE_SQUARES
              : undefined
          }
          onSquareClick={boardClickHandler}
          eventOverlayState={eventOverlayState}
          animatingPieces={animatingPieces}
          fadingSquares={fadingSquares}
          isAnimating={isAnimating}
          animSpeedMultiplier={animSpeedMultiplier}
          pieceShadow={pieceShadow}
          flashingSquares={flashingSquares}
          explosionState={explosionState}
          overlayState={overlayState}
          lastMoveSquares={lastMoveSquares ?? null}
          marchingOrdersGrid={
            editorMarchingOrdersGrid ?? eventOverlayState?.marchingOrdersGrid ?? undefined
          }
          dragState={dragState}
          pointerHandlers={pointerHandlers}
        />
      </div>
      {(overlays || (validPlacementSquares && validPlacementSquares.size > 0) || pendingArrowFrom !== null) && (
        <svg
          ref={svgRef ?? undefined}
          className={styles.overlaySvg}
          viewBox={`0 0 ${String(BOARD_EXTENT)} ${String(BOARD_EXTENT)}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          data-testid="cogitate-board-overlay"
        >
          {overlayElements}
        </svg>
      )}
    </div>
  );
}

export default memo(CogitateBoard);
