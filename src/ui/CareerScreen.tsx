/**
 * Career mode sub-menu screen.
 * Displays a read-only progression dashboard with four sections:
 * 1. Summary Statistics — four stat cards
 * 2. Unlock Progress — five track ProgressTrackers
 * 3. Mode Statistics — expandable panels per mode category
 * 4. Chaos Gate — four requirement rows with progress indicators
 */

import { useState, useEffect } from 'react';
import ModeScreenShell from './ModeScreenShell';
import ProgressTracker from './ProgressTracker';
import type { Milestone } from './ProgressTracker';
import ExpandableDetailPanel from './ExpandableDetailPanel';
import type {
  CareerSnapshot,
  ModeStatBlock,
  ChallengeStats,
  WaveStats,
  EventStatEntry,
} from '../persistence/careerStatsEngine';
import { loadAndComputeCareerSnapshot, formatPlayTime } from '../persistence/careerStatsEngine';
import type {
  UnlockEvaluation,
  TrackUnlockResult,
  ChaosGateStatus,
  ChoiceModeUnlockStatus,
} from '../persistence/unlockEvaluator';
import { evaluateFullUnlocks } from '../persistence/unlockEvaluator';
import { CHOICE_MODE_DATA } from '../persistence/choiceModeData';
import styles from './CareerScreen.module.css';

// ---------------------------------------------------------------------------
// Lifer track Choice mode name lookup
// ---------------------------------------------------------------------------

/** Map from choiceNumber to displayName for Lifer track modes (25–32). */
const LIFER_MODE_NAMES: ReadonlyMap<number, string> = new Map(
  CHOICE_MODE_DATA
    .filter((d) => d.track === 'lifer')
    .map((d) => [d.choiceNumber, d.displayName]),
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRACK_DESCRIPTIONS: ReadonlyMap<string, string> = new Map([
  ['puzzle-mastery', 'Complete Challenge puzzles to unlock Choice modes 1\u20138.'],
  ['chaos-veteran', 'Win Crazy mode games vs. Hard CPU to unlock Choice modes 9\u201316.'],
  ['rule-bender', 'Win Choice mode games vs. Hard CPU to unlock Choice modes 17\u201324.'],
  ['lifer', 'Reach career milestones to unlock Choice modes 25\u201332.'],
  ['world-player', 'Win Classified games vs. Hard CPU to unlock Choice modes 33\u201340.'],
]);

const TRACK_ABBREVIATIONS: ReadonlyMap<string, string> = new Map([
  ['puzzle-mastery', 'PM'],
  ['chaos-veteran', 'CV'],
  ['rule-bender', 'RB'],
  ['lifer', 'L'],
  ['world-player', 'WP'],
]);

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format a number with locale-aware comma separators. */
function formatNumber(n: number): string {
  return n.toLocaleString();
}

/** Format win/loss/draw record as "XW / YL / ZD". */
function formatRecord(wins: number, losses: number, draws: number): string {
  return `${String(wins)}W / ${String(losses)}L / ${String(draws)}D`;
}

/** Format record with incomplete game count when W+L+D doesn't match total. */
function formatRecordWithIncomplete(
  wins: number,
  losses: number,
  draws: number,
  totalGames: number,
): string {
  const completed = wins + losses + draws;
  const incomplete = totalGames - completed;
  const base = formatRecord(wins, losses, draws);
  if (incomplete > 0) {
    return `${base} (${String(incomplete)} incomplete)`;
  }
  return base;
}

/** Format a percentage (0-100) to one decimal place. */
function formatPercent(value: number): string {
  if (Number.isNaN(value)) return '\u2014';
  return value.toFixed(1) + '%';
}

/** Format a mode stat summary with incomplete count if applicable. */
function formatModeSummary(stat: ModeStatBlock): string {
  const completed = stat.wins + stat.losses + stat.draws;
  const incomplete = stat.gamesPlayed - completed;
  const record = formatRecord(stat.wins, stat.losses, stat.draws);
  if (incomplete > 0) {
    return `${String(stat.gamesPlayed)} games \u2014 ${record} (${String(incomplete)} incomplete)`;
  }
  return `${String(stat.gamesPlayed)} games \u2014 ${record}`;
}

/** Format milliseconds as M:SS.T (tenths) for challenge times. */
function formatChallengeTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((totalSeconds * 10) % 10);
  return String(minutes) + ':' + String(seconds).padStart(2, '0') + '.' + String(tenths);
}

