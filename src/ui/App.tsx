/**
 * Root application component with state-based screen navigation.
 *
 * Maintains a discriminated-union Screen state to route between
 * MenuScreen, GameScreen, and ConfigScreen without a router library.
 */

import { useEffect, useState, useCallback } from 'react';
import { applyTheme, THEMES, DEFAULT_THEME_ID } from '../themes/theme';
import { createAmericanRules } from '../engine/rules';
import { PlayerType } from '../engine/types';
import type { PlayerSetup, RuleSet } from '../engine/types';
import GameScreen from './GameScreen';
import MenuScreen from './MenuScreen';
import ConfigScreen from './ConfigScreen';

// ---------------------------------------------------------------------------
// Navigation state
// ---------------------------------------------------------------------------

type Screen =
  | { readonly kind: 'menu' }
  | {
      readonly kind: 'game';
      readonly players: PlayerSetup;
      readonly ruleSet: RuleSet;
      readonly flipped: boolean;
    }
  | { readonly kind: 'config' };

// ---------------------------------------------------------------------------
// App component
// ---------------------------------------------------------------------------

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: 'menu' });
  const [gameKey, setGameKey] = useState(0);

  // Apply default theme on mount
  useEffect(() => {
    const theme = THEMES[DEFAULT_THEME_ID];
    if (theme) applyTheme(theme);
  }, []);

  // Browser back-button support
  useEffect(() => {
    if (screen.kind !== 'menu') {
      window.history.pushState({ screen: screen.kind }, '');
    }

    function handlePopState() {
      setScreen({ kind: 'menu' });
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [screen.kind]);

  // Navigation callbacks
  const navigateToMenu = useCallback(() => setScreen({ kind: 'menu' }), []);

  const navigateToGame = useCallback((players: PlayerSetup, flipped: boolean) => {
    setScreen({
      kind: 'game',
      players,
      ruleSet: createAmericanRules(),
      flipped,
    });
    setGameKey((prev) => prev + 1);
  }, []);

  const navigateToConfig = useCallback(() => setScreen({ kind: 'config' }), []);

  // Render
  switch (screen.kind) {
    case 'menu':
      return <MenuScreen onStartGame={navigateToGame} onConfigure={navigateToConfig} />;

    case 'game':
      return (
        <GameScreen
          key={gameKey}
          ruleSet={screen.ruleSet}
          players={screen.players}
          flipped={screen.flipped}
          onNewGame={() => navigateToGame(screen.players, screen.flipped)}
          onMainMenu={navigateToMenu}
        />
      );

    case 'config':
      return <ConfigScreen onBack={navigateToMenu} />;
  }
}
