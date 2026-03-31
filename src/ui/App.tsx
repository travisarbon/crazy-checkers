/**
 * Root application component.
 *
 * Temporary game harness: wires up game state, interaction hook, and animation
 * queue so two humans can play pass-and-play checkers in the browser with
 * smooth move animations. Task 2.4 replaces this with the full GameScreen layout.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { applyTheme, THEMES, DEFAULT_THEME_ID } from '../themes/theme';
import { createNewGame } from '../engine/game';
import { createAmericanRules } from '../engine/rules';
import type { GameState } from '../engine/types';
import { PieceColor, PlayerType, GameStatus } from '../engine/types';
import Board from './Board';
import { useGameInteraction } from './useGameInteraction';
import {
  useAnimationQueue,
  buildAnimationSequence,
} from './useAnimationQueue';

export default function App() {
  useEffect(() => {
    const theme = THEMES[DEFAULT_THEME_ID];
    if (theme) {
      applyTheme(theme);
    }
  }, []);

  const [gameState, setGameState] = useState(() =>
    createNewGame(createAmericanRules(), {
      white: PlayerType.Human,
      black: PlayerType.Human,
    }),
  );

  // Pending state: the state after the move, held until animation completes
  const pendingStateRef = useRef<GameState | null>(null);

  const animationQueue = useAnimationQueue({
    speedMultiplier: 1.0,
    onComplete: () => {
      if (pendingStateRef.current) {
        setGameState(pendingStateRef.current);
        pendingStateRef.current = null;
      }
    },
  });

  // Handle a complete move: build animation sequence, enqueue, defer state update
  const handleMove = useCallback(
    (newState: GameState) => {
      const move = newState.moveHistory[newState.moveHistory.length - 1];
      if (!move) {
        setGameState(newState);
        return;
      }

      const steps = buildAnimationSequence(move, gameState.board, newState.board);
      pendingStateRef.current = newState;
      animationQueue.enqueue(steps, gameState.board);
    },
    [gameState.board, animationQueue],
  );

  const interaction = useGameInteraction({
    gameState,
    onMove: handleMove,
    isAnimating: animationQueue.isAnimating,
  });

  // Escape key listener
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
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [interaction, animationQueue]);

  const turnLabel = gameState.activeColor === PieceColor.White ? 'White' : 'Black';

  // The board displays:
  // - During animation: animationQueue.animationBoard (pre-move snapshot with CSS transitions)
  // - Otherwise: interaction.displayBoard (normal game state or intermediate multi-jump board)
  const displayBoard = animationQueue.animationBoard ?? interaction.displayBoard;

  return (
    <div style={{ padding: '1rem', textAlign: 'center' }}>
      <h1>Crazy Checkers</h1>
      <p>
        {gameState.status === GameStatus.GameOver
          ? `Game Over — ${gameState.result?.type ?? ''}`
          : `${turnLabel}'s turn`}
      </p>
      {interaction.isMidMultiJump && !animationQueue.isAnimating && (
        <p style={{ color: 'var(--ui-accent)' }}>
          Multi-jump in progress — click the next destination or press Escape to
          cancel
        </p>
      )}
      <Board
        board={displayBoard}
        selectedSquare={animationQueue.isAnimating ? null : interaction.selectedSquare}
        legalMoveSquares={animationQueue.isAnimating ? undefined : interaction.legalDestinations}
        selectablePieces={animationQueue.isAnimating ? undefined : interaction.selectablePieces}
        onSquareClick={interaction.handleSquareClick}
        animatingPieces={animationQueue.animatingPieces}
        fadingSquares={animationQueue.fadingSquares}
        isAnimating={animationQueue.isAnimating}
      />
    </div>
  );
}
