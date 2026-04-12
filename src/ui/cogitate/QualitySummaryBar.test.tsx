import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import QualitySummaryBar from './QualitySummaryBar';

describe('QualitySummaryBar', () => {
  it('renders a segment for each ply', () => {
    render(
      <QualitySummaryBar qualities={['good', 'blunder', null, 'brilliant']} />,
    );
    expect(screen.getByTestId('quality-summary-segment-0')).toBeInTheDocument();
    expect(screen.getByTestId('quality-summary-segment-3')).toBeInTheDocument();
  });

  it('marks not-yet-analyzed segments as pending', () => {
    render(<QualitySummaryBar qualities={[null, null]} />);
    expect(screen.getByTestId('quality-summary-segment-0').getAttribute('data-quality')).toBe('pending');
  });

  it('fires onPlySelect when a segment is clicked', () => {
    const onPlySelect = vi.fn();
    render(
      <QualitySummaryBar qualities={['good', 'good']} onPlySelect={onPlySelect} />,
    );
    fireEvent.click(screen.getByTestId('quality-summary-segment-1'));
    expect(onPlySelect).toHaveBeenCalledWith(1);
  });

  it('renders the quality score when provided', () => {
    render(<QualitySummaryBar qualities={['good']} qualityScore={72.4} />);
    expect(screen.getByTestId('quality-summary-score')).toHaveTextContent('72/100');
  });

  it('sets aria-label summary counts', () => {
    render(
      <QualitySummaryBar
        qualities={['good', 'good', 'blunder', 'mistake', 'inaccuracy']}
      />,
    );
    expect(
      screen.getByLabelText(
        /0 brilliant, 2 good, 1 inaccuracy, 1 mistake, 1 blunder/,
      ),
    ).toBeInTheDocument();
  });
});
