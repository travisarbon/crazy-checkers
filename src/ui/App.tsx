/**
 * Root application component with state-based screen navigation.
 *
 * Maintains a discriminated-union Screen state to route between
 * MenuScreen, GameScreen, and ConfigScreen without a router library.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { applyTheme, THEMES } from '../themes/theme';
import { createAmericanRules } from '../engine/rules';
import type { GameState, PlayerSetup, RuleSet } from '../engine/types';
import { loadSettings, saveSettings, loadSavedGame, clearSavedGame } from '../persistence/settings';
import type { SavedGame } from '../persistence/settings';
import { deserializeGameState } from '../persistence/serialization';
import GameScreen from './GameScreen';
import MenuScreen from './MenuScreen';
import ConfigScreen from './ConfigScreen';
import ResumeGameDialog from './dialogs/ResumeGameDialog';

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
  const [settings, setSettings] = useState(() => loadSettings());
  const [pendingResume, setPendingResume] = useState<SavedGame | null>(() => loadSavedGame());
  const [resumedGameState, setResumedGameState] = useState<GameState | null>(null);
  const [gameStartedAt, setGameStartedAt] = useState(() => Date.now());

  // Persist settings on every change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Apply theme reactively when themeId changes
  useEffect(() => {
    const theme = THEMES[settings.themeId];
    if (theme) applyTheme(theme);
  }, [settings.themeId]);

  // Browser back-button support — push a base entry on mount so there is
  // always a history entry to return to, then push on non-menu transitions.
  const hasInitializedHistory = useRef(false);

  useEffect(() => {
    if (!hasInitializedHistory.current) {
      hasInitializedHistory.current = true;
      window.history.replaceState({ screen: 'menu' }, '');
    }
  }, []);

  useEffect(() => {
    if (screen.kind !== 'menu') {
      window.history.pushState({ screen: screen.kind }, '');
    }

    function handlePopState() {
      setScreen({ kind: 'menu' });
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [screen.kind]);

  // Navigation callbacks
  const navigateToMenu = useCallback(() => {
    setScreen({ kind: 'menu' });
  }, []);

  const navigateToGame = useCallback((players: PlayerSetup, flipped: boolean) => {
    setScreen({
      kind: 'game',
      players,
      ruleSet: createAmericanRules(),
      flipped,
    });
    setGameKey((prev) => prev + 1);
    setGameStartedAt(Date.now());
    setResumedGameState(null);
  }, []);

  const navigateToConfig = useCallback(() => {
    setScreen({ kind: 'config' });
  }, []);

  // Resume/discard handlers
  const handleResume = useCallback(() => {
    if (pendingResume === null) return;
    try {
      const gameState = deserializeGameState(pendingResume.state);
      setScreen({
        kind: 'game',
        players: gameState.players,
        ruleSet: gameState.ruleSet,
        flipped: pendingResume.flipped,
      });
      setResumedGameState(gameState);
      setGameStartedAt(pendingResume.timestamp);
      setGameKey((prev) => prev + 1);
      clearSavedGame();
      setPendingResume(null);
    } catch (err) {
      console.warn('Failed to deserialize saved game:', err);
      clearSavedGame();
      setPendingResume(null);
    }
  }, [pendingResume]);

  const handleDiscard = useCallback(() => {
    clearSavedGame();
    setPendingResume(null);
  }, []);

  // Render
  switch (screen.kind) {
    case 'menu':
      return (
        <>
          <MenuScreen onStartGame={navigateToGame} onConfigure={navigateToConfig} />
          {pendingResume !== null && (
            <ResumeGameDialog
              savedGame={pendingResume}
              onResume={handleResume}
              onDiscard={handleDiscard}
            />
          )}
        </>
      );

    case 'game':
      return (
        <GameScreen
          key={gameKey}
          ruleSet={screen.ruleSet}
          players={screen.players}
          flipped={screen.flipped}
          animationSpeedMultiplier={settings.animationSpeed}
          moveConfirmation={settings.moveConfirmation}
          pieceShadow={THEMES[settings.themeId]?.pieceShadow ?? false}
          initialGameState={resumedGameState ?? undefined}
          gameStartedAt={gameStartedAt}
          onNewGame={() => {
            setResumedGameState(null);
            navigateToGame(screen.players, screen.flipped);
          }}
          onMainMenu={() => {
            setResumedGameState(null);
            navigateToMenu();
          }}
        />
      );

    case 'config':
      return (
        <ConfigScreen settings={settings} onSettingsChange={setSettings} onBack={navigateToMenu} />
      );
  }
}
