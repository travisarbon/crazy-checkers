import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AnalysisDetailPanel from './AnalysisDetailPanel';
import type { AnalysisResult } from '../../cogitate/types';

function makeResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    evaluation: 0.15,
    bestMove: null,
    bestMoveNotation: '11-15',
    principalVariation: [],
    pvNotation: ['11-15', '22-18', '15x22'],
    alternativeMoves: [
      { move: {} as never, notation: '11-15', score: 1, normalizedScore: 0.15 },
      { move: {} as never, notation: '10-14', score: 0.8, normalizedScore: 0.05 },
      { move: {} as never, notation: '9-13', score: 0.6, normalizedScore: -0.05 },
    ],
    depth: 8,
    nodesEvaluated: 1000,
    rawScore: 100,
    evalDrop: 0.35,
    moveQuality: 'blunder',
    ...overrides,
  };
}

describe('AnalysisDetailPanel', () => {
  it('shows loading state when result is null and analyzing', () => {
    render(
      <AnalysisDetailPanel
        result={null}
        plyIndex={0}
        playedMoveNotation="11-15"
        isAnalyzing
      />,
    );
    expect(screen.getByTestId('analysis-detail-analyzing')).toBeInTheDocument();
  });

  it('shows empty state when result is null and not analyzing', () => {
    render(
      <AnalysisDetailPanel
        result={null}
        plyIndex={0}
        playedMoveNotation=""
        isAnalyzing={false}
      />,
    );
    expect(screen.getByTestId('analysis-detail-empty')).toBeInTheDocument();
  });

  it('renders classification badge, eval, eval drop, and best move', () => {
    render(
      <AnalysisDetailPanel
        result={makeResult()}
        plyIndex={4}
        playedMoveNotation="12-16"
        isAnalyzing={false}
      />,
    );
    expect(screen.getByTestId('analysis-detail-badge-blunder')).toBeInTheDocument();
    expect(screen.getByTestId('analysis-detail-drop')).toHaveTextContent('−0.35');
    expect(screen.getByTestId('analysis-detail-best')).toHaveTextContent('11-15');
  });

  it('does not show eval drop for good moves', () => {
    render(
      <AnalysisDetailPanel
        result={makeResult({ moveQuality: 'good', evalDrop: 0 })}
        plyIndex={0}
        playedMoveNotation="11-15"
        isAnalyzing={false}
      />,
    );
    expect(screen.queryByTestId('analysis-detail-drop')).not.toBeInTheDocument();
  });

  it('fires onDeepAnalyze when the button is clicked', () => {
    const handler = vi.fn();
    render(
      <AnalysisDetailPanel
        result={makeResult()}
        plyIndex={0}
        playedMoveNotation="11-15"
        isAnalyzing={false}
        onDeepAnalyze={handler}
      />,
    );
    fireEvent.click(screen.getByTestId('analysis-detail-deep-analyze'));
    expect(handler).toHaveBeenCalled();
  });

  it('disables deep analyze when not available', () => {
    render(
      <AnalysisDetailPanel
        result={makeResult()}
        plyIndex={0}
        playedMoveNotation="11-15"
        isAnalyzing={false}
        onDeepAnalyze={() => undefined}
        deepAnalyzeAvailable={false}
      />,
    );
    expect(screen.getByTestId('analysis-detail-deep-analyze')).toBeDisabled();
  });
});
