/**
 * Challenge mode gameplay screen for solving timed puzzles.
 *
 * Renders the puzzle board, validates moves against the solution path,
 * auto-plays scripted opponent responses, and shows a completion dialog
 * with star rating on success.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameState, Move, Square } from '../engine/types';
import { GameMode, GameStatus, PlayerType } from '../engine/types';
import { createAmericanRules } from '../engine/rules';
import { makeMove } from '../engine/game';
import { computeZobristHash } from '../engine/zobrist';
import { moveToString, stringToMove } from '../utils/notation';
import { deserializeBoardState } from '../persistence/serialization';
import { recordChallengeAttempt } from '../persistence/challengeRecords';
import type { PuzzleDefinition } from '../data/puzzleData';
import Board from './Board';
import { useAnimationQueue, buildAnimationSequence } from './useAnimationQueue';
import { usePuzzleInteraction } from './usePuzzleInteraction';
import { usePuzzleTimer } from './usePuzzleTimer';
import { calculatePuzzleRating, puzzleColorToPieceColor } from './challengeGameUtils';
import PuzzleCompletionDialog from './PuzzleCompletionDialog';
import styles from './ChallengeGameScreen.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPPONENT_RESPONSE_DELAY_MS = 400;
const INCORRECT_FEEDBACK_DURATION_MS = 300;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ChallengeGameScreenProps {
  readonly puzzle: PuzzleDefinition;
  readonly onBack: () => void;
  readonly onNextPuzzle: (nextPuzzleId: number) => void;
  readonly onRetry: (puzzleId: number) => void;
  readonly animationSpeedMultiplier?: number;
  readonly pieceShadow?: boolean;
  readonly isRetry?: boolean;
  readonly previousBestTimeMs?: number | null;
  /** Called after a successful puzzle solve is recorded to IndexedDB. */
  readonly onPuzzleCompleted?: () => void;
}

// ---------------------------------------------------------------------------
// Completion data
// ---------------------------------------------------------------------------

interface CompletionData {
  solveTimeMs: number;
  rating: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChallengeGameScreen({
  puzzle,
  onBack,
  onNextPuzzle,
  onRetry,
  animationSpeedMultiplier = 1,
  pieceShadow = false,
  isRetry = false,
  previousBestTimeMs = null,
  onPuzzleCompleted,
}: ChallengeGameScreenProps) {
  // ── Initialize game state from puzzle ──────────────────────
  const [gameState, setGameState] = useState<GameState>(() => {
    const board = deserializeBoardState(puzzle.boardState);
    const activeColor = puzzleColorToPieceColor(puzzle.activeColor);
    const ruleSet = createAmericanRules();
    return {
      board,
      activeColor,
      status: GameStatus.InProgress,
      result: null,
      ruleSet,
      players: { white: PlayerType.Human, black: PlayerType.Human },
      moveHistory: [],
      positionHashes: [computeZobristHash(board, activeColor)],
      halfMoveClock: 0,
      plyCount: 0,
      mode: GameMode.Classic,
      activeEvents: [],
    };
  });

  const [solutionStepIndex, setSolutionStepIndex] = useState(0);
  const [isSolved, setIsSolved] = useState(false);
  const [movesPlayed, setMovesPlayed] = useState<string[]>([]);
  const [incorrectMoveSquare, setIncorrectMoveSquare] = useState<Square | null>(null);
  const [statusMessage, setStatusMessage] = useState('Your turn');
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionData, setCompletionData] = useState<CompletionData | null>(null);

  const isMountedRef = useRef(true);
  const pendingOpponentMoveRef = useRef(false);
  const pendingStateRef = useRef<GameState | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Timer ──────────────────────────────────────────────────
  const timer = usePuzzleTimer();

