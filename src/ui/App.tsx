/**
 * Root application component with state-based screen navigation.
 *
 * Maintains a discriminated-union Screen state to route between
 * MenuScreen, GameScreen, and ConfigScreen without a router library.
 */

import { useEffect, useState, useCallback } from 'react';
import { applyTheme, THEMES } from '../themes/theme';
import { createAmericanRules } from '../engine/rules';
import type { PlayerSetup, RuleSet } from '../engine/types';
import GameScreen from './GameScreen';
import MenuScreen from './MenuScreen';
import ConfigScreen from './ConfigScreen';
import { DEFAULT_SETTINGS } from './settings';

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
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Apply theme reactively when themeId changes
  useEffect(() => {
    const theme = THEMES[settings.themeId];
    if (theme) applyTheme(theme);
  }, [settings.themeId]);

  // Browser back-button support
  useEffect(() => {
    if (screen.kind !== 'menu') {
      window.history.pushState({ screen: screen.kind }, '');
    }

    function handlePopState() {
      setScreen({ kind: 'menu' });
    }

    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); };
  }, [screen.kind]);

  // Navigation callbacks
  const navigateToMenu = useCallback(() => { setScreen({ kind: 'menu' }); }, []);

  const navigateToGame = useCallback((players: PlayerSetup, flipped: boolean) => {
    setScreen({
      kind: 'game',
      players,
      ruleSet: createAmericanRules(),
      flipped,
    });
    setGameKey((prev) => prev + 1);
  }, []);

  const navigateToConfig = useCallback(() => { setScreen({ kind: 'config' }); }, []);

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
          animationSpeedMultiplier={settings.animationSpeed}
          moveConfirmation={settings.moveConfirmation}
          onNewGame={() => { navigateToGame(screen.players, screen.flipped); }}
          onMainMenu={navigateToMenu}
        />
      );

    case 'config':
      return (
        <ConfigScreen
          settings={settings}
          onSettingsChange={setSettings}
          onBack={navigateToMenu}
        />
      );
  }
}
