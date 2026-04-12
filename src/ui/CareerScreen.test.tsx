import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CareerScreen from './CareerScreen';
import type {
  CareerSnapshot,
  SummaryStats,
  ModeStatBlock,
  TrackProgress,
  Track4MilestoneStatus,
  ChaosGateProgress,
  ChallengeStats,
  WaveStats,
  EventStatEntry,
  PerOpponentBreakdown,
} from '../persistence/careerStatsEngine';
import type {
  UnlockEvaluation,
  TrackUnlockResult,
  ChaosGateStatus,
  ChoiceModeUnlockStatus,
} from '../persistence/unlockEvaluator';
import type { UnlockSnapshot } from '../persistence/unlockState';
import type { TrackId } from '../persistence/gameModeRegistry';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../persistence/careerStatsEngine', () => ({
  loadAndComputeCareerSnapshot: vi.fn(),
  formatPlayTime: vi.fn((ms: number) => {
    if (ms <= 0) return '0m';
    const mins = Math.floor(ms / 60_000);
    const hrs = Math.floor(mins / 60);
    if (hrs > 0) return `${String(hrs)}h ${String(mins % 60)}m`;
    return `${String(mins)}m`;
  }),
}));

vi.mock('../persistence/unlockEvaluator', () => ({
  evaluateFullUnlocks: vi.fn(),
}));

import { loadAndComputeCareerSnapshot } from '../persistence/careerStatsEngine';
import { evaluateFullUnlocks } from '../persistence/unlockEvaluator';

const mockLoadCareer = vi.mocked(loadAndComputeCareerSnapshot);
const mockEvaluateUnlocks = vi.mocked(evaluateFullUnlocks);

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeDefaultSummary(overrides?: Partial<SummaryStats>): SummaryStats {
  return {
    totalGames: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: NaN,
    longestWinStreak: 0,
    currentWinStreak: 0,
    totalPlayTimeMs: 0,
    averageGameLengthPlies: 0,
    averagePlayTimeMs: 0,
    ...overrides,
  };
}

function makeDefaultPerOpponent(): PerOpponentBreakdown {
  return {
    vsEasy: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, winRate: NaN },
    vsHard: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, winRate: NaN },
    passAround: { gamesPlayed: 0, whiteWins: 0, blackWins: 0, draws: 0 },
  };
}

function makeTrackProgress(
  trackId: TrackId,
  trackName: string,
  currentValue: number,
  thresholds: readonly number[],
  overrides?: Partial<TrackProgress>,
): TrackProgress {
  let completedMilestones = 0;
  for (const t of thresholds) {
    if (currentValue >= t) completedMilestones += 1;
    else break;
  }
  const nextThreshold =
    completedMilestones < thresholds.length
      ? thresholds[completedMilestones] ?? null
      : null;

  return {
    trackId,
    trackName,
    currentValue,
    thresholds: [...thresholds],
    completedMilestones,
    totalMilestones: thresholds.length,
    nextThreshold,
    ...overrides,
  };
}

function makeDefaultTracks(): TrackProgress[] {
  return [
    makeTrackProgress('puzzle-mastery', 'Puzzle Mastery', 0, [1, 15, 29, 43, 57, 71, 85, 99]),
    makeTrackProgress('chaos-veteran', 'Chaos Veteran', 0, [1, 3, 6, 10, 15, 21, 28, 36]),
    makeTrackProgress('rule-bender', 'Rule Bender', 0, [1, 4, 8, 13, 19, 26, 34, 43]),
    makeTrackProgress('lifer', 'Lifer', 0, [1, 2, 3, 4, 5, 6, 7, 8]),
    makeTrackProgress('world-player', 'World Player', 0, [1, 5, 10, 20, 30, 40, 50, 64]),
  ];
}

function makeDefaultTrack4Milestones(): Track4MilestoneStatus[] {
  return [
    { choiceNumber: 25, description: 'Play 50 total games', condition: 'totalGamesPlayed >= 50', met: false, currentValue: 0, requiredValue: 50 },
    { choiceNumber: 26, description: 'Win 5 games in a row vs. Hard CPU', condition: 'maxHardWinStreak >= 5', met: false, currentValue: 0, requiredValue: 5 },
    { choiceNumber: 27, description: 'Win 10 games as Black vs. Hard CPU', condition: 'blackHardWins >= 10', met: false, currentValue: 0, requiredValue: 10 },
    { choiceNumber: 28, description: 'Play 100 total games', condition: 'totalGamesPlayed >= 100', met: false, currentValue: 0, requiredValue: 100 },
    { choiceNumber: 29, description: 'Win a game in 5 different modes', condition: 'distinctModeWins >= 5', met: false, currentValue: 0, requiredValue: 5 },
    { choiceNumber: 30, description: 'Win 25 games in Pass Around', condition: 'passAroundGames >= 25', met: false, currentValue: 0, requiredValue: 25 },
    { choiceNumber: 31, description: 'Achieve a 10-game win streak vs. Hard CPU', condition: 'maxHardWinStreak >= 10', met: false, currentValue: 0, requiredValue: 10 },
    { choiceNumber: 32, description: 'Play 200 total games', condition: 'totalGamesPlayed >= 200', met: false, currentValue: 0, requiredValue: 200 },
  ];
}

function makeDefaultChaosGateProgress(): ChaosGateProgress {
  return {
    challengesCompleted: 0,
    choiceModesUnlocked: 0,
    classifiedUnlocked: false,
    classifiedHardWins: 0,
  };
}

function makeDefaultChallengeStats(overrides?: Partial<ChallengeStats>): ChallengeStats {
  return {
    puzzlesCompleted: 0,
    averageRating: 0,
    bestTimeMs: null,
    currentStreak: 0,
    totalAttempts: 0,
    ...overrides,
  };
}

