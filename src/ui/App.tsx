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
import { GameMode } from '../engine/types';
import type { TimeControlConfig } from '../engine/clock';
import { loadSettings, saveSettings, loadSavedGame, clearSavedGame } from '../persistence/settings';
import type { SavedGame } from '../persistence/settings';
import { deserializeGameState } from '../persistence/serialization';
import { AudioManager } from '../audio/audioManager';
import { AudioManagerContext } from '../audio/useAudioManager';
import { DEFAULT_PACK } from '../audio/defaultPack';
import { SILENT_PACK } from '../audio/silentPack';
import { resolveMusicTrack } from '../audio/musicMapping';
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
      readonly mode: GameMode;
      readonly timeControl: TimeControlConfig | null;
      readonly remainingTimeWhiteMs?: number;
      readonly remainingTimeBlackMs?: number;
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

  // Initialize AudioManager once (stable singleton across renders)
  const [audioManager] = useState(() => {
    const pack = settings.audioPackId === 'silent' ? SILENT_PACK : DEFAULT_PACK;
    return new AudioManager(pack, {
      masterVolume: settings.masterVolume,
      sfxVolume: settings.sfxVolume,
      musicVolume: settings.musicVolume,
      muted: settings.muted,
    });
  });

  // Persist settings on every change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  // Sync settings -> AudioManager on every settings change
  useEffect(() => {
    audioManager.updateSettings({
      masterVolume: settings.masterVolume,
      sfxVolume: settings.sfxVolume,
      musicVolume: settings.musicVolume,
      muted: settings.muted,
    });
  }, [settings.masterVolume, settings.sfxVolume, settings.musicVolume, settings.muted, audioManager]);

  // Sync audio pack when audioPackId changes
  const prevPackIdRef = useRef(settings.audioPackId);
  useEffect(() => {
    if (settings.audioPackId !== prevPackIdRef.current) {
      prevPackIdRef.current = settings.audioPackId;
      const newPack = settings.audioPackId === 'silent' ? SILENT_PACK : DEFAULT_PACK;
      void audioManager.loadPack(newPack);
    }
  }, [settings.audioPackId, audioManager]);

  // Music routing: play the correct track for the current screen
  useEffect(() => {
    const gameMode = screen.kind === 'game' ? screen.mode : undefined;
    const track = resolveMusicTrack(screen.kind, gameMode);
    if (track) {
      audioManager.playMusic(track);
    }
  }, [screen, audioManager]);

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

  const navigateToGame = useCallback((players: PlayerSetup, flipped: boolean, mode: GameMode = GameMode.Classic, timeControl: TimeControlConfig | null = null) => {
    setScreen({
      kind: 'game',
      players,
      ruleSet: createAmericanRules(),
      flipped,
      mode,
      timeControl,
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
        mode: gameState.mode,
        timeControl: pendingResume.timeControl ?? null,
        remainingTimeWhiteMs: pendingResume.remainingTimeWhiteMs,
        remainingTimeBlackMs: pendingResume.remainingTimeBlackMs,
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
  let content: React.ReactNode;
  switch (screen.kind) {
    case 'menu':
      content = (
        <>
          <MenuScreen onStartGame={navigateToGame} onConfigure={navigateToConfig} defaultTimeControl={settings.timeControl} />
          {pendingResume !== null && (
            <ResumeGameDialog
              savedGame={pendingResume}
              onResume={handleResume}
              onDiscard={handleDiscard}
            />
          )}
        </>
      );
      break;

    case 'game':
      content = (
        <GameScreen
          key={gameKey}
          ruleSet={screen.ruleSet}
          players={screen.players}
          flipped={screen.flipped}
          mode={screen.mode}
          animationSpeedMultiplier={settings.animationSpeed}
          moveConfirmation={settings.moveConfirmation}
          pieceShadow={THEMES[settings.themeId]?.pieceShadow ?? false}
          initialGameState={resumedGameState ?? undefined}
          gameStartedAt={gameStartedAt}
          timeControl={screen.timeControl}
          initialRemainingWhiteMs={screen.remainingTimeWhiteMs}
          initialRemainingBlackMs={screen.remainingTimeBlackMs}
          onNewGame={() => {
            setResumedGameState(null);
            navigateToGame(screen.players, screen.flipped, screen.mode, screen.timeControl);
          }}
          onMainMenu={() => {
            setResumedGameState(null);
            navigateToMenu();
          }}
        />
      );
      break;

    case 'config':
      content = (
        <ConfigScreen settings={settings} onSettingsChange={setSettings} onBack={navigateToMenu} />
      );
      break;
  }

  return (
    <AudioManagerContext.Provider value={audioManager}>
      {content}
    </AudioManagerContext.Provider>
  );
}
