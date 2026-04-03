import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GameScreen from './GameScreen';
import MenuScreen from './MenuScreen';
import { createAmericanRules } from '../engine/rules';
import { PlayerType } from '../engine/types';
import type { PlayerSetup, RuleSet } from '../engine/types';

const VIEWPORTS = [
  { name: 'small-phone', width: 360, height: 640 },
  { name: 'iphone', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1024, height: 768 },
  { name: 'wide', width: 1440, height: 900 },
];

function setupViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, writable: true, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, writable: true, configurable: true });
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => {
      let matches = false;
      const maxWidthMatch = query.match(/max-width:\s*(\d+)px/);
      const minWidthMatch = query.match(/min-width:\s*(\d+)px/);
      if (maxWidthMatch?.[1]) {
        matches = width <= parseInt(maxWidthMatch[1], 10);
      } else if (minWidthMatch?.[1]) {
        matches = width >= parseInt(minWidthMatch[1], 10);
      }
      return {
        matches,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
      };
    }),
    writable: true,
    configurable: true,
  });
}

describe.each(VIEWPORTS)(
  'Responsive layout at $name ($width×$height)',
  ({ width, height }) => {
    beforeEach(() => {
      setupViewport(width, height);
    });

    it('GameScreen renders without error', () => {
      const ruleSet: RuleSet = createAmericanRules();
      const players: PlayerSetup = {
        white: PlayerType.Human,
        black: PlayerType.Human,
      };
      render(
        <GameScreen
          ruleSet={ruleSet}
          players={players}
          onNewGame={vi.fn()}
        />,
      );
      expect(screen.getByTestId('game-screen')).toBeTruthy();
    });

    it('MenuScreen renders without error', () => {
      render(
        <MenuScreen
          onStartGame={vi.fn()}
          onConfigure={vi.fn()}
        />,
      );
      expect(screen.getByText('Crazy Checkers')).toBeTruthy();
    });
  },
);
