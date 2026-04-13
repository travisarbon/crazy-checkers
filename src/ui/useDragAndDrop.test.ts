import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDragAndDrop } from './useDragAndDrop';
import { setBoardSquare } from '../engine/board';
import type { BoardState, Square, ActiveEvent } from '../engine/types';
import { PieceColor, PieceType, square, CrazyEvent } from '../engine/types';
import { createActiveEvent } from '../engine/events';

/**
 * Build a stub SVGSVGElement sufficient for the hook's coordinate math.
 * Uses an identity CTM so SVG coords equal client coords.
 */
function makeSvgStub(): SVGSVGElement {
  const svg = {
    getScreenCTM: () => ({
      a: 1,
      b: 0,
      c: 0,
      d: 1,
      e: 0,
      f: 0,
      inverse() {
        return this;
      },
    }),
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
  } as unknown as SVGSVGElement;
  return svg;
}

interface PointerEventInit {
  pointerId?: number;
  button?: number;
  clientX?: number;
  clientY?: number;
}

function pointerEvent(
  svg: SVGSVGElement,
  init: PointerEventInit = {},
): React.PointerEvent<SVGSVGElement> {
  return {
    pointerId: init.pointerId ?? 1,
    button: init.button ?? 0,
    clientX: init.clientX ?? 0,
    clientY: init.clientY ?? 0,
    currentTarget: svg,
    preventDefault: () => undefined,
  } as unknown as React.PointerEvent<SVGSVGElement>;
}

function emptyBoard(): BoardState {
  return new Array(32).fill(null) as BoardState;
}

function placePiece(
  board: BoardState,
  sq: number,
  color: PieceColor,
  type: PieceType = PieceType.Pawn,
): BoardState {
  return setBoardSquare(board, square(sq), { color, type });
}

/** SVG center (x, y) of a dark square (1-32) on an un-flipped board. */
function centerOfDarkSquare(sq: number): { x: number; y: number } {
  // Square 1: row 0, cols 1,3,5,7. American numbering goes right-to-left in row 0.
  // Easier: derive via reverse of gridToSquare helpers (pre-computed table).
  const map: Record<number, { row: number; col: number }> = {};
  for (let r = 0; r < 8; r++) {
    const oddRow = r % 2 === 1;
    for (let c = 0; c < 8; c++) {
      const isDark = (r + c) % 2 === 1;
      if (!isDark) continue;
      const darkIndexInRow = oddRow ? Math.floor(c / 2) : Math.floor(c / 2);
      const sqNum = r * 4 + darkIndexInRow + 1;
      map[sqNum] = { row: r, col: c };
    }
  }
  const pos = map[sq];
  if (!pos) throw new Error(`no mapping for sq ${String(sq)}`);
  return { x: pos.col * 100 + 50, y: pos.row * 100 + 50 };
}

function defaultOptions(over: Partial<Parameters<typeof useDragAndDrop>[0]> = {}) {
  return {
    effectiveBoard: emptyBoard(),
    activeColor: PieceColor.White,
    selectablePieces: new Set<number>(),
    legalDestinations: new Set<number>(),
    selectedSquare: null as Square | null,
    isMidMultiJump: false,
    handleSquareClick: vi.fn(),
    isAnimating: false,
    isDisabled: false,
    isGameInProgress: true,
    flipped: false,
    activeEvents: [] as readonly ActiveEvent[],
    holdTimeMs: 0, // disable hold-gate in tests (we control timing manually)
    dragThreshold: 12,
    ...over,
  };
}

