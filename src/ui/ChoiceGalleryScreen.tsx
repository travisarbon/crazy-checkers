/**
 * Choice Gallery Screen — browsable visual catalog of all 40 Choice modes.
 *
 * Renders a CSS Grid of interactive cards showing locked/unlocked states,
 * track badges, and integrates GalleryDialogBox for detailed mode inspection
 * and navigation to the Choice detail screen.
 */

import { useState, useEffect, useCallback } from 'react';
import ModeScreenShell from './ModeScreenShell';
import BoardPreviewLarge from './BoardPreviewLarge';
import GalleryDialogBox from './GalleryDialogBox';
import { CHOICE_MODE_DATA } from '../persistence/choiceModeData';
import type { ChoiceModeDefinition } from '../persistence/choiceModeData';
import type {
  UnlockEvaluation,
  ChoiceModeUnlockStatus,
} from '../persistence/unlockEvaluator';
import { evaluateFullUnlocks } from '../persistence/unlockEvaluator';
import { CrazyEvent } from '../engine/types';
import styles from './ChoiceGalleryScreen.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_DISPLAY_NAMES: ReadonlyMap<string, string> = new Map([
  [CrazyEvent.KingForADay, 'King for a Day'],
  [CrazyEvent.LiveGrenade, 'Live Grenade'],
  [CrazyEvent.HotPotato, 'Hot Potato'],
  [CrazyEvent.ChecksMix, 'Checks Mix'],
  [CrazyEvent.OppositeDay, 'Opposite Day'],
  [CrazyEvent.UpInTheAir, 'Up in the Air'],
  [CrazyEvent.NoTouching, 'No Touching!'],
  [CrazyEvent.StepBack, 'Step-Back'],
  [CrazyEvent.FlippedScript, 'Flipped Script'],
  [CrazyEvent.MarchingOrders, 'Marching Orders'],
  [CrazyEvent.DealersChoice, "Dealer's Choice"],
  [CrazyEvent.Bodyguard, 'Bodyguard'],
  [CrazyEvent.Quicksand, 'Quicksand'],
  [CrazyEvent.Conscription, 'Conscription'],
  [CrazyEvent.GhostWalk, 'Ghost Walk'],
  [CrazyEvent.Landmine, 'Landmine'],
  [CrazyEvent.Leapfrog, 'Leapfrog'],
  [CrazyEvent.FrozenAssets, 'Frozen Assets'],
  [CrazyEvent.DoubleTime, 'Double Time'],
  [CrazyEvent.SafeHaven, 'Safe Haven'],
  [CrazyEvent.ChainReaction, 'Chain Reaction'],
  [CrazyEvent.PromotionParty, 'Promotion Party'],
  [CrazyEvent.Reinforcements, 'Reinforcements'],
  [CrazyEvent.Wormhole, 'Wormhole'],
  [CrazyEvent.Demotion, 'Demotion'],
  [CrazyEvent.TimeBomb, 'Time Bomb'],
  [CrazyEvent.ForcedMarch, 'Forced March'],
  [CrazyEvent.Ricochet, 'Ricochet'],
  [CrazyEvent.CrownThief, 'Crown Thief'],
  [CrazyEvent.Stampede, 'Stampede'],
  [CrazyEvent.TollRoad, 'Toll Road'],
  [CrazyEvent.SwapMeet, 'Swap Meet'],
  [CrazyEvent.RoyalDecree, 'Royal Decree'],
  [CrazyEvent.Backfire, 'Backfire'],
  [CrazyEvent.Sentry, 'Sentry'],
  [CrazyEvent.RushHour, 'Rush Hour'],
  [CrazyEvent.Haunted, 'Haunted'],
  [CrazyEvent.Sacrifice, 'Sacrifice'],
  [CrazyEvent.ShrinkingBoard, 'Shrinking Board'],
]);

const TRACK_BADGE_CLASSES = new Map<string, string>([
  ['puzzle-mastery', styles.trackPM ?? ''],
  ['chaos-veteran', styles.trackCV ?? ''],
  ['rule-bender', styles.trackRB ?? ''],
  ['lifer', styles.trackL ?? ''],
  ['world-player', styles.trackWP ?? ''],
]);

