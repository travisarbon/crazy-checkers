import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Board from './Board';
import { createInitialBoard } from '../engine/board';
import type { BoardState } from '../engine/types';
import { PieceColor, PieceType, square } from '../engine/types';
import { squareToGrid } from '../engine/board';

describe('Board', () => {
  it('renders 64 squares (32 light + 32 dark)', () => {
    const { container } = render(<Board board={createInitialBoard()} />);
    const rects = container.querySelectorAll('rect');
    expect(rects).toHaveLength(64);
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

    // None of the pieces should mention squares 13-20
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
    // Place a single black pawn on square 1 (engine row 0)
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

    // In normal orientation, square 1 (row 0, col 1) renders at y = 0 * 100 + 50 = 50
    // In flipped orientation, square 1 (row 0) renders at y = (7 - 0) * 100 + 50 = 750
    const normalCircle = normalContainer.querySelector('circle');
    const flippedCircle = flippedContainer.querySelector('circle');

    expect(normalCircle).not.toBeNull();
    expect(flippedCircle).not.toBeNull();

    const normalCy = Number(normalCircle!.getAttribute('cy'));
    const flippedCy = Number(flippedCircle!.getAttribute('cy'));

    // Normal: piece at top (low y), Flipped: piece at bottom (high y)
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

    // Check that at least one occupied square has a descriptive label
    const sq1Cell = gridcells.find((cell) =>
      cell.getAttribute('aria-label')?.includes('Square 1'),
    );
    expect(sq1Cell).toBeDefined();
    expect(sq1Cell!.getAttribute('aria-label')).toBe('Square 1, black pawn');
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
    expect(sq13Cell!.getAttribute('aria-label')).toBe('Square 13, empty');
  });

  it('board container has square aspect ratio', () => {
    const { container } = render(<Board board={createInitialBoard()} />);
    const boardContainer = container.firstElementChild as HTMLElement;
    expect(boardContainer).not.toBeNull();
    // CSS module class is applied; check the SVG viewBox is square
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 800 800');
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
    // Square 1 is at grid (0, 1) — should render at x=150, y=50 (normal orientation)
    const board: BoardState = new Array(32).fill(null) as BoardState;
    const mutableBoard = [...board];
    mutableBoard[0] = { color: PieceColor.White, type: PieceType.Pawn };
    const testBoard = mutableBoard as unknown as BoardState;

    const { container } = render(<Board board={testBoard} />);
    const circle = container.querySelector('circle');
    expect(circle).not.toBeNull();

    const grid = squareToGrid(square(1));
    // col 1 => x center = 1 * 100 + 50 = 150
    // row 0 => y center = 0 * 100 + 50 = 50
    expect(Number(circle!.getAttribute('cx'))).toBe(grid.col * 100 + 50);
    expect(Number(circle!.getAttribute('cy'))).toBe(grid.row * 100 + 50);
  });
});