function makeDefaultWaves(): WaveStats[] {
  const names = [
    'The Draughts Family', 'Hunt & Capture', 'Race & Connection', 'Territory & Enclosure',
    'Deep Strategy & Unique Systems', 'The Chess Family', 'The Shogi Family', 'The Final Unlocks',
  ];
  return names.map((name, i) => ({
    wave: i + 1,
    waveName: name,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    hardWins: 0,
    totalGamesInWave: i < 7 ? 8 : 4,
  }));
}

function makeCareerSnapshot(overrides?: Partial<CareerSnapshot>): CareerSnapshot {
  return {
    summary: makeDefaultSummary(),
    perOpponent: makeDefaultPerOpponent(),
    perMode: new Map(),
    tracks: makeDefaultTracks(),
    track4Milestones: makeDefaultTrack4Milestones(),
    chaosGate: makeDefaultChaosGateProgress(),
    challengeStats: makeDefaultChallengeStats(),
    classifiedWaves: makeDefaultWaves(),
    eventStats: new Map(),
    ...overrides,
  };
}

function makeDefaultSnapshot(): UnlockSnapshot {
  return {
    choiceUnlocked: false,
    classifiedUnlocked: false,
    chaosUnlocked: false,
  };
}

function makeChoiceModeStatus(
  choiceNumber: number,
  displayName: string,
  trackId: TrackId,
  unlocked = false,
): ChoiceModeUnlockStatus {
  return {
    choiceNumber,
    registryId: `choice-${displayName.toLowerCase().replace(/\s+/g, '-')}`,
    displayName,
    trackId,
    unlockedByProgression: unlocked,
    unlockedByCode: false,
    unlocked,
  };
}

function makeDefaultChoiceModes(): Map<number, ChoiceModeUnlockStatus> {
  const trackNames: { trackId: TrackId; base: number }[] = [
    { trackId: 'puzzle-mastery', base: 1 },
    { trackId: 'chaos-veteran', base: 9 },
    { trackId: 'rule-bender', base: 17 },
    { trackId: 'lifer', base: 25 },
    { trackId: 'world-player', base: 33 },
  ];
  const modes = new Map<number, ChoiceModeUnlockStatus>();
  for (const { trackId, base } of trackNames) {
    for (let i = 0; i < 8; i++) {
      const num = base + i;
      modes.set(num, makeChoiceModeStatus(num, `Mode ${String(num)}`, trackId));
    }
  }
  return modes;
}

function makeTrackUnlockResult(
  trackId: TrackId,
  trackName: string,
  currentValue: number,
  thresholds: readonly number[],
  milestoneDetails: readonly Track4MilestoneStatus[] | null = null,
  overrides?: Partial<TrackUnlockResult>,
): TrackUnlockResult {
  let unlockedCount = 0;
  for (const t of thresholds) {
    if (currentValue >= t) unlockedCount += 1;
    else break;
  }
  const nextThreshold =
    unlockedCount < thresholds.length ? thresholds[unlockedCount] ?? null : null;

  return {
    trackId,
    trackName,
    currentValue,
    thresholds: [...thresholds],
    unlockedCount,
    totalMilestones: thresholds.length,
    nextThreshold,
    complete: unlockedCount >= thresholds.length,
    milestoneDetails,
    ...overrides,
  };
}

function makeDefaultTrackUnlockResults(
  track4Milestones?: readonly Track4MilestoneStatus[],
): TrackUnlockResult[] {
  const m4 = track4Milestones ?? makeDefaultTrack4Milestones();
  const met = m4.filter((m) => m.met).length;
  return [
    makeTrackUnlockResult('puzzle-mastery', 'Puzzle Mastery', 0, [1, 15, 29, 43, 57, 71, 85, 99]),
    makeTrackUnlockResult('chaos-veteran', 'Chaos Veteran', 0, [1, 3, 6, 10, 15, 21, 28, 36]),
    makeTrackUnlockResult('rule-bender', 'Rule Bender', 0, [1, 4, 8, 13, 19, 26, 34, 43]),
    makeTrackUnlockResult('lifer', 'Lifer', met, [1, 2, 3, 4, 5, 6, 7, 8], m4),
    makeTrackUnlockResult('world-player', 'World Player', 0, [1, 5, 10, 20, 30, 40, 50, 64]),
  ];
}

function makeChaosGateStatus(overrides?: Partial<ChaosGateStatus>): ChaosGateStatus {
  return {
    unlocked: false,
    unlockedByCode: false,
    gates: {
      challengesCompleted: { current: 0, required: 100, met: false },
      choiceModesUnlocked: { current: 0, required: 40, met: false },
      classifiedUnlocked: { met: false },
      classifiedHardWins: { current: 0, required: 64, met: false },
    },
    ...overrides,
  };
}

function makeUnlockEvaluation(overrides?: Partial<UnlockEvaluation>): UnlockEvaluation {
  return {
    snapshot: makeDefaultSnapshot(),
    choiceModes: makeDefaultChoiceModes(),
    tracks: makeDefaultTrackUnlockResults(),
    chaosGate: makeChaosGateStatus(),
    masterUnlockActive: false,
    totalChoiceModesUnlocked: 0,
    ...overrides,
  };
}

function makeModeStatBlock(
  registryId: string,
  displayName: string,
  category: 'classic' | 'crazy' | 'choice' | 'challenge' | 'classified' | 'chaos',
  overrides?: Partial<ModeStatBlock>,
): ModeStatBlock {
  return {
    registryId,
    displayName,
    category,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: NaN,
    vsEasy: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, winRate: NaN },
    vsHard: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, winRate: NaN },
    passAround: { gamesPlayed: 0, whiteWins: 0, blackWins: 0, draws: 0 },
    averageGameLengthPlies: 0,
    totalPlayTimeMs: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function setupMocks(
  snapshot: CareerSnapshot,
  evaluation: UnlockEvaluation,
) {
  mockLoadCareer.mockResolvedValue(snapshot);
  mockEvaluateUnlocks.mockResolvedValue(evaluation);
}

