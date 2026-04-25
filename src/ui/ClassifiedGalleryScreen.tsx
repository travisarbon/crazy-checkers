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
import EmptyStateIllustration from './EmptyStateIllustration';
import GalleryDialogBox from './GalleryDialogBox';
import type { ModeRegistryEntry } from '../persistence/gameModeRegistry';
import { getClassifiedByWave } from '../persistence/gameModeRegistry';
import type { UnlockEvaluation } from '../persistence/unlockEvaluator';
import { evaluateFullUnlocks } from '../persistence/unlockEvaluator';
import { isClassifiedRegistered } from '../engine/classified/registry';
import { asClassifiedGameId } from '../engine/classified/ClassifiedRuleSet';
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

type CardState = 'locked' | 'coming-soon' | 'playable' | 'playable-registered';

/**
 * Extract the Classified registry game id from a `ModeRegistryEntry.id`.
 * Live-registered entries use `classified-<kebab-game-id>`; placeholders use
 * `classified-<number>`. Returns null for placeholder ids.
 */
function extractRegistryGameId(entry: ModeRegistryEntry): string | null {
  const PREFIX = 'classified-';
  if (!entry.id.startsWith(PREFIX)) return null;
  const suffix = entry.id.slice(PREFIX.length);
  if (/^\d+$/.test(suffix)) return null;
  return suffix;
}

/**
 * Determine the display state of a Classified game card.
 *
 * @param entry — The registry entry for the game.
 * @param classifiedUnlocked — Whether Classified mode is unlocked (100 challenges).
 * @param gamesUnlockedCount — Number of Classified games unlocked (Hard CPU wins).
 * @param masterUnlockActive — Whether the master UNLOCKALL code is active.
 * @returns The visual state to render.
 */
