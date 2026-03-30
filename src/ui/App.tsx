/**
 * Root application component. Handles routing between modes.
 * Task 4.1 implements the full title screen and navigation.
 */

import { useEffect } from 'react';
import { applyTheme, THEMES, DEFAULT_THEME_ID } from '../themes/theme';
import { createInitialBoard } from '../engine/board';
import Board from './Board';

export default function App() {
  useEffect(() => {
    applyTheme(THEMES[DEFAULT_THEME_ID]!);
  }, []);

  return (
    <div>
      <h1>Crazy Checkers</h1>
      <Board board={createInitialBoard()} />
    </div>
  );
}
