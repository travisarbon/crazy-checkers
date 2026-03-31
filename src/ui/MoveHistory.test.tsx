import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MoveHistory from './MoveHistory';
import type { Move } from '../engine/types';
import { square } from '../engine/types';

function makeMoveObj(from: number, to: number, captured: number[] = []): Move {
  return {
    from: square(from),
    path: [square(to)],
    captured: captured.map(square),
  };
}

describe('MoveHistory', () => {
  it('shows placeholder when no moves exist', () => {
    render(<MoveHistory moveHistory={[]} currentMoveIndex={-1} />);
    expect(screen.getByText('No moves yet.')).toBeInTheDocument();
    expect(screen.getByTestId('move-history-empty')).toBeInTheDocument();
  });

  it('renders a single White move', () => {
    const moves = [makeMoveObj(11, 15)];
    render(<MoveHistory moveHistory={moves} currentMoveIndex={0} />);
    expect(screen.getByTestId('move-history-list')).toBeInTheDocument();
    expect(screen.getByText('11-15')).toBeInTheDocument();
  });

  it('renders a full move pair (White + Black)', () => {
    const moves = [makeMoveObj(11, 15), makeMoveObj(23, 18)];
    render(<MoveHistory moveHistory={moves} currentMoveIndex={1} />);
    expect(screen.getByText('11-15')).toBeInTheDocument();
    expect(screen.getByText('23-18')).toBeInTheDocument();
  });

  it('renders capture notation with x separator', () => {
    const moves = [makeMoveObj(15, 22, [18])];
    render(<MoveHistory moveHistory={moves} currentMoveIndex={0} />);
    expect(screen.getByText('15x22')).toBeInTheDocument();
  });

  it('highlights the current move', () => {
    const moves = [makeMoveObj(11, 15), makeMoveObj(23, 18)];
    render(<MoveHistory moveHistory={moves} currentMoveIndex={1} />);
    const blackMove = screen.getByText('23-18');
    expect(blackMove.className).toContain('moveCurrent');
  });

  it('does not highlight non-current moves', () => {
    const moves = [makeMoveObj(11, 15), makeMoveObj(23, 18)];
    render(<MoveHistory moveHistory={moves} currentMoveIndex={1} />);
    const whiteMove = screen.getByText('11-15');
    expect(whiteMove.className).not.toContain('moveCurrent');
  });

  it('renders collapsible details element when collapsible=true', () => {
    render(<MoveHistory moveHistory={[]} currentMoveIndex={-1} collapsible />);
    const details = screen.getByTestId('move-history');
    expect(details.tagName.toLowerCase()).toBe('details');
  });

  it('renders a div (not details) when collapsible=false', () => {
    render(<MoveHistory moveHistory={[]} currentMoveIndex={-1} />);
    const container = screen.getByTestId('move-history');
    expect(container.tagName.toLowerCase()).toBe('div');
  });

  it('shows move count in collapsible summary', () => {
    const moves = [makeMoveObj(11, 15), makeMoveObj(23, 18)];
    render(
      <MoveHistory moveHistory={moves} currentMoveIndex={1} collapsible />,
    );
    expect(screen.getByText('Move History (2 moves)')).toBeInTheDocument();
  });

  it('auto-scroll calls scrollIntoView on the current move', () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    const moves = [makeMoveObj(11, 15)];
    render(<MoveHistory moveHistory={moves} currentMoveIndex={0} />);
    expect(scrollIntoViewMock).toHaveBeenCalled();
  });

  it('renders multiple move pairs correctly', () => {
    const moves = [
      makeMoveObj(11, 15),
      makeMoveObj(23, 18),
      makeMoveObj(8, 11),
      makeMoveObj(26, 23),
    ];
    render(<MoveHistory moveHistory={moves} currentMoveIndex={3} />);
    expect(screen.getByText('11-15')).toBeInTheDocument();
    expect(screen.getByText('23-18')).toBeInTheDocument();
    expect(screen.getByText('8-11')).toBeInTheDocument();
    expect(screen.getByText('26-23')).toBeInTheDocument();
    // Move numbers should be present
    expect(screen.getByText('1.')).toBeInTheDocument();
    expect(screen.getByText('2.')).toBeInTheDocument();
  });
});