function getCardState(
  entry: ModeRegistryEntry,
  classifiedUnlocked: boolean,
  gamesUnlockedCount: number,
  masterUnlockActive: boolean,
): CardState {
  // Classified mode not unlocked: everything is locked
  if (!classifiedUnlocked) return 'locked';

  // Game not yet unlocked (sequential unlock based on Hard CPU wins).
  // Master unlock bypasses the sequential gate.
  if (!masterUnlockActive) {
    const gameIndex = entry.classifiedIndex ?? 0;
    if (gameIndex > gamesUnlockedCount) return 'locked';
  }

  // Game unlocked but not implemented: Coming Soon
  if (!entry.implemented) return 'coming-soon';

  // Game unlocked, implemented — check for live Classified registry entry
  const gameId = extractRegistryGameId(entry);
  if (gameId !== null && isClassifiedRegistered(asClassifiedGameId(gameId))) {
    return 'playable-registered';
  }
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
  masterUnlockActive: boolean,
): number | undefined {
  const currentPos = waveGames.findIndex(
    (g) => g.classifiedIndex === currentIndex,
  );
  if (currentPos === -1) return undefined;

  for (let i = currentPos + 1; i < waveGames.length; i++) {
    const entry = waveGames[i];
    if (!entry) continue;
    const state = getCardState(
      entry,
      classifiedUnlocked,
      gamesUnlockedCount,
      masterUnlockActive,
    );
    if (state === 'playable' || state === 'playable-registered') {
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
  masterUnlockActive: boolean,
): number | undefined {
  const currentPos = waveGames.findIndex(
    (g) => g.classifiedIndex === currentIndex,
  );
  if (currentPos === -1) return undefined;

  for (let i = currentPos - 1; i >= 0; i--) {
    const entry = waveGames[i];
    if (!entry) continue;
    const state = getCardState(
      entry,
      classifiedUnlocked,
      gamesUnlockedCount,
      masterUnlockActive,
    );
    if (state === 'playable' || state === 'playable-registered') {
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
  const isInteractive =
    cardState === 'playable' || cardState === 'playable-registered';
  const isPlayableRegistered = cardState === 'playable-registered';

  const cardClasses = [styles.card];
  if (cardState === 'locked') cardClasses.push(styles.cardLocked);
  if (cardState === 'coming-soon') cardClasses.push(styles.cardComingSoon);
  if (isPlayableRegistered && styles.cardPlayableRegistered) {
    cardClasses.push(styles.cardPlayableRegistered);
  }

  return (
    <button
      className={cardClasses.join(' ')}
      onClick={isInteractive ? onClick : undefined}
      disabled={!isInteractive}
      aria-label={(() => {
        switch (cardState) {
          case 'locked':
            return `${entry.displayName} \u2014 locked`;
          case 'coming-soon':
            return `${entry.displayName} \u2014 coming soon`;
          case 'playable-registered':
            return `${entry.displayName} \u2014 playable now`;
          default:
            return `${entry.displayName} \u2014 ${entry.boardGeometry ?? ''} ${entry.family ?? ''}`;
        }
      })()}
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
      {isPlayableRegistered && (
        <span
          className={styles.playBadge}
          data-testid={`classified-play-badge-${String(entry.classifiedIndex ?? 0)}`}
        >
          Play
        </span>
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
  const masterUnlockActive = unlockEvaluation?.masterUnlockActive ?? false;

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
    ? findNextInWave(selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount, masterUnlockActive) !== undefined
    : false;

  const hasPrevious = selectedGame !== null
    ? findPreviousInWave(selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount, masterUnlockActive) !== undefined
    : false;

  const handleDialogNext = useCallback(() => {
    if (selectedGame !== null) {
      const next = findNextInWave(
        selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount, masterUnlockActive,
      );
      if (next !== undefined) setSelectedGame(next);
    }
  }, [selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount, masterUnlockActive]);

  const handleDialogPrevious = useCallback(() => {
    if (selectedGame !== null) {
      const prev = findPreviousInWave(
        selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount, masterUnlockActive,
      );
      if (prev !== undefined) setSelectedGame(prev);
    }
  }, [selectedGame, selectedWaveGames, classifiedUnlocked, gamesUnlockedCount, masterUnlockActive]);

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
          <div
            data-testid="classified-locked-teaser"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '1.5rem 1rem',
              margin: '1rem 0',
              border: '1px dashed color-mix(in srgb, var(--ui-accent) 35%, transparent)',
              borderRadius: 'var(--radius-lg, 10px)',
              color: 'var(--ui-accent)',
              textAlign: 'center',
            }}
          >
            <EmptyStateIllustration variant="locked" size={96} />
            <p
              style={{
                margin: 0,
                fontSize: '0.95rem',
                fontWeight: 600,
                color: 'var(--ui-text)',
              }}
            >
              A library of 64 abstract strategy games awaits.
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '0.85rem',
                opacity: 0.75,
                color: 'var(--ui-text)',
                maxWidth: '36rem',
                lineHeight: 1.45,
              }}
            >
              Draughts variants, chess cousins, territorial games, shogi-family
              games, and many more — each unlocked in sequence as you complete
              Challenge puzzles and defeat the Hard CPU.
            </p>
          </div>
        </>
      )}

      {/* Wave sections — locked games and empty waves are hidden entirely.
          Live registrations and Phase-3 placeholders that share the same
          classifiedIndex are deduped here, preferring the live-registered
          entry so the gallery never renders two cards for the same game. */}
      {WAVE_META.map((waveMeta) => {
        const rawWaveGames = getClassifiedByWave(waveMeta.wave);
        const dedupedByIndex = new Map<number, ModeRegistryEntry>();
        for (const entry of rawWaveGames) {
          const idx = entry.classifiedIndex ?? -1;
          const existing = dedupedByIndex.get(idx);
          if (!existing || (entry.implemented && !existing.implemented)) {
            dedupedByIndex.set(idx, entry);
          }
        }
        const waveGames = [...dedupedByIndex.values()].sort(
          (a, b) => (a.classifiedIndex ?? 0) - (b.classifiedIndex ?? 0),
        );
        const visibleGames = waveGames.filter((entry) =>
          getCardState(
            entry,
            classifiedUnlocked,
            gamesUnlockedCount,
            masterUnlockActive,
          ) !== 'locked',
        );
        if (visibleGames.length === 0) return null;

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
                {String(visibleGames.length)} / {String(waveGames.length)} games
              </span>
              <p className={styles.waveSubtitle}>{waveMeta.subtitle}</p>
            </div>

            {/* Game card grid */}
            <div
              className={styles.gallery}
              role="grid"
              aria-label={`${waveMeta.title} games`}
            >
              {visibleGames.map((entry) => {
                const state = getCardState(
                  entry,
                  classifiedUnlocked,
                  gamesUnlockedCount,
                  masterUnlockActive,
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

      {classifiedUnlocked && gamesUnlockedCount === 0 && (
        <p className={styles.emptyState} data-testid="classified-empty">
          No Classified games unlocked yet. Win against the Hard CPU in other
          modes to unlock games here, wave by wave.
        </p>
      )}

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