  // Start timer on mount
  useEffect(() => {
    timer.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Animation queue ────────────────────────────────────────
  const animationQueue = useAnimationQueue({
    speedMultiplier: animationSpeedMultiplier,
    flipped: puzzle.activeColor === 'black',
    onComplete: () => {
      if (pendingStateRef.current) {
        setGameState(pendingStateRef.current);
        pendingStateRef.current = null;
      }
    },
  });

  // ── Board orientation ──────────────────────────────────────
  const flipped = puzzle.activeColor === 'black';

  // ── Solution validation ────────────────────────────────────
  const expectedNotation = puzzle.solutionPath[solutionStepIndex];
  const playerMoveCount = Math.ceil(puzzle.solutionPath.length / 2);
  const playerMovesCompleted = Math.ceil(solutionStepIndex / 2);

  // ── Schedule opponent move ─────────────────────────────────
  const scheduleOpponentMove = useCallback((currentState: GameState, nextStepIndex: number) => {
    if (nextStepIndex >= puzzle.solutionPath.length) return;

    pendingOpponentMoveRef.current = true;
    setTimeout(() => {
      if (!isMountedRef.current) return;

      const opponentNotation = puzzle.solutionPath[nextStepIndex];
      if (!opponentNotation) {
        pendingOpponentMoveRef.current = false;
        return;
      }

      try {
        const opponentMove = stringToMove(opponentNotation, currentState.board);
        const boardBefore = currentState.board;
        const newState = makeMove(currentState, opponentMove);
        const steps = buildAnimationSequence(opponentMove, boardBefore, newState.board);

        animationQueue.enqueue(steps, boardBefore, currentState.activeColor);
        pendingStateRef.current = newState;

        const afterStepIndex = nextStepIndex + 1;
        setSolutionStepIndex(afterStepIndex);

        if (afterStepIndex >= puzzle.solutionPath.length) {
          // Puzzle solved on opponent's final move (rare)
          handlePuzzleSolved();
        }
      } catch (err) {
        console.error('Opponent move error:', err);
        setStatusMessage('Puzzle error');
      }

      pendingOpponentMoveRef.current = false;
    }, OPPONENT_RESPONSE_DELAY_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puzzle.solutionPath, animationQueue]);

  // ── Puzzle completion ──────────────────────────────────────
  const handlePuzzleSolved = useCallback(() => {
    setIsSolved(true);
    const finalElapsedMs = timer.stop();
    const rating = calculatePuzzleRating(
      finalElapsedMs,
      puzzle.thresholdFastMs,
      puzzle.thresholdSlowMs,
    );

    setCompletionData({ solveTimeMs: finalElapsedMs, rating });

    // Record the attempt asynchronously, then notify unlock system
    void recordChallengeAttempt(
      puzzle.id,
      true,
      finalElapsedMs,
      rating,
      movesPlayed,
    ).then(() => {
      onPuzzleCompleted?.();
    });

    // Brief delay before showing dialog (let final animation play)
    setTimeout(() => {
      if (isMountedRef.current) {
        setShowCompletion(true);
      }
    }, 500);
  }, [puzzle, timer, movesPlayed, onPuzzleCompleted]);

  // ── Move callbacks ─────────────────────────────────────────
  const handleCorrectMove = useCallback((move: Move, newState: GameState) => {
    // Record the move
    setMovesPlayed((prev) => [...prev, moveToString(move)]);
    setStatusMessage('Correct!');

    // Animate the move
    const boardBefore = gameState.board;
    const steps = buildAnimationSequence(move, boardBefore, newState.board);
    animationQueue.enqueue(steps, boardBefore, gameState.activeColor);
    pendingStateRef.current = newState;

    const nextStepIndex = solutionStepIndex + 1;
    setSolutionStepIndex(nextStepIndex);

    if (nextStepIndex >= puzzle.solutionPath.length) {
      // Puzzle solved
      handlePuzzleSolved();
    } else {
      // Schedule opponent's response
      setStatusMessage('Opponent moving...');
      scheduleOpponentMove(newState, nextStepIndex);
    }
  }, [gameState, solutionStepIndex, puzzle.solutionPath.length, animationQueue, handlePuzzleSolved, scheduleOpponentMove]);

  const handleIncorrectMove = useCallback((move: Move) => {
    setMovesPlayed((prev) => [...prev, moveToString(move)]);

    // Find the from square for the shake animation
    setIncorrectMoveSquare(move.from);
    setStatusMessage('Try again');

    setTimeout(() => {
      if (isMountedRef.current) {
        setIncorrectMoveSquare(null);
        setStatusMessage('Your turn');
      }
    }, INCORRECT_FEEDBACK_DURATION_MS);
  }, []);

  // ── Interaction hook ───────────────────────────────────────
  const interaction = usePuzzleInteraction({
    gameState,
    isBlocked: animationQueue.isAnimating || pendingOpponentMoveRef.current,
    isSolved,
    onCorrectMove: handleCorrectMove,
    onIncorrectMove: handleIncorrectMove,
    expectedNotation,
  });

  // ── Keyboard handler ───────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (showCompletion) return;
        interaction.handleEscape();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.removeEventListener('keydown', handleKeyDown); };
  }, [interaction, showCompletion]);

