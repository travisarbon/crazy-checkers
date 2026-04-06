/**
 * Inline game setup form extracted from GameSetupDialog.
 * Replaces the modal dialog flow with an inline section
 * suitable for embedding within mode sub-menu screens.
 */

import { useState } from 'react';
import { PlayerType, GameMode } from '../engine/types';
import type { PlayerSetup } from '../engine/types';
import type { TimeControlConfig } from '../engine/clock';
import TimeControlOverride from './dialogs/TimeControlOverride';
import styles from './GameSetupSection.module.css';

export interface GameSetupSectionProps {
  mode: GameMode;
  defaultTimeControl: TimeControlConfig | null;
  onStartGame: (players: PlayerSetup, flipped: boolean, mode: GameMode, timeControl: TimeControlConfig | null) => void;
  savedGameExists?: boolean;
  onResumeSavedGame?: () => void;
}

type GameType = 'pass-around' | 'vs-cpu';
type ColorChoice = 'white' | 'black';
type DifficultyChoice = 'easy' | 'hard';

export default function GameSetupSection({
  mode,
  defaultTimeControl,
  onStartGame,
  savedGameExists = false,
  onResumeSavedGame,
}: GameSetupSectionProps) {
  const [gameType, setGameType] = useState<GameType>('pass-around');
  const [colorChoice, setColorChoice] = useState<ColorChoice>('white');
  const [difficultyChoice, setDifficultyChoice] = useState<DifficultyChoice>('easy');
  const [timeControl, setTimeControl] = useState(defaultTimeControl);

  function handleStartGame() {
    let players: PlayerSetup;
    let flipped: boolean;

    if (gameType === 'pass-around') {
      players = { white: PlayerType.Human, black: PlayerType.Human };
      flipped = colorChoice === 'black';
    } else {
      const cpuType = difficultyChoice === 'easy' ? PlayerType.CpuEasy : PlayerType.CpuHard;
      if (colorChoice === 'white') {
        players = { white: PlayerType.Human, black: cpuType };
        flipped = false;
      } else {
        players = { white: cpuType, black: PlayerType.Human };
        flipped = true;
      }
    }

    onStartGame(players, flipped, mode, timeControl);
  }

  return (
    <div className={styles.setupSection} data-testid="game-setup-section">
      {/* Game Type */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Game Type</legend>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="gameType"
            value="pass-around"
            checked={gameType === 'pass-around'}
            onChange={() => { setGameType('pass-around'); }}
          />
          Pass Around (two players)
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="gameType"
            value="vs-cpu"
            checked={gameType === 'vs-cpu'}
            onChange={() => { setGameType('vs-cpu'); }}
          />
          vs. CPU
        </label>
      </fieldset>

      {/* Color Selection */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>
          {gameType === 'pass-around' ? 'Player 1 Color' : 'Your Color'}
        </legend>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="color"
            value="white"
            checked={colorChoice === 'white'}
            onChange={() => { setColorChoice('white'); }}
          />
          White (moves first)
        </label>
        <label className={styles.radioLabel}>
          <input
            type="radio"
            name="color"
            value="black"
            checked={colorChoice === 'black'}
            onChange={() => { setColorChoice('black'); }}
          />
          Black
        </label>
      </fieldset>

      {/* Difficulty (vs. CPU only) */}
      {gameType === 'vs-cpu' && (
        <fieldset className={styles.fieldset} data-testid="difficulty-fieldset">
          <legend className={styles.legend}>Difficulty</legend>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="difficulty"
              value="easy"
              checked={difficultyChoice === 'easy'}
              onChange={() => { setDifficultyChoice('easy'); }}
            />
            Easy
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="difficulty"
              value="hard"
              checked={difficultyChoice === 'hard'}
              onChange={() => { setDifficultyChoice('hard'); }}
            />
            Hard
          </label>
        </fieldset>
      )}

      {/* Time Control */}
      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>Time Control</legend>
        <TimeControlOverride
          defaultConfig={defaultTimeControl}
          onChange={setTimeControl}
          isVsCpu={gameType === 'vs-cpu'}
        />
      </fieldset>

      {/* Action Buttons */}
      <div className={styles.actionButtons}>
        {savedGameExists && onResumeSavedGame && (
          <button
            className={styles.secondaryButton}
            onClick={onResumeSavedGame}
            data-testid="resume-game-button"
          >
            Resume Saved Game
          </button>
        )}
        <button
          className={styles.primaryButton}
          onClick={handleStartGame}
          data-testid="start-game-button"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
