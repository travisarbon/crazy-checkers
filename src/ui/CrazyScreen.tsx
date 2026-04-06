/**
 * Crazy mode sub-menu screen.
 * Displays board preview with glow, rules summary, event reference, and game setup.
 */

import { GameMode } from '../engine/types';
import type { PlayerSetup } from '../engine/types';
import type { TimeControlConfig } from '../engine/clock';
import ModeScreenShell from './ModeScreenShell';
import BoardPreviewLarge from './BoardPreviewLarge';
import ExpandableDetailPanel from './ExpandableDetailPanel';
import GameSetupSection from './GameSetupSection';
import EventReferencePanel from './EventReferencePanel';
import shellStyles from './ModeScreenShell.module.css';
import styles from './CrazyScreen.module.css';

interface CrazyScreenProps {
  onBack: () => void;
  onStartGame: (players: PlayerSetup, flipped: boolean, mode: GameMode, timeControl: TimeControlConfig | null) => void;
  defaultTimeControl: TimeControlConfig | null;
  savedGameExists: boolean;
  onResumeSavedGame?: () => void;
}

export default function CrazyScreen({
  onBack,
  onStartGame,
  defaultTimeControl,
  savedGameExists,
  onResumeSavedGame,
}: CrazyScreenProps) {
  return (
    <ModeScreenShell title="Crazy" onBack={onBack} testId="crazy-screen">
      {/* Hero row: board left, setup right on desktop */}
      <div className={shellStyles.heroRow}>
        <div className={shellStyles.heroBoard}>
          <div className={styles.boardSection}>
            <div className={styles.boardGlow}>
              <BoardPreviewLarge
                size={260}
                label="Crazy mode starting position with random events on multi-jumps"
              />
            </div>
            <p className={styles.boardCaption}>
              American Rules Checkers with random events on multi-jumps.
            </p>
          </div>
        </div>
        <div className={shellStyles.heroControls}>
          <GameSetupSection
            mode={GameMode.Crazy}
            defaultTimeControl={defaultTimeControl}
            onStartGame={onStartGame}
            savedGameExists={savedGameExists}
            onResumeSavedGame={onResumeSavedGame}
          />
        </div>
      </div>

      {/* How to Play */}
      <div className={styles.section}>
        <p className={styles.howToPlay}>
          Play standard checkers, but every time you complete a multi-jump (capturing two or
          more pieces in one turn), a random event is triggered from a pool of 40 possible events.
          Events can change the rules, move pieces, transform the board, or impose new conditions.
          Events stack &mdash; multiple events can be active simultaneously. Embrace the chaos!
        </p>
      </div>

      {/* Active Events Reminder */}
      <p className={styles.callout}>
        During gameplay, active events are always visible in the sidebar&rsquo;s Active Events
        Indicator. Events announce themselves with flavor text when triggered.
      </p>

      {/* Section 5: Event Reference */}
      <ExpandableDetailPanel
        title="Event Reference \u2014 All 40 Crazy Events"
        summary="Complete reference for every event: mechanics, durations, and interactions"
      >
        <EventReferencePanel />
      </ExpandableDetailPanel>
    </ModeScreenShell>
  );
}