describe('useDragAndDrop', () => {
  beforeEach(() => {
    // Run RAF callbacks synchronously for deterministic assertions.
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(
      (cb: FrameRequestCallback) => {
        cb(0);
        return 1 as unknown as number;
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('1. drop below threshold falls back to click', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const handleSquareClick = vi.fn();
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
      handleSquareClick,
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: origin.x + 2, clientY: origin.y + 2 }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(
        pointerEvent(svg, { clientX: origin.x + 2, clientY: origin.y + 2 }),
      );
    });

    expect(result.current.dragState.isDragging).toBe(false);
    expect(handleSquareClick).toHaveBeenCalledTimes(1);
    expect(handleSquareClick).toHaveBeenCalledWith(square(9));
  });

  it('2. drag above threshold enters dragging state', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: origin.x + 30, clientY: origin.y + 30 }),
      );
    });

    expect(result.current.dragState.isDragging).toBe(true);
    expect(result.current.dragState.dragOriginSquare).toBe(square(9));
    expect(result.current.dragState.draggedPiece?.color).toBe(PieceColor.White);
  });

  it('3. drop on legal destination triggers click on destination', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const handleSquareClick = vi.fn();
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
      legalDestinations: new Set([13, 14]),
      handleSquareClick,
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    const dest = centerOfDarkSquare(14);

    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: dest.x, clientY: dest.y }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(
        pointerEvent(svg, { clientX: dest.x, clientY: dest.y }),
      );
    });

    // Call 1: select origin on drag start; Call 2: drop destination.
    expect(handleSquareClick).toHaveBeenCalledTimes(2);
    expect(handleSquareClick.mock.calls[0]?.[0]).toBe(square(9));
    expect(handleSquareClick.mock.calls[1]?.[0]).toBe(square(14));
    expect(result.current.dragState.isDragging).toBe(false);
  });

  it('4. drop on illegal square resets state without calling destination click', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const handleSquareClick = vi.fn();
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
      legalDestinations: new Set([13]),
      handleSquareClick,
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    const bad = centerOfDarkSquare(18);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: bad.x, clientY: bad.y }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerUp(
        pointerEvent(svg, { clientX: bad.x, clientY: bad.y }),
      );
    });

    // Origin select + no destination call.
    expect(handleSquareClick).toHaveBeenCalledTimes(1);
    expect(result.current.dragState.isDragging).toBe(false);
  });

  it('5. pointercancel resets state', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
    });
    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: origin.x + 30, clientY: origin.y + 30 }),
      );
    });
    expect(result.current.dragState.isDragging).toBe(true);

    act(() => {
      result.current.pointerHandlers.onPointerCancel(pointerEvent(svg));
    });
    expect(result.current.dragState.isDragging).toBe(false);
  });

  it('6. cancelDrag() resets during drag', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: origin.x + 30, clientY: origin.y + 30 }),
      );
    });
    expect(result.current.dragState.isDragging).toBe(true);

    act(() => {
      result.current.cancelDrag();
    });
    expect(result.current.dragState.isDragging).toBe(false);
  });

  it('7. hold-time filter prevents premature drag', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
      holdTimeMs: 10_000, // impossibly large
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: origin.x + 50, clientY: origin.y + 50 }),
      );
    });
    expect(result.current.dragState.isDragging).toBe(false);
  });

  it('8. non-primary button ignored', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const handleSquareClick = vi.fn();
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
      handleSquareClick,
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y, button: 2 }),
      );
    });
    expect(result.current.dragState.isDragging).toBe(false);
    expect(handleSquareClick).not.toHaveBeenCalled();
  });

  it('9. suppressed during animation', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
      isAnimating: true,
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
    });
    expect(result.current.dragState.isDragging).toBe(false);
  });

  it('10. suppressed during AI turn (isDisabled)', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
      isDisabled: true,
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
    });
    expect(result.current.dragState.isDragging).toBe(false);
  });

  it('11. atomic mode is selected when Marching Orders is active', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const handleSquareClick = vi.fn();
    const activeEvents: readonly ActiveEvent[] = [
      createActiveEvent(CrazyEvent.MarchingOrders, PieceColor.White, 0),
    ];
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
      legalDestinations: new Set([13]),
      isMidMultiJump: true,
      handleSquareClick,
      activeEvents,
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    const dest = centerOfDarkSquare(13);

    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: dest.x, clientY: dest.y }),
      );
    });
    // No auto-hop should happen despite isMidMultiJump — only origin select.
    expect(handleSquareClick).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.pointerHandlers.onPointerUp(
        pointerEvent(svg, { clientX: dest.x, clientY: dest.y }),
      );
    });
    // Drop executes the destination atomically.
    expect(handleSquareClick).toHaveBeenCalledTimes(2);
    expect(handleSquareClick.mock.calls[1]?.[0]).toBe(square(13));
  });

  it('12. auto-hop fires on pointermove during mid-multi-jump', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const handleSquareClick = vi.fn();
    const opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
      legalDestinations: new Set([18]),
      isMidMultiJump: true,
      handleSquareClick,
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    const hop = centerOfDarkSquare(18);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
      // Cross threshold into the drag phase, still over origin square.
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: origin.x + 20, clientY: origin.y + 20 }),
      );
    });
    expect(result.current.dragState.isDragging).toBe(true);

    act(() => {
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: hop.x, clientY: hop.y }),
      );
    });
    // Origin select + auto-hop on hover over legal continuation.
    expect(handleSquareClick).toHaveBeenCalledTimes(2);
    expect(handleSquareClick.mock.calls[1]?.[0]).toBe(square(18));
    expect(result.current.dragState.isContinuationDrag).toBe(true);
    expect(result.current.dragState.hopTrail.length).toBe(1);
  });

  it('13. editor mode drag calls onEditorDragDrop', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const onEditorDragDrop = vi.fn();
    const handleSquareClick = vi.fn();
    const opts = defaultOptions({
      effectiveBoard: board,
      editorMode: true,
      isGameInProgress: false,
      handleSquareClick,
      onEditorDragDrop,
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    const dest = centerOfDarkSquare(14);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: dest.x, clientY: dest.y }),
      );
      result.current.pointerHandlers.onPointerUp(
        pointerEvent(svg, { clientX: dest.x, clientY: dest.y }),
      );
    });

    expect(onEditorDragDrop).toHaveBeenCalledTimes(1);
    expect(onEditorDragDrop).toHaveBeenCalledWith(square(9), square(14));
    // Editor mode never calls handleSquareClick.
    expect(handleSquareClick).not.toHaveBeenCalled();
  });

  it('14. non-selectable piece does not initiate drag (game mode)', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.Black); // wrong color
    const opts = defaultOptions({
      effectiveBoard: board,
      activeColor: PieceColor.White,
      selectablePieces: new Set<number>(), // none selectable
    });
    const { result } = renderHook((p: typeof opts) => useDragAndDrop(p), { initialProps: opts });

    const origin = centerOfDarkSquare(9);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: origin.x + 50, clientY: origin.y + 50 }),
      );
    });
    expect(result.current.dragState.isDragging).toBe(false);
  });

  it('15. multi-jump completion ends drag (isMidMultiJump false→true→false path)', () => {
    const svg = makeSvgStub();
    const board = placePiece(emptyBoard(), 9, PieceColor.White);
    const handleSquareClick = vi.fn();
    let opts = defaultOptions({
      effectiveBoard: board,
      selectablePieces: new Set([9]),
      legalDestinations: new Set([18]),
      isMidMultiJump: true,
      handleSquareClick,
    });
    const { result, rerender } = renderHook((p: typeof opts) => useDragAndDrop(p), {
      initialProps: opts,
    });

    const origin = centerOfDarkSquare(9);
    act(() => {
      result.current.pointerHandlers.onPointerDown(
        pointerEvent(svg, { clientX: origin.x, clientY: origin.y }),
      );
      result.current.pointerHandlers.onPointerMove(
        pointerEvent(svg, { clientX: origin.x + 30, clientY: origin.y + 30 }),
      );
    });
    expect(result.current.dragState.isDragging).toBe(true);

    opts = { ...opts, isMidMultiJump: false };
    act(() => {
      rerender(opts);
    });
    expect(result.current.dragState.isDragging).toBe(false);
  });
});
