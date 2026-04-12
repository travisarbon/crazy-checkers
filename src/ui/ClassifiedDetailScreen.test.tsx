import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClassifiedDetailScreen from './ClassifiedDetailScreen';
import { getClassifiedByWave } from '../persistence/gameModeRegistry';

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderScreen(
  gameIndex = 1,
  overrides: Partial<{ onBack: () => void }> = {},
) {
  const defaultProps = {
    gameIndex,
    onBack: overrides.onBack ?? vi.fn(),
  };
  return {
    onBack: defaultProps.onBack,
    ...render(<ClassifiedDetailScreen {...defaultProps} />),
  };
}

// ===========================================================================
// 6.7 — ClassifiedDetailScreen Tests
// ===========================================================================

describe('ClassifiedDetailScreen -- rendering and content', () => {
  it('42: renders with ModeScreenShell and game name as title', () => {
    renderScreen(1);
    expect(screen.getByRole('heading', { name: 'Russian Draughts' })).toBeInTheDocument();
  });

  it('43: renders game info card with board geometry', () => {
    renderScreen(1);
    expect(screen.getByText('Board:')).toBeInTheDocument();
  });

  it('44: renders game info card with family', () => {
    renderScreen(1);
    expect(screen.getByText('Family:')).toBeInTheDocument();
    expect(screen.getByText('Draughts')).toBeInTheDocument();
  });

  it('45: renders game info card with wave number', () => {
    renderScreen(1);
    expect(screen.getByText('Wave:')).toBeInTheDocument();
    expect(screen.getByText('Wave 1')).toBeInTheDocument();
  });

  it('46: renders Coming Soon notice', () => {
    renderScreen(1);
    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
  });

  it('47: renders descriptive text mentioning game name', () => {
    renderScreen(1);
    expect(screen.getByText(/Russian Draughts is being prepared/)).toBeInTheDocument();
  });

  it('48: back button calls onBack', () => {
    const onBack = vi.fn();
    renderScreen(1, { onBack });
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('49: renders fallback for invalid gameIndex (0)', () => {
    renderScreen(0);
    expect(screen.getByText(/Game not found/)).toBeInTheDocument();
  });

  it('50: renders fallback for invalid gameIndex (999)', () => {
    renderScreen(999);
    expect(screen.getByText(/Game not found/)).toBeInTheDocument();
  });

  it('51: renders with correct testid', () => {
    renderScreen(1);
    expect(screen.getByTestId('classified-detail-screen')).toBeInTheDocument();
  });
});

// ===========================================================================
// Integration: renders for all 64 game indices
// ===========================================================================

describe('ClassifiedDetailScreen -- integration', () => {
  it('56: renders for all 64 game indices without error', () => {
    for (let i = 1; i <= 64; i++) {
      const { unmount } = render(
        <ClassifiedDetailScreen gameIndex={i} onBack={vi.fn()} />,
      );
      expect(screen.getByTestId('classified-detail-screen')).toBeInTheDocument();
      unmount();
    }
  });

  it('renders correct title for various game indices', () => {
    // Spot-check a few games across waves
    const testCases = [
      { index: 1, name: 'Russian Draughts' },
      { index: 15, name: 'Zamma' },
      { index: 28, name: 'Breakthrough' },
      { index: 48, name: 'Arimaa' },
      { index: 64, name: 'Chess' },
    ];
    for (const tc of testCases) {
      const { unmount } = render(
        <ClassifiedDetailScreen gameIndex={tc.index} onBack={vi.fn()} />,
      );
      expect(screen.getByRole('heading', { name: tc.name })).toBeInTheDocument();
      unmount();
    }
  });

  it('all 64 classified entries are reachable via getClassifiedByWave', () => {
    const allIndices = new Set<number>();
    for (let wave = 1; wave <= 8; wave++) {
      const entries = getClassifiedByWave(wave);
      for (const entry of entries) {
        if (entry.classifiedIndex !== null) {
          allIndices.add(entry.classifiedIndex);
        }
      }
    }
    expect(allIndices.size).toBe(64);
    for (let i = 1; i <= 64; i++) {
      expect(allIndices.has(i)).toBe(true);
    }
  });
});
