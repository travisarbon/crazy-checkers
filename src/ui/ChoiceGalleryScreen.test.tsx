import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ChoiceGalleryScreen from './ChoiceGalleryScreen';
import type {
  UnlockEvaluation,
  ChoiceModeUnlockStatus,
  TrackUnlockResult,
  ChaosGateStatus,
} from '../persistence/unlockEvaluator';
import type { UnlockSnapshot } from '../persistence/unlockState';
import type { TrackId } from '../persistence/gameModeRegistry';
import { CHOICE_MODE_DATA } from '../persistence/choiceModeData';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../persistence/unlockEvaluator', () => ({
  evaluateFullUnlocks: vi.fn(),
}));

import { evaluateFullUnlocks } from '../persistence/unlockEvaluator';

const mockEvaluateUnlocks = vi.mocked(evaluateFullUnlocks);

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

function makeChoiceModeStatus(
  choiceNumber: number,
  trackId: TrackId,
  unlocked = false,
): ChoiceModeUnlockStatus {
  return {
    choiceNumber,
    registryId: `choice-${String(choiceNumber)}`,
    displayName: `Mode ${String(choiceNumber)}`,
    trackId,
    unlockedByProgression: unlocked,
    unlockedByCode: false,
    unlocked,
  };
}

function makeDefaultChoiceModes(
  unlockedNumbers: number[] = [],
): Map<number, ChoiceModeUnlockStatus> {
  const trackRanges: { trackId: TrackId; base: number }[] = [
    { trackId: 'puzzle-mastery', base: 1 },
    { trackId: 'chaos-veteran', base: 9 },
    { trackId: 'rule-bender', base: 17 },
    { trackId: 'lifer', base: 25 },
    { trackId: 'world-player', base: 33 },
  ];
  const modes = new Map<number, ChoiceModeUnlockStatus>();
  for (const { trackId, base } of trackRanges) {
    for (let i = 0; i < 8; i++) {
      const num = base + i;
      modes.set(num, makeChoiceModeStatus(num, trackId, unlockedNumbers.includes(num)));
    }
  }
  return modes;
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

function makeChaosGateStatus(): ChaosGateStatus {
  return {
    unlocked: false,
    unlockedByCode: false,
    gates: {
      challengesCompleted: { current: 0, required: 100, met: false },
      choiceModesUnlocked: { current: 0, required: 40, met: false },
      classifiedUnlocked: { met: false },
      classifiedHardWins: { current: 0, required: 64, met: false },
    },
  };
}

function makeDefaultSnapshot(): UnlockSnapshot {
  return {
    choiceUnlocked: false,
    classifiedUnlocked: false,
    chaosUnlocked: false,
  };
}

function makeUnlockEvaluation(
  unlockedNumbers: number[] = [],
): UnlockEvaluation {
  return {
    snapshot: makeDefaultSnapshot(),
    choiceModes: makeDefaultChoiceModes(unlockedNumbers),
    tracks: [
      makeTrackUnlockResult('puzzle-mastery', 'Puzzle Mastery', [1, 15, 29, 43, 57, 71, 85, 99]),
      makeTrackUnlockResult('chaos-veteran', 'Chaos Veteran', [1, 3, 6, 10, 15, 21, 28, 36]),
      makeTrackUnlockResult('rule-bender', 'Rule Bender', [1, 4, 8, 13, 19, 26, 34, 43]),
      makeTrackUnlockResult('lifer', 'Lifer', [1, 2, 3, 4, 5, 6, 7, 8]),
      makeTrackUnlockResult('world-player', 'World Player', [1, 5, 10, 20, 30, 40, 50, 64]),
    ],
    chaosGate: makeChaosGateStatus(),
    masterUnlockActive: false,
    totalChoiceModesUnlocked: unlockedNumbers.length,
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
    <ChoiceGalleryScreen onBack={backCb} onNavigateToDetail={detailCb} />,
  );
  await waitFor(() => {
    expect(screen.queryByTestId('choice-loading')).not.toBeInTheDocument();
  });
  return { onBack: backCb, onNavigateToDetail: detailCb, ...result };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

// ────────────────────────────────────────────────────────────
// 6.1 — Rendering and Layout
// ────────────────────────────────────────────────────────────

describe('ChoiceGalleryScreen -- rendering and layout', () => {
  it('1: renders with ModeScreenShell and correct title', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    expect(screen.getByRole('heading', { name: 'Choice' })).toBeInTheDocument();
  });

  it('2: shows loading state initially', () => {
    mockEvaluateUnlocks.mockReturnValue(new Promise(() => {}));
    render(
      <ChoiceGalleryScreen onBack={vi.fn()} onNavigateToDetail={vi.fn()} />,
    );
    expect(screen.getByTestId('choice-loading')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('3: renders only unlocked gallery cards after loading', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 2, 3]));
    await renderGallery();
    expect(screen.getByTestId('choice-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('choice-card-2')).toBeInTheDocument();
    expect(screen.getByTestId('choice-card-3')).toBeInTheDocument();
    expect(screen.queryByTestId('choice-card-4')).not.toBeInTheDocument();
    expect(screen.queryByTestId('choice-card-40')).not.toBeInTheDocument();
  });

  it('4: back button calls onBack', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    const onBack = vi.fn();
    await renderGallery(onBack);
    const backButton = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backButton);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('5: renders intro text explaining Choice mode', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation());
    await renderGallery();
    expect(screen.getByText(/permanent rule/)).toBeInTheDocument();
  });

  it('6: shows unlock summary with correct count', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 2, 3, 4, 5]));
    await renderGallery();
    expect(screen.getByTestId('unlock-summary')).toHaveTextContent('5 / 40 modes unlocked');
  });
});

