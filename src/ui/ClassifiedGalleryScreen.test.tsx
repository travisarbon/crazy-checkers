import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ClassifiedGalleryScreen from './ClassifiedGalleryScreen';
import type {
  UnlockEvaluation,
  ChaosGateStatus,
  TrackUnlockResult,
} from '../persistence/unlockEvaluator';
import type { UnlockSnapshot } from '../persistence/unlockState';
import type { ModeRegistryEntry, TrackId } from '../persistence/gameModeRegistry';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../persistence/unlockEvaluator', () => ({
  evaluateFullUnlocks: vi.fn(),
}));

// We mock gameModeRegistry so we can override `implemented` flags for specific tests.
// The actual module is imported first so we can delegate to the real functions.
const actualRegistry = await vi.importActual<typeof import('../persistence/gameModeRegistry')>(
  '../persistence/gameModeRegistry',
);

let implementedOverrides: number[] = [];

vi.mock('../persistence/gameModeRegistry', async () => {
  const actual = await vi.importActual<typeof import('../persistence/gameModeRegistry')>(
    '../persistence/gameModeRegistry',
  );
  return {
    ...actual,
    getClassifiedByWave: (wave: number) => {
      const entries = actual.getClassifiedByWave(wave);
      if (implementedOverrides.length === 0) return entries;
      return entries.map((e: ModeRegistryEntry) => {
        if (implementedOverrides.includes(e.classifiedIndex ?? 0)) {
          return { ...e, implemented: true };
        }
        return e;
      });
    },
  };
});

import { evaluateFullUnlocks } from '../persistence/unlockEvaluator';

const mockEvaluateUnlocks = vi.mocked(evaluateFullUnlocks);

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeChaosGateStatus(overrides: {
  classifiedUnlocked?: boolean;
  classifiedHardWins?: number;
} = {}): ChaosGateStatus {
  return {
    unlocked: false,
    unlockedByCode: false,
    gates: {
      challengesCompleted: { current: 100, required: 100, met: true },
      choiceModesUnlocked: { current: 0, required: 40, met: false },
      classifiedUnlocked: { met: overrides.classifiedUnlocked ?? false },
      classifiedHardWins: {
        current: overrides.classifiedHardWins ?? 0,
        required: 64,
        met: (overrides.classifiedHardWins ?? 0) >= 64,
      },
    },
  };
}

function makeDefaultSnapshot(overrides: {
  classifiedUnlocked?: boolean;
} = {}): UnlockSnapshot {
  return {
    choiceUnlocked: true,
    classifiedUnlocked: overrides.classifiedUnlocked ?? false,
    chaosUnlocked: false,
  };
}

function makeTrackUnlockResult(
  trackId: TrackId,
  trackName: string,
  thresholds: readonly number[],
): TrackUnlockResult {
  return {
    trackId,
    trackName,
    currentValue: 0,
    thresholds: [...thresholds],
    unlockedCount: 0,
    totalMilestones: thresholds.length,
    nextThreshold: thresholds[0] ?? null,
    complete: false,
    milestoneDetails: null,
  };
}

function makeUnlockEvaluation(overrides: {
  classifiedUnlocked?: boolean;
  classifiedHardWins?: number;
  masterUnlockActive?: boolean;
} = {}): UnlockEvaluation {
  return {
    snapshot: makeDefaultSnapshot({
      classifiedUnlocked: overrides.classifiedUnlocked,
    }),
    choiceModes: new Map(),
    tracks: [
      makeTrackUnlockResult('puzzle-mastery', 'Puzzle Mastery', [1, 15, 29, 43, 57, 71, 85, 99]),
      makeTrackUnlockResult('chaos-veteran', 'Chaos Veteran', [1, 3, 6, 10, 15, 21, 28, 36]),
      makeTrackUnlockResult('rule-bender', 'Rule Bender', [1, 4, 8, 13, 19, 26, 34, 43]),
      makeTrackUnlockResult('lifer', 'Lifer', [1, 2, 3, 4, 5, 6, 7, 8]),
      makeTrackUnlockResult('world-player', 'World Player', [1, 5, 10, 20, 30, 40, 50, 64]),
    ],
    chaosGate: makeChaosGateStatus({
      classifiedUnlocked: overrides.classifiedUnlocked,
      classifiedHardWins: overrides.classifiedHardWins,
    }),
    masterUnlockActive: overrides.masterUnlockActive ?? false,
    totalChoiceModesUnlocked: 0,
  };
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

async function renderGallery(
  onBack?: () => void,
  onNavigateToDetail?: (n: number) => void,
) {
  const backCb = onBack ?? vi.fn();
  const detailCb = onNavigateToDetail ?? vi.fn();
  const result = render(
    <ClassifiedGalleryScreen onBack={backCb} onNavigateToDetail={detailCb} />,
  );
  await waitFor(() => {
    expect(screen.queryByTestId('classified-loading')).not.toBeInTheDocument();
  });
  return { onBack: backCb, onNavigateToDetail: detailCb, ...result };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  implementedOverrides = [];
});

