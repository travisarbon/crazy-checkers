import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ResumeGameDialog from './ResumeGameDialog';
import type { SavedGame } from '../../persistence/settings';
import type { SerializedGameState } from '../../persistence/serialization';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockState: SerializedGameState = {
  board: Array.from({ length: 32 }, () => null),
  activeColor: 'WHITE',
  status: 'IN_PROGRESS',
  result: null,
  players: { white: 'HUMAN', black: 'CPU_EASY' },
  moveHistory: [],
  positionHashes: [],
  halfMoveClock: 0,
  plyCount: 5,
};

const mockSavedGame: SavedGame = {
  version: 1,
  state: mockState,
  mode: 'classic',
  playerSetup: { white: 'HUMAN', black: 'CPU_EASY' },
  flipped: false,
  timestamp: Date.now() - 3600000, // 1 hour ago
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ResumeGameDialog', () => {
  it('renders game info', () => {
    render(<ResumeGameDialog savedGame={mockSavedGame} onResume={vi.fn()} onDiscard={vi.fn()} />);

    expect(screen.getByText('Resume Game?')).toBeInTheDocument();
    expect(screen.getByText(/classic/)).toBeInTheDocument();
    expect(screen.getByText(/Human \(White\) vs\. CPU Easy \(Black\)/)).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('Resume button calls onResume', () => {
    const onResume = vi.fn();
    render(<ResumeGameDialog savedGame={mockSavedGame} onResume={onResume} onDiscard={vi.fn()} />);

    fireEvent.click(screen.getByTestId('resume-resume'));
    expect(onResume).toHaveBeenCalledOnce();
  });

  it('Discard button calls onDiscard', () => {
    const onDiscard = vi.fn();
    render(<ResumeGameDialog savedGame={mockSavedGame} onResume={vi.fn()} onDiscard={onDiscard} />);

    fireEvent.click(screen.getByTestId('resume-discard'));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('Escape key calls onDiscard', () => {
    const onDiscard = vi.fn();
    render(<ResumeGameDialog savedGame={mockSavedGame} onResume={vi.fn()} onDiscard={onDiscard} />);

    fireEvent.keyDown(screen.getByTestId('resume-dialog'), { key: 'Escape' });
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('has dialog role and aria-modal', () => {
    render(<ResumeGameDialog savedGame={mockSavedGame} onResume={vi.fn()} onDiscard={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'resume-title');
  });
});
