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
import { loadSettings, saveSettings, loadSavedGame, clearSavedGame, savedGameExistsForMode } from '../persistence/settings';
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
import ClassicScreen from './ClassicScreen';
import CrazyScreen from './CrazyScreen';
import ChaosScreen from './ChaosScreen';
import ChallengeScreen from './ChallengeScreen';
import ChallengeGameScreen from './ChallengeGameScreen';
import { PUZZLE_DATA } from '../data/puzzleData';
import ChoiceGalleryScreen from './ChoiceGalleryScreen';
import ChoiceDetailScreen from './ChoiceDetailScreen';
import { createNewChoiceGame } from '../engine/game';
import type { CrazyEvent } from '../engine/types';
import ClassifiedGalleryScreen from './ClassifiedGalleryScreen';
import ClassifiedDetailScreen from './ClassifiedDetailScreen';
import ClassifiedGameScreen from './ClassifiedGameScreen';
import type { ClassifiedGameId } from '../engine/classified/ClassifiedRuleSet';
import { loadClassifiedTier } from '../engine/classified/tierLoader';
import CogitateScreen, { type CogitateInitialView } from './CogitateScreen';
import CareerScreen from './CareerScreen';
import CodeScreen from './CodeScreen';
import { useUnlockState } from './hooks/useUnlockState';

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
      readonly permanentEvent?: CrazyEvent | null;
    }
  | { readonly kind: 'config' }
  | { readonly kind: 'classic' }
  | { readonly kind: 'crazy' }
  | { readonly kind: 'chaos' }
  | { readonly kind: 'challenge' }
  | { readonly kind: 'challenge-game'; readonly puzzleId: number; readonly retryCount?: number }
  | { readonly kind: 'choice' }
  | { readonly kind: 'choice-detail'; readonly eventId: string }
  | { readonly kind: 'classified' }
  | { readonly kind: 'classified-detail'; readonly gameId: number }
  | {
      readonly kind: 'classified-game';
      readonly gameId: ClassifiedGameId;
      readonly players: PlayerSetup;
      readonly flipped: boolean;
      readonly timeControl: TimeControlConfig | null;
    }
  | {
      readonly kind: 'cogitate';
      readonly initialView?: CogitateInitialView;
      readonly initialGameId?: string;
    }
  | { readonly kind: 'career' }
  | { readonly kind: 'code' };

type ScreenKind = Screen['kind'];

interface HistoryEntry {
  screenKind: ScreenKind;
  parentKind?: ScreenKind;
}

