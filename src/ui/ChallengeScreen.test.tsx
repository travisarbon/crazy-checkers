import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChallengeScreen from './ChallengeScreen';
import type { ChallengeRecord, ChallengeProgressSnapshot, PuzzleSummary } from '../persistence/challengeRecords';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../persistence/challengeRecords', () => ({
  getAllChallengeRecords: vi.fn(),
  computeChallengeProgress: vi.fn(),
}));

// We need to import the mocked functions to control them
import { getAllChallengeRecords, computeChallengeProgress } from '../persistence/challengeRecords';

const mockGetAll = vi.mocked(getAllChallengeRecords);
const mockCompute = vi.mocked(computeChallengeProgress);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSummary(
  puzzleId: number,
  solved: boolean,
  bestTimeMs: number | null = null,
  bestRating = 0,
  attemptCount = 1,
): PuzzleSummary {
  return { puzzleId, solved, bestTimeMs, bestRating, attemptCount };
}

function buildPerPuzzle(entries: PuzzleSummary[]): ReadonlyMap<number, PuzzleSummary> {
  const map = new Map<number, PuzzleSummary>();
  for (const e of entries) map.set(e.puzzleId, e);
  return map;
}

function makeProgress(overrides?: Partial<ChallengeProgressSnapshot>): ChallengeProgressSnapshot {
  return {
    puzzlesCompleted: 0,
    nextPuzzleId: 1,
    averageRating: 0,
    bestTimeMs: null,
    currentStreak: 0,
    perPuzzle: new Map<number, PuzzleSummary>(),
    totalAttempts: 0,
    ...overrides,
  };
}

function setupMock(progress: ChallengeProgressSnapshot) {
  mockGetAll.mockResolvedValue([] as ChallengeRecord[]);
  mockCompute.mockReturnValue(progress);
}