const TRACK_SHORT_NAMES: ReadonlyMap<string, string> = new Map([
  ['puzzle-mastery', 'PM'],
  ['chaos-veteran', 'CV'],
  ['rule-bender', 'RB'],
  ['lifer', 'L'],
  ['world-player', 'WP'],
]);

// ---------------------------------------------------------------------------
// Cycling helpers
// ---------------------------------------------------------------------------

/**
 * Find the next unlocked choice number after the given one.
 * Returns undefined if no next unlocked mode exists.
 */
function findNextUnlocked(
  currentChoiceNumber: number,
  choiceModes: ReadonlyMap<number, ChoiceModeUnlockStatus>,
): number | undefined {
  for (let i = currentChoiceNumber + 1; i <= 40; i++) {
    if (choiceModes.get(i)?.unlocked) return i;
  }
  return undefined;
}

/**
 * Find the previous unlocked choice number before the given one.
 * Returns undefined if no previous unlocked mode exists.
 */
function findPreviousUnlocked(
  currentChoiceNumber: number,
  choiceModes: ReadonlyMap<number, ChoiceModeUnlockStatus>,
): number | undefined {
  for (let i = currentChoiceNumber - 1; i >= 1; i--) {
    if (choiceModes.get(i)?.unlocked) return i;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function GalleryCard({
  mode,
  unlockStatus,
  onClick,
}: {
  readonly mode: ChoiceModeDefinition;
  readonly unlockStatus: ChoiceModeUnlockStatus | undefined;
  readonly onClick: () => void;
}) {
  const isLocked = !(unlockStatus?.unlocked ?? false);
  const trackBadgeClass = TRACK_BADGE_CLASSES.get(mode.track) ?? '';
  const trackShort = TRACK_SHORT_NAMES.get(mode.track) ?? '';

  const cardClasses = [styles.card];
  if (isLocked) cardClasses.push(styles.cardLocked);

  return (
    <button
      className={cardClasses.join(' ')}
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      aria-label={
        isLocked
          ? `${mode.displayName} \u2014 locked. ${mode.unlockThreshold}`
          : `${mode.displayName} \u2014 ${mode.description}`
      }
      data-testid={`choice-card-${String(mode.choiceNumber)}`}
    >
      <span className={styles.modeNumber}>#{String(mode.choiceNumber)}</span>
      <div className={styles.cardPreview}>
        <BoardPreviewLarge size={80} label={`${mode.displayName} board preview`} />
      </div>
      <span className={styles.modeName}>{mode.displayName}</span>
      <span className={[styles.trackBadge, trackBadgeClass].join(' ')}>{trackShort}</span>
      {isLocked ? (
        <>
          <span className={styles.lockOverlay} aria-hidden="true">{'\uD83D\uDD12'}</span>
          <span className={styles.modeHint}>{mode.unlockThreshold}</span>
        </>
      ) : (
        <span className={styles.modeDescription}>{mode.description}</span>
      )}
    </button>
  );
}

function EventCallout({ mode }: { readonly mode: ChoiceModeDefinition }) {
  if (mode.event === null) {
    // Extra Crazy (choice #8) -- special case
    return (
      <div className={styles.eventCallout}>
        <span className={styles.eventCalloutLabel}>Related Mechanic</span>
        Extra Crazy triggers a random event on every jump, not just multi-jumps
        like in standard Crazy mode. Any of the 40 events can fire, including
        Double Trouble.
      </div>
    );
  }

  const eventName = EVENT_DISPLAY_NAMES.get(mode.event) ?? mode.event;

  return (
    <div className={styles.eventCallout}>
      <span className={styles.eventCalloutLabel}>Related Crazy Event</span>
      Based on <strong>{eventName}</strong>. In Crazy mode, this event is
      triggered randomly and lasts for a limited duration. In{' '}
      <strong>{mode.displayName}</strong>, the effect is permanent and always
      active.
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ChoiceGalleryScreenProps {
  readonly onBack: () => void;
  readonly onNavigateToDetail: (choiceNumber: number) => void;
}

export default function ChoiceGalleryScreen({
  onBack,
  onNavigateToDetail,
}: ChoiceGalleryScreenProps) {
  const [unlockEvaluation, setUnlockEvaluation] = useState<UnlockEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<number | null>(null);

  // Load unlock evaluation on mount
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const evaluation = await evaluateFullUnlocks();
        if (!cancelled) {
          setUnlockEvaluation(evaluation);
          setIsLoading(false);
        }
      } catch {
        // Graceful degradation: render with all modes locked
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Total unlocked count for the summary text
  const totalUnlocked = unlockEvaluation?.totalChoiceModesUnlocked ?? 0;

  // Dialog handlers
  const handleCardClick = useCallback((choiceNumber: number) => {
    setSelectedMode(choiceNumber);
  }, []);

  const handleDialogClose = useCallback(() => {
    setSelectedMode(null);
  }, []);

  const handleDialogPlay = useCallback(() => {
    if (selectedMode !== null) {
      onNavigateToDetail(selectedMode);
    }
  }, [selectedMode, onNavigateToDetail]);

  const handleDialogNext = useCallback(() => {
    if (selectedMode !== null && unlockEvaluation) {
      const next = findNextUnlocked(selectedMode, unlockEvaluation.choiceModes);
      if (next !== undefined) setSelectedMode(next);
    }
  }, [selectedMode, unlockEvaluation]);

  const handleDialogPrevious = useCallback(() => {
    if (selectedMode !== null && unlockEvaluation) {
      const prev = findPreviousUnlocked(selectedMode, unlockEvaluation.choiceModes);
      if (prev !== undefined) setSelectedMode(prev);
    }
  }, [selectedMode, unlockEvaluation]);

  // Loading state
  if (isLoading) {
    return (
      <ModeScreenShell title="Choice" onBack={onBack} testId="choice-screen">
        <p className={styles.loading} data-testid="choice-loading">
          Loading...
        </p>
      </ModeScreenShell>
    );
  }

  // Find selected mode data for dialog
  const selectedModeData = selectedMode !== null
    ? CHOICE_MODE_DATA.find((m) => m.choiceNumber === selectedMode) ?? null
    : null;

  const hasNext = selectedMode !== null && unlockEvaluation
    ? findNextUnlocked(selectedMode, unlockEvaluation.choiceModes) !== undefined
    : false;

  const hasPrevious = selectedMode !== null && unlockEvaluation
    ? findPreviousUnlocked(selectedMode, unlockEvaluation.choiceModes) !== undefined
    : false;

  return (
    <ModeScreenShell title="Choice" onBack={onBack} testId="choice-screen">
      {/* Intro text */}
      <p className={styles.introText}>
        Each Choice mode plays a full game of checkers with a specific event
        imposed as a permanent rule. Unlock new modes by progressing through
        five tracks.
      </p>
      <p className={styles.unlockSummary} data-testid="unlock-summary">
        {String(totalUnlocked)} / 40 modes unlocked
      </p>

      {/* Gallery grid */}
      <div className={styles.gallery} role="grid" aria-label="Choice mode gallery">
        {CHOICE_MODE_DATA.map((mode) => (
          <GalleryCard
            key={mode.choiceNumber}
            mode={mode}
            unlockStatus={unlockEvaluation?.choiceModes.get(mode.choiceNumber)}
            onClick={() => { handleCardClick(mode.choiceNumber); }}
          />
        ))}
      </div>

      {/* GalleryDialogBox for selected mode */}
      {selectedMode !== null && selectedModeData !== null && (
        <GalleryDialogBox
          title={selectedModeData.displayName}
          visualization={
            <BoardPreviewLarge
              size={180}
              label={`${selectedModeData.displayName} board preview`}
            />
          }
          description={
            <>
              <p>{selectedModeData.description}</p>
              <EventCallout mode={selectedModeData} />
            </>
          }
          onPlay={handleDialogPlay}
          onClose={handleDialogClose}
          onNext={hasNext ? handleDialogNext : undefined}
          onPrevious={hasPrevious ? handleDialogPrevious : undefined}
          ariaLabel={`Choice mode: ${selectedModeData.displayName}`}
        />
      )}
    </ModeScreenShell>
  );
}
