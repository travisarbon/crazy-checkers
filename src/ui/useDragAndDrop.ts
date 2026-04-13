/**
 * useDragAndDrop — drag-and-drop state machine for checkers piece movement.
 *
 * Task 23.2: progressive-enhancement layer that translates Pointer Events
 * into calls to useGameInteraction.handleSquareClick. Operates in two modes:
 *
 *  • auto-hop: during multi-jump chains, hops execute on pointermove as the
 *    pointer enters a legal continuation square (pointer stays captured).
 *  • atomic: Marching Orders / Leapfrog — drop on a legal destination
 *    executes the full pre-computed move in one go, bypassing per-hop state.
 *
 * The hook computes zero move legality itself — it only maps pointer positions
 * to Square identifiers and delegates to useGameInteraction.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import type { ActiveEvent, BoardState, Piece as PieceData, Square } from '../engine/types';
import { CrazyEvent, PieceColor, PieceType } from '../engine/types';
import { getBoardSquare, gridToSquare } from '../engine/board';
import { gridToExtSquare, extSquareToGrid } from '../engine/events/marchingOrders';

const SQUARE_SIZE = 100;
const DEFAULT_THRESHOLD = 12;
const DEFAULT_HOLD_MS = 80;

export interface DragState {
  /** Whether a drag is currently active (past the distance threshold). */
  readonly isDragging: boolean;
  /** The square being dragged from (origin for ghost piece). */
  readonly dragOriginSquare: Square | null;
  /** Current SVG coordinates of the dragged piece. */
  readonly dragPosition: { x: number; y: number } | null;
  /** The piece data being dragged (for rendering). */
  readonly draggedPiece: PieceData | null;
  /** Whether this is a continuation hop in a multi-jump chain. */
  readonly isContinuationDrag: boolean;
  /** Trail of intermediate hop positions (ghost trail during multi-jump). */
  readonly hopTrail: ReadonlyArray<{ square: Square; piece: PieceData }>;
}

const IDLE_STATE: DragState = {
  isDragging: false,
  dragOriginSquare: null,
  dragPosition: null,
  draggedPiece: null,
  isContinuationDrag: false,
  hopTrail: [],
};

export interface UseDragAndDropOptions {
  readonly effectiveBoard: BoardState;
  readonly activeColor: PieceColor;
  readonly selectablePieces: ReadonlySet<number>;
  readonly legalDestinations: ReadonlySet<number>;
  readonly selectedSquare: Square | null;
  readonly isMidMultiJump: boolean;
  readonly handleSquareClick: (sq: Square) => void;
  readonly isAnimating?: boolean;
  readonly isDisabled?: boolean;
  readonly isGameInProgress: boolean;
  readonly flipped: boolean;
  readonly activeEvents: readonly ActiveEvent[];
  readonly dragThreshold?: number;
  readonly holdTimeMs?: number;
  readonly editorMode?: boolean;
  readonly onEditorDragDrop?: (from: Square, to: Square) => void;
  readonly marchingOrdersGrid?: readonly ({ color: PieceColor; type: PieceType } | null)[];
}

export interface UseDragAndDropResult {
  readonly dragState: DragState;
  readonly pointerHandlers: {
    onPointerDown: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerMove: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerUp: (e: React.PointerEvent<SVGSVGElement>) => void;
    onPointerCancel: (e: React.PointerEvent<SVGSVGElement>) => void;
  };
  readonly cancelDrag: () => void;
}

function clientToSvg(
  svgEl: SVGSVGElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const ctm = svgEl.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const inv = ctm.inverse();
  return {
    x: clientX * inv.a + clientY * inv.c + inv.e,
    y: clientX * inv.b + clientY * inv.d + inv.f,
  };
}

function svgPointToSquare(
  x: number,
  y: number,
  flipped: boolean,
  includeLightSquares: boolean,
): Square | null {
  const col = Math.floor(x / SQUARE_SIZE);
  const rawRow = Math.floor(y / SQUARE_SIZE);
  if (col < 0 || col > 7 || rawRow < 0 || rawRow > 7) return null;
  const row = flipped ? 7 - rawRow : rawRow;

  const darkSq = gridToSquare(row, col);
  if (darkSq !== null) return darkSq;

  if (includeLightSquares) {
    return gridToExtSquare(row, col) as Square;
  }
  return null;
}

function getPieceForDrag(
  board: BoardState,
  sq: Square,
  marchingOrdersGrid?: readonly ({ color: PieceColor; type: PieceType } | null)[],
): PieceData | null {
  const sqNum = sq as number;
  if (sqNum <= 32) return getBoardSquare(board, sq);
  if (marchingOrdersGrid) {
    const { row, col } = extSquareToGrid(sqNum);
    return marchingOrdersGrid[row * 8 + col] ?? null;
  }
  return null;
}

