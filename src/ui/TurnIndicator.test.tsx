import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import TurnIndicator from './TurnIndicator';
import { PieceColor, GameResultType, GameEndReason } from '../engine/types';
import type { GameResult } from '../engine/types';

describe('TurnIndicator', () => {
  it('displays "White\'s turn" when White is active', () => {
    render(<TurnIndicator activeColor={PieceColor.White} isGameOver={false} result={null} />);
    expect(screen.getByText("White's turn")).toBeInTheDocument();
  });

  it('displays "Black\'s turn" when Black is active', () => {
    render(<TurnIndicator activeColor={PieceColor.Black} isGameOver={false} result={null} />);
    expect(screen.getByText("Black's turn")).toBeInTheDocument();
  });

  it('displays "Thinking\u2026" when isThinking is true and game is in progress', () => {
    render(
      <TurnIndicator
        activeColor={PieceColor.Black}
        isGameOver={false}
        result={null}
        isThinking={true}
      />,
    );
    expect(screen.getByText('Thinking\u2026')).toBeInTheDocument();
  });

  it('displays the normal turn text when isThinking is false', () => {
    render(
      <TurnIndicator
        activeColor={PieceColor.White}
        isGameOver={false}
        result={null}
        isThinking={false}
      />,
    );
    expect(screen.getByText("White's turn")).toBeInTheDocument();
  });

  it('does not display "Thinking\u2026" when game is over, even if isThinking is true', () => {
    const result: GameResult = {
      type: GameResultType.WhiteWin,
      reason: GameEndReason.NoLegalMoves,
    };
    render(
      <TurnIndicator
        activeColor={PieceColor.Black}
        isGameOver={true}
        result={result}
        isThinking={true}
      />,
    );
    expect(screen.queryByText('Thinking\u2026')).not.toBeInTheDocument();
    expect(screen.getByText(/White wins/)).toBeInTheDocument();
  });

  it('has aria-live="polite" for screen reader announcements', () => {
    render(
      <TurnIndicator
        activeColor={PieceColor.Black}
        isGameOver={false}
        result={null}
        isThinking={true}
      />,
    );
    const indicator = screen.getByTestId('turn-indicator');
    expect(indicator).toHaveAttribute('role', 'status');
    expect(indicator).toHaveAttribute('aria-live', 'polite');
  });

  it('renders thinking dots indicator when thinking', () => {
    render(
      <TurnIndicator
        activeColor={PieceColor.Black}
        isGameOver={false}
        result={null}
        isThinking={true}
      />,
    );
    expect(screen.getByText('Thinking\u2026')).toBeInTheDocument();
    expect(screen.getByTestId('thinking-dots')).toBeInTheDocument();
  });

  it('displays game result when game is over', () => {
    const result: GameResult = {
      type: GameResultType.Draw,
      reason: GameEndReason.Repetition,
    };
    render(<TurnIndicator activeColor={PieceColor.White} isGameOver={true} result={result} />);
    expect(screen.getByText(/Draw.*repetition/)).toBeInTheDocument();
  });
});
