import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import CapturedPieces from './CapturedPieces';
import type { Move } from '../engine/types';
import { square } from '../engine/types';

describe('CapturedPieces', () => {
  const emptyHistory: Move[] = [];

  it('shows zero captures with empty history and no pending', () => {
    render(<CapturedPieces moveHistory={emptyHistory} />);
    const whiteCount = screen.getByTestId('capture-count-white');
    const blackCount = screen.getByTestId('capture-count-black');
    expect(whiteCount.textContent).toContain('0');
    expect(blackCount.textContent).toContain('0');
  });

  it('adds pendingCaptures to the derived counts', () => {
    render(
      <CapturedPieces
        moveHistory={emptyHistory}
        pendingCaptures={{ white: 2, black: 1 }}
      />,
    );
    const whiteCount = screen.getByTestId('capture-count-white');
    const blackCount = screen.getByTestId('capture-count-black');
    expect(whiteCount.textContent).toContain('2');
    expect(blackCount.textContent).toContain('1');
  });

  it('derives counts from move history correctly', () => {
    const history: Move[] = [
      // Move 0 (white's turn): captures 1 piece
      { from: square(22), path: [square(15)], captured: [square(18)] },
      // Move 1 (black's turn): captures 1 piece
      { from: square(11), path: [square(18)], captured: [square(15)] },
    ];

    render(<CapturedPieces moveHistory={history} />);
    const whiteCount = screen.getByTestId('capture-count-white');
    const blackCount = screen.getByTestId('capture-count-black');
    expect(whiteCount.textContent).toContain('1');
    expect(blackCount.textContent).toContain('1');
  });

  it('combines history and pending captures', () => {
    const history: Move[] = [
      { from: square(22), path: [square(15)], captured: [square(18)] },
    ];

    render(
      <CapturedPieces
        moveHistory={history}
        pendingCaptures={{ white: 0, black: 0 }}
      />,
    );
    const whiteCount = screen.getByTestId('capture-count-white');
    expect(whiteCount.textContent).toContain('1');
  });

  it('shows zero pending as no change from base', () => {
    render(
      <CapturedPieces
        moveHistory={emptyHistory}
        pendingCaptures={{ white: 0, black: 0 }}
      />,
    );
    const whiteCount = screen.getByTestId('capture-count-white');
    const blackCount = screen.getByTestId('capture-count-black');
    expect(whiteCount.textContent).toContain('0');
    expect(blackCount.textContent).toContain('0');
  });
});
