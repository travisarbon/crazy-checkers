/**
 * ClassifiedDetailScreen — Task 27.8 MVP registered-branch tests.
 *
 * Verifies that when the Classified game is live-registered (Tier 1), the
 * detail screen renders the inline GameSetupSection with a Start Game
 * button and invokes the onStartGame callback with the correct game id.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import ClassifiedDetailScreen from './ClassifiedDetailScreen';
import {
  _clearClassifiedRegistry,
  isClassifiedRegistered,
} from '../engine/classified/registry';
import {
  _clearTierLoaderCache,
  loadClassifiedTier,
} from '../engine/classified/tierLoader';
import { RUSSIAN_DRAUGHTS_ID } from '../engine/classified/tier1/ids';
import { asClassifiedGameId } from '../engine/classified/ClassifiedRuleSet';

beforeAll(async () => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
  await loadClassifiedTier(1);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ClassifiedDetailScreen — MVP registered branch (Task 27.8)', () => {
  it('renders Russian Draughts (index 1) via the registered branch', () => {
    expect(isClassifiedRegistered(asClassifiedGameId(RUSSIAN_DRAUGHTS_ID))).toBe(
      true,
    );

    render(
      <ClassifiedDetailScreen
        gameIndex={1}
        onBack={vi.fn()}
        onStartGame={vi.fn()}
      />,
    );

    // Rule summary should render and replace the Coming Soon block.
    expect(screen.getByTestId('classified-rule-summary')).toBeInTheDocument();
    expect(screen.queryByText('Coming Soon')).not.toBeInTheDocument();

    // Inline GameSetupSection with Start Game button.
    expect(screen.getByTestId('game-setup-section')).toBeInTheDocument();
    expect(screen.getByTestId('start-game-button')).toBeInTheDocument();
  });

  it('invokes onStartGame with the registered gameId when Start Game is clicked', () => {
    const onStartGame = vi.fn();

    render(
      <ClassifiedDetailScreen
        gameIndex={1}
        onBack={vi.fn()}
        onStartGame={onStartGame}
      />,
    );

    fireEvent.click(screen.getByTestId('start-game-button'));

    expect(onStartGame).toHaveBeenCalledTimes(1);
    const [gameId] = onStartGame.mock.calls[0] as readonly unknown[];
    expect(gameId).toBe(RUSSIAN_DRAUGHTS_ID);
  });

  it('falls back to Coming Soon for unregistered games', () => {
    render(
      <ClassifiedDetailScreen
        gameIndex={64}
        onBack={vi.fn()}
        onStartGame={vi.fn()}
      />,
    );

    expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    expect(screen.queryByTestId('game-setup-section')).not.toBeInTheDocument();
  });
});