// ────────────────────────────────────────────────────────────
// 6.2 — Locked/Unlocked Card States
// ────────────────────────────────────────────────────────────

describe('ChoiceGalleryScreen -- locked cards are hidden', () => {
  it('7: locked cards are not rendered at all', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    for (let i = 2; i <= 40; i++) {
      expect(screen.queryByTestId(`choice-card-${String(i)}`)).not.toBeInTheDocument();
    }
  });

  it('8: no lock icon or unlock hint is shown in the gallery', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    expect(screen.queryByText('\uD83D\uDD12')).not.toBeInTheDocument();
    expect(screen.queryByText('Complete 1 challenge')).not.toBeInTheDocument();
  });

  it('9: empty-state hint appears when nothing is unlocked', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([]));
    await renderGallery();
    expect(screen.getByTestId('choice-empty')).toBeInTheDocument();
  });

  it('10: unlocked cards are interactive (not disabled)', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    const card1 = screen.getByTestId('choice-card-1');
    expect(card1).not.toBeDisabled();
  });

  it('11: unlocked cards show description', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    const card1 = screen.getByTestId('choice-card-1');
    const modeData = CHOICE_MODE_DATA[0];
    expect(card1).toHaveTextContent(modeData?.description ?? '');
  });

  it('12: unlocked cards have correct aria-label with description', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    const card1 = screen.getByTestId('choice-card-1');
    const modeData = CHOICE_MODE_DATA[0];
    expect(card1.getAttribute('aria-label')).toContain('Revolution');
    expect(card1.getAttribute('aria-label')).toContain(modeData?.description ?? '');
  });

  it('13: unlocked cards show mode name, number, and track badge', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 9, 17, 25, 33]));
    await renderGallery();
    expect(screen.getByTestId('choice-card-1')).toHaveTextContent('Revolution');
    expect(screen.getByTestId('choice-card-1')).toHaveTextContent('#1');
    expect(screen.getByTestId('choice-card-1')).toHaveTextContent('PM');
    expect(screen.getByTestId('choice-card-9')).toHaveTextContent('CV');
    expect(screen.getByTestId('choice-card-17')).toHaveTextContent('RB');
    expect(screen.getByTestId('choice-card-25')).toHaveTextContent('L');
    expect(screen.getByTestId('choice-card-33')).toHaveTextContent('WP');
  });

  it('17: partially unlocked gallery shows only unlocked cards', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 2, 3]));
    await renderGallery();
    expect(screen.getByTestId('choice-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('choice-card-2')).toBeInTheDocument();
    expect(screen.getByTestId('choice-card-3')).toBeInTheDocument();
    expect(screen.queryByTestId('choice-card-4')).not.toBeInTheDocument();
    expect(screen.queryByTestId('choice-card-40')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// 6.3 — GalleryDialogBox
// ────────────────────────────────────────────────────────────

describe('ChoiceGalleryScreen -- GalleryDialogBox', () => {
  it('18: clicking unlocked card opens GalleryDialogBox', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    expect(screen.getByTestId('gallery-dialog')).toBeInTheDocument();
  });

  it('19: locked cards are not present so cannot be clicked', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    expect(screen.queryByTestId('choice-card-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('gallery-dialog')).not.toBeInTheDocument();
  });

  it('20: dialog shows correct mode name as title', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Revolution' })).toBeInTheDocument();
  });

  it('21: dialog shows board preview visualization', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    // BoardPreviewLarge renders an SVG
    expect(dialog.querySelector('svg')).not.toBeNull();
  });

  it('22: dialog shows mode description', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    const modeData = CHOICE_MODE_DATA[0];
    expect(within(dialog).getByText(modeData?.description ?? '')).toBeInTheDocument();
  });

  it('23: dialog shows Related Crazy Event callout', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    expect(screen.getByText('Related Crazy Event')).toBeInTheDocument();
    expect(screen.getByText('King for a Day')).toBeInTheDocument();
  });

  it('24: dialog shows special callout for Extra Crazy (mode 8)', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([8]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-8'));
    expect(screen.getByText('Related Mechanic')).toBeInTheDocument();
    expect(screen.getByText(/triggers a random event on every jump/)).toBeInTheDocument();
  });

  it('25: dialog Play button calls onNavigateToDetail with correct choiceNumber', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    const onNavigateToDetail = vi.fn();
    await renderGallery(undefined, onNavigateToDetail);
    fireEvent.click(screen.getByTestId('choice-card-1'));
    fireEvent.click(screen.getByTestId('gallery-play'));
    expect(onNavigateToDetail).toHaveBeenCalledWith(1);
  });

  it('26: dialog Close button closes dialog', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    expect(screen.getByTestId('gallery-dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByTestId('gallery-dialog')).not.toBeInTheDocument();
  });

  it('27: Escape key closes dialog', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    expect(screen.getByTestId('gallery-dialog')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('gallery-dialog')).not.toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// 6.4 — Dialog Cycling Navigation
// ────────────────────────────────────────────────────────────

describe('ChoiceGalleryScreen -- dialog cycling navigation', () => {
  it('28: Next button cycles to next unlocked mode', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 3]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Revolution' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next item' }));
    expect(within(dialog).getByRole('heading', { name: 'Imposter' })).toBeInTheDocument();
  });

  it('29: Previous button cycles to previous unlocked mode', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 3]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-3'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Imposter' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous item' }));
    expect(within(dialog).getByRole('heading', { name: 'Revolution' })).toBeInTheDocument();
  });

  it('30: Next button hidden on last unlocked mode', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 3]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-3'));
    expect(screen.queryByRole('button', { name: 'Next item' })).not.toBeInTheDocument();
  });

  it('31: Previous button hidden on first unlocked mode', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 3]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    expect(screen.queryByRole('button', { name: 'Previous item' })).not.toBeInTheDocument();
  });

  it('32: cycling skips locked modes', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 5, 9]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Revolution' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next item' }));
    // Mode 5 = Mirror World (skipping locked modes 2-4)
    expect(within(dialog).getByRole('heading', { name: 'Mirror World' })).toBeInTheDocument();
  });

  it('33: single unlocked mode has no navigation buttons', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    expect(screen.queryByRole('button', { name: 'Next item' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous item' })).not.toBeInTheDocument();
  });

  it('34: ArrowRight key cycles forward', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 2]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-1'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Revolution' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(within(dialog).getByRole('heading', { name: 'Boom Box' })).toBeInTheDocument();
  });

  it('35: ArrowLeft key cycles backward', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1, 2]));
    await renderGallery();
    fireEvent.click(screen.getByTestId('choice-card-2'));
    const dialog = screen.getByTestId('gallery-dialog');
    expect(within(dialog).getByRole('heading', { name: 'Boom Box' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(within(dialog).getByRole('heading', { name: 'Revolution' })).toBeInTheDocument();
  });
});