// ────────────────────────────────────────────────────────────
// 6.1 — Rendering and Layout
// ────────────────────────────────────────────────────────────

describe('ClassifiedGalleryScreen -- rendering and layout', () => {
  it('1: renders with ModeScreenShell and correct title', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    expect(screen.getByRole('heading', { name: 'Classified' })).toBeInTheDocument();
  });

  it('2: shows loading state initially', () => {
    mockEvaluateUnlocks.mockReturnValue(new Promise(() => {}));
    render(
      <ClassifiedGalleryScreen onBack={vi.fn()} onNavigateToDetail={vi.fn()} />,
    );
    expect(screen.getByTestId('classified-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('3: renders all 8 wave section headers after loading', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    expect(screen.getByText('The Draughts Family')).toBeInTheDocument();
    expect(screen.getByText('Hunt & Capture')).toBeInTheDocument();
    expect(screen.getByText('Race & Connection')).toBeInTheDocument();
    expect(screen.getByText('Territory & Enclosure')).toBeInTheDocument();
    expect(screen.getByText('Deep Strategy & Unique Systems')).toBeInTheDocument();
    expect(screen.getByText('The Chess Family')).toBeInTheDocument();
    expect(screen.getByText('The Shogi Family')).toBeInTheDocument();
    expect(screen.getByText('The Final Unlocks')).toBeInTheDocument();
  });

  it('4: renders correct game count per wave in headers', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    expect(screen.getByText('14 games')).toBeInTheDocument();
    expect(screen.getByText('13 games')).toBeInTheDocument();
    expect(screen.getByText('10 games')).toBeInTheDocument();
    expect(screen.getByText('6 games')).toBeInTheDocument();
    expect(screen.getByText('9 games')).toBeInTheDocument();
    expect(screen.getByText('2 games')).toBeInTheDocument();
  });

  it('5: renders all 64 game cards across all waves', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    for (let i = 1; i <= 64; i++) {
      expect(screen.getByTestId(`classified-card-${String(i)}`)).toBeInTheDocument();
    }
  });

  it('6: back button calls onBack', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    const onBack = vi.fn();
    await renderGallery(onBack);
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('7: renders intro text explaining Classified mode', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    expect(screen.getByText(/abstract strategy board games/)).toBeInTheDocument();
  });

  it('8: renders wave subtitles', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    expect(screen.getByText(/divergence from American Rules/)).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// 6.2 — Unlock Status Display
// ────────────────────────────────────────────────────────────

describe('ClassifiedGalleryScreen -- unlock status display', () => {
  it('9: shows locked status when Classified mode not unlocked', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation({ classifiedUnlocked: false }));
    await renderGallery();
    expect(screen.getByTestId('classified-unlock-status')).toHaveTextContent('Classified mode: Locked');
  });

  it('10: shows unlock hint when Classified mode locked', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation({ classifiedUnlocked: false }));
    await renderGallery();
    expect(screen.getByText(/Complete all 100 challenges/)).toBeInTheDocument();
  });

  it('11: shows games unlocked count when Classified mode unlocked', async () => {
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 5 }),
    );
    await renderGallery();
    expect(screen.getByTestId('classified-unlock-status')).toHaveTextContent('5 / 64 games unlocked');
  });

  it('12: shows 0 / 64 when mode unlocked but no games won', async () => {
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 0 }),
    );
    await renderGallery();
    expect(screen.getByTestId('classified-unlock-status')).toHaveTextContent('0 / 64 games unlocked');
  });
});

// ────────────────────────────────────────────────────────────
// 6.3 — Card States
// ────────────────────────────────────────────────────────────