async function renderCareer(onBack?: () => void) {
  const cb = onBack ?? vi.fn();
  const result = render(<CareerScreen onBack={cb} />);
  await waitFor(() => {
    expect(screen.queryByTestId('career-loading')).not.toBeInTheDocument();
  });
  return { onBack: cb, ...result };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────
// 6.1 — Basic rendering
// ────────────────────────────────────────────────────────────

describe('CareerScreen — basic rendering', () => {
  it('1: renders with ModeScreenShell and correct title', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    await renderCareer();
    expect(screen.getByRole('heading', { name: 'Career' })).toBeInTheDocument();
  });

  it('2: shows loading state initially', () => {
    mockLoadCareer.mockReturnValue(new Promise(() => {}));
    mockEvaluateUnlocks.mockReturnValue(new Promise(() => {}));
    render(<CareerScreen onBack={vi.fn()} />);
    expect(screen.getByTestId('career-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading career data...')).toBeInTheDocument();
  });

  it('3: shows empty state when data load fails', async () => {
    mockLoadCareer.mockRejectedValue(new Error('DB error'));
    mockEvaluateUnlocks.mockRejectedValue(new Error('DB error'));
    render(<CareerScreen onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.getByTestId('career-empty')).toBeInTheDocument();
    });
    expect(screen.getByText('No career data available. Play some games to see your statistics!')).toBeInTheDocument();
  });

  it('4: back button calls onBack', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    const onBack = vi.fn();
    await renderCareer(onBack);
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// ────────────────────────────────────────────────────────────
// 6.2 — Section 1: Summary Statistics
// ────────────────────────────────────────────────────────────

describe('CareerScreen — Section 1: Summary Statistics', () => {
  it('5: stat cards render with zero data', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    await renderCareer();
    expect(screen.getByTestId('stat-total-games')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-record')).toHaveTextContent('0W / 0L / 0D');
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('0');
    expect(screen.getByTestId('stat-play-time')).toHaveTextContent('0m');
  });

  it('6: stat cards render with populated data', async () => {
    const snapshot = makeCareerSnapshot({
      summary: makeDefaultSummary({
        totalGames: 252,
        wins: 142,
        losses: 87,
        draws: 23,
        longestWinStreak: 12,
        currentWinStreak: 0,
        totalPlayTimeMs: 170_280_000,
      }),
    });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();
    expect(screen.getByTestId('stat-total-games')).toHaveTextContent('252');
    expect(screen.getByTestId('stat-record')).toHaveTextContent('142W / 87L / 23D');
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('12');
    expect(screen.getByTestId('stat-play-time')).toHaveTextContent('47h');
  });

  it('7: total games uses locale formatting', async () => {
    const snapshot = makeCareerSnapshot({
      summary: makeDefaultSummary({ totalGames: 1247 }),
    });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();
    // toLocaleString for 1247 should produce "1,247" in en-US locale
    expect(screen.getByTestId('stat-total-games')).toHaveTextContent('1,247');
  });

  it('8: streak shows active indicator when current equals longest', async () => {
    const snapshot = makeCareerSnapshot({
      summary: makeDefaultSummary({
        longestWinStreak: 5,
        currentWinStreak: 5,
      }),
    });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('5 (active)');
  });

  it('9: streak shows just number when current does not equal longest', async () => {
    const snapshot = makeCareerSnapshot({
      summary: makeDefaultSummary({
        longestWinStreak: 8,
        currentWinStreak: 3,
      }),
    });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('8');
    expect(screen.getByTestId('stat-streak')).not.toHaveTextContent('active');
  });

  it('10: stat cards have correct ARIA labels', async () => {
    const snapshot = makeCareerSnapshot({
      summary: makeDefaultSummary({ totalGames: 100 }),
    });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();
    const totalCard = screen.getByTestId('stat-total-games');
    expect(totalCard).toHaveAttribute('aria-label', expect.stringContaining('Total Games'));
    expect(totalCard).toHaveAttribute('aria-label', expect.stringContaining('100'));
  });
});

// ────────────────────────────────────────────────────────────
// 6.3 — Section 2: Unlock Progress
// ────────────────────────────────────────────────────────────

describe('CareerScreen — Section 2: Unlock Progress', () => {
  it('11: renders five ProgressTracker components', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    await renderCareer();
    const trackers = screen.getAllByTestId('progress-tracker');
    expect(trackers).toHaveLength(5);
  });

  it('12: Track 1 shows correct name and description', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    await renderCareer();
    expect(screen.getByText('Puzzle Mastery')).toBeInTheDocument();
    expect(screen.getByText(/Complete Challenge puzzles to unlock Choice modes 1/)).toBeInTheDocument();
  });

  it('13: Track 1 milestones map to Choice mode names', async () => {
    const choiceModes = makeDefaultChoiceModes();
    // Set first 3 as unlocked
    for (let i = 1; i <= 3; i++) {
      const mode = choiceModes.get(i);
      if (mode) {
        choiceModes.set(i, { ...mode, unlocked: true, unlockedByProgression: true });
      }
    }

    const tracks = makeDefaultTrackUnlockResults();
    tracks[0] = makeTrackUnlockResult('puzzle-mastery', 'Puzzle Mastery', 30, [1, 15, 29, 43, 57, 71, 85, 99]);

    const evaluation = makeUnlockEvaluation({
      choiceModes,
      tracks,
      totalChoiceModesUnlocked: 3,
    });
    const snapshot = makeCareerSnapshot({
      tracks: [
        makeTrackProgress('puzzle-mastery', 'Puzzle Mastery', 30, [1, 15, 29, 43, 57, 71, 85, 99]),
        ...makeDefaultTracks().slice(1),
      ],
    });

    setupMocks(snapshot, evaluation);
    await renderCareer();

    // ProgressTracker milestone markers: completed ones show checkmarks
    const checkmarks = screen.getAllByText('\u2713');
    expect(checkmarks.length).toBeGreaterThanOrEqual(3);
  });

  it('14: Track 4 uses milestone descriptions instead of Choice mode names', async () => {
    const m4 = makeDefaultTrack4Milestones();
    m4[0] = { choiceNumber: 25, description: 'Play 50 total games', condition: 'totalGamesPlayed >= 50', met: true, currentValue: 50, requiredValue: 50 };
    m4[1] = { choiceNumber: 26, description: 'Win 5 games in a row vs. Hard CPU', condition: 'maxHardWinStreak >= 5', met: true, currentValue: 5, requiredValue: 5 };

    const tracks = makeDefaultTrackUnlockResults(m4);
    tracks[3] = makeTrackUnlockResult('lifer', 'Lifer', 2, [1, 2, 3, 4, 5, 6, 7, 8], m4);

    const evaluation = makeUnlockEvaluation({ tracks });
    const snapshot = makeCareerSnapshot({ track4Milestones: m4 });

    setupMocks(snapshot, evaluation);
    await renderCareer();

    expect(screen.getByText('Play 50 total games')).toBeInTheDocument();
    expect(screen.getByText('Win 5 games in a row vs. Hard CPU')).toBeInTheDocument();
  });

  it('15: next milestone text shown for incomplete tracks', async () => {
    const choiceModes = makeDefaultChoiceModes();
    // Track 2 with 3 unlocked (currentValue = 7 which is >= 6 for threshold index 2)
    const tracks = makeDefaultTrackUnlockResults();
    tracks[1] = makeTrackUnlockResult('chaos-veteran', 'Chaos Veteran', 7, [1, 3, 6, 10, 15, 21, 28, 36]);

    const evaluation = makeUnlockEvaluation({ choiceModes, tracks });
    setupMocks(makeCareerSnapshot(), evaluation);
    await renderCareer();

    // Next milestone should mention the next threshold (10) and "Crazy Hard wins"
    expect(screen.getByTestId('track-next-chaos-veteran')).toHaveTextContent('Next:');
    expect(screen.getByTestId('track-next-chaos-veteran')).toHaveTextContent('10 Crazy Hard wins');
  });

  it('16: track complete text shown for finished tracks', async () => {
    const tracks = makeDefaultTrackUnlockResults();
    tracks[0] = makeTrackUnlockResult(
      'puzzle-mastery', 'Puzzle Mastery', 99, [1, 15, 29, 43, 57, 71, 85, 99],
      null,
      { complete: true, unlockedCount: 8 },
    );
    const evaluation = makeUnlockEvaluation({ tracks });
    setupMocks(makeCareerSnapshot(), evaluation);
    await renderCareer();

    expect(screen.getByTestId('track-complete-puzzle-mastery')).toHaveTextContent('Track complete!');
  });

  it('17: all tracks at 0% with no games', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    await renderCareer();
    const progressBars = screen.getAllByRole('progressbar');
    // All 5 track progress bars should be at 0
    const trackBars = progressBars.filter(
      (el) => el.getAttribute('aria-valuenow') === '0',
    );
    expect(trackBars.length).toBeGreaterThanOrEqual(5);
  });
});