// ────────────────────────────────────────────────────────────
// 6.5 — Edge Cases
// ────────────────────────────────────────────────────────────

describe('ChoiceGalleryScreen -- edge cases', () => {
  it('36: renders empty state when evaluation fails', async () => {
    mockEvaluateUnlocks.mockRejectedValue(new Error('DB error'));
    const backCb = vi.fn();
    const detailCb = vi.fn();
    render(
      <ChoiceGalleryScreen onBack={backCb} onNavigateToDetail={detailCb} />,
    );
    await waitFor(() => {
      expect(screen.queryByTestId('choice-loading')).not.toBeInTheDocument();
    });
    // No cards should be rendered
    for (let i = 1; i <= 40; i++) {
      expect(screen.queryByTestId(`choice-card-${String(i)}`)).not.toBeInTheDocument();
    }
    expect(screen.getByTestId('choice-empty')).toBeInTheDocument();
    expect(screen.getByTestId('unlock-summary')).toHaveTextContent('0 / 40 modes unlocked');
  });

  it('37: renders with all modes unlocked', async () => {
    const allNumbers = Array.from({ length: 40 }, (_, i) => i + 1);
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation(allNumbers));
    await renderGallery();
    for (let i = 1; i <= 40; i++) {
      expect(screen.getByTestId(`choice-card-${String(i)}`)).not.toBeDisabled();
    }
    expect(screen.getByTestId('unlock-summary')).toHaveTextContent('40 / 40 modes unlocked');
  });

  it('38: only unlocked cards are tabbable', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    const card1 = screen.getByTestId('choice-card-1');
    expect(card1).not.toBeDisabled();
    expect(screen.queryByTestId('choice-card-2')).not.toBeInTheDocument();
  });

  it('40: unmounting during load does not cause state update', () => {
    // Create a promise that won't resolve during the test
    let resolvePromise: (value: UnlockEvaluation) => void = () => {};
    mockEvaluateUnlocks.mockReturnValue(
      new Promise<UnlockEvaluation>((resolve) => { resolvePromise = resolve; }),
    );
    const { unmount } = render(
      <ChoiceGalleryScreen onBack={vi.fn()} onNavigateToDetail={vi.fn()} />,
    );
    expect(screen.getByTestId('choice-loading')).toBeInTheDocument();
    // Unmount while still loading
    unmount();
    // Resolve after unmount -- should not cause warnings
    resolvePromise(makeUnlockEvaluation());
    // If no console error about unmounted state update, test passes
  });
});

// ────────────────────────────────────────────────────────────
// 6.6 — Integration Tests
// ────────────────────────────────────────────────────────────

describe('ChoiceGalleryScreen -- integration', () => {
  it('41: gallery integrates with CHOICE_MODE_DATA (40 entries)', () => {
    expect(CHOICE_MODE_DATA).toHaveLength(40);
    const numbers = new Set(CHOICE_MODE_DATA.map((m) => m.choiceNumber));
    expect(numbers.size).toBe(40);
  });

  it('42: all 40 modes have valid track assignments', () => {
    const validTracks = new Set(['puzzle-mastery', 'chaos-veteran', 'rule-bender', 'lifer', 'world-player']);
    for (const mode of CHOICE_MODE_DATA) {
      expect(validTracks.has(mode.track)).toBe(true);
    }
  });

  it('43: card rendering matches CHOICE_MODE_DATA display names', async () => {
    mockEvaluateUnlocks.mockResolvedValue(makeUnlockEvaluation([1]));
    await renderGallery();
    const card1 = screen.getByTestId('choice-card-1');
    const modeData = CHOICE_MODE_DATA[0];
    expect(card1).toHaveTextContent(modeData?.displayName ?? '');
  });
});
