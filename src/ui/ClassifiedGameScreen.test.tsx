/**
 * ClassifiedGameScreen — Task 27.8 smoke tests.
 */

import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import ClassifiedGameScreen from './ClassifiedGameScreen';
import {
  _clearClassifiedRegistry,
} from '../engine/classified/registry';
import {
  _clearTierLoaderCache,
  loadClassifiedTier,
} from '../engine/classified/tierLoader';
import { RUSSIAN_DRAUGHTS_ID } from '../engine/classified/tier1/ids';
import { asClassifiedGameId } from '../engine/classified/ClassifiedRuleSet';
import { PlayerType } from '../engine/types';

beforeAll(async () => {
  _clearClassifiedRegistry();
  _clearTierLoaderCache();
  await loadClassifiedTier(1);
});

describe('ClassifiedGameScreen — Task 27.8', () => {
  it('renders the registered game with title and board', () => {
    render(
      <ClassifiedGameScreen
        gameId={RUSSIAN_DRAUGHTS_ID}
        players={{ white: PlayerType.Human, black: PlayerType.Human }}
        themeId="crazy"
        onNewGame={vi.fn()}
        onMainMenu={vi.fn()}
      />,
    );

    expect(screen.getByTestId('classified-game-screen')).toBeInTheDocument();
    expect(screen.getByTestId('classified-turn')).toHaveTextContent(
      'White to move',
    );
    // SquareBoardRenderer mounts for an 8x8 board geometry.
    expect(screen.getByTestId('square-board-renderer')).toBeInTheDocument();
  });

  it('renders an error state when the gameId is not registered', () => {
    render(
      <ClassifiedGameScreen
        gameId={asClassifiedGameId('not-a-registered-game')}
        players={{ white: PlayerType.Human, black: PlayerType.Human }}
        themeId="crazy"
        onNewGame={vi.fn()}
        onMainMenu={vi.fn()}
      />,
    );

    expect(screen.getByText('Game not registered')).toBeInTheDocument();
  });
});
