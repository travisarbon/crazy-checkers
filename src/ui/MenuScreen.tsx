/**
 * Title screen and mode selection.
 *
 * Displays the game title and a grid of mode buttons. In Phase 1,
 * only Classic and Configure are functional; other modes show
 * "Coming Soon". Clicking Classic opens the GameSetupDialog.
 */

import { useState } from 'react';
import type { PlayerSetup } from '../engine/types';
import { GameMode } from '../engine/types';
import type { TimeControlConfig } from '../engine/clock';
import { useAudioManager } from '../audio/useAudioManager';
import { SoundEvent } from '../audio/types';
import GameSetupDialog from './dialogs/GameSetupDialog';
import styles from './MenuScreen.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MenuScreenProps {
  onStartGame: (players: PlayerSetup, flipped: boolean, mode: GameMode, timeControl: TimeControlConfig | null) => void;
  onConfigure: () => void;
  defaultTimeControl: TimeControlConfig | null;
}

// ---------------------------------------------------------------------------
// Mode data
// ---------------------------------------------------------------------------

interface ModeEntry {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly hidden: boolean;
  readonly description: string;
}

const MODES: readonly ModeEntry[] = [
  {
    id: 'crazy',
    label: 'Crazy',
    enabled: true,
    hidden: false,
    description: 'Checkers with chaotic events',
  },
  {
    id: 'classic',
    label: 'Classic',
    enabled: true,
    hidden: false,
    description: 'Standard American Rules Checkers',
  },
  {
    id: 'challenge',
    label: 'Challenge',
    enabled: false,
    hidden: false,
    description: 'Timed checkers puzzles',
  },
  { id: 'code', label: 'Code', enabled: false, hidden: false, description: 'Enter unlock codes' },
  {
    id: 'cogitate',
    label: 'Cogitate',
    enabled: false,
    hidden: false,
    description: 'Game review and analysis',
  },
  {
    id: 'career',
    label: 'Career',
    enabled: false,
    hidden: false,
    description: 'Statistics and progression',
  },
  {
    id: 'configure',
    label: 'Configure',
    enabled: true,
    hidden: false,
    description: 'Settings and themes',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MenuScreen({ onStartGame, onConfigure, defaultTimeControl }: MenuScreenProps) {
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [selectedMode, setSelectedMode] = useState<GameMode>(GameMode.Classic);
  const audioManager = useAudioManager();

  function handleModeClick(modeId: string): void {
    audioManager?.play(SoundEvent.MenuClick);
    if (modeId === 'classic' || modeId === 'crazy') {
      setSelectedMode(modeId === 'crazy' ? GameMode.Crazy : GameMode.Classic);
      setShowSetupDialog(true);
    } else if (modeId === 'configure') {
      onConfigure();
    }
  }

  function handleSetupConfirm(players: PlayerSetup, flipped: boolean, mode: GameMode, timeControl: TimeControlConfig | null): void {
    setShowSetupDialog(false);
    onStartGame(players, flipped, mode, timeControl);
  }

  function handleSetupCancel(): void {
    setShowSetupDialog(false);
  }

  return (
    <div className={styles.menuScreen} data-testid="menu-screen" role="main">
      <header>
        <h1 className={styles.gameTitle}>Crazy Checkers</h1>
        <p className={styles.gameSubtitle}>A chaotic twist on a timeless classic</p>
      </header>

      <nav className={styles.modeGrid} aria-label="Game modes">
        {MODES.filter((m) => !m.hidden).map((mode) => (
          <button
            key={mode.id}
            className={`${styles.modeButton ?? ''} ${!mode.enabled ? (styles.disabled ?? '') : ''}`}
            disabled={!mode.enabled}
            aria-label={mode.enabled ? mode.label : `${mode.label} — Coming Soon`}
            title={mode.description}
            onClick={() => {
              handleModeClick(mode.id);
            }}
          >
            <span>{mode.label}</span>
            {!mode.enabled && <span className={styles.badge}>Coming Soon</span>}
          </button>
        ))}
      </nav>

      {showSetupDialog && (
        <GameSetupDialog mode={selectedMode} defaultTimeControl={defaultTimeControl} onConfirm={handleSetupConfirm} onCancel={handleSetupCancel} />
      )}
    </div>
  );
}
