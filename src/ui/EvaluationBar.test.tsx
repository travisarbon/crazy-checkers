import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EvaluationBar, { formatEvaluationScore } from './EvaluationBar';
import type { NormalizedEvaluation } from '../cogitate/types';

function evalValue(score: number): NormalizedEvaluation {
  return { score, rawScore: score * 100, isTerminal: false, confidence: 1 };
}

describe('formatEvaluationScore', () => {
  it('formats a positive value with a plus sign', () => {
    expect(formatEvaluationScore(0.3)).toBe('+0.3');
  });

  it('formats a negative value with a Unicode minus', () => {
    expect(formatEvaluationScore(-0.8)).toBe('\u22120.8');
  });

  it('formats zero as 0.0', () => {
    expect(formatEvaluationScore(0)).toBe('0.0');
  });

  it('clamps values outside [-1, 1]', () => {
    expect(formatEvaluationScore(2)).toBe('+1.0');
    expect(formatEvaluationScore(-5)).toBe('\u22121.0');
  });
});

describe('EvaluationBar', () => {
  it('renders in loading state when score is null and no state prop is given', () => {
    render(<EvaluationBar score={null} />);
    const bar = screen.getByTestId('evaluation-bar');
    expect(bar.dataset.state).toBe('loading');
    expect(screen.getByTestId('evaluation-bar-label').textContent).toBe('Analyzing...');
  });

  it('renders in unavailable state when explicitly set', () => {
    render(<EvaluationBar score={null} state="unavailable" />);
    const bar = screen.getByTestId('evaluation-bar');
    expect(bar.dataset.state).toBe('unavailable');
    expect(screen.getByTestId('evaluation-bar-label').textContent).toBe('N/A');
  });

  it('renders in error state when explicitly set', () => {
    render(<EvaluationBar score={null} state="error" />);
    const bar = screen.getByTestId('evaluation-bar');
    expect(bar.dataset.state).toBe('error');
    expect(screen.getByTestId('evaluation-bar-label').textContent).toBe('Error');
  });

  it('renders with 50% fill for score 0.0', () => {
    render(<EvaluationBar score={evalValue(0)} />);
    const fill = screen.getByTestId('evaluation-bar-fill');
    expect(fill.style.height).toBe('50%');
  });

  it('renders with 100% fill for score +1.0 (vertical)', () => {
    render(<EvaluationBar score={evalValue(1)} />);
    const fill = screen.getByTestId('evaluation-bar-fill');
    expect(fill.style.height).toBe('100%');
  });

  it('renders with 0% fill for score -1.0 (vertical)', () => {
    render(<EvaluationBar score={evalValue(-1)} />);
    const fill = screen.getByTestId('evaluation-bar-fill');
    expect(fill.style.height).toBe('0%');
  });

  it('applies horizontal class when orientation="horizontal"', () => {
    render(<EvaluationBar score={evalValue(0.5)} orientation="horizontal" />);
    const bar = screen.getByTestId('evaluation-bar');
    expect(bar.dataset.orientation).toBe('horizontal');
    const fill = screen.getByTestId('evaluation-bar-fill');
    expect(fill.style.width).toBe('75%');
    expect(fill.style.height).toBe('100%');
  });

  it('provides ARIA meter role and valuenow', () => {
    render(<EvaluationBar score={evalValue(0.3)} />);
    const bar = screen.getByRole('meter');
    expect(bar).toHaveAttribute('aria-valuenow', '0.3');
    expect(bar).toHaveAttribute('aria-valuemin', '-1');
    expect(bar).toHaveAttribute('aria-valuemax', '1');
    expect(bar).toHaveAttribute('aria-label', 'Position evaluation');
  });
});
