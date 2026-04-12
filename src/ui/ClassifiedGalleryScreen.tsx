/**
 * Classified Gallery Screen — browsable visual catalog of all 64 Classified games.
 *
 * Renders wave-grouped sections (8 waves) with CSS Grid card grids per wave,
 * three-state cards (locked/coming-soon/playable), GalleryDialogBox integration
 * with within-wave cycling, and unlock summary.
 *
 * Phase 3 placeholder: all 64 games are unimplemented. The gallery structure
 * is fully extensible for Phase 4 when games set `implemented: true`.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import ModeScreenShell from './ModeScreenShell';
import BoardPreviewLarge from './BoardPreviewLarge';
import GalleryDialogBox from './GalleryDialogBox';
import type { ModeRegistryEntry } from '../persistence/gameModeRegistry';
import { getClassifiedByWave } from '../persistence/gameModeRegistry';
import type { UnlockEvaluation } from '../persistence/unlockEvaluator';
import { evaluateFullUnlocks } from '../persistence/unlockEvaluator';
import styles from './ClassifiedGalleryScreen.module.css';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

interface WaveMeta {
  readonly wave: number;
  readonly title: string;
  readonly subtitle: string;
}

const WAVE_META: readonly WaveMeta[] = [
  {
    wave: 1,
    title: 'The Draughts Family',
    subtitle:
      'Variants of the game you already know, ordered by increasing divergence from American Rules.',
  },
  {
    wave: 2,
    title: 'Hunt & Capture',
    subtitle:
      'Capture is still the primary action, but the mechanics are radically different.',
  },
  {
    wave: 3,
    title: 'Race & Connection',
    subtitle:
      'The shift from removing enemy pieces to reaching a destination or forming a pattern.',
  },
  {
    wave: 4,
    title: 'Territory & Enclosure',
    subtitle: 'Think about what you own rather than where you are going.',
  },
  {
    wave: 5,
    title: 'Deep Strategy & Unique Systems',
    subtitle: 'Mechanically self-contained systems with serious strategic depth.',
  },
  {
    wave: 6,
    title: 'The Chess Family',
    subtitle:
      'Nine games ordered by increasing proximity to modern Western chess.',
  },
  {
    wave: 7,
    title: 'The Shogi Family',
    subtitle:
      'The drop mechanic \u2014 playing captured pieces back onto the board as your own.',
  },
  {
    wave: 8,
    title: 'The Final Unlocks',
    subtitle:
      'Chess 960 strips away opening theory; standard Chess closes the library.',
  },
];

const WAVE_COLOR_CLASSES: ReadonlyMap<number, string> = new Map([
  [1, styles.waveColor1 ?? ''],
  [2, styles.waveColor2 ?? ''],
  [3, styles.waveColor3 ?? ''],
  [4, styles.waveColor4 ?? ''],
  [5, styles.waveColor5 ?? ''],
  [6, styles.waveColor6 ?? ''],
  [7, styles.waveColor7 ?? ''],
  [8, styles.waveColor8 ?? ''],
]);

// ---------------------------------------------------------------------------
// Card state helpers
// ---------------------------------------------------------------------------

type CardState = 'locked' | 'coming-soon' | 'playable';

/**
 * Determine the display state of a Classified game card.
 *
 * @param entry — The registry entry for the game.
 * @param classifiedUnlocked — Whether Classified mode is unlocked (100 challenges).
 * @param gamesUnlockedCount — Number of Classified games unlocked (Hard CPU wins).
 * @returns The visual state to render.
 */
function getCardState(
  entry: ModeRegistryEntry,
  classifiedUnlocked: boolean,
  gamesUnlockedCount: number,
): CardState {
  // Classified mode not unlocked: everything is locked
  if (!classifiedUnlocked) return 'locked';

  // Game not yet unlocked (sequential unlock based on Hard CPU wins)
  const gameIndex = entry.classifiedIndex ?? 0;
  if (gameIndex > gamesUnlockedCount) return 'locked';

  // Game unlocked but not implemented: Coming Soon
  if (!entry.implemented) return 'coming-soon';

  // Game unlocked and implemented: Playable
  return 'playable';
}

// ---------------------------------------------------------------------------
// Cycling helpers (within-wave only)
// ---------------------------------------------------------------------------

/**
 * Find the next playable game index within the same wave.
 * Returns undefined if no next game exists.
 */
function findNextInWave(
  currentIndex: number,
  waveGames: readonly ModeRegistryEntry[],
  classifiedUnlocked: boolean,
  gamesUnlockedCount: number,
): number | undefined {
  const currentPos = waveGames.findIndex(
    (g) => g.classifiedIndex === currentIndex,
  );
  if (currentPos === -1) return undefined;

  for (let i = currentPos + 1; i < waveGames.length; i++) {
    const entry = waveGames[i];
    if (entry && getCardState(entry, classifiedUnlocked, gamesUnlockedCount) === 'playable') {
      return entry.classifiedIndex ?? undefined;
    }
  }
  return undefined;
}

