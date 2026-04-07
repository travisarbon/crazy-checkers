/**
 * Chaos mode sub-menu screen.
 * Similar to CrazyScreen but with intensified glow and Chaos-specific content.
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
import styles from './ChaosScreen.module.css';

interface ChaosScreenProps {
  onBack: () => void;
  onStartGame: (players: PlayerSetup, flipped: boolean, mode: GameMode, timeControl: TimeControlConfig | null) => void;
  defaultTimeControl: TimeControlConfig | null;
  savedGameExists: boolean;
  onResumeSavedGame?: () => void;
}

export default function ChaosScreen({
  onBack,
  onStartGame,
  defaultTimeControl,
  savedGameExists,
  onResumeSavedGame,
}: ChaosScreenProps) {
  return (
    <ModeScreenShell title="Chaos" onBack={onBack} testId="chaos-screen">
      {/* Hero row: board left, setup right on desktop */}
      <div className={shellStyles.heroRow}>
        <div className={shellStyles.heroBoard}>
          <div className={styles.boardSection}>
            <div className={styles.boardGlow} data-testid="chaos-glow">
              <BoardPreviewLarge
                size={260}
                label="Chaos mode starting position with Double Trouble on every capture"
              />
            </div>
            <p className={styles.boardCaption}>
              Double Trouble fires on every jump &mdash; the ultimate chaos experience.
            </p>
          </div>
        </div>
        <div className={shellStyles.heroControls}>
          <GameSetupSection
            mode={GameMode.Chaos}
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
          Double Trouble fires on every jump &mdash; not just multi-jumps. Every single capture
          triggers two simultaneous random events. Events stack rapidly, creating an overwhelming,
          celebratory experience. This is the victory lap.
        </p>
      </div>

      {/* Active Events Reminder */}
      <p className={styles.callout}>
        During gameplay, active events are always visible in the sidebar&rsquo;s Active Events
        Indicator. In Chaos mode, expect 4&ndash;6 active events at once &mdash; the sidebar
        will be busy!
      </p>

      {/* Section 5: Event Reference */}
      <ExpandableDetailPanel
        title="Event Reference — All 40 Crazy Events"
        summary="Complete reference for every event: mechanics, durations, and interactions"
      >
        <EventReferencePanel
          introContent={
            <div className={styles.chaosIntro}>
              <h3 className={styles.chaosIntroTitle}>How Chaos Differs from Crazy</h3>
              <p className={styles.chaosIntroText}>
                In Crazy mode, a random event triggers only when you complete a multi-jump (two or
                more captures in one turn). In Chaos mode, Double Trouble fires on every single
                capture &mdash; meaning two random events activate simultaneously every time any
                piece is captured. Events accumulate rapidly, often stacking 4&ndash;6 active events
                at once. This transforms the game into a celebration of controlled mayhem, reserved
                for players who have mastered every other game mode.
              </p>
            </div>
          }
        />
      </ExpandableDetailPanel>
    </ModeScreenShell>
  );
}
