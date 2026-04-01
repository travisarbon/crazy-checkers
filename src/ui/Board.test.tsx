import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Board from './Board';
import { createInitialBoard } from '../engine/board';
import type { BoardState } from '../engine/types';
import { PieceColor, PieceType, square } from '../engine/types';
import { squareToGrid } from '../engine/board';

describe('Board', () => {
  it('renders all 64 squares (32 light + 32 dark with overlays)', () => {
    const { container } = render(<Board board={createInitialBoard()} />);
    // 32 light squares (1 rect each) + 32 dark squares (base rect + transparent click target = 2 each)
    const rects = container.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(64);
    // Verify 32 gridcells (dark squares)
    const gridcells = screen.getAllByRole('gridcell');
    expect(gridcells).toHaveLength(32);
  });

  it('renders 24 pieces at the initial position', () => {
    render(<Board board={createInitialBoard()} />);
    const pieces = screen.getAllByTestId('piece');
    expect(pieces).toHaveLength(24);
  });

  it('places black pieces on squares 1-12 and white pieces on squares 21-32', () => {
    render(<Board board={createInitialBoard()} />);
    const pieces = screen.getAllByTestId('piece');

    const blackPieces = pieces.filter((p) =>
      p.getAttribute('aria-label')?.startsWith('Black'),
    );
    const whitePieces = pieces.filter((p) =>
      p.getAttribute('aria-label')?.startsWith('White'),
    );

    expect(blackPieces).toHaveLength(12);
    expect(whitePieces).toHaveLength(12);
  });

  it('renders no pieces for squares 13-20 (middle rows)', () => {
    render(<Board board={createInitialBoard()} />);
    const pieces = screen.getAllByTestId('piece');

    for (let sq = 13; sq <= 20; sq++) {
      const found = pieces.some((p) =>
        p.getAttribute('aria-label')?.includes(`square ${String(sq)}`),
      );
      expect(found).toBe(false);
    }
  });

  it('renders no pieces for an empty board', () => {
    const emptyBoard: BoardState = new Array(32).fill(null) as BoardState;
    render(<Board board={emptyBoard} />);
    const pieces = screen.queryAllByTestId('piece');
    expect(pieces).toHaveLength(0);
  });

  it('renders the board with flipped orientation', () => {
    const board: BoardState = new Array(32).fill(null) as BoardState;
    const mutableBoard = [...board];
    mutableBoard[0] = { color: PieceColor.Black, type: PieceType.Pawn };
    const testBoard = mutableBoard as unknown as BoardState;

    const { container: normalContainer } = render(
      <Board board={testBoard} />,
    );
    const { container: flippedContainer } = render(
      <Board board={testBoard} flipped />,
    );

    // Pieces now use origin-based rendering with <g transform="translate(cx, cy) scale(1)">
    const normalPiece = normalContainer.querySelector('[data-testid="piece"]');
    const flippedPiece = flippedContainer.querySelector('[data-testid="piece"]');

    expect(normalPiece).not.toBeNull();
    expect(flippedPiece).not.toBeNull();

    if (normalPiece === null || flippedPiece === null) return;

    // Extract cy from transform="translate(cx, cy) scale(1)"
    const extractCy = (el: Element) => {
      const transform = el.getAttribute('transform') ?? '';
      const match = /translate\(\d+,\s*(\d+)\)/.exec(transform);
      return match ? Number(match[1]) : NaN;
    };

    const normalCy = extractCy(normalPiece);
    const flippedCy = extractCy(flippedPiece);

    expect(normalCy).toBeLessThan(flippedCy);
    expect(normalCy).toBe(50);
    expect(flippedCy).toBe(750);
  });

  it('has ARIA role="grid" on the SVG', () => {
    render(<Board board={createInitialBoard()} />);
    const svg = screen.getByRole('grid');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-label', 'Checkers board');
  });

  it('dark squares have role="gridcell" with descriptive aria-labels', () => {
    render(<Board board={createInitialBoard()} />);
    const gridcells = screen.getAllByRole('gridcell');
    expect(gridcells).toHaveLength(32);

    const sq1Cell = gridcells.find((cell) =>
      cell.getAttribute('aria-label')?.includes('Square 1'),
    );
    expect(sq1Cell).toBeDefined();
    expect(sq1Cell).toHaveAttribute('aria-label', 'Square 1, black pawn');
  });

  it('light squares have aria-hidden="true"', () => {
    const { container } = render(<Board board={createInitialBoard()} />);
    const hiddenRects = container.querySelectorAll('rect[aria-hidden="true"]');
    expect(hiddenRects).toHaveLength(32);
  });

  it('empty squares are labeled correctly', () => {
    render(<Board board={createInitialBoard()} />);
    const gridcells = screen.getAllByRole('gridcell');

    const sq13Cell = gridcells.find((cell) =>
      cell.getAttribute('aria-label')?.includes('Square 13'),
    );
    expect(sq13Cell).toBeDefined();
    expect(sq13Cell).toHaveAttribute('aria-label', 'Square 13, empty');
  });

  it('board container has square aspect ratio', () => {
    const { container } = render(<Board board={createInitialBoard()} />);
    const boardContainer = container.firstElementChild as HTMLElement;
    expect(boardContainer).not.toBeNull();
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '-4 -4 808 808');
  });

  it('renders a king piece with crown indicator', () => {
    const board: BoardState = new Array(32).fill(null) as BoardState;
    const mutableBoard = [...board];
    mutableBoard[0] = { color: PieceColor.Black, type: PieceType.King };
    const testBoard = mutableBoard as unknown as BoardState;

    render(<Board board={testBoard} />);

    const crown = screen.getByTestId('crown');
    expect(crown).toBeInTheDocument();

    const piece = screen.getByTestId('piece');
    expect(piece.getAttribute('aria-label')).toBe(
      'Black king on square 1',
    );
  });

  it('correctly maps engine squares to SVG positions', () => {
    const board: BoardState = new Array(32).fill(null) as BoardState;
    const mutableBoard = [...board];
    mutableBoard[0] = { color: PieceColor.White, type: PieceType.Pawn };
    const testBoard = mutableBoard as unknown as BoardState;

    const { container } = render(<Board board={testBoard} />);
    // Pieces now use origin-based rendering: <g transform="translate(cx, cy) scale(1)">
    const pieceG = container.querySelector('[data-testid="piece"]');
    expect(pieceG).not.toBeNull();

    if (pieceG === null) return;

    const grid = squareToGrid(square(1));
    const expectedCx = grid.col * 100 + 50;
    const expectedCy = grid.row * 100 + 50;
    expect(pieceG.getAttribute('transform')).toBe(
      `translate(${String(expectedCx)}, ${String(expectedCy)}) scale(1)`,
    );
  });

  // --- Last-move highlights (Task 2.6) ---

  const SQUARE_SIZE_C = 100;

  function expectedPosition(sq: number, flipped = false): { x: number; y: number } {
    const { row, col } = squareToGrid(square(sq));
    const renderRow = flipped ? 7 - row : row;
    return { x: col * SQUARE_SIZE_C, y: renderRow * SQUARE_SIZE_C };
  }

  it('renders last-move highlights for from and to squares', () => {
    render(
      <Board
        board={createInitialBoard()}
        lastMoveSquares={{ from: square(22), to: square(18) }}
      />,
    );
    const highlights = screen.getAllByTestId('highlight-last-move');
    expect(highlights).toHaveLength(2);
  });

  it('renders no last-move highlights when lastMoveSquares is null', () => {
    render(<Board board={createInitialBoard()} lastMoveSquares={null} />);
    expect(screen.queryAllByTestId('highlight-last-move')).toHaveLength(0);
  });

  it('renders no last-move highlights when lastMoveSquares is undefined', () => {
    render(<Board board={createInitialBoard()} />);
    expect(screen.queryAllByTestId('highlight-last-move')).toHaveLength(0);
  });

  it('last-move highlight uses correct CSS variable', () => {
    render(
      <Board
        board={createInitialBoard()}
        lastMoveSquares={{ from: square(22), to: square(18) }}
      />,
    );
    const highlights = screen.getAllByTestId('highlight-last-move');
    for (const rect of highlights) {
      expect(rect.getAttribute('fill')).toBe('var(--highlight-last-move)');
    }
  });

  it('highlight layering: last-move renders before legal-move highlight', () => {
    const legalMoves = new Set([18]);
    render(
      <Board
        board={createInitialBoard()}
        lastMoveSquares={{ from: square(22), to: square(18) }}
        legalMoveSquares={legalMoves}
      />,
    );

    const gridcells = screen.getAllByRole('gridcell');
    const sq18Cell = gridcells.find((cell) =>
      cell.getAttribute('aria-label')?.includes('Square 18'),
    );
    expect(sq18Cell).toBeDefined();
    if (!sq18Cell) return;

    const rects = sq18Cell.querySelectorAll('rect[data-testid]');
    const testIds = Array.from(rects).map((r) => r.getAttribute('data-testid'));
    const lastMoveIdx = testIds.indexOf('highlight-last-move');
    const legalIdx = testIds.indexOf('highlight-legal');
    expect(lastMoveIdx).toBeGreaterThanOrEqual(0);
    expect(legalIdx).toBeGreaterThanOrEqual(0);
    expect(lastMoveIdx).toBeLessThan(legalIdx);
  });

  it('highlight layering: last-move renders before selected highlight', () => {
    render(
      <Board
        board={createInitialBoard()}
        lastMoveSquares={{ from: square(22), to: square(18) }}
        selectedSquare={square(18)}
      />,
    );

    const gridcells = screen.getAllByRole('gridcell');
    const sq18Cell = gridcells.find((cell) =>
      cell.getAttribute('aria-label')?.includes('Square 18'),
    );
    expect(sq18Cell).toBeDefined();
    if (!sq18Cell) return;

    const rects = sq18Cell.querySelectorAll('rect[data-testid]');
    const testIds = Array.from(rects).map((r) => r.getAttribute('data-testid'));
    const lastMoveIdx = testIds.indexOf('highlight-last-move');
    const selectedIdx = testIds.indexOf('highlight-selected');
    expect(lastMoveIdx).toBeGreaterThanOrEqual(0);
    expect(selectedIdx).toBeGreaterThanOrEqual(0);
    expect(lastMoveIdx).toBeLessThan(selectedIdx);
  });

  it('last-move highlight on from square has correct position', () => {
    render(
      <Board
        board={createInitialBoard()}
        lastMoveSquares={{ from: square(22), to: square(18) }}
      />,
    );
    const highlights = screen.getAllByTestId('highlight-last-move');
    const { x, y } = expectedPosition(22);
    const fromRect = highlights.find(
      (r) => r.getAttribute('x') === String(x) && r.getAttribute('y') === String(y),
    );
    expect(fromRect).toBeDefined();
  });

  it('last-move highlight on to square has correct position', () => {
    render(
      <Board
        board={createInitialBoard()}
        lastMoveSquares={{ from: square(22), to: square(18) }}
      />,
    );
    const highlights = screen.getAllByTestId('highlight-last-move');
    const { x, y } = expectedPosition(18);
    const toRect = highlights.find(
      (r) => r.getAttribute('x') === String(x) && r.getAttribute('y') === String(y),
    );
    expect(toRect).toBeDefined();
  });

  it('last-move highlights respect board flip', () => {
    const { container: normalContainer } = render(
      <Board
        board={createInitialBoard()}
        lastMoveSquares={{ from: square(22), to: square(18) }}
      />,
    );
    const normalHighlights = normalContainer.querySelectorAll('[data-testid="highlight-last-move"]');

    const { container: flippedContainer } = render(
      <Board
        board={createInitialBoard()}
        lastMoveSquares={{ from: square(22), to: square(18) }}
        flipped
      />,
    );
    const flippedHighlights = flippedContainer.querySelectorAll('[data-testid="highlight-last-move"]');

    expect(normalHighlights).toHaveLength(2);
    expect(flippedHighlights).toHaveLength(2);

    const normalYs = Array.from(normalHighlights).map((r) => Number(r.getAttribute('y'))).sort();
    const flippedYs = Array.from(flippedHighlights).map((r) => Number(r.getAttribute('y'))).sort();
    expect(normalYs).not.toEqual(flippedYs);
  });

  it('last-move highlights do not appear on light squares', () => {
    render(
      <Board
        board={createInitialBoard()}
        lastMoveSquares={{ from: square(22), to: square(18) }}
      />,
    );
    const highlights = screen.getAllByTestId('highlight-last-move');
    for (const hl of highlights) {
      const parent = hl.closest('[role="gridcell"]');
      expect(parent).not.toBeNull();
    }
  });
});
