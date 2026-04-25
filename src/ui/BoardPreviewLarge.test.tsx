import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import BoardPreviewLarge from './BoardPreviewLarge';
import { PieceColor, PieceType } from '../engine/types';
import type { BoardState } from '../engine/types';
import { THEMES } from '../themes/theme';

describe('BoardPreviewLarge', () => {
  it('renders default position with 24 pieces', () => {
    const { container } = render(
      <BoardPreviewLarge label="Starting position" />,
    );
    const pieces = container.querySelectorAll('[data-testid^="piece-"]');
    expect(pieces).toHaveLength(24);
  });

  it('renders custom position', () => {
    // Board with only 2 pieces on squares 1 and 32
    const board: BoardState = Array.from({ length: 32 }, (_, i) => {
      if (i === 0) return { color: PieceColor.Black, type: PieceType.Pawn };
      if (i === 31) return { color: PieceColor.White, type: PieceType.Pawn };
      return null;
    });
    const { container } = render(
      <BoardPreviewLarge position={board} label="Custom position" />,
    );
    const pieces = container.querySelectorAll('[data-testid^="piece-"]');
    expect(pieces).toHaveLength(2);
  });

  it('renders empty board with no pieces', () => {
    const emptyBoard: BoardState = new Array(32).fill(null);
    const { container } = render(
      <BoardPreviewLarge position={emptyBoard} label="Empty board" />,
    );
    const pieces = container.querySelectorAll('[data-testid^="piece-"]');
    expect(pieces).toHaveLength(0);
  });

  it('highlights squares', () => {
    const { container } = render(
      <BoardPreviewLarge highlightSquares={[1, 5, 10]} label="Highlighted board" />,
    );
    expect(container.querySelector('[data-testid="highlight-1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="highlight-5"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="highlight-10"]')).toBeInTheDocument();
  });

  it('has accessible label', () => {
    const { container } = render(
      <BoardPreviewLarge label="Test board label" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-label', 'Test board label');
  });

  it('has role img', () => {
    const { container } = render(
      <BoardPreviewLarge label="Board" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
  });

  it('renders kings distinctly', () => {
    const board: BoardState = Array.from({ length: 32 }, (_, i) => {
      if (i === 0) return { color: PieceColor.White, type: PieceType.King };
      return null;
    });
    const { container } = render(
      <BoardPreviewLarge position={board} label="King board" />,
    );
    expect(container.querySelector('[data-testid="king-1"]')).toBeInTheDocument();
  });

  it('theme prop overrides CSS vars', () => {
    const theme = THEMES['crazy-original'];
    if (!theme) return;
    const { container } = render(
      <BoardPreviewLarge theme={theme} label="Themed board" />,
    );
    // Board squares should use direct color values, not CSS vars
    const rects = container.querySelectorAll('rect');
    const fills = Array.from(rects).map((r) => r.getAttribute('fill'));
    expect(fills).toContain(theme.boardLight);
    expect(fills).toContain(theme.boardDark);
  });

  it('default size is 240', () => {
    const { container } = render(
      <BoardPreviewLarge label="Default size board" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '240');
  });

  it('unsupported boardType renders fallback', () => {
    render(
      <BoardPreviewLarge boardType="10x10" label="Unsupported board" />,
    );
    expect(screen.getByText('Board type: 10x10')).toBeInTheDocument();
  });
});