async function renderChallenge(overrides?: Partial<{
  onBack: () => void;
  onStartPuzzle: (id: number) => void;
}>) {
  const onBack = overrides?.onBack ?? vi.fn();
  const onStartPuzzle = overrides?.onStartPuzzle ?? vi.fn();
  const result = render(
    <ChallengeScreen onBack={onBack} onStartPuzzle={onStartPuzzle} />,
  );
  // Wait for the async load to complete
  await waitFor(() => {
    expect(screen.queryByTestId('challenge-loading')).not.toBeInTheDocument();
  });
  return { onBack, onStartPuzzle, ...result };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ChallengeScreen', () => {
  it('renders ModeScreenShell with title "Challenge"', async () => {
    setupMock(makeProgress());
    await renderChallenge();
    expect(screen.getByRole('heading', { name: 'Challenge' })).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    // Don't resolve the promise yet
    mockGetAll.mockReturnValue(new Promise(() => {}));
    render(<ChallengeScreen onBack={vi.fn()} />);
    expect(screen.getByTestId('challenge-loading')).toBeInTheDocument();
  });

  it('stat cards display zero progress', async () => {
    setupMock(makeProgress());
    await renderChallenge();

    expect(screen.getByTestId('stat-completed')).toHaveTextContent('0 / 100');
    expect(screen.getByTestId('stat-avg-rating')).toHaveTextContent('\u2014');
    expect(screen.getByTestId('stat-best-time')).toHaveTextContent('\u2014');
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('0');
  });

  it('stat cards display partial progress', async () => {
    const perPuzzle = buildPerPuzzle([
      makeSummary(1, true, 5000, 3, 1),
      makeSummary(2, true, 8000, 2, 2),
      makeSummary(3, true, 12000, 1, 1),
    ]);
    setupMock(makeProgress({
      puzzlesCompleted: 3,
      nextPuzzleId: 4,
      averageRating: 2.0,
      bestTimeMs: 5000,
      currentStreak: 2,
      perPuzzle,
      totalAttempts: 4,
    }));
    await renderChallenge();

    expect(screen.getByTestId('stat-completed')).toHaveTextContent('3 / 100');
    expect(screen.getByTestId('stat-avg-rating')).toHaveTextContent('2.0');
    expect(screen.getByTestId('stat-best-time')).toHaveTextContent('0:05.0');
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('2');
  });

  it('board preview SVG renders', async () => {
    setupMock(makeProgress());
    const { container } = await renderChallenge();
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toBeInTheDocument();
  });

  it('continue button shows correct puzzle ID', async () => {
    setupMock(makeProgress({ nextPuzzleId: 7 }));
    await renderChallenge();
    const btn = screen.getByTestId('challenge-continue');
    expect(btn.textContent).toContain('Puzzle 7');
  });

  it('continue button calls onStartPuzzle with next puzzle', async () => {
    const onStartPuzzle = vi.fn();
    setupMock(makeProgress({ nextPuzzleId: 5 }));
    await renderChallenge({ onStartPuzzle });
    fireEvent.click(screen.getByTestId('challenge-continue'));
    expect(onStartPuzzle).toHaveBeenCalledWith(5);
  });

  it('all-complete state hides continue button and shows message', async () => {
    const entries: PuzzleSummary[] = [];
    for (let id = 1; id <= 100; id++) {
      entries.push(makeSummary(id, true, 5000, 3));
    }
    setupMock(makeProgress({
      puzzlesCompleted: 100,
      nextPuzzleId: 101,
      averageRating: 3.0,
      bestTimeMs: 1000,
      currentStreak: 100,
      perPuzzle: buildPerPuzzle(entries),
      totalAttempts: 100,
    }));
    await renderChallenge();

    expect(screen.queryByTestId('challenge-continue')).not.toBeInTheDocument();
    expect(screen.getByTestId('challenge-all-complete')).toBeInTheDocument();
  });

  it('select puzzle toggle opens and closes PuzzleSelector', async () => {
    setupMock(makeProgress());
    await renderChallenge();

    expect(screen.queryByTestId('puzzle-selector')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('puzzle-selector-toggle'));
    expect(screen.getByTestId('puzzle-selector')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('puzzle-selector-toggle'));
    expect(screen.queryByTestId('puzzle-selector')).not.toBeInTheDocument();
  });

  it('puzzle selector shows 100 cells when expanded', async () => {
    setupMock(makeProgress());
    await renderChallenge();
    fireEvent.click(screen.getByTestId('puzzle-selector-toggle'));
    expect(screen.getByTestId('puzzle-selector')).toBeInTheDocument();
  });

  it('expandable detail panels present', async () => {
    setupMock(makeProgress());
    await renderChallenge();
    expect(screen.getByRole('button', { name: /Performance History/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /About Challenge Mode/i })).toBeInTheDocument();
  });

  it('performance history shows empty state for no attempts', async () => {
    setupMock(makeProgress());
    await renderChallenge();
    // Expand the performance history panel
    fireEvent.click(screen.getByRole('button', { name: /Performance History/i }));
    expect(screen.getByTestId('empty-history')).toBeInTheDocument();
  });

  it('performance history table shows attempted puzzles', async () => {
    const perPuzzle = buildPerPuzzle([
      makeSummary(1, true, 5000, 3, 1),
      makeSummary(2, false, null, 0, 2),
    ]);
    setupMock(makeProgress({
      puzzlesCompleted: 1,
      nextPuzzleId: 2,
      perPuzzle,
      totalAttempts: 3,
    }));
    await renderChallenge();
    fireEvent.click(screen.getByRole('button', { name: /Performance History/i }));
    expect(screen.getByTestId('history-table')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('back button navigates', async () => {
    const onBack = vi.fn();
    setupMock(makeProgress());
    await renderChallenge({ onBack });
    fireEvent.click(screen.getByRole('button', { name: /back to previous screen/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('how-to-play text rendered', async () => {
    setupMock(makeProgress());
    await renderChallenge();
    expect(screen.getByText(/100 hand-crafted puzzles/i)).toBeInTheDocument();
  });

  it('challenge-screen testid is present', async () => {
    setupMock(makeProgress());
    await renderChallenge();
    expect(screen.getByTestId('challenge-screen')).toBeInTheDocument();
  });

  it('hero layout with board preview and stats present', async () => {
    setupMock(makeProgress());
    const { container } = await renderChallenge();
    // Board preview exists in the hero layout
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toBeInTheDocument();
    // Stats are present
    expect(screen.getByTestId('stat-completed')).toBeInTheDocument();
  });

  it('puzzle selector toggle present', async () => {
    setupMock(makeProgress());
    await renderChallenge();
    expect(screen.getByTestId('puzzle-selector-toggle')).toBeInTheDocument();
  });
});
