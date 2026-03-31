/**
 * Root application component.
 *
 * Thin shell: applies default theme, renders GameScreen with fixed
 * configuration. Task 4.1 will add MenuScreen and routing.
 */

import { useEffect, useState } from 'react';
import { applyTheme, THEMES, DEFAULT_THEME_ID } from '../themes/theme';
import { createAmericanRules } from '../engine/rules';
import { PlayerType } from '../engine/types';
import type { PlayerSetup, RuleSet } from '../engine/types';
import GameScreen from './GameScreen';

export default function App() {
  // Apply default theme on mount
  useEffect(() => {
    const theme = THEMES[DEFAULT_THEME_ID];
    if (theme) applyTheme(theme);
  }, []);

  // Temporary: fixed game configuration until Task 4.1 adds MenuScreen
  const [gameKey, setGameKey] = useState(0);
  const ruleSet: RuleSet = createAmericanRules();
  const players: PlayerSetup = {
    white: PlayerType.Human,
    black: PlayerType.Human,
  };

  const handleNewGame = () => {
    setGameKey((prev) => prev + 1);
  };

  return (
    <GameScreen
      key={gameKey}
      ruleSet={ruleSet}
      players={players}
      onNewGame={handleNewGame}
    />
  );
}