// ---------------------------------------------------------------------------
// Milestone builder helpers
// ---------------------------------------------------------------------------

function getBaseChoiceNumberForTrack(trackId: string): number {
  switch (trackId) {
    case 'puzzle-mastery': return 1;
    case 'chaos-veteran': return 9;
    case 'rule-bender': return 17;
    case 'lifer': return 25;
    case 'world-player': return 33;
    default: return 1;
  }
}

/**
 * Build Milestone[] array for a track from its TrackUnlockResult
 * and the per-Choice-mode unlock status map.
 */
function buildMilestonesForTrack(
  track: TrackUnlockResult,
  choiceModes: ReadonlyMap<number, ChoiceModeUnlockStatus>,
): Milestone[] {
  if (track.trackId === 'lifer' && track.milestoneDetails !== null) {
    // Track 4: show Choice mode names with milestone descriptions as tooltips
    return track.milestoneDetails.map((m) => ({
      name: LIFER_MODE_NAMES.get(m.choiceNumber) ?? `Choice ${String(m.choiceNumber)}`,
      threshold: m.requiredValue,
      completed: m.met,
      tooltip: m.description,
    }));
  }

  // Tracks 1, 2, 3, 5: map thresholds to Choice mode names
  const baseChoiceNumber = getBaseChoiceNumberForTrack(track.trackId);
  return track.thresholds.map((threshold, index) => {
    const choiceNumber = baseChoiceNumber + index;
    const modeStatus = choiceModes.get(choiceNumber);
    const name = modeStatus?.displayName ?? `Choice ${String(choiceNumber)}`;
    return {
      name,
      threshold,
      completed: index < track.unlockedCount,
    };
  });
}

function getThresholdUnit(trackId: string): string {
  switch (trackId) {
    case 'puzzle-mastery': return 'challenges';
    case 'chaos-veteran': return 'Crazy Hard wins';
    case 'rule-bender': return 'Choice Hard wins';
    case 'world-player': return 'Classified Hard wins';
    default: return '';
  }
}

/**
 * Build the "Next: [Mode Name] — [threshold]" text for a track.
 */
function buildNextMilestoneText(
  track: TrackUnlockResult,
  choiceModes: ReadonlyMap<number, ChoiceModeUnlockStatus>,
): string | null {
  if (track.complete) return null;

  if (track.trackId === 'lifer' && track.milestoneDetails !== null) {
    // Find the first unmet milestone
    const nextMilestone = track.milestoneDetails.find((m) => !m.met);
    if (nextMilestone) {
      const modeName = LIFER_MODE_NAMES.get(nextMilestone.choiceNumber)
        ?? `Choice ${String(nextMilestone.choiceNumber)}`;
      return `Next: ${modeName} \u2014 ${nextMilestone.description}`;
    }
    return null;
  }

  // For linear tracks, find the next locked Choice mode
  if (track.nextThreshold === null) return null;
  const baseChoiceNumber = getBaseChoiceNumberForTrack(track.trackId);
  const nextChoiceNumber = baseChoiceNumber + track.unlockedCount;
  const modeStatus = choiceModes.get(nextChoiceNumber);
  const modeName = modeStatus?.displayName ?? `Choice ${String(nextChoiceNumber)}`;

  return `Next: ${modeName} \u2014 ${String(track.nextThreshold)} ${getThresholdUnit(track.trackId)}`;
}

// ---------------------------------------------------------------------------
// Inline sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  testId,
  longValue = false,
}: {
  label: string;
  value: string;
  testId: string;
  longValue?: boolean;
}) {
  return (
    <div
      className={styles.statCard}
      role="group"
      aria-label={`${label}: ${value}`}
      data-testid={testId}
    >
      <span className={styles.statLabel}>{label}</span>
      <span className={longValue ? styles.statValueLong : styles.statValue}>{value}</span>
    </div>
  );
}