  // ── Display board ──────────────────────────────────────────
  const displayBoard = animationQueue.animationBoard ?? interaction.displayBoard;

  // ── Back handler ───────────────────────────────────────────
  const handleBack = useCallback(() => {
    timer.pause();
    onBack();
  }, [timer, onBack]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={styles.challengeGameScreen}>
      {/* Header */}
      <header className={styles.header}>
        <button
          className={styles.backButton}
          onClick={handleBack}
          data-testid="challenge-back"
        >
          &larr; Back
        </button>
        <span className={styles.puzzleId}>
          Puzzle {String(puzzle.id)} / 100
        </span>
        <span
          className={styles.difficultyBadge}
          data-tier={puzzle.difficultyTier}
          aria-label={'Difficulty: ' + puzzle.difficultyTier}
        >
          {puzzle.difficultyTier}
        </span>
        <span className={styles.timerDisplay} aria-live="polite">
          {timer.displayTime}
        </span>
      </header>

      {/* Goal Banner */}
      <div className={styles.goalBanner} role="status" aria-live="polite">
        {puzzle.goal}
      </div>

      {/* Board */}
      <div className={styles.boardArea}>
        <Board
          board={displayBoard}
          flipped={flipped}
          selectedSquare={animationQueue.isAnimating ? null : interaction.selectedSquare}
          legalMoveSquares={animationQueue.isAnimating ? undefined : interaction.legalDestinations}
          selectablePieces={animationQueue.isAnimating ? undefined : interaction.selectablePieces}
          onSquareClick={interaction.handleSquareClick}
          animatingPieces={animationQueue.animatingPieces}
          fadingSquares={animationQueue.fadingSquares}
          isAnimating={animationQueue.isAnimating}
          animSpeedMultiplier={animationSpeedMultiplier}
          pieceShadow={pieceShadow}
        />
        {/* Incorrect move error overlay */}
        {incorrectMoveSquare !== null && (
          <div className={styles.errorOverlay} aria-hidden="true" />
        )}
      </div>

      {/* Status Area */}
      <div className={styles.statusArea}>
        <p
          className={styles.moveProgress}
          aria-live="polite"
        >
          Move {String(Math.min(playerMovesCompleted + 1, playerMoveCount))} of {String(playerMoveCount)}
        </p>
        <p
          className={[styles.statusMessage, incorrectMoveSquare !== null ? styles.statusError : ''].join(' ')}
          aria-live="assertive"
        >
          {statusMessage}
        </p>
      </div>

      {/* Completion Dialog */}
      {showCompletion && completionData && (
        <PuzzleCompletionDialog
          puzzle={puzzle}
          solveTimeMs={completionData.solveTimeMs}
          rating={completionData.rating}
          previousBestTimeMs={previousBestTimeMs}
          isRetry={isRetry}
          onNextPuzzle={() => { onNextPuzzle(puzzle.id + 1); }}
          onRetry={() => { onRetry(puzzle.id); }}
          onBack={onBack}
        />
      )}
    </div>
  );
}
