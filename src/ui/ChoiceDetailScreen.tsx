/**
 * Choice Detail Screen — per-mode sub-menu for Choice mode games.
 *
 * Follows the Classic screen pattern: board preview, rules summary,
 * game setup, and expandable detail. Adds Choice-specific sections
 * for event relationship and strategy guidance.
 */

import { GameMode } from '../engine/types';
import type { CrazyEvent, PlayerSetup } from '../engine/types';
import type { TimeControlConfig } from '../engine/clock';
import ModeScreenShell from './ModeScreenShell';
import BoardPreviewLarge from './BoardPreviewLarge';
import ExpandableDetailPanel from './ExpandableDetailPanel';
import GameSetupSection from './GameSetupSection';
import { CHOICE_MODE_DATA } from '../persistence/choiceModeData';
import { EVENT_DATA_MAP } from '../data/eventData';
import { EVENT_DISPLAY_NAMES, EVENT_DURATIONS } from '../engine/events';
import shellStyles from './ModeScreenShell.module.css';
import styles from './ChoiceDetailScreen.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Optional highlight squares for specific Choice modes.
 * Most modes use the standard starting position with no highlights.
 */
const CHOICE_HIGHLIGHT_SQUARES: ReadonlyMap<number, readonly number[]> = new Map([
  // Sanctuary (#12): near-corner safe haven squares
  [12, [1, 4, 29, 32]],
  // Tar Pit (#14): edge squares (simplified representation)
  [14, [1, 2, 3, 4, 5, 12, 13, 20, 21, 28, 29, 30, 31, 32]],
  // Minefield (#26): center squares
  [26, [14, 15, 18, 19]],
  // Portal (#37): example wormhole-linked squares
  [37, [10, 23, 7, 26]],
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(plies: number): string {
  if (plies === 0) return 'is applied instantly';
  if (plies === -1) return 'lasts until a condition is met';
  if (plies === 2) return 'lasts 1 round';
  if (plies === 4) return 'lasts 2 rounds';
  if (plies === 16) return 'lasts 8 rounds';
  return `lasts ${String(plies)} plies`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChoiceDetailScreenProps {
  readonly choiceNumber: number;
  readonly onBack: () => void;
  readonly onStartGame: (
    players: PlayerSetup,
    flipped: boolean,
    mode: GameMode,
    timeControl: TimeControlConfig | null,
    permanentEvent: CrazyEvent | null,
  ) => void;
  readonly defaultTimeControl: TimeControlConfig | null;
  readonly savedGameExists: boolean;
  readonly onResumeSavedGame?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChoiceDetailScreen({
  choiceNumber,
  onBack,
  onStartGame,
  defaultTimeControl,
  savedGameExists,
  onResumeSavedGame,
}: ChoiceDetailScreenProps) {
  // Resolve mode data from the static CHOICE_MODE_DATA array
  const modeData = CHOICE_MODE_DATA.find((m) => m.choiceNumber === choiceNumber);

  // Resolve event detail data from EVENT_DATA_MAP
  const eventData = modeData?.event != null
    ? EVENT_DATA_MAP.get(modeData.event) ?? null
    : null;

  // Fallback for invalid choiceNumber
  if (!modeData) {
    return (
      <ModeScreenShell title="Choice" onBack={onBack} testId="choice-detail-screen">
        <p className={styles.errorState}>
          Mode not found. Please return to the gallery and select a valid mode.
        </p>
      </ModeScreenShell>
    );
  }

  // Capture the permanent event for the game start handler
  const permanentEvent = modeData.event;

  // Wrap the GameSetupSection onStartGame to inject the permanentEvent
  function handleStartGame(
    players: PlayerSetup,
    flipped: boolean,
    mode: GameMode,
    timeControl: TimeControlConfig | null,
  ) {
    onStartGame(players, flipped, mode, timeControl, permanentEvent);
  }

  // Mode-specific data
  const displayName = modeData.displayName;
  const highlights = CHOICE_HIGHLIGHT_SQUARES.get(choiceNumber) ?? [];
  const eventName = modeData.event != null
    ? EVENT_DISPLAY_NAMES[modeData.event]
    : null;
  const eventDurationPlies = modeData.event != null
    ? EVENT_DURATIONS[modeData.event]
    : null;

  return (
    <ModeScreenShell title={displayName} onBack={onBack} testId="choice-detail-screen">
      {/* Hero row: board left, setup right on desktop */}
      <div className={shellStyles.heroRow}>
        <div className={shellStyles.heroBoard}>
          <div className={styles.boardSection}>
            <BoardPreviewLarge
              size={260}
              highlightSquares={highlights as number[]}
              label={`${displayName} board preview showing the starting position`}
            />
            <p className={styles.boardCaption}>{modeData.description}</p>
          </div>
        </div>
        <div className={shellStyles.heroControls}>
          <GameSetupSection
            mode={GameMode.Choice}
            defaultTimeControl={defaultTimeControl}
            onStartGame={handleStartGame}
            savedGameExists={savedGameExists}
            onResumeSavedGame={onResumeSavedGame}
          />
        </div>
      </div>

      {/* How to Play */}
      <div className={styles.section}>
        <p className={styles.howToPlay}>
          {modeData.event != null && eventData
            ? eventData.choiceModeDescription
            : 'A random event triggers on every single jump — not just multi-jumps like standard Crazy mode. Any of the 40 events can fire, including Double Trouble. Embrace absolute chaos!'
          }
        </p>
      </div>

      {/* Crazy Event Relationship */}
      <div className={styles.section}>
        {modeData.event != null && eventName != null && eventDurationPlies != null ? (
          <div className={styles.eventCallout}>
            <span className={styles.eventCalloutLabel}>
              Related Crazy Event
            </span>
            This Choice mode is based on{' '}
            <strong>{eventName}</strong>. In Crazy mode, {eventName}{' '}
            {formatDuration(eventDurationPlies)} and is triggered randomly on
            multi-jumps. In <strong>{displayName}</strong>, the effect is
            permanent and always active.
          </div>
        ) : (
          <div className={styles.eventCallout}>
            <span className={styles.eventCalloutLabel}>
              Related Mechanic
            </span>
            Extra Crazy triggers a random event on every jump, not just
            multi-jumps like in standard Crazy mode. Any of the 40 events can
            fire, including Double Trouble. This is the most chaotic Choice
            mode.
          </div>
        )}
      </div>

      {/* Expanded Detail Panel */}
      <ExpandableDetailPanel
        title="Strategy & Rules Detail"
        summary={eventData
          ? 'Detailed mechanics, strategy tips, and event interactions'
          : 'Strategy tips for Extra Crazy mode'
        }
      >
        {eventData ? (
          <>
            <h3 className={styles.subsectionTitle}>Detailed Mechanics</h3>
            <p className={styles.contentParagraph}>
              {eventData.mechanicalEffect}
            </p>
            <p className={styles.contentParagraph}>
              In <strong>{displayName}</strong> (Choice mode), this effect is
              permanent from the start of the game rather than being triggered
              randomly. {eventData.choiceModeDescription}
            </p>

            {eventData.stackingNotes.length > 0 && (
              <>
                <h3 className={styles.subsectionTitle}>
                  Event Interaction Notes
                </h3>
                <p className={styles.contentParagraph}>
                  When playing Crazy mode, the {eventName} event can stack
                  with other randomly triggered events. Key interactions:
                </p>
                <ul className={styles.stackingList}>
                  {eventData.stackingNotes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        ) : (
          <>
            <h3 className={styles.subsectionTitle}>How Extra Crazy Works</h3>
            <p className={styles.contentParagraph}>
              Every single capture — not just multi-jumps — triggers a
              random event from the full pool of 40 events. Events stack
              rapidly, creating an overwhelming, unpredictable experience.
            </p>
            <p className={styles.contentParagraph}>
              Strategy in Extra Crazy is fundamentally different from other
              Choice modes. Positional play matters less because the board
              state changes constantly. Focus on maintaining piece count
              advantage and adapting to whatever events arise.
            </p>
          </>
        )}
      </ExpandableDetailPanel>
    </ModeScreenShell>
  );
}