function OpponentBreakdownTable({
  modeStat,
}: {
  modeStat: ModeStatBlock;
}) {
  return (
    <div className={styles.modeStatTableWrapper}>
      <table className={styles.modeStatTable}>
        <thead>
          <tr>
            <th>Opponent</th>
            <th>Played</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Draws</th>
            <th>Win Rate</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>vs. Easy CPU</td>
            <td>{String(modeStat.vsEasy.gamesPlayed)}</td>
            <td>{String(modeStat.vsEasy.wins)}</td>
            <td>{String(modeStat.vsEasy.losses)}</td>
            <td>{String(modeStat.vsEasy.draws)}</td>
            <td>{formatPercent(modeStat.vsEasy.winRate)}</td>
          </tr>
          <tr>
            <td>vs. Hard CPU</td>
            <td>{String(modeStat.vsHard.gamesPlayed)}</td>
            <td>{String(modeStat.vsHard.wins)}</td>
            <td>{String(modeStat.vsHard.losses)}</td>
            <td>{String(modeStat.vsHard.draws)}</td>
            <td>{formatPercent(modeStat.vsHard.winRate)}</td>
          </tr>
          <tr>
            <td>Pass Around</td>
            <td>{String(modeStat.passAround.gamesPlayed)}</td>
            <td>{String(modeStat.passAround.whiteWins)}</td>
            <td>{String(modeStat.passAround.blackWins)}</td>
            <td>{String(modeStat.passAround.draws)}</td>
            <td>{'\u2014'}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ChoiceModeTable({
  choiceModes,
  perMode,
}: {
  choiceModes: ReadonlyMap<number, ChoiceModeUnlockStatus>;
  perMode: ReadonlyMap<string, ModeStatBlock>;
}) {
  const sortedModes = [...choiceModes.values()].sort(
    (a, b) => a.choiceNumber - b.choiceNumber,
  );

  return (
    <div className={styles.modeStatTableWrapper}>
      <table className={styles.modeStatTable}>
        <thead>
          <tr>
            <th>#</th>
            <th>Mode</th>
            <th>Track</th>
            <th>Played</th>
            <th>Record</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedModes.map((mode) => {
            const stat = perMode.get(mode.registryId);
            const isLocked = !mode.unlocked;
            const abbreviation = TRACK_ABBREVIATIONS.get(mode.trackId) ?? '';

            return (
              <tr
                key={mode.choiceNumber}
                className={isLocked ? styles.lockedRow : undefined}
                aria-disabled={isLocked}
                aria-label={
                  isLocked
                    ? `${mode.displayName} \u2014 locked`
                    : `${mode.displayName} \u2014 ${String(stat?.gamesPlayed ?? 0)} games played`
                }
              >
                <td>{String(mode.choiceNumber)}</td>
                <td>{mode.displayName}</td>
                <td>{abbreviation}</td>
                <td>{isLocked ? '\u2014' : String(stat?.gamesPlayed ?? 0)}</td>
                <td>
                  {isLocked
                    ? '\u2014'
                    : formatRecord(stat?.wins ?? 0, stat?.losses ?? 0, stat?.draws ?? 0)}
                </td>
                <td>
                  {isLocked ? '\uD83D\uDD12 Locked' : '\u2713 Unlocked'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChaosGateRow({
  label,
  current,
  required,
  met,
  testId,
}: {
  label: string;
  current: number;
  required: number;
  met: boolean;
  testId: string;
}) {
  const percentage = required > 0 ? Math.round((current / required) * 100) : 0;

  return (
    <div className={styles.chaosGateRow} data-testid={testId}>
      <span className={styles.chaosGateLabel}>{label}</span>
      <div className={styles.chaosGateBar}>
        <div className={styles.chaosGateBarContainer}>
          <div
            className={styles.chaosGateBarFill}
            style={{ width: `${String(Math.min(percentage, 100))}%` }}
            role="progressbar"
            aria-valuenow={current}
            aria-valuemin={0}
            aria-valuemax={required}
            aria-label={label}
          />
        </div>
      </div>
      <span className={met ? [styles.chaosGateValue, styles.chaosGateMet].join(' ') : styles.chaosGateValue}>
        {met ? '\u2713' : `${String(current)} / ${String(required)}`}
      </span>
    </div>
  );
}

function ChaosGateSection({
  chaosGate,
}: {
  chaosGate: ChaosGateStatus;
}) {
  if (chaosGate.unlocked) {
    return (
      <div className={styles.section} data-testid="chaos-gate-section">
        <h2 className={styles.sectionTitle}>Chaos Gate</h2>
        <p className={styles.chaosGateUnlockedBanner} data-testid="chaos-gate-unlocked">
          Chaos Mode Unlocked!
        </p>
      </div>
    );
  }

  const gates = chaosGate.gates;

  return (
    <div className={styles.section} data-testid="chaos-gate-section">
      <h2 className={styles.sectionTitle}>Chaos Gate</h2>
      <div className={styles.chaosGateGrid}>
        <ChaosGateRow
          label="Complete 100 Challenges"
          current={gates.challengesCompleted.current}
          required={gates.challengesCompleted.required}
          met={gates.challengesCompleted.met}
          testId="chaos-gate-challenges"
        />
        <ChaosGateRow
          label="Unlock All 40 Choice Modes"
          current={gates.choiceModesUnlocked.current}
          required={gates.choiceModesUnlocked.required}
          met={gates.choiceModesUnlocked.met}
          testId="chaos-gate-choice"
        />
        <ChaosGateRow
          label="Unlock Classified Mode"
          current={gates.classifiedUnlocked.met ? 1 : 0}
          required={1}
          met={gates.classifiedUnlocked.met}
          testId="chaos-gate-classified"
        />
        <ChaosGateRow
          label="Win All Classified Games vs. Hard"
          current={gates.classifiedHardWins.current}
          required={gates.classifiedHardWins.required}
          met={gates.classifiedHardWins.met}
          testId="chaos-gate-classified-hard"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode statistics rendering helpers
// ---------------------------------------------------------------------------

function renderEventStats(
  eventStats: ReadonlyMap<string, EventStatEntry>,
): React.ReactNode {
  if (eventStats.size === 0) {
    return (
      <p className={styles.emptyMessage}>
        No event data recorded yet.
      </p>
    );
  }

  const sortedEvents = [...eventStats.values()].sort(
    (a, b) => b.triggerCount - a.triggerCount,
  );

  return (
    <>
      <h3 className={styles.subsectionTitle}>Event Frequency</h3>
      <div className={styles.modeStatTableWrapper}>
        <table className={styles.modeStatTable}>
          <thead>
            <tr>
              <th>Event</th>
              <th>Triggers</th>
              <th>Games</th>
              <th>Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {sortedEvents.map((entry) => {
              const eventWinRate =
                entry.gamesWithEvent > 0
                  ? (entry.winsWithEvent / entry.gamesWithEvent) * 100
                  : NaN;
              return (
                <tr key={entry.eventId}>
                  <td>{entry.eventId}</td>
                  <td>{String(entry.triggerCount)}</td>
                  <td>{String(entry.gamesWithEvent)}</td>
                  <td>{formatPercent(eventWinRate)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function renderChallengeStats(stats: ChallengeStats): React.ReactNode {
  if (stats.puzzlesCompleted === 0) {
    return (
      <p className={styles.emptyMessage}>
        No challenges completed yet. Start your first puzzle in Challenge mode!
      </p>
    );
  }

  return (
    <div className={styles.challengeStatsGrid}>
      <div className={styles.challengeStatRow}>
        <span className={styles.challengeStatLabel}>Puzzles Completed</span>
        <span className={styles.challengeStatValue}>
          {String(stats.puzzlesCompleted)} / 100
        </span>
      </div>
      <div className={styles.challengeStatRow}>
        <span className={styles.challengeStatLabel}>Average Rating</span>
        <span className={styles.challengeStatValue}>
          {stats.averageRating > 0
            ? stats.averageRating.toFixed(1) + ' \u2605'
            : '\u2014'}
        </span>
      </div>
      <div className={styles.challengeStatRow}>
        <span className={styles.challengeStatLabel}>Best Time</span>
        <span className={styles.challengeStatValue}>
          {stats.bestTimeMs !== null
            ? formatChallengeTime(stats.bestTimeMs)
            : '\u2014'}
        </span>
      </div>
      <div className={styles.challengeStatRow}>
        <span className={styles.challengeStatLabel}>Current Streak</span>
        <span className={styles.challengeStatValue}>
          {String(stats.currentStreak)}
        </span>
      </div>
      <div className={styles.challengeStatRow}>
        <span className={styles.challengeStatLabel}>Total Attempts</span>
        <span className={styles.challengeStatValue}>
          {String(stats.totalAttempts)}
        </span>
      </div>
    </div>
  );
}

function classifiedSummaryText(waves: readonly WaveStats[]): string {
  const totalPlayed = waves.reduce((sum, w) => sum + w.gamesPlayed, 0);
  const totalHardWins = waves.reduce((sum, w) => sum + w.hardWins, 0);
  const totalGames = waves.reduce((sum, w) => sum + w.totalGamesInWave, 0);
  if (totalPlayed === 0) return 'No games played';
  return `${String(totalHardWins)} / ${String(totalGames)} games mastered`;
}

function renderClassifiedWaves(
  waves: readonly WaveStats[],
): React.ReactNode {
  const totalPlayed = waves.reduce((sum, w) => sum + w.gamesPlayed, 0);

  if (totalPlayed === 0) {
    return (
      <p className={styles.emptyMessage}>
        No Classified mode games played yet. Complete 100 challenges to unlock Classified mode.
      </p>
    );
  }

  return (
    <div className={styles.modeStatTableWrapper}>
      <table className={styles.modeStatTable}>
        <thead>
          <tr>
            <th>Wave</th>
            <th>Played</th>
            <th>W/L/D</th>
            <th>Hard Wins</th>
          </tr>
        </thead>
        <tbody>
          {waves.map((wave) => (
            <tr key={wave.wave}>
              <td>{wave.waveName}</td>
              <td>{String(wave.gamesPlayed)}</td>
              <td>{formatRecord(wave.wins, wave.losses, wave.draws)}</td>
              <td>
                {String(wave.hardWins)} / {String(wave.totalGamesInWave)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderModeStatistics(
  snapshot: CareerSnapshot,
  evaluation: UnlockEvaluation,
): React.ReactNode {
  const classicStat = snapshot.perMode.get('classic');
  const crazyStat = snapshot.perMode.get('crazy');
  const chaosStat = snapshot.perMode.get('chaos');

  return (
    <>
      {/* Classic */}
      <ExpandableDetailPanel
        title="Classic"
        summary={
          classicStat && classicStat.gamesPlayed > 0
            ? formatModeSummary(classicStat)
            : 'No games played'
        }
      >
        {classicStat && classicStat.gamesPlayed > 0 ? (
          <OpponentBreakdownTable modeStat={classicStat} />
        ) : (
          <p className={styles.emptyMessage}>
            No Classic mode games played yet. Play a game to see your statistics!
          </p>
        )}
      </ExpandableDetailPanel>

      {/* Crazy */}
      <ExpandableDetailPanel
        title="Crazy"
        summary={
          crazyStat && crazyStat.gamesPlayed > 0
            ? formatModeSummary(crazyStat)
            : 'No games played'
        }
      >
        {crazyStat && crazyStat.gamesPlayed > 0 ? (
          <>
            <OpponentBreakdownTable modeStat={crazyStat} />
            {renderEventStats(snapshot.eventStats)}
          </>
        ) : (
          <p className={styles.emptyMessage}>
            No Crazy mode games played yet.
          </p>
        )}
      </ExpandableDetailPanel>

      {/* Choice */}
      <ExpandableDetailPanel
        title="Choice"
        summary={`${String(evaluation.totalChoiceModesUnlocked)} / 40 modes unlocked`}
      >
        <ChoiceModeTable
          choiceModes={evaluation.choiceModes}
          perMode={snapshot.perMode}
        />
      </ExpandableDetailPanel>

      {/* Challenge */}
      <ExpandableDetailPanel
        title="Challenge"
        summary={`${String(snapshot.challengeStats.puzzlesCompleted)} / 100 puzzles completed`}
      >
        {renderChallengeStats(snapshot.challengeStats)}
      </ExpandableDetailPanel>

      {/* Classified */}
      <ExpandableDetailPanel
        title="Classified"
        summary={classifiedSummaryText(snapshot.classifiedWaves)}
      >
        {renderClassifiedWaves(snapshot.classifiedWaves)}
      </ExpandableDetailPanel>

      {/* Chaos */}
      <ExpandableDetailPanel
        title="Chaos"
        summary={
          chaosStat && chaosStat.gamesPlayed > 0
            ? formatModeSummary(chaosStat)
            : evaluation.chaosGate.unlockedByCode
              ? 'Unlocked via code'
              : 'Not yet unlocked'
        }
      >
        {chaosStat && chaosStat.gamesPlayed > 0 ? (
          <OpponentBreakdownTable modeStat={chaosStat} />
        ) : evaluation.chaosGate.unlockedByCode ? (
          <p className={styles.emptyMessage}>
            Chaos mode unlocked via code. Play a game to see your statistics!
          </p>
        ) : (
          <p className={styles.emptyMessage}>
            Chaos mode is not yet unlocked. Complete the Chaos Gate requirements to access it.
          </p>
        )}
      </ExpandableDetailPanel>
    </>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CareerScreenProps {
  readonly onBack: () => void;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CareerScreen({ onBack }: CareerScreenProps) {
  const [careerSnapshot, setCareerSnapshot] = useState<CareerSnapshot | null>(null);
  const [unlockEvaluation, setUnlockEvaluation] = useState<UnlockEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [snapshot, evaluation] = await Promise.all([
          loadAndComputeCareerSnapshot(),
          evaluateFullUnlocks(),
        ]);
        if (!cancelled) {
          setCareerSnapshot(snapshot);
          setUnlockEvaluation(evaluation);
          setIsLoading(false);
        }
      } catch {
        // Graceful degradation: show empty state rather than crashing
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) {
    return (
      <ModeScreenShell title="Career" onBack={onBack} testId="career-screen">
        <p className={styles.loading} data-testid="career-loading">
          Loading career data...
        </p>
      </ModeScreenShell>
    );
  }

  // If data failed to load, show empty state
  if (careerSnapshot === null || unlockEvaluation === null) {
    return (
      <ModeScreenShell title="Career" onBack={onBack} testId="career-screen">
        <p className={styles.emptyMessage} data-testid="career-empty">
          No career data available. Play some games to see your statistics!
        </p>
      </ModeScreenShell>
    );
  }

  const { summary } = careerSnapshot;
  const showChaosGate =
    careerSnapshot.chaosGate.challengesCompleted >= 1 ||
    unlockEvaluation.totalChoiceModesUnlocked > 0 ||
    unlockEvaluation.chaosGate.unlocked;

  // Build streak display: "5" or "5 (active)" if current streak equals longest
  const streakDisplay =
    summary.currentWinStreak > 0 && summary.currentWinStreak === summary.longestWinStreak
      ? `${String(summary.longestWinStreak)} (active)`
      : String(summary.longestWinStreak);

  return (
    <ModeScreenShell title="Career" onBack={onBack} testId="career-screen">
      {/* Section 1: Summary Statistics */}
      <div className={styles.section} data-testid="summary-section">
        <h2 className={styles.sectionTitle}>Summary</h2>
        <div className={styles.statsGrid}>
          <StatCard
            label="Games Played"
            value={formatNumber(summary.totalGames)}
            testId="stat-total-games"
          />
          <StatCard
            label="Record"
            value={formatRecordWithIncomplete(summary.wins, summary.losses, summary.draws, summary.totalGames)}
            testId="stat-record"
            longValue
          />
          <StatCard
            label="Best Streak"
            value={streakDisplay}
            testId="stat-streak"
          />
          <StatCard
            label="Play Time"
            value={formatPlayTime(summary.totalPlayTimeMs)}
            testId="stat-play-time"
          />
        </div>
      </div>

      {/* Section 2: Unlock Progress */}
      <div className={styles.section} data-testid="unlock-section">
        <h2 className={styles.sectionTitle}>Unlock Progress</h2>
        <div className={styles.trackSection}>
          {unlockEvaluation.tracks.map((track) => {
            const milestones = buildMilestonesForTrack(track, unlockEvaluation.choiceModes);
            const nextText = buildNextMilestoneText(track, unlockEvaluation.choiceModes);
            const description = TRACK_DESCRIPTIONS.get(track.trackId) ?? '';
            const maxValue =
              track.trackId === 'lifer'
                ? track.totalMilestones
                : track.thresholds[track.thresholds.length - 1] ?? 0;
            const currentValue =
              track.trackId === 'lifer'
                ? track.unlockedCount
                : track.currentValue;

            return (
              <div key={track.trackId} className={styles.trackWrapper}>
                <ProgressTracker
                  trackName={track.trackName}
                  milestones={milestones}
                  currentValue={currentValue}
                  maxValue={maxValue}
                />
                <p className={styles.trackDescription}>{description}</p>
                {track.complete ? (
                  <p className={styles.trackComplete} data-testid={`track-complete-${track.trackId}`}>
                    Track complete!
                  </p>
                ) : nextText !== null ? (
                  <p className={styles.nextMilestone} data-testid={`track-next-${track.trackId}`}>
                    {nextText}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Mode Statistics */}
      {renderModeStatistics(careerSnapshot, unlockEvaluation)}

      {/* Section 4: Chaos Gate */}
      {showChaosGate && (
        <ChaosGateSection chaosGate={unlockEvaluation.chaosGate} />
      )}
    </ModeScreenShell>
  );
}