/**
 * Find the previous playable game index within the same wave.
 * Returns undefined if no previous game exists.
 */
function findPreviousInWave(
  currentIndex: number,
  waveGames: readonly ModeRegistryEntry[],
  classifiedUnlocked: boolean,
  gamesUnlockedCount: number,
): number | undefined {
  const currentPos = waveGames.findIndex(
    (g) => g.classifiedIndex === currentIndex,
  );
  if (currentPos === -1) return undefined;

  for (let i = currentPos - 1; i >= 0; i--) {
    const entry = waveGames[i];
    if (entry && getCardState(entry, classifiedUnlocked, gamesUnlockedCount) === 'playable') {
      return entry.classifiedIndex ?? undefined;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function GalleryCard({
  entry,
  cardState,
  waveNumber,
  onClick,
}: {
  readonly entry: ModeRegistryEntry;
  readonly cardState: CardState;
  readonly waveNumber: number;
  readonly onClick: () => void;
}) {
  const waveColorClass = WAVE_COLOR_CLASSES.get(waveNumber) ?? '';
  const isInteractive = cardState === 'playable';

  const cardClasses = [styles.card];
  if (cardState === 'locked') cardClasses.push(styles.cardLocked);
  if (cardState === 'coming-soon') cardClasses.push(styles.cardComingSoon);

  return (
    <button
      className={cardClasses.join(' ')}
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      aria-label={
        cardState === 'locked'
          ? `${entry.displayName} \u2014 locked`
          : cardState === 'coming-soon'
            ? `${entry.displayName} \u2014 coming soon`
            : `${entry.displayName} \u2014 ${entry.boardGeometry ?? ''} ${entry.family ?? ''}`
      }
      data-testid={`classified-card-${String(entry.classifiedIndex ?? 0)}`}
    >
      <div className={styles.cardPreview}>
        <BoardPreviewLarge size={80} label={`${entry.displayName} board preview`} />
      </div>
      <span className={styles.gameName}>{entry.displayName}</span>
      <span className={styles.boardGeometry}>{entry.boardGeometry ?? ''}</span>
      <span className={[styles.familyBadge, waveColorClass].join(' ')}>
        {entry.family ?? ''}
      </span>
      {cardState === 'locked' && (
        <span className={styles.lockOverlay} aria-hidden="true">{'\uD83D\uDD12'}</span>
      )}
      {cardState === 'coming-soon' && (
        <span className={styles.comingSoon}>Coming Soon</span>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ClassifiedGalleryScreenProps {
  readonly onBack: () => void;
  readonly onNavigateToDetail: (gameIndex: number) => void;
}

export default function ClassifiedGalleryScreen({
  onBack,
  onNavigateToDetail,
}: ClassifiedGalleryScreenProps) {
  const [unlockEvaluation, setUnlockEvaluation] =
    useState<UnlockEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGame, setSelectedGame] = useState<number | null>(null);

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
        // Graceful degradation: render with all games locked
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // Derive unlock state
  const classifiedUnlocked =
    unlockEvaluation?.snapshot.classifiedUnlocked ?? false;
  const gamesUnlockedCount =
    unlockEvaluation?.chaosGate.gates.classifiedHardWins.current ?? 0;

  // Dialog handlers
  const handleCardClick = useCallback((gameIndex: number) => {
    setSelectedGame(gameIndex);
  }, []);

  const handleDialogClose = useCallback(() => {
    setSelectedGame(null);
  }, []);

  const handleDialogPlay = useCallback(() => {
    if (selectedGame !== null) {
      onNavigateToDetail(selectedGame);
    }
  }, [selectedGame, onNavigateToDetail]);

  // Resolve selected game data for dialog
  const allClassified = useMemo(
    () => WAVE_META.flatMap((w) => getClassifiedByWave(w.wave)),
    [],
  );
  const selectedEntry = selectedGame !== null
    ? allClassified.find((e) => e.classifiedIndex === selectedGame) ?? null
    : null;
  const selectedWave = selectedEntry?.wave ?? null;

  // Cycling within the selected game's wave
  const selectedWaveGames = useMemo(
    () => selectedWave !== null ? getClassifiedByWave(selectedWave) : [],
    [selectedWave],
  );

  const hasNext = selectedGame !== null
    ? findNextInWave(selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount) !== undefined
    : false;

  const hasPrevious = selectedGame !== null
    ? findPreviousInWave(selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount) !== undefined
    : false;

  const handleDialogNext = useCallback(() => {
    if (selectedGame !== null) {
      const next = findNextInWave(
        selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount,
      );
      if (next !== undefined) setSelectedGame(next);
    }
  }, [selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount]);

  const handleDialogPrevious = useCallback(() => {
    if (selectedGame !== null) {
      const prev = findPreviousInWave(
        selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount,
      );
      if (prev !== undefined) setSelectedGame(prev);
    }
  }, [selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount]);

  // Total games count (for unlock summary)
  const totalGames = allClassified.length;

  // Loading state
  if (isLoading) {
    return (
      <ModeScreenShell title="Classified" onBack={onBack} testId="classified-screen">
        <p className={styles.loading} data-testid="classified-loading">
          Loading...
        </p>
      </ModeScreenShell>
    );
  }

  const unlockStatusClasses = classifiedUnlocked
    ? [styles.unlockStatus, styles.unlockStatusUnlocked].join(' ')
    : [styles.unlockStatus, styles.unlockStatusLocked].join(' ');

  return (
    <ModeScreenShell title="Classified" onBack={onBack} testId="classified-screen">
      {/* Intro text */}
      <p className={styles.introText}>
        A library of abstract strategy board games from around the world.
        Each game is unlocked sequentially as you win against the Hard CPU.
      </p>

      {/* Unlock status */}
      {classifiedUnlocked ? (
        <p
          className={unlockStatusClasses}
          data-testid="classified-unlock-status"
        >
          {String(gamesUnlockedCount)} / {String(totalGames)} games unlocked
        </p>
      ) : (
        <>
          <p
            className={unlockStatusClasses}
            data-testid="classified-unlock-status"
          >
            Classified mode: Locked
          </p>
          <p className={styles.unlockHint}>
            Complete all 100 challenges to unlock Classified mode.
          </p>
        </>
      )}

      {/* Wave sections */}
      {WAVE_META.map((waveMeta) => {
        const waveGames = getClassifiedByWave(waveMeta.wave);
        if (waveGames.length === 0) return null;

        return (
          <section
            key={waveMeta.wave}
            className={styles.waveSection}
            aria-label={`Wave ${String(waveMeta.wave)}: ${waveMeta.title}`}
          >
            {/* Wave header */}
            <div className={styles.waveHeader}>
              <span className={styles.waveLabel}>
                Wave {String(waveMeta.wave)}
              </span>
              <h2 className={styles.waveTitle}>{waveMeta.title}</h2>
              <span className={styles.waveCount}>
                {String(waveGames.length)} games
              </span>
              <p className={styles.waveSubtitle}>{waveMeta.subtitle}</p>
            </div>

            {/* Game card grid */}
            <div
              className={styles.gallery}
              role="grid"
              aria-label={`${waveMeta.title} games`}
            >
              {waveGames.map((entry) => {
                const state = getCardState(
                  entry, classifiedUnlocked, gamesUnlockedCount,
                );
                return (
                  <GalleryCard
                    key={entry.id}
                    entry={entry}
                    cardState={state}
                    waveNumber={waveMeta.wave}
                    onClick={() => {
                      handleCardClick(entry.classifiedIndex ?? 0);
                    }}
                  />
                );
              })}
            </div>
          </section>
        );
      })}

      {/* GalleryDialogBox for selected game */}
      {selectedGame !== null && selectedEntry !== null && (
        <GalleryDialogBox
          title={selectedEntry.displayName}
          visualization={
            <BoardPreviewLarge
              size={180}
              label={`${selectedEntry.displayName} board preview`}
            />
          }
          description={
            <div className={styles.dialogInfo}>
              <div className={styles.dialogInfoRow}>
                <span className={styles.dialogInfoLabel}>Board:</span>
                <span>{selectedEntry.boardGeometry ?? 'Standard'}</span>
              </div>
              <div className={styles.dialogInfoRow}>
                <span className={styles.dialogInfoLabel}>Family:</span>
                <span>{selectedEntry.family ?? 'Unknown'}</span>
              </div>
              <div className={styles.dialogInfoRow}>
                <span className={styles.dialogInfoLabel}>Wave:</span>
                <span>
                  {selectedEntry.wave !== null
                    ? `Wave ${String(selectedEntry.wave)}`
                    : ''}
                </span>
              </div>
              <div className={styles.dialogPlaceholder}>
                Historical context and detailed rules coming in a future update.
              </div>
            </div>
          }
          onPlay={handleDialogPlay}
          onClose={handleDialogClose}
          onNext={hasNext ? handleDialogNext : undefined}
          onPrevious={hasPrevious ? handleDialogPrevious : undefined}
          ariaLabel={`Classified game: ${selectedEntry.displayName}`}
        />
      )}
    </ModeScreenShell>
  );
}