export function useDragAndDrop(options: UseDragAndDropOptions): UseDragAndDropResult {
  const {
    effectiveBoard,
    activeColor,
    selectablePieces,
    legalDestinations,
    isMidMultiJump,
    handleSquareClick,
    isAnimating = false,
    isDisabled = false,
    isGameInProgress,
    flipped,
    activeEvents,
    dragThreshold = DEFAULT_THRESHOLD,
    holdTimeMs = DEFAULT_HOLD_MS,
    editorMode = false,
    onEditorDragDrop,
    marchingOrdersGrid,
  } = options;

  // Refs (no re-render).
  const svgRef = useRef<SVGSVGElement | null>(null);
  const phaseRef = useRef<'idle' | 'pending' | 'dragging'>('idle');
  const modeRef = useRef<'auto-hop' | 'atomic'>('auto-hop');
  const startSvgPos = useRef({ x: 0, y: 0 });
  const startSquareRef = useRef<Square | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const downTimestamp = useRef(0);
  const lastHoveredSquare = useRef<Square | null>(null);
  const rafId = useRef(0);
  const pendingPosition = useRef<{ x: number; y: number } | null>(null);

  // Visual state.
  const [dragState, setDragState] = useState(IDLE_STATE);

  // Keep the latest inputs addressable from stable callbacks so they can
  // react to updates without being re-created each render (re-creation
  // would thrash pointer handlers mid-drag). We update the ref in an
  // effect so the assignment doesn't happen during render.
  const liveRef = useRef({
    effectiveBoard,
    activeColor,
    selectablePieces,
    legalDestinations,
    isMidMultiJump,
    handleSquareClick,
    isAnimating,
    isDisabled,
    isGameInProgress,
    flipped,
    activeEvents,
    dragThreshold,
    holdTimeMs,
    editorMode,
    onEditorDragDrop,
    marchingOrdersGrid,
  });
  useEffect(() => {
    liveRef.current = {
      effectiveBoard,
      activeColor,
      selectablePieces,
      legalDestinations,
      isMidMultiJump,
      handleSquareClick,
      isAnimating,
      isDisabled,
      isGameInProgress,
      flipped,
      activeEvents,
      dragThreshold,
      holdTimeMs,
      editorMode,
      onEditorDragDrop,
      marchingOrdersGrid,
    };
  });

  const resetDrag = useCallback(() => {
    pointerIdRef.current = null;
    phaseRef.current = 'idle';
    lastHoveredSquare.current = null;
    pendingPosition.current = null;
    if (rafId.current !== 0) {
      cancelAnimationFrame(rafId.current);
      rafId.current = 0;
    }
    setDragState(IDLE_STATE);
  }, []);

  const cancelDrag = useCallback(() => {
    if (phaseRef.current !== 'idle') {
      resetDrag();
    }
  }, [resetDrag]);

  const updateDragPosition = useCallback((svgPos: { x: number; y: number }) => {
    pendingPosition.current = svgPos;
    if (rafId.current === 0) {
      rafId.current = requestAnimationFrame(() => {
        rafId.current = 0;
        const pos = pendingPosition.current;
        if (pos) {
          setDragState((prev) => (prev.isDragging ? { ...prev, dragPosition: pos } : prev));
        }
      });
    }
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    const live = liveRef.current;
    if (live.isAnimating || live.isDisabled) return;
    if (!live.editorMode && !live.isGameInProgress) return;
    if (e.button !== 0) return;
    if (pointerIdRef.current !== null) return;

    const svg = e.currentTarget;
    const svgPos = clientToSvg(svg, e.clientX, e.clientY);
    const sq = svgPointToSquare(
      svgPos.x,
      svgPos.y,
      live.flipped,
      live.marchingOrdersGrid !== undefined,
    );
    if (sq === null) return;

    const piece = getPieceForDrag(live.effectiveBoard, sq, live.marchingOrdersGrid);
    if (!piece) return;

    if (!live.editorMode) {
      if (piece.color !== live.activeColor) return;
      if (!live.selectablePieces.has(sq as number)) return;
    }

    const marchingOrdersActive = live.activeEvents.some(
      (ev) => ev.type === CrazyEvent.MarchingOrders,
    );
    const leapfrogActive = live.activeEvents.some((ev) => ev.type === CrazyEvent.Leapfrog);
    modeRef.current = marchingOrdersActive || leapfrogActive ? 'atomic' : 'auto-hop';

    svgRef.current = svg;
    pointerIdRef.current = e.pointerId;
    phaseRef.current = 'pending';
    startSvgPos.current = svgPos;
    startSquareRef.current = sq;
    downTimestamp.current = Date.now();
    lastHoveredSquare.current = null;

    try {
      svg.setPointerCapture(e.pointerId);
    } catch {
      // Ignore — some test environments don't support pointer capture.
    }
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== pointerIdRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const live = liveRef.current;
    const svgPos = clientToSvg(svg, e.clientX, e.clientY);

    if (phaseRef.current === 'pending') {
      const elapsed = Date.now() - downTimestamp.current;
      if (elapsed < live.holdTimeMs) return;

      const dx = svgPos.x - startSvgPos.current.x;
      const dy = svgPos.y - startSvgPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) < live.dragThreshold) return;

      const sq = startSquareRef.current;
      if (sq === null) return;
      const piece = getPieceForDrag(live.effectiveBoard, sq, live.marchingOrdersGrid);
      if (!piece) return;

      phaseRef.current = 'dragging';
      if (!live.editorMode) {
        live.handleSquareClick(sq);
      }

      setDragState({
        isDragging: true,
        dragOriginSquare: sq,
        dragPosition: svgPos,
        draggedPiece: piece,
        isContinuationDrag: false,
        hopTrail: [],
      });
      return;
    }

    if (phaseRef.current === 'dragging') {
      updateDragPosition(svgPos);

      if (
        !live.editorMode &&
        modeRef.current === 'auto-hop' &&
        live.isMidMultiJump
      ) {
        const hoverSq = svgPointToSquare(
          svgPos.x,
          svgPos.y,
          live.flipped,
          live.marchingOrdersGrid !== undefined,
        );
        if (
          hoverSq !== null &&
          hoverSq !== lastHoveredSquare.current &&
          live.legalDestinations.has(hoverSq as number)
        ) {
          lastHoveredSquare.current = hoverSq;
          live.handleSquareClick(hoverSq);

          setDragState((prev) => {
            if (!prev.isDragging) return prev;
            const originPiece = prev.draggedPiece;
            const originSq = prev.dragOriginSquare;
            const newTrail =
              originSq !== null && originPiece
                ? [...prev.hopTrail, { square: originSq, piece: originPiece }]
                : prev.hopTrail;
            return {
              ...prev,
              dragOriginSquare: hoverSq,
              draggedPiece: originPiece,
              isContinuationDrag: true,
              hopTrail: newTrail,
            };
          });
        }
      }
    }
  }, [updateDragPosition]);

  const onPointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== pointerIdRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const live = liveRef.current;

    try {
      svg.releasePointerCapture(e.pointerId);
    } catch {
      // No-op.
    }
    pointerIdRef.current = null;

    if (phaseRef.current === 'pending') {
      phaseRef.current = 'idle';
      const sq = startSquareRef.current;
      if (sq !== null && !live.editorMode) {
        live.handleSquareClick(sq);
      }
      return;
    }

    if (phaseRef.current === 'dragging') {
      const svgPos = clientToSvg(svg, e.clientX, e.clientY);
      const dropSq = svgPointToSquare(
        svgPos.x,
        svgPos.y,
        live.flipped,
        live.marchingOrdersGrid !== undefined,
      );
      const originSq = startSquareRef.current;

      if (live.editorMode) {
        if (
          dropSq !== null &&
          originSq !== null &&
          (dropSq as number) !== (originSq as number)
        ) {
          live.onEditorDragDrop?.(originSq, dropSq);
        }
      } else if (dropSq !== null && live.legalDestinations.has(dropSq as number)) {
        live.handleSquareClick(dropSq);
      }

      phaseRef.current = 'idle';
      lastHoveredSquare.current = null;
      if (rafId.current !== 0) {
        cancelAnimationFrame(rafId.current);
        rafId.current = 0;
      }
      setDragState(IDLE_STATE);
    }
  }, []);

  const onPointerCancel = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    if (e.pointerId !== pointerIdRef.current) return;
    resetDrag();
  }, [resetDrag]);

  // End drag when multi-jump chain completes (isMidMultiJump went true→false
  // while dragging). The reset is the synchronisation step that mirrors the
  // external multi-jump state into our local drag state — exactly the kind
  // of state-from-external-system bridging useEffect is meant for.
  const prevMidMultiJump = useRef(false);
  useEffect(() => {
    if (
      prevMidMultiJump.current &&
      !isMidMultiJump &&
      phaseRef.current === 'dragging' &&
      !editorMode
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      resetDrag();
    }
    prevMidMultiJump.current = isMidMultiJump;
  }, [isMidMultiJump, editorMode, resetDrag]);

  return {
    dragState,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    cancelDrag,
  };
}