function buildScreenFromKind(kind: ScreenKind): Screen {
  switch (kind) {
    case 'menu': return { kind: 'menu' };
    case 'classic': return { kind: 'classic' };
    case 'crazy': return { kind: 'crazy' };
    case 'chaos': return { kind: 'chaos' };
    case 'challenge': return { kind: 'challenge' };
    case 'challenge-game': return { kind: 'challenge' };
    case 'choice': return { kind: 'choice' };
    case 'classified': return { kind: 'classified' };
    case 'classified-detail': return { kind: 'classified' };
    case 'classified-game': return { kind: 'classified' };
    case 'cogitate': return { kind: 'cogitate' };
    case 'career': return { kind: 'career' };
    case 'code': return { kind: 'code' };
    case 'config': return { kind: 'config' };
    default: return { kind: 'menu' };
  }
}

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

  // Progressive unlock system
  const {
    snapshot: unlockSnapshot,
    newlyUnlocked,
    markSeen,
    refreshUnlocks,
  } = useUnlockState();

  // Refresh unlock state and saved-game check when returning to menu
  useEffect(() => {
    if (screen.kind === 'menu') {
      refreshUnlocks();
      setPendingResume(loadSavedGame());
    }
  }, [screen.kind, refreshUnlocks]);

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
    // Extra Crazy = Choice mode with no permanent event; it gets its own track.
    const specialMode =
      screen.kind === 'game' && screen.mode === GameMode.Choice && !screen.permanentEvent
        ? 'extraCrazy'
        : undefined;
    const track = resolveMusicTrack(screen.kind, gameMode, specialMode);
    if (track) {
      audioManager.playMusic(track);
    }
  }, [screen, audioManager]);

  // Apply theme reactively when themeId changes
  useEffect(() => {
    const theme = THEMES[settings.themeId];
    if (theme) applyTheme(theme);
  }, [settings.themeId]);

  // Task 27.8: load the Tier 1 Classified registrations so their gallery
  // cards render the live Play affordance and their detail screens open the
  // MVP game-launch path. Tiers 2–7 follow the same pattern as they land.
  useEffect(() => {
    void loadClassifiedTier(1).catch((err: unknown) => {
      console.warn('[App] failed to load Classified Tier 1:', err);
    });
  }, []);

  // Browser back-button support — push a base entry on mount so there is
  // always a history entry to return to, then push on non-menu transitions.
  const hasInitializedHistory = useRef(false);

  useEffect(() => {
    if (!hasInitializedHistory.current) {
      hasInitializedHistory.current = true;
      window.history.replaceState({ screenKind: 'menu' } satisfies HistoryEntry, '');
    }
  }, []);

  // Track previous screen for determining parent in history entries
  const prevScreenRef = useRef<Screen>({ kind: 'menu' });

  useEffect(() => {
    const prev = prevScreenRef.current;
    prevScreenRef.current = screen;

    if (screen.kind === 'menu') {
      return;
    }

    // Determine parent based on navigation level
    let parentKind: ScreenKind | undefined;
    if (
      screen.kind === 'choice-detail' ||
      screen.kind === 'classified-detail' ||
      screen.kind === 'challenge-game' ||
      screen.kind === 'classified-game'
    ) {
      // Level 3: parent is the gallery/sub-menu
      parentKind =
        screen.kind === 'choice-detail'
          ? 'choice'
          : screen.kind === 'classified-detail' || screen.kind === 'classified-game'
            ? 'classified'
            : 'challenge';
    } else if (screen.kind === 'game') {
      // Game: parent is the mode that launched it
      parentKind = prev.kind !== 'menu' ? prev.kind : 'menu';
    } else {
      // Level 2: parent is menu
      parentKind = 'menu';
    }

    const entry: HistoryEntry = { screenKind: screen.kind, parentKind };
    window.history.pushState(entry, '');

    function handlePopState(event: PopStateEvent) {
      const state = event.state as HistoryEntry | null;
      if (state?.parentKind) {
        setScreen(buildScreenFromKind(state.parentKind));
      } else {
        setScreen({ kind: 'menu' });
      }
    }

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on screen.kind only; full screen object is captured via prevScreenRef
  }, [screen.kind]);

  // Navigation callbacks
  const navigateToScreen = useCallback((target: Screen) => {
    if (target.kind === 'game') {
      setGameKey((prev) => prev + 1);
      setGameStartedAt(Date.now());
      setResumedGameState(null);
    }
    setScreen(target);
  }, []);

  const navigateToMenu = useCallback(() => {
    navigateToScreen({ kind: 'menu' });
  }, [navigateToScreen]);

  const navigateToGame = useCallback((players: PlayerSetup, flipped: boolean, mode: GameMode = GameMode.Classic, timeControl: TimeControlConfig | null = null) => {
    navigateToScreen({
      kind: 'game',
      players,
      ruleSet: createAmericanRules(),
      flipped,
      mode,
      timeControl,
    });
  }, [navigateToScreen]);

  const navigateToConfig = useCallback(() => {
    navigateToScreen({ kind: 'config' });
  }, [navigateToScreen]);

  const navigateToClassifiedGame = useCallback(
    (
      gameId: ClassifiedGameId,
      players: PlayerSetup,
      flipped: boolean,
      timeControl: TimeControlConfig | null,
    ) => {
      navigateToScreen({
        kind: 'classified-game',
        gameId,
        players,
        flipped,
        timeControl,
      });
    },
    [navigateToScreen],
  );

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

  // Render
  let content: React.ReactNode;
  switch (screen.kind) {
    case 'menu':
      content = (
        <MenuScreen
          onConfigure={navigateToConfig}
          onNavigate={(kind) => { navigateToScreen(buildScreenFromKind(kind as ScreenKind)); }}
          unlockSnapshot={unlockSnapshot}
          newlyUnlocked={newlyUnlocked}
          onUnlockAnimationEnd={markSeen}
          chaosUnlocked={unlockSnapshot.chaosUnlocked}
        />
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
            if (screen.mode === GameMode.Choice && screen.permanentEvent !== undefined) {
              // Recreate the Choice game with the same permanent event
              const ruleSet = createAmericanRules();
              const initialState = createNewChoiceGame(ruleSet, screen.players, screen.permanentEvent ?? null);
              setResumedGameState(initialState);
              setGameKey((prev) => prev + 1);
              setGameStartedAt(Date.now());
              setScreen({
                kind: 'game',
                players: screen.players,
                ruleSet: initialState.ruleSet,
                flipped: screen.flipped,
                mode: GameMode.Choice,
                timeControl: screen.timeControl,
                permanentEvent: screen.permanentEvent,
              });
            } else {
              setResumedGameState(null);
              navigateToGame(screen.players, screen.flipped, screen.mode, screen.timeControl);
            }
          }}
          onMainMenu={() => {
            setResumedGameState(null);
            navigateToMenu();
          }}
          onReview={(gameId: string) => {
            setResumedGameState(null);
            navigateToScreen({
              kind: 'cogitate',
              initialView: 'cogitate-replay',
              initialGameId: gameId,
            });
          }}
        />
      );
      break;

    case 'config':
      content = (
        <ConfigScreen settings={settings} onSettingsChange={setSettings} onBack={navigateToMenu} />
      );
      break;

    case 'classic':
      content = (
        <ClassicScreen
          onBack={navigateToMenu}
          onStartGame={navigateToGame}
          defaultTimeControl={settings.timeControl}
          savedGameExists={savedGameExistsForMode(GameMode.Classic)}
          onResumeSavedGame={pendingResume?.mode === GameMode.Classic ? handleResume : undefined}
        />
      );
      break;

    case 'crazy':
      content = (
        <CrazyScreen
          onBack={navigateToMenu}
          onStartGame={navigateToGame}
          defaultTimeControl={settings.timeControl}
          savedGameExists={savedGameExistsForMode(GameMode.Crazy)}
          onResumeSavedGame={pendingResume?.mode === GameMode.Crazy ? handleResume : undefined}
        />
      );
      break;

    case 'chaos':
      content = (
        <ChaosScreen
          onBack={navigateToMenu}
          onStartGame={navigateToGame}
          defaultTimeControl={settings.timeControl}
          savedGameExists={savedGameExistsForMode(GameMode.Chaos)}
          onResumeSavedGame={pendingResume?.mode === GameMode.Chaos ? handleResume : undefined}
        />
      );
      break;

    case 'challenge':
      content = (
        <ChallengeScreen
          onBack={navigateToMenu}
          onStartPuzzle={(puzzleId: number) => { navigateToScreen({ kind: 'challenge-game', puzzleId }); }}
        />
      );
      break;

    case 'challenge-game': {
      const puzzle = PUZZLE_DATA.find((p) => p.id === screen.puzzleId);
      if (!puzzle) {
        navigateToScreen({ kind: 'challenge' });
        break;
      }
      content = (
        <ChallengeGameScreen
          key={'puzzle-' + String(screen.puzzleId) + '-' + String(screen.retryCount ?? 0)}
          puzzle={puzzle}
          onBack={() => { navigateToScreen({ kind: 'challenge' }); }}
          onNextPuzzle={(nextId) => { navigateToScreen({ kind: 'challenge-game', puzzleId: nextId }); }}
          onRetry={(id) => { navigateToScreen({ kind: 'challenge-game', puzzleId: id, retryCount: (screen.retryCount ?? 0) + 1 }); }}
          animationSpeedMultiplier={settings.animationSpeed}
          pieceShadow={THEMES[settings.themeId]?.pieceShadow ?? false}
          onPuzzleCompleted={refreshUnlocks}
        />
      );
      break;
    }

    case 'choice':
      content = (
        <ChoiceGalleryScreen
          onBack={navigateToMenu}
          onNavigateToDetail={(choiceNumber) => {
            navigateToScreen({ kind: 'choice-detail', eventId: String(choiceNumber) });
          }}
        />
      );
      break;

    case 'choice-detail': {
      const choiceNum = Number(screen.eventId);
      content = (
        <ChoiceDetailScreen
          choiceNumber={choiceNum}
          onBack={() => { navigateToScreen({ kind: 'choice' }); }}
          onStartGame={(players, flipped, _mode, timeControl, permanentEvent) => {
            const ruleSet = createAmericanRules();
            const initialState = createNewChoiceGame(ruleSet, players, permanentEvent ?? null);
            setResumedGameState(initialState);
            setGameKey((prev) => prev + 1);
            setGameStartedAt(Date.now());
            setScreen({
              kind: 'game',
              players,
              ruleSet: initialState.ruleSet,
              flipped,
              mode: GameMode.Choice,
              timeControl,
              permanentEvent,
            });
          }}
          defaultTimeControl={settings.timeControl}
          savedGameExists={savedGameExistsForMode(GameMode.Choice)}
          onResumeSavedGame={pendingResume?.mode === GameMode.Choice ? handleResume : undefined}
        />
      );
      break;
    }

    case 'classified':
      content = (
        <ClassifiedGalleryScreen
          onBack={navigateToMenu}
          onNavigateToDetail={(gameIndex) => {
            navigateToScreen({ kind: 'classified-detail', gameId: gameIndex });
          }}
        />
      );
      break;

    case 'classified-detail':
      content = (
        <ClassifiedDetailScreen
          gameIndex={screen.gameId}
          onBack={() => { navigateToScreen({ kind: 'classified' }); }}
          onStartGame={navigateToClassifiedGame}
        />
      );
      break;

    case 'classified-game':
      content = (
        <ClassifiedGameScreen
          key={gameKey}
          gameId={screen.gameId}
          players={screen.players}
          flipped={screen.flipped}
          themeId={settings.themeId}
          onNewGame={() => {
            navigateToClassifiedGame(
              screen.gameId,
              screen.players,
              screen.flipped,
              screen.timeControl,
            );
          }}
          onMainMenu={() => { navigateToScreen({ kind: 'classified' }); }}
        />
      );
      break;

    case 'cogitate':
      content = (
        <CogitateScreen
          onBack={navigateToMenu}
          initialView={screen.initialView}
          initialGameId={screen.initialGameId}
        />
      );
      break;

    case 'career':
      content = <CareerScreen onBack={navigateToMenu} />;
      break;

    case 'code':
      content = <CodeScreen onBack={navigateToMenu} onCodeRedeemed={refreshUnlocks} />;
      break;
  }

  return (
    <AudioManagerContext.Provider value={audioManager}>
      {content}
    </AudioManagerContext.Provider>
  );
}
