/**
 * Game screen layout: board + sidebar with turn indicator, captured pieces,
 * move history, and game controls. Responsive: sidebar on desktop, bottom
 * panel on mobile.
 *
 * Owns the GameState, undo stack, animation queue, and interaction hook
 * for the duration of a game session.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { BREAKPOINT } from './breakpoints';
import type { ActiveEvent, GameState, PlayerSetup, RuleSet } from '../engine/types';
import { GameMode, GameStatus, PieceColor, PlayerType } from '../engine/types';
import { createNewGame, makeMove, canUndo as engineCanUndo, resign, getEffectiveBoard } from '../engine/game';
import { requestAIMove } from '../ai/workerClient';
import type { Difficulty } from '../ai/difficulty';
import { saveGame, clearSavedGame } from '../persistence/settings';
import { recordGame } from '../persistence/gameHistory';
import Board from './Board';
import TurnIndicator from './TurnIndicator';
import CapturedPieces from './CapturedPieces';
import MoveHistory from './MoveHistory';
import GameControls from './GameControls';
import GameAnnouncer from './GameAnnouncer';
import GameOverDialog from './dialogs/GameOverDialog';
import EventAnnouncement from './EventAnnouncement';
import ActiveEventsIndicator from './ActiveEventsIndicator';
import { useGameInteraction } from './useGameInteraction';
import type { AnimationStep } from './useAnimationQueue';
import { useAnimationQueue, buildAnimationSequence } from './useAnimationQueue';
import { useEventAnimations } from './useEventAnimations';
import { useEventOverlays } from './useEventOverlays';
import styles from './GameScreen.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface GameScreenProps {
  ruleSet: RuleSet;
  players: PlayerSetup;
  flipped?: boolean;
  mode?: GameMode;
  animationSpeedMultiplier?: number;
  moveConfirmation?: boolean;
  pieceShadow?: boolean;
  initialGameState?: GameState;
  gameStartedAt?: number;
  onNewGame: () => void;
  onMainMenu?: () => void;
}

// ---------------------------------------------------------------------------
// Undo policy helpers
// ---------------------------------------------------------------------------

function computeInitialTakebacks(players: PlayerSetup): number {
  if (players.white === PlayerType.Human && players.black === PlayerType.Human) {
    return -1; // unlimited
  }
  if (players.white === PlayerType.CpuEasy || players.black === PlayerType.CpuEasy) {
    return 1;
  }
  return 0; // CPU Hard
}

function computeUndoState(
  gameState: GameState,
  takebacksRemaining: number,
): { canUndo: boolean; tooltip: string; countLabel?: string } {
  if (!engineCanUndo(gameState)) {
    return { canUndo: false, tooltip: 'No moves to undo' };
  }
  if (takebacksRemaining === -1) {
    return { canUndo: true, tooltip: 'Undo last move' };
  }
  if (takebacksRemaining > 0) {
    return {
      canUndo: true,
      tooltip: `Undo (${String(takebacksRemaining)} remaining)`,
      countLabel: `(${String(takebacksRemaining)})`,
    };
  }
  return { canUndo: false, tooltip: 'Undo not available in this mode' };
}

// ---------------------------------------------------------------------------
// useIsMobile hook
// ---------------------------------------------------------------------------

function getPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = useState(getPrefersReducedMotion);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => {
      setPrefers(e.matches);
    };
    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
    };
  }, []);

  return prefers;
}

function getIsMobile(breakpoint: number): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(`(max-width: ${String(breakpoint - 1)}px)`).matches;
}

function useIsMobile(breakpoint = BREAKPOINT.PHABLET_MAX + 1): boolean {
  const [isMobile, setIsMobile] = useState(() => getIsMobile(breakpoint));

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${String(breakpoint - 1)}px)`);
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    mql.addEventListener('change', handler);
    return () => {
      mql.removeEventListener('change', handler);
    };
  }, [breakpoint]);

  return isMobile;
}

// ---------------------------------------------------------------------------
// Event detection helper
// ---------------------------------------------------------------------------

function getNewlyTriggeredEvents(
  prevEvents: readonly ActiveEvent[],
  nextEvents: readonly ActiveEvent[],
): readonly ActiveEvent[] {
  const prevKeys = new Set(prevEvents.map((e) => `${e.type}:${String(e.triggeredAtPly)}`));
  return nextEvents.filter((e) => !prevKeys.has(`${e.type}:${String(e.triggeredAtPly)}`));
}

function getNewlyExpiredEvents(
  prevEvents: readonly ActiveEvent[],
  nextEvents: readonly ActiveEvent[],
): readonly ActiveEvent[] {
  const nextKeys = new Set(nextEvents.map((e) => `${e.type}:${String(e.triggeredAtPly)}`));
  return prevEvents.filter((e) => !nextKeys.has(`${e.type}:${String(e.triggeredAtPly)}`));
}

// ---------------------------------------------------------------------------
// GameScreen component
// ---------------------------------------------------------------------------

export default function GameScreen({
  ruleSet,
  players,
  flipped = false,
  mode = GameMode.Classic,
  animationSpeedMultiplier = 1.0,
  moveConfirmation = false,
  pieceShadow = false,
  initialGameState,
  gameStartedAt: gameStartedAtProp,
  onNewGame,
  onMainMenu,
}: GameScreenProps) {
  // --- State ---
  const [gameState, setGameState] = useState<GameState>(
    () => initialGameState ?? createNewGame(ruleSet, players, mode),
  );
  const [announcementEvents, setAnnouncementEvents] = useState<readonly ActiveEvent[]>([]);
  const [gameStartedAt] = useState(() => gameStartedAtProp ?? Date.now());
  const pendingStateRef = useRef<GameState | null>(null);
  const [undoStack, setUndoStack] = useState<GameState[]>([]);
  const [takebacksRemaining, setTakebacksRemaining] = useState(computeInitialTakebacks(players));
  const [isAIThinking, setIsAIThinking] = useState(false);
  const aiThinkingRef = useRef(false);
  const gameStateRef = useRef(gameState);
  const [pendingCaptures, setPendingCaptures] = useState({ white: 0, black: 0 });
  const prefersReducedMotion = usePrefersReducedMotion();

  // --- Animation queue ---
  const effectiveAnimSpeed = prefersReducedMotion ? 0.01 : animationSpeedMultiplier;
  const animationQueue = useAnimationQueue({
    speedMultiplier: effectiveAnimSpeed,
    flipped,
    onComplete: () => {
      if (pendingStateRef.current) {
        setGameState(pendingStateRef.current);
        pendingStateRef.current = null;
      }
      setPendingCaptures({ white: 0, black: 0 });
    },
    onCaptureAnimated: (capturedByColor) => {
      setPendingCaptures((prev) => ({
        white: capturedByColor === PieceColor.White ? prev.white + 1 : prev.white,
        black: capturedByColor === PieceColor.Black ? prev.black + 1 : prev.black,
      }));
    },
  });

  // --- Event animation hook ---
  const eventAnimations = useEventAnimations({ flipped });

  // --- Auto-save on every state change ---
  useEffect(() => {
    saveGame(gameState, gameState.mode, flipped);
  }, [gameState, flipped]);

  // --- Clear auto-save and record game on completion ---
  useEffect(() => {
    if (gameState.status === GameStatus.GameOver) {
      clearSavedGame();
      recordGame(gameState, gameState.mode, gameStartedAt).catch((err: unknown) => {
        console.warn('Failed to record game history:', err);
      });
    }
  }, [gameState.status, gameState, gameStartedAt]);

  // --- Move handler ---
  const handleMove = useCallback(
    (newState: GameState) => {
      setUndoStack((prev) => [...prev, gameState]);

      // Detect newly triggered and expired events
      const triggered = getNewlyTriggeredEvents(gameState.activeEvents, newState.activeEvents);
      const expired = getNewlyExpiredEvents(gameState.activeEvents, newState.activeEvents);

      if (triggered.length > 0) {
        setAnnouncementEvents(triggered);
      }

      const move = newState.moveHistory[newState.moveHistory.length - 1];
      if (!move) {
        setGameState(newState);
        return;
      }

      // Use the effective board (after onTurnStart, e.g. Checks Mix shuffle)
      // so the animation starts from the board the player actually sees.
      const boardBefore = getEffectiveBoard(gameState);
      let allSteps: AnimationStep[] = [];

      // 1. Event activation animations (play first)
      if (triggered.length > 0) {
        allSteps = allSteps.concat(
          eventAnimations.buildActivationSequence(triggered, boardBefore, newState.board),
        );
      }

      // 2. Move animations
      allSteps = allSteps.concat(buildAnimationSequence(move, boardBefore, newState.board));

      // 3. Mid-move effects (detonations, color swaps from expired events)
      if (expired.length > 0) {
        allSteps = allSteps.concat(
          eventAnimations.buildMidMoveEffects(move, expired, boardBefore, newState.board),
        );
      }

      // 4. Event expiration animations
      if (expired.length > 0) {
        allSteps = allSteps.concat(
          eventAnimations.buildExpirationSequence(expired, newState.board),
        );
      }

      // 5. Enqueue and set pending state
      pendingStateRef.current = newState;
      animationQueue.enqueue(allSteps, boardBefore, gameState.activeColor);
    },
    [gameState, animationQueue, eventAnimations],
  );

  // --- Keep gameStateRef in sync (ref must not be written during render) ---
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Ref for handleMove so the AI effect doesn't depend on it directly,
  // which would cause re-runs whenever gameState changes (since handleMove
  // closes over gameState).
  const handleMoveRef = useRef(handleMove);
  useEffect(() => {
    handleMoveRef.current = handleMove;
  }, [handleMove]);

  // --- AI turn effect ---
  // Dependencies are intentionally limited to avoid circular re-triggers.
  // The effect only fires when animation stops or gameState changes identity.
  // It reads the latest gameState and handleMove from refs to avoid stale
  // closures while keeping the dependency array stable.
  useEffect(() => {
    if (animationQueue.isAnimating) return;
    if (aiThinkingRef.current) return;
    if (announcementEvents.length > 0) return; // Wait for announcement to dismiss

    const state = gameStateRef.current;
    if (state.status !== GameStatus.InProgress) return;

    const activePlayer =
      state.activeColor === PieceColor.White ? state.players.white : state.players.black;

    if (activePlayer === PlayerType.Human) return;

    const difficulty: Difficulty = activePlayer === PlayerType.CpuEasy ? 'easy' : 'hard';

    aiThinkingRef.current = true;
    let cancelled = false;

    requestAIMove(state, difficulty)
      .then((move) => {
        if (cancelled) return;
        const newState = makeMove(state, move);
        handleMoveRef.current(newState);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('AI move computation failed:', error);
      })
      .finally(() => {
        if (!cancelled) {
          aiThinkingRef.current = false;
          setIsAIThinking(false);
        }
      });

    // Use a microtask to set the thinking UI state, avoiding a synchronous
    // setState call in the effect body (react-hooks/set-state-in-effect).
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setIsAIThinking(true);
      }
    });

    return () => {
      cancelled = true;
      aiThinkingRef.current = false;
    };
  }, [gameState, animationQueue.isAnimating, announcementEvents]);

  // --- Interaction hook ---
  const interaction = useGameInteraction({
    gameState,
    onMove: handleMove,
    isAnimating: animationQueue.isAnimating,
    isDisabled: isAIThinking,
    moveConfirmation,
  });

  // --- Escape key ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (animationQueue.isAnimating) {
          animationQueue.skipAnimation();
        } else {
          interaction.handleEscape();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [interaction, animationQueue]);

  // --- Undo handler ---
  const handleUndo = useCallback(() => {
    if (animationQueue.isAnimating) return;

    // Clear any visible event announcement on undo
    setAnnouncementEvents([]);

    const isCpuGame = players.white !== PlayerType.Human || players.black !== PlayerType.Human;

    if (isCpuGame && undoStack.length >= 2) {
      const twoMovesBack = undoStack[undoStack.length - 2];
      if (twoMovesBack) {
        setGameState(twoMovesBack);
        setUndoStack((prev) => prev.slice(0, -2));
      }
    } else if (undoStack.length >= 1) {
      const previousState = undoStack[undoStack.length - 1];
      if (previousState) {
        setGameState(previousState);
        setUndoStack((prev) => prev.slice(0, -1));
      }
    }

    if (takebacksRemaining > 0) {
      setTakebacksRemaining((prev) => prev - 1);
    }
  }, [undoStack, takebacksRemaining, players, animationQueue.isAnimating]);

  // --- Resign handler ---
  const handleResign = useCallback(() => {
    if (gameState.status !== GameStatus.InProgress) return;
    const newState = resign(gameState, gameState.activeColor);
    setGameState(newState);
  }, [gameState]);

  // --- Persistent event overlay state (Task 11.3) ---
  const eventOverlayState = useEventOverlays(
    gameState.activeEvents,
    animationQueue.animationBoard ?? interaction.displayBoard,
    animationQueue.isAnimating ? null : interaction.selectedSquare,
  );

  // --- Derived state ---
  const displayBoard = animationQueue.animationBoard ?? interaction.displayBoard;
  const isGameOver = gameState.status === GameStatus.GameOver;
  const {
    canUndo: undoAvailable,
    tooltip: undoTooltip,
    countLabel: undoCountLabel,
  } = computeUndoState(gameState, takebacksRemaining);
  const currentMoveIndex = gameState.moveHistory.length - 1;
  const lastMoveSquares = useMemo(() => {
    const history = gameState.moveHistory;
    if (history.length === 0) return null;
    const lastMove = history[history.length - 1];
    if (!lastMove) return null;
    const finalDestination = lastMove.path[lastMove.path.length - 1];
    if (finalDestination === undefined) return null;
    return { from: lastMove.from, to: finalDestination };
  }, [gameState.moveHistory]);
  const isMobile = useIsMobile();

  // --- Render ---
  return (
    <div className={styles.gameScreen} data-testid="game-screen" role="main">
      <GameAnnouncer gameState={gameState} isAnimating={animationQueue.isAnimating} />
      <div className={styles.boardArea}>
        {interaction.isMidMultiJump && !animationQueue.isAnimating && (
          <div className={styles.multiJumpBanner} role="status" aria-live="polite">
            Multi-jump in progress — click next destination
          </div>
        )}
        <Board
          board={displayBoard}
          flipped={flipped}
          selectedSquare={animationQueue.isAnimating ? null : interaction.selectedSquare}
          pendingConfirmSquare={
            animationQueue.isAnimating ? null : interaction.pendingConfirmSquare
          }
          legalMoveSquares={animationQueue.isAnimating ? undefined : interaction.legalDestinations}
          selectablePieces={animationQueue.isAnimating ? undefined : interaction.selectablePieces}
          lastMoveSquares={lastMoveSquares}
          onSquareClick={interaction.handleSquareClick}
          animatingPieces={animationQueue.animatingPieces}
          fadingSquares={animationQueue.fadingSquares}
          isAnimating={animationQueue.isAnimating}
          animSpeedMultiplier={effectiveAnimSpeed}
          pieceShadow={pieceShadow}
          flashingSquares={animationQueue.flashingSquares}
          explosionState={animationQueue.explosionState}
          overlayState={animationQueue.overlayState}
          eventOverlayState={eventOverlayState}
        />
      </div>

      <aside className={styles.sidebar} aria-label="Game information">
        <TurnIndicator
          activeColor={gameState.activeColor}
          isGameOver={isGameOver}
          result={gameState.result}
          isThinking={isAIThinking}
        />
        <CapturedPieces moveHistory={gameState.moveHistory} pendingCaptures={pendingCaptures} />
        {(gameState.mode === GameMode.Crazy || gameState.mode === GameMode.Chaos) && (
          <ActiveEventsIndicator
            activeEvents={gameState.activeEvents}
            activeColor={gameState.activeColor}
          />
        )}
        <MoveHistory
          moveHistory={gameState.moveHistory}
          currentMoveIndex={currentMoveIndex}
          collapsible={isMobile}
        />
        <GameControls
          canUndo={undoAvailable && !animationQueue.isAnimating && !isAIThinking}
          undoTooltip={undoTooltip}
          undoCountLabel={undoCountLabel}
          isGameInProgress={!isGameOver}
          onNewGame={onNewGame}
          onUndo={handleUndo}
          onResign={handleResign}
          onMainMenu={onMainMenu}
        />
      </aside>

      {announcementEvents.length > 0 && (
        <EventAnnouncement
          events={announcementEvents}
          onDismiss={() => {
            setAnnouncementEvents([]);
          }}
        />
      )}

      {isGameOver && gameState.result && (
        <GameOverDialog
          result={gameState.result}
          lastActiveColor={gameState.activeColor}
          mode={gameState.mode}
          activeEvents={gameState.activeEvents}
          onNewGame={onNewGame}
          onMainMenu={onMainMenu}
        />
      )}
    </div>
  );
}
