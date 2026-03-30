/**
 * Root application component.
 *
 * Temporary game harness for Task 2.2: wires up game state and interaction
 * hook so two humans can play pass-and-play checkers in the browser.
 * Task 2.4 replaces this with the full GameScreen layout.
 */

import { useState, useEffect } from 'react';
import { applyTheme, THEMES, DEFAULT_THEME_ID } from '../themes/theme';
import { createNewGame } from '../engine/game';
import { createAmericanRules } from '../engine/rules';
import { PieceColor, PlayerType, GameStatus } from '../engine/types';
import Board from './Board';
import { useGameInteraction } from './useGameInteraction';

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

  const interaction = useGameInteraction({
    gameState,
    onMove: setGameState,
  });

  // Escape key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        interaction.handleEscape();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [interaction]);

  const turnLabel = gameState.activeColor === PieceColor.White ? 'White' : 'Black';

  return (
    <div style={{ padding: '1rem', textAlign: 'center' }}>
      <h1>Crazy Checkers</h1>
      <p>
        {gameState.status === GameStatus.GameOver
          ? `Game Over — ${gameState.result?.type ?? ''}`
          : `${turnLabel}'s turn`}
      </p>
      {interaction.isMidMultiJump && (
        <p style={{ color: 'var(--ui-accent)' }}>
          Multi-jump in progress — click the next destination or press Escape to
          cancel
        </p>
      )}
      <Board
        board={interaction.displayBoard}
        selectedSquare={interaction.selectedSquare}
        legalMoveSquares={interaction.legalDestinations}
        selectablePieces={interaction.selectablePieces}
        onSquareClick={interaction.handleSquareClick}
      />
    </div>
  );
}