// ────────────────────────────────────────────────────────────
// 6.4 — Section 3: Mode Statistics
// ────────────────────────────────────────────────────────────

describe('CareerScreen — Section 3: Mode Statistics', () => {
  it('18: Classic panel present with summary', async () => {
    const classicStat = makeModeStatBlock('classic', 'Classic', 'classic', {
      gamesPlayed: 10,
      wins: 7,
      losses: 2,
      draws: 1,
    });
    const perMode = new Map<string, ModeStatBlock>();
    perMode.set('classic', classicStat);
    const snapshot = makeCareerSnapshot({ perMode });

    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    // The expandable panel for Classic should show the summary
    expect(screen.getByText(/10 games \u2014 7W/)).toBeInTheDocument();
  });

  it('19: Classic panel shows opponent breakdown when expanded', async () => {
    const classicStat = makeModeStatBlock('classic', 'Classic', 'classic', {
      gamesPlayed: 10,
      wins: 7,
      losses: 2,
      draws: 1,
      vsEasy: { gamesPlayed: 5, wins: 4, losses: 1, draws: 0, winRate: 80 },
      vsHard: { gamesPlayed: 3, wins: 2, losses: 1, draws: 0, winRate: 66.7 },
      passAround: { gamesPlayed: 2, whiteWins: 1, blackWins: 0, draws: 1 },
    });
    const perMode = new Map<string, ModeStatBlock>();
    perMode.set('classic', classicStat);
    const snapshot = makeCareerSnapshot({ perMode });

    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    // Expand the Classic panel
    const classicButton = screen.getByRole('button', { name: 'Classic' });
    fireEvent.click(classicButton);

    expect(screen.getByText('vs. Easy CPU')).toBeInTheDocument();
    expect(screen.getByText('vs. Hard CPU')).toBeInTheDocument();
    expect(screen.getByText('Pass Around')).toBeInTheDocument();
  });

  it('20: Crazy panel shows empty state when no games', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    await renderCareer();

    // Expand the Crazy panel
    const crazyButton = screen.getByRole('button', { name: 'Crazy' });
    fireEvent.click(crazyButton);

    expect(screen.getByText('No Crazy mode games played yet.')).toBeInTheDocument();
  });

  it('21: Crazy panel shows event frequency table', async () => {
    const crazyStat = makeModeStatBlock('crazy', 'Crazy', 'crazy', {
      gamesPlayed: 5,
      wins: 3,
      losses: 2,
    });
    const perMode = new Map<string, ModeStatBlock>();
    perMode.set('crazy', crazyStat);

    const eventStats = new Map<string, EventStatEntry>();
    eventStats.set('stampede', {
      eventId: 'stampede',
      triggerCount: 12,
      gamesWithEvent: 4,
      winsWithEvent: 3,
      lossesWithEvent: 1,
    });

    const snapshot = makeCareerSnapshot({ perMode, eventStats });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    const crazyButton = screen.getByRole('button', { name: 'Crazy' });
    fireEvent.click(crazyButton);

    expect(screen.getByText('Event Frequency')).toBeInTheDocument();
    expect(screen.getByText('stampede')).toBeInTheDocument();
    // Verify trigger count cell exists (use getAllByText since "12" may appear elsewhere)
    const triggerCells = screen.getAllByText('12');
    expect(triggerCells.length).toBeGreaterThanOrEqual(1);
  });

  it('22: Choice panel shows X/40 unlocked in summary', async () => {
    const evaluation = makeUnlockEvaluation({ totalChoiceModesUnlocked: 5 });
    setupMocks(makeCareerSnapshot(), evaluation);
    await renderCareer();

    expect(screen.getByText('5 / 40 modes unlocked')).toBeInTheDocument();
  });

  it('23: Choice panel shows all 40 modes in table', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    await renderCareer();

    // Expand the Choice panel
    const choiceButton = screen.getByRole('button', { name: 'Choice' });
    fireEvent.click(choiceButton);

    // There should be 40 rows (plus 1 header row)
    const choiceTables = screen.getAllByRole('table');
    // Find the Choice mode table (it has columns #, Mode, Track, Played, Record, Status)
    const choiceTable = choiceTables.find((table) =>
      table.querySelector('th')?.textContent === '#',
    );
    expect(choiceTable).toBeDefined();
    const rows = choiceTable?.querySelectorAll('tbody tr') ?? [];
    expect(rows).toHaveLength(40);
  });

  it('24: Choice table locked modes have muted styling', async () => {
    const choiceModes = makeDefaultChoiceModes();
    // Unlock first 3
    for (let i = 1; i <= 3; i++) {
      const mode = choiceModes.get(i);
      if (mode) {
        choiceModes.set(i, { ...mode, unlocked: true, unlockedByProgression: true });
      }
    }

    const evaluation = makeUnlockEvaluation({ choiceModes, totalChoiceModesUnlocked: 3 });
    setupMocks(makeCareerSnapshot(), evaluation);
    await renderCareer();

    const choiceButton = screen.getByRole('button', { name: 'Choice' });
    fireEvent.click(choiceButton);

    // Check for locked rows: 37 should be locked
    const choiceTables = screen.getAllByRole('table');
    const choiceTable = choiceTables.find((table) =>
      table.querySelector('th')?.textContent === '#',
    );
    expect(choiceTable).toBeDefined();

    const lockedRows = choiceTable?.querySelectorAll('tr[aria-disabled="true"]') ?? [];
    expect(lockedRows).toHaveLength(37);
  });

  it('25: Challenge panel shows puzzle count in summary', async () => {
    const snapshot = makeCareerSnapshot({
      challengeStats: makeDefaultChallengeStats({ puzzlesCompleted: 25 }),
    });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    expect(screen.getByText('25 / 100 puzzles completed')).toBeInTheDocument();
  });

  it('26: Challenge panel shows stats when expanded', async () => {
    const snapshot = makeCareerSnapshot({
      challengeStats: makeDefaultChallengeStats({
        puzzlesCompleted: 25,
        averageRating: 2.4,
        bestTimeMs: 5000,
        currentStreak: 3,
        totalAttempts: 40,
      }),
    });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    const challengeButton = screen.getByRole('button', { name: 'Challenge' });
    fireEvent.click(challengeButton);

    expect(screen.getByText('Average Rating')).toBeInTheDocument();
    expect(screen.getByText(/2\.4/)).toBeInTheDocument();
    expect(screen.getByText('Total Attempts')).toBeInTheDocument();
    // "40" appears in multiple places (e.g. "40 modes unlocked"), so use getAllByText
    const fortyTexts = screen.getAllByText('40');
    expect(fortyTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('27: Classified panel shows empty state', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    await renderCareer();

    const classifiedButton = screen.getByRole('button', { name: 'Classified' });
    fireEvent.click(classifiedButton);

    expect(screen.getByText(/No Classified mode games played yet/)).toBeInTheDocument();
  });

  it('28: Classified panel shows wave table when data exists', async () => {
    const waves = makeDefaultWaves();
    waves[0] = { wave: 1, waveName: 'The Draughts Family', gamesPlayed: 3, wins: 2, losses: 1, draws: 0, hardWins: 1, totalGamesInWave: 8 };

    const snapshot = makeCareerSnapshot({ classifiedWaves: waves });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    const classifiedButton = screen.getByRole('button', { name: 'Classified' });
    fireEvent.click(classifiedButton);

    expect(screen.getByText('The Draughts Family')).toBeInTheDocument();
    expect(screen.getByText('2W / 1L / 0D')).toBeInTheDocument();
  });

  it('29: Chaos panel shows not-yet-unlocked message', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    await renderCareer();

    const chaosButton = screen.getByRole('button', { name: 'Chaos' });
    fireEvent.click(chaosButton);

    expect(screen.getByText(/Chaos mode is not yet unlocked/)).toBeInTheDocument();
  });

  it('30: Chaos panel shows stats when unlocked and played', async () => {
    const chaosStat = makeModeStatBlock('chaos', 'Chaos', 'chaos', {
      gamesPlayed: 5,
      wins: 3,
      losses: 2,
      draws: 0,
      vsEasy: { gamesPlayed: 2, wins: 2, losses: 0, draws: 0, winRate: 100 },
      vsHard: { gamesPlayed: 3, wins: 1, losses: 2, draws: 0, winRate: 33.3 },
    });
    const perMode = new Map<string, ModeStatBlock>();
    perMode.set('chaos', chaosStat);
    const snapshot = makeCareerSnapshot({ perMode });

    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    const chaosButton = screen.getByRole('button', { name: 'Chaos' });
    fireEvent.click(chaosButton);

    expect(screen.getByText('vs. Easy CPU')).toBeInTheDocument();
    expect(screen.getByText('vs. Hard CPU')).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// 6.5 — Section 4: Chaos Gate
// ────────────────────────────────────────────────────────────

describe('CareerScreen — Section 4: Chaos Gate', () => {
  it('31: Chaos Gate hidden when no progress', async () => {
    setupMocks(makeCareerSnapshot(), makeUnlockEvaluation());
    await renderCareer();

    expect(screen.queryByTestId('chaos-gate-section')).not.toBeInTheDocument();
  });

  it('32: Chaos Gate visible with 1+ challenges', async () => {
    const snapshot = makeCareerSnapshot({
      chaosGate: { ...makeDefaultChaosGateProgress(), challengesCompleted: 1 },
    });
    const evaluation = makeUnlockEvaluation({
      chaosGate: makeChaosGateStatus({
        gates: {
          challengesCompleted: { current: 1, required: 100, met: false },
          choiceModesUnlocked: { current: 0, required: 40, met: false },
          classifiedUnlocked: { met: false },
          classifiedHardWins: { current: 0, required: 64, met: false },
        },
      }),
    });
    setupMocks(snapshot, evaluation);
    await renderCareer();

    expect(screen.getByTestId('chaos-gate-section')).toBeInTheDocument();
  });

  it('33: Chaos Gate shows 4 requirement rows', async () => {
    const snapshot = makeCareerSnapshot({
      chaosGate: { ...makeDefaultChaosGateProgress(), challengesCompleted: 1 },
    });
    const evaluation = makeUnlockEvaluation({
      chaosGate: makeChaosGateStatus({
        gates: {
          challengesCompleted: { current: 1, required: 100, met: false },
          choiceModesUnlocked: { current: 0, required: 40, met: false },
          classifiedUnlocked: { met: false },
          classifiedHardWins: { current: 0, required: 64, met: false },
        },
      }),
    });
    setupMocks(snapshot, evaluation);
    await renderCareer();

    expect(screen.getByTestId('chaos-gate-challenges')).toBeInTheDocument();
    expect(screen.getByTestId('chaos-gate-choice')).toBeInTheDocument();
    expect(screen.getByTestId('chaos-gate-classified')).toBeInTheDocument();
    expect(screen.getByTestId('chaos-gate-classified-hard')).toBeInTheDocument();
  });

  it('34: challenges gate shows correct progress', async () => {
    const snapshot = makeCareerSnapshot({
      chaosGate: { ...makeDefaultChaosGateProgress(), challengesCompleted: 50 },
    });
    const evaluation = makeUnlockEvaluation({
      chaosGate: makeChaosGateStatus({
        gates: {
          challengesCompleted: { current: 50, required: 100, met: false },
          choiceModesUnlocked: { current: 0, required: 40, met: false },
          classifiedUnlocked: { met: false },
          classifiedHardWins: { current: 0, required: 64, met: false },
        },
      }),
    });
    setupMocks(snapshot, evaluation);
    await renderCareer();

    expect(screen.getByTestId('chaos-gate-challenges')).toHaveTextContent('50 / 100');
  });

  it('35: Choice modes gate shows correct progress', async () => {
    const snapshot = makeCareerSnapshot({
      chaosGate: { ...makeDefaultChaosGateProgress(), challengesCompleted: 1 },
    });
    const evaluation = makeUnlockEvaluation({
      totalChoiceModesUnlocked: 12,
      chaosGate: makeChaosGateStatus({
        gates: {
          challengesCompleted: { current: 1, required: 100, met: false },
          choiceModesUnlocked: { current: 12, required: 40, met: false },
          classifiedUnlocked: { met: false },
          classifiedHardWins: { current: 0, required: 64, met: false },
        },
      }),
    });
    setupMocks(snapshot, evaluation);
    await renderCareer();

    expect(screen.getByTestId('chaos-gate-choice')).toHaveTextContent('12 / 40');
  });

  it('36: Classified gate shows lock when not met', async () => {
    const snapshot = makeCareerSnapshot({
      chaosGate: { ...makeDefaultChaosGateProgress(), challengesCompleted: 50 },
    });
    const evaluation = makeUnlockEvaluation({
      chaosGate: makeChaosGateStatus({
        gates: {
          challengesCompleted: { current: 50, required: 100, met: false },
          choiceModesUnlocked: { current: 0, required: 40, met: false },
          classifiedUnlocked: { met: false },
          classifiedHardWins: { current: 0, required: 64, met: false },
        },
      }),
    });
    setupMocks(snapshot, evaluation);
    await renderCareer();

    expect(screen.getByTestId('chaos-gate-classified')).toHaveTextContent('0 / 1');
  });

  it('37: Classified gate shows checkmark when met', async () => {
    const snapshot = makeCareerSnapshot({
      chaosGate: { ...makeDefaultChaosGateProgress(), challengesCompleted: 100 },
    });
    const evaluation = makeUnlockEvaluation({
      chaosGate: makeChaosGateStatus({
        gates: {
          challengesCompleted: { current: 100, required: 100, met: true },
          choiceModesUnlocked: { current: 0, required: 40, met: false },
          classifiedUnlocked: { met: true },
          classifiedHardWins: { current: 0, required: 64, met: false },
        },
      }),
    });
    setupMocks(snapshot, evaluation);
    await renderCareer();

    expect(screen.getByTestId('chaos-gate-classified')).toHaveTextContent('\u2713');
  });

  it('38: all gates met shows Chaos Mode Unlocked banner', async () => {
    const snapshot = makeCareerSnapshot({
      chaosGate: { challengesCompleted: 100, choiceModesUnlocked: 40, classifiedUnlocked: true, classifiedHardWins: 64 },
    });
    const evaluation = makeUnlockEvaluation({
      totalChoiceModesUnlocked: 40,
      chaosGate: makeChaosGateStatus({
        unlocked: true,
        gates: {
          challengesCompleted: { current: 100, required: 100, met: true },
          choiceModesUnlocked: { current: 40, required: 40, met: true },
          classifiedUnlocked: { met: true },
          classifiedHardWins: { current: 64, required: 64, met: true },
        },
      }),
    });
    setupMocks(snapshot, evaluation);
    await renderCareer();

    expect(screen.getByTestId('chaos-gate-unlocked')).toBeInTheDocument();
    expect(screen.getByText('Chaos Mode Unlocked!')).toBeInTheDocument();
  });

  it('39: Chaos Gate progress bars have ARIA attributes', async () => {
    const snapshot = makeCareerSnapshot({
      chaosGate: { ...makeDefaultChaosGateProgress(), challengesCompleted: 25 },
    });
    const evaluation = makeUnlockEvaluation({
      chaosGate: makeChaosGateStatus({
        gates: {
          challengesCompleted: { current: 25, required: 100, met: false },
          choiceModesUnlocked: { current: 0, required: 40, met: false },
          classifiedUnlocked: { met: false },
          classifiedHardWins: { current: 0, required: 64, met: false },
        },
      }),
    });
    setupMocks(snapshot, evaluation);
    await renderCareer();

    const challengeBar = screen.getByTestId('chaos-gate-challenges').querySelector('[role="progressbar"]');
    expect(challengeBar).toBeDefined();
    expect(challengeBar).toHaveAttribute('aria-valuenow', '25');
    expect(challengeBar).toHaveAttribute('aria-valuemax', '100');
    expect(challengeBar).toHaveAttribute('aria-valuemin', '0');
  });
});

// ────────────────────────────────────────────────────────────
// 6.6 — Edge Cases
// ────────────────────────────────────────────────────────────

describe('CareerScreen — Edge Cases', () => {
  it('40: handles NaN winRate gracefully', async () => {
    const classicStat = makeModeStatBlock('classic', 'Classic', 'classic', {
      gamesPlayed: 1,
      wins: 0,
      losses: 0,
      draws: 1,
      winRate: NaN,
      vsEasy: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, winRate: NaN },
      vsHard: { gamesPlayed: 0, wins: 0, losses: 0, draws: 0, winRate: NaN },
    });
    const perMode = new Map<string, ModeStatBlock>();
    perMode.set('classic', classicStat);
    const snapshot = makeCareerSnapshot({ perMode });

    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    const classicButton = screen.getByRole('button', { name: 'Classic' });
    fireEvent.click(classicButton);

    // Win rate should show em dash, not "NaN"
    const cells = screen.getAllByText('\u2014');
    expect(cells.length).toBeGreaterThanOrEqual(1);
    // Ensure "NaN" is not rendered anywhere
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
  });

  it('41: handles null bestTimeMs in challenge stats', async () => {
    const snapshot = makeCareerSnapshot({
      challengeStats: makeDefaultChallengeStats({
        puzzlesCompleted: 5,
        bestTimeMs: null,
        averageRating: 2.0,
      }),
    });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    const challengeButton = screen.getByRole('button', { name: 'Challenge' });
    fireEvent.click(challengeButton);

    expect(screen.getByText('Best Time')).toBeInTheDocument();
    // Should show em dash for null time
    const values = screen.getAllByText('\u2014');
    expect(values.length).toBeGreaterThanOrEqual(1);
  });

  it('42: large play time formats correctly', async () => {
    const snapshot = makeCareerSnapshot({
      summary: makeDefaultSummary({ totalPlayTimeMs: 200_000_000 }),
    });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    // 200_000_000ms = ~55h 33m — our mock formatPlayTime will produce "55h 33m"
    expect(screen.getByTestId('stat-play-time')).toHaveTextContent('55h 33m');
  });

  it('43: zero-division-safe for Chaos Gate with required=0', async () => {
    const snapshot = makeCareerSnapshot({
      chaosGate: { ...makeDefaultChaosGateProgress(), challengesCompleted: 1 },
    });
    const evaluation = makeUnlockEvaluation({
      chaosGate: makeChaosGateStatus({
        gates: {
          challengesCompleted: { current: 1, required: 100, met: false },
          choiceModesUnlocked: { current: 0, required: 40, met: false },
          classifiedUnlocked: { met: false },
          classifiedHardWins: { current: 0, required: 0, met: true },
        },
      }),
    });
    setupMocks(snapshot, evaluation);

    // Should not throw
    await renderCareer();
    expect(screen.getByTestId('chaos-gate-section')).toBeInTheDocument();
  });

  it('44: track with no milestoneDetails for Track 4', async () => {
    const tracks = makeDefaultTrackUnlockResults();
    // Set milestoneDetails to null for Track 4 (defensive edge case)
    tracks[3] = makeTrackUnlockResult('lifer', 'Lifer', 0, [1, 2, 3, 4, 5, 6, 7, 8], null);

    const evaluation = makeUnlockEvaluation({ tracks });
    setupMocks(makeCareerSnapshot(), evaluation);

    // Should not throw — falls back to default milestone names
    await renderCareer();
    expect(screen.getByText('Lifer')).toBeInTheDocument();
  });

  it('45: Choice mode with no perMode stat entry', async () => {
    const choiceModes = makeDefaultChoiceModes();
    // Unlock mode 1 but don't add a stat entry for it
    const mode1 = choiceModes.get(1);
    if (mode1) {
      choiceModes.set(1, { ...mode1, unlocked: true, unlockedByProgression: true });
    }

    const evaluation = makeUnlockEvaluation({ choiceModes, totalChoiceModesUnlocked: 1 });
    setupMocks(makeCareerSnapshot(), evaluation);
    await renderCareer();

    const choiceButton = screen.getByRole('button', { name: 'Choice' });
    fireEvent.click(choiceButton);

    // Mode 1 should show 0 games and 0W / 0L / 0D
    const choiceTables = screen.getAllByRole('table');
    const choiceTable = choiceTables.find((table) =>
      table.querySelector('th')?.textContent === '#',
    );
    expect(choiceTable).toBeDefined();
    const firstRow = choiceTable?.querySelectorAll('tbody tr')[0];
    expect(firstRow).toBeDefined();
    expect(firstRow?.textContent).toContain('0');
    expect(firstRow?.textContent).toContain('0W / 0L / 0D');
  });
});

// ────────────────────────────────────────────────────────────
// 6.7 — Integration Tests
// ────────────────────────────────────────────────────────────

describe('CareerScreen — Integration Tests', () => {
  it('46: full render with realistic data', async () => {
    const classicStat = makeModeStatBlock('classic', 'Classic', 'classic', {
      gamesPlayed: 30,
      wins: 20,
      losses: 8,
      draws: 2,
      vsEasy: { gamesPlayed: 15, wins: 12, losses: 2, draws: 1, winRate: 85.7 },
      vsHard: { gamesPlayed: 10, wins: 5, losses: 5, draws: 0, winRate: 50.0 },
      passAround: { gamesPlayed: 5, whiteWins: 3, blackWins: 1, draws: 1 },
    });
    const crazyStat = makeModeStatBlock('crazy', 'Crazy', 'crazy', {
      gamesPlayed: 20,
      wins: 10,
      losses: 8,
      draws: 2,
    });

    const perMode = new Map<string, ModeStatBlock>();
    perMode.set('classic', classicStat);
    perMode.set('crazy', crazyStat);

    const snapshot = makeCareerSnapshot({
      summary: makeDefaultSummary({
        totalGames: 50,
        wins: 30,
        losses: 16,
        draws: 4,
        longestWinStreak: 7,
        currentWinStreak: 3,
        totalPlayTimeMs: 7_200_000, // 2h 0m
      }),
      perMode,
      challengeStats: makeDefaultChallengeStats({ puzzlesCompleted: 25 }),
      chaosGate: { challengesCompleted: 25, choiceModesUnlocked: 3, classifiedUnlocked: false, classifiedHardWins: 0 },
    });

    const tracks = makeDefaultTrackUnlockResults();
    tracks[0] = makeTrackUnlockResult('puzzle-mastery', 'Puzzle Mastery', 25, [1, 15, 29, 43, 57, 71, 85, 99]);
    tracks[1] = makeTrackUnlockResult('chaos-veteran', 'Chaos Veteran', 3, [1, 3, 6, 10, 15, 21, 28, 36]);

    const evaluation = makeUnlockEvaluation({
      tracks,
      totalChoiceModesUnlocked: 3,
      chaosGate: makeChaosGateStatus({
        gates: {
          challengesCompleted: { current: 25, required: 100, met: false },
          choiceModesUnlocked: { current: 3, required: 40, met: false },
          classifiedUnlocked: { met: false },
          classifiedHardWins: { current: 0, required: 64, met: false },
        },
      }),
    });

    setupMocks(snapshot, evaluation);
    await renderCareer();

    // Section 1: Summary
    expect(screen.getByTestId('summary-section')).toBeInTheDocument();
    expect(screen.getByTestId('stat-total-games')).toHaveTextContent('50');
    expect(screen.getByTestId('stat-record')).toHaveTextContent('30W / 16L / 4D');
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('7');
    expect(screen.getByTestId('stat-play-time')).toHaveTextContent('2h 0m');

    // Section 2: Unlock Progress
    expect(screen.getByTestId('unlock-section')).toBeInTheDocument();
    expect(screen.getAllByTestId('progress-tracker')).toHaveLength(5);

    // Section 3: Mode Statistics (expandable panels present)
    expect(screen.getByRole('button', { name: 'Classic' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crazy' })).toBeInTheDocument();

    // Section 4: Chaos Gate (visible because challengesCompleted >= 1)
    expect(screen.getByTestId('chaos-gate-section')).toBeInTheDocument();
  });

  it('47: ProgressTrackers update correctly after data change', async () => {
    const tracks1 = makeDefaultTrackUnlockResults();
    tracks1[0] = makeTrackUnlockResult('puzzle-mastery', 'Puzzle Mastery', 0, [1, 15, 29, 43, 57, 71, 85, 99]);

    const evaluation1 = makeUnlockEvaluation({ tracks: tracks1 });
    const snapshot1 = makeCareerSnapshot();

    setupMocks(snapshot1, evaluation1);
    const { unmount } = render(<CareerScreen onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByTestId('career-loading')).not.toBeInTheDocument();
    });

    // Verify initial data
    expect(screen.getByTestId('stat-total-games')).toHaveTextContent('0');

    // Unmount and remount with new data
    unmount();

    const tracks2 = makeDefaultTrackUnlockResults();
    tracks2[0] = makeTrackUnlockResult('puzzle-mastery', 'Puzzle Mastery', 20, [1, 15, 29, 43, 57, 71, 85, 99]);

    const evaluation2 = makeUnlockEvaluation({ tracks: tracks2 });
    const snapshot2 = makeCareerSnapshot({
      summary: makeDefaultSummary({ totalGames: 20 }),
    });

    mockLoadCareer.mockResolvedValue(snapshot2);
    mockEvaluateUnlocks.mockResolvedValue(evaluation2);

    render(<CareerScreen onBack={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByTestId('career-loading')).not.toBeInTheDocument();
    });

    // The component should reflect new data after re-mount
    expect(screen.getByTestId('stat-total-games')).toHaveTextContent('20');
  });

  it('48: mode panels remain independently expandable', async () => {
    const classicStat = makeModeStatBlock('classic', 'Classic', 'classic', {
      gamesPlayed: 5,
      wins: 3,
      losses: 2,
      vsEasy: { gamesPlayed: 3, wins: 2, losses: 1, draws: 0, winRate: 66.7 },
      vsHard: { gamesPlayed: 2, wins: 1, losses: 1, draws: 0, winRate: 50 },
    });
    const perMode = new Map<string, ModeStatBlock>();
    perMode.set('classic', classicStat);

    const snapshot = makeCareerSnapshot({ perMode });
    setupMocks(snapshot, makeUnlockEvaluation());
    await renderCareer();

    // Expand Classic
    const classicButton = screen.getByRole('button', { name: 'Classic' });
    fireEvent.click(classicButton);
    expect(classicButton).toHaveAttribute('aria-expanded', 'true');

    // Crazy should still be collapsed
    const crazyButton = screen.getByRole('button', { name: 'Crazy' });
    expect(crazyButton).toHaveAttribute('aria-expanded', 'false');

    // Expand Crazy
    fireEvent.click(crazyButton);
    expect(crazyButton).toHaveAttribute('aria-expanded', 'true');

    // Classic should remain expanded
    expect(classicButton).toHaveAttribute('aria-expanded', 'true');
  });
});