describe('ClassifiedGalleryScreen -- card states', () => {
  it('13: all cards locked when Classified mode not unlocked', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation({ classifiedUnlocked: false }));
    await renderGallery();
    for (let i = 1; i <= 64; i++) {
      const card = screen.getByTestId(`classified-card-${String(i)}`);
      expect(card).toBeDisabled();
    }
  });

  it('14: all cards show lock icon when mode locked', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation({ classifiedUnlocked: false }));
    await renderGallery();
    const card1 = screen.getByTestId('classified-card-1');
    expect(card1).toHaveTextContent('\uD83D\uDD12');
  });

  it('15: cards show Coming Soon when game unlocked but not implemented', async () => {
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 5 }),
    );
    await renderGallery();
    // First 5 games are unlocked but not implemented -- show "Coming Soon"
    for (let i = 1; i <= 5; i++) {
      const card = screen.getByTestId(`classified-card-${String(i)}`);
      expect(card).toHaveTextContent('Coming Soon');
      expect(card).not.toHaveTextContent('\uD83D\uDD12');
    }
    // Game 6 is still locked
    const card6 = screen.getByTestId('classified-card-6');
    expect(card6).toHaveTextContent('\uD83D\uDD12');
    expect(card6).not.toHaveTextContent('Coming Soon');
  });

  it('16: cards are interactive when game is implemented and unlocked', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    const card1 = screen.getByTestId('classified-card-1');
    expect(card1).not.toBeDisabled();
  });

  it('17: all cards show game name', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    expect(screen.getByTestId('classified-card-1')).toHaveTextContent('Russian Draughts');
    expect(screen.getByTestId('classified-card-64')).toHaveTextContent('Chess');
  });

  it('18: all cards show board geometry', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    const card1 = screen.getByTestId('classified-card-1');
    expect(card1.textContent).toMatch(/8\u00d78/);
  });

  it('19: all cards show family badge', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    const card1 = screen.getByTestId('classified-card-1');
    expect(card1).toHaveTextContent('Draughts');
  });

  it('20: card testids match game index', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    for (let i = 1; i <= 64; i++) {
      expect(screen.getByTestId(`classified-card-${String(i)}`)).toBeInTheDocument();
    }
  });
});

// ────────────────────────────────────────────────────────────
// 6.4 — GalleryDialogBox
// ────────────────────────────────────────────────────────────

