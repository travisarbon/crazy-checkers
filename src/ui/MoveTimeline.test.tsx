import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MoveTimeline from './MoveTimeline';

describe('MoveTimeline', () => {
  it('renders an empty-state message when moves is empty', () => {
    render(<MoveTimeline moves={[]} currentPly={0} onPlySelect={() => undefined} />);
    expect(screen.getByTestId('move-timeline-empty')).toBeInTheDocument();
  });

  it('renders moves grouped into paired rows', () => {
    const moves = ['11-15', '22-18', '15x22', '25x18'];
    render(<MoveTimeline moves={moves} currentPly={0} onPlySelect={() => undefined} />);
    expect(screen.getByTestId('move-timeline-cell-0').textContent).toContain('11-15');
    expect(screen.getByTestId('move-timeline-cell-1').textContent).toContain('22-18');
    expect(screen.getByTestId('move-timeline-cell-2').textContent).toContain('15x22');
    expect(screen.getByTestId('move-timeline-cell-3').textContent).toContain('25x18');
  });

  it('applies a current highlight to the currentPly cell', () => {
    render(<MoveTimeline moves={['11-15', '22-18']} currentPly={1} onPlySelect={() => undefined} />);
    const cell = screen.getByTestId('move-timeline-cell-1');
    expect(cell.dataset.current).toBe('true');
    expect(cell).toHaveAttribute('aria-selected', 'true');
  });

  it('fires onPlySelect when a move cell is clicked', () => {
    const handler = vi.fn();
    render(<MoveTimeline moves={['11-15', '22-18']} currentPly={0} onPlySelect={handler} />);
    fireEvent.click(screen.getByTestId('move-timeline-cell-1'));
    expect(handler).toHaveBeenCalledWith(1);
  });

  it('renders quality indicators when moveQualities is provided', () => {
    render(
      <MoveTimeline
        moves={['11-15', '22-18', '15x22']}
        currentPly={0}
        onPlySelect={() => undefined}
        moveQualities={['brilliant', 'mistake', 'blunder']}
      />,
    );
    expect(screen.getByTestId('quality-brilliant')).toBeInTheDocument();
    expect(screen.getByTestId('quality-mistake')).toBeInTheDocument();
    expect(screen.getByTestId('quality-blunder')).toBeInTheDocument();
  });

  it('uses ARIA listbox semantics', () => {
    render(<MoveTimeline moves={['11-15']} currentPly={0} onPlySelect={() => undefined} />);
    const listbox = screen.getByRole('listbox');
    expect(listbox).toHaveAttribute('aria-label', 'Move timeline');
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0);
  });

  it('navigates ply with ArrowRight and ArrowLeft', () => {
    const handler = vi.fn();
    render(
      <MoveTimeline
        moves={['11-15', '22-18', '15x22']}
        currentPly={1}
        onPlySelect={handler}
      />,
    );
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowRight' });
    expect(handler).toHaveBeenCalledWith(2);
    fireEvent.keyDown(listbox, { key: 'ArrowLeft' });
    expect(handler).toHaveBeenCalledWith(0);
  });
});