describe('ClassifiedGalleryScreen -- GalleryDialogBox', () => {
  it('21: clicking playable card opens GalleryDialogBox', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    expect(screen.getByTestId('gallery-dialog')).toBeInTheDocument();
  });

  it('22: clicking locked card does nothing', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation({ classifiedUnlocked: false }));
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    expect(screen.queryByTestId('gallery-dialog')).not.toBeInTheDocument();
  });

  it('23: clicking coming-soon card does nothing', async () => {
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 5 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    expect(screen.queryByTestId('gallery-dialog')).not.toBeInTheDocument();
  });

  it('24: dialog shows correct game name as title', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Russian Draughts' })).toBeInTheDocument();
  });

  it('25: dialog shows board geometry info', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByText('Board:')).toBeInTheDocument();
  });

  it('26: dialog shows family info', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByText('Family:')).toBeInTheDocument();
  });

  it('27: dialog shows wave info', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByText('Wave:')).toBeInTheDocument();
  });

  it('28: dialog shows placeholder text for historical context', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    expect(screen.getByText(/Historical context and detailed rules coming/)).toBeInTheDocument();
  });

  it('29: dialog Play button calls onNavigateToDetail', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    const onNavigateToDetail = vi.fn();
    await renderGallery(undefined, onNavigateToDetail);
    fireEvent.click(screen.getByTestId('classified-card-1'));
    fireEvent.click(screen.getByTestId('gallery-play'));
    expect(onNavigateToDetail).toHaveBeenCalledWith(1);
  });

  it('30: dialog Close button closes dialog', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    expect(screen.getByTestId('gallery-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByTestId('gallery-dialog')).not.toBeInTheDocument();
  });

  it('31: Escape key closes dialog', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    expect(screen.getByTestId('gallery-dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('gallery-dialog')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// 6.5 — Dialog Cycling Navigation
// ────────────────────────────────────────────────────────────

describe('ClassifiedGalleryScreen -- dialog cycling navigation', () => {
  it('32: Next button cycles to next playable game in same wave', async () => {
    implementedOverrides = [1, 2];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 2 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Russian Draughts' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next item' }));
    expect(within(dialog).getByRole('heading', { name: 'Brazilian Draughts' })).toBeInTheDocument();
  });

  it('33: Previous button cycles to previous playable game in same wave', async () => {
    implementedOverrides = [1, 2];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 2 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-2'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Brazilian Draughts' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous item' }));
    expect(within(dialog).getByRole('heading', { name: 'Russian Draughts' })).toBeInTheDocument();
  });

  it('34: Next button hidden on last playable game in wave', async () => {
    implementedOverrides = [14];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 14 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-14'));
    expect(screen.queryByRole('button', { name: 'Next item' })).not.toBeInTheDocument();
  });

  it('35: Previous button hidden on first playable game in wave', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    expect(screen.queryByRole('button', { name: 'Previous item' })).not.toBeInTheDocument();
  });

  it('36: cycling does not cross wave boundaries', async () => {
    implementedOverrides = [14, 15];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 15 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-14'));
    expect(screen.queryByRole('button', { name: 'Next item' })).not.toBeInTheDocument();
  });

  it('37: single playable game in wave has no navigation buttons', async () => {
    implementedOverrides = [1];
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 1 }),
    );
    await renderGallery();
    fireEvent.click(screen.getByTestId('classified-card-1'));
    expect(screen.queryByRole('button', { name: 'Next item' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous item' })).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// 6.6 — Edge Cases
// ────────────────────────────────────────────────────────────

describe('ClassifiedGalleryScreen -- edge cases', () => {
  it('38: renders with all games locked when evaluation fails', async () => {
    mockEvaluateUnlocks.mockRejectedValue(new Error('DB error'));
    const backCb = vi.fn();
    const detailCb = vi.fn();
    render(
      <ClassifiedGalleryScreen onBack={backCb} onNavigateToDetail={detailCb} />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('classified-loading')).not.toBeInTheDocument();
    });
    for (let i = 1; i <= 64; i++) {
      expect(screen.getByTestId(`classified-card-${String(i)}`)).toBeDisabled();
    }
    expect(screen.getByTestId('classified-unlock-status')).toHaveTextContent('Classified mode: Locked');
  });

  it('39: renders correctly with master unlock (all unlocked)', async () => {
    mockEvaluateUnlocks.mockResolvedValue(
      makeUnlockEvaluation({ classifiedUnlocked: true, classifiedHardWins: 64, masterUnlockActive: true }),
    );
    await renderGallery();
    expect(screen.getByTestId('classified-unlock-status')).toHaveTextContent('64 / 64 games unlocked');
  });

  it('40: unmounting during load does not cause state update', () => {
    let resolvePromise: (value: UnlockEvaluation) => void = () => {};
    mockEvaluateUnlocks.mockReturnValue(
      new Promise<UnlockEvaluation>((resolve) => { resolvePromise = resolve; }),
    );
    const { unmount } = render(
      <ClassifiedGalleryScreen onBack={vi.fn()} onNavigateToDetail={vi.fn()} />,
    );
    expect(screen.getByTestId('classified-loading')).toBeInTheDocument();
    unmount();
    resolvePromise(makeUnlockEvaluation());
  });

  it('41: wave sections render in correct order (1 through 8)', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    const sections = screen.getAllByRole('region');
    const waveLabels = sections.map((s) => s.getAttribute('aria-label') ?? '');
    expect(waveLabels[0]).toMatch(/Wave 1/);
    expect(waveLabels[1]).toMatch(/Wave 2/);
    expect(waveLabels[2]).toMatch(/Wave 3/);
    expect(waveLabels[3]).toMatch(/Wave 4/);
    expect(waveLabels[4]).toMatch(/Wave 5/);
    expect(waveLabels[5]).toMatch(/Wave 6/);
    expect(waveLabels[6]).toMatch(/Wave 7/);
    expect(waveLabels[7]).toMatch(/Wave 8/);
  });
});

// ────────────────────────────────────────────────────────────
// 6.8 — Integration Tests
// ────────────────────────────────────────────────────────────

describe('ClassifiedGalleryScreen -- integration', () => {
  it('52: gallery integrates with real registry data (64 entries)', () => {
    let total = 0;
    for (let wave = 1; wave <= 8; wave++) {
      total += actualRegistry.getClassifiedByWave(wave).length;
    }
    expect(total).toBe(64);
  });

  it('53: all 64 games have valid wave assignments (1-8)', () => {
    for (let wave = 1; wave <= 8; wave++) {
      const entries = actualRegistry.getClassifiedByWave(wave);
      for (const entry of entries) {
        expect(entry.wave).toBe(wave);
      }
    }
  });

  it('54: all 64 games have non-empty display names', () => {
    for (let wave = 1; wave <= 8; wave++) {
      const entries = actualRegistry.getClassifiedByWave(wave);
      for (const entry of entries) {
        expect(entry.displayName).toBeTruthy();
        expect(entry.displayName.length).toBeGreaterThan(0);
      }
    }
  });

  it('55: getClassifiedByWave returns entries sorted by index', () => {
    for (let wave = 1; wave <= 8; wave++) {
      const entries = actualRegistry.getClassifiedByWave(wave);
      for (let i = 1; i < entries.length; i++) {
        const prev = entries[i - 1];
        const curr = entries[i];
        expect((prev?.classifiedIndex ?? 0) < (curr?.classifiedIndex ?? 0)).toBe(true);
      }
    }
  });
});
