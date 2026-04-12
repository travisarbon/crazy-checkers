import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ChoiceDetailScreen from './ChoiceDetailScreen';
import { CrazyEvent, GameMode } from '../engine/types';
import { CHOICE_MODE_DATA } from '../persistence/choiceModeData';
import { EVENT_DATA_MAP } from '../data/eventData';

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderScreen(
  choiceNumber = 1,
  overrides: Partial<{
    onBack: () => void;
    onStartGame: (...args: unknown[]) => void;
    savedGameExists: boolean;
    onResumeSavedGame: () => void;
  }> = {},
) {
  const defaultProps = {
    choiceNumber,
    onBack: overrides.onBack ?? vi.fn(),
    onStartGame: overrides.onStartGame ?? vi.fn(),
    defaultTimeControl: null,
    savedGameExists: overrides.savedGameExists ?? false,
    onResumeSavedGame: overrides.onResumeSavedGame,
  };
  return {
    onBack: defaultProps.onBack,
    onStartGame: defaultProps.onStartGame,
    ...render(<ChoiceDetailScreen {...defaultProps} />),
  };
}

// ===========================================================================
// 6.2 — Rendering and Layout
// ===========================================================================

describe('ChoiceDetailScreen — Rendering and Layout', () => {
  it('renders with ModeScreenShell and mode name as title', () => {
    renderScreen(1);
    expect(screen.getByRole('heading', { name: 'Revolution' })).toBeInTheDocument();
  });

  it('renders board preview visualization', () => {
    const { container } = renderScreen(1);
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toBeInTheDocument();
  });

  it('renders mode description as board caption', () => {
    renderScreen(1);
    const modeData = CHOICE_MODE_DATA.find((m) => m.choiceNumber === 1);
    expect(modeData).toBeDefined();
    expect(screen.getByText(modeData?.description ?? '')).toBeInTheDocument();
  });

  it('renders GameSetupSection', () => {
    renderScreen(1);
    expect(screen.getByTestId('game-setup-section')).toBeInTheDocument();
  });

  it('renders How to Play section with choice mode description', () => {
    renderScreen(1);
    const eventData = EVENT_DATA_MAP.get(CrazyEvent.KingForADay);
    expect(eventData).toBeDefined();
    expect(screen.getByText(eventData?.choiceModeDescription ?? '')).toBeInTheDocument();
  });

  it('back button calls onBack', () => {
    const onBack = vi.fn();
    renderScreen(1, { onBack });
    fireEvent.click(screen.getByRole('button', { name: /back to previous screen/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('renders with correct testid', () => {
    renderScreen(1);
    expect(screen.getByTestId('choice-detail-screen')).toBeInTheDocument();
  });
});

// ===========================================================================
// 6.3 — Crazy Event Relationship Callout
// ===========================================================================

describe('ChoiceDetailScreen — Event Relationship Callout', () => {
  it('shows Related Crazy Event callout for event-based modes', () => {
    renderScreen(1);
    expect(screen.getByText('Related Crazy Event')).toBeInTheDocument();
  });

  it('callout shows correct event name', () => {
    renderScreen(1);
    expect(screen.getByText('King for a Day')).toBeInTheDocument();
  });

  it('callout shows permanent vs temporary comparison', () => {
    renderScreen(1);
    expect(screen.getByText(/permanent and always active/)).toBeInTheDocument();
  });

  it('callout shows event duration text', () => {
    renderScreen(2);
    // Live Grenade has remainingPlies = -1 (condition-based)
    expect(screen.getByText(/lasts until a condition is met/)).toBeInTheDocument();
  });

  it('shows Related Mechanic callout for Extra Crazy (mode 8)', () => {
    renderScreen(8);
    expect(screen.getByText('Related Mechanic')).toBeInTheDocument();
    expect(screen.getByText(/triggers a random event on every jump/)).toBeInTheDocument();
  });

  it('Extra Crazy callout does not show Related Crazy Event label', () => {
    renderScreen(8);
    expect(screen.queryByText('Related Crazy Event')).not.toBeInTheDocument();
  });
});

// ===========================================================================
// 6.4 — Game Start Flow
// ===========================================================================

describe('ChoiceDetailScreen — Game Start Flow', () => {
  it('Start Game button calls onStartGame with correct permanent event', () => {
    const onStartGame = vi.fn();
    renderScreen(1, { onStartGame });
    fireEvent.click(screen.getByTestId('start-game-button'));
    // 5th argument should be the permanent event
    expect(onStartGame).toHaveBeenCalledWith(
      expect.anything(), // players
      expect.anything(), // flipped
      GameMode.Choice,   // mode
      null,              // timeControl
      CrazyEvent.KingForADay, // permanentEvent
    );
  });

  it('Start Game passes GameMode.Choice as mode', () => {
    const onStartGame = vi.fn();
    renderScreen(1, { onStartGame });
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledOnce();
    const callArgs = onStartGame.mock.calls[0] as unknown[];
    expect(callArgs[2]).toBe(GameMode.Choice);
  });

  it('Start Game for Extra Crazy passes null as permanent event', () => {
    const onStartGame = vi.fn();
    renderScreen(8, { onStartGame });
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledOnce();
    const callArgs = onStartGame.mock.calls[0] as unknown[];
    expect(callArgs[4]).toBeNull();
  });

  it('game type selection works (vs CPU)', () => {
    const onStartGame = vi.fn();
    renderScreen(1, { onStartGame });
    // Select vs CPU
    fireEvent.click(screen.getByLabelText(/vs\. CPU/i));
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(onStartGame).toHaveBeenCalledOnce();
    // CPU player should be in the players object
    const callArgs = onStartGame.mock.calls[0] as unknown[];
    const players = callArgs[0] as { white: string; black: string };
    expect(players.black).toMatch(/CPU/);
  });

  it('color selection works', () => {
    const onStartGame = vi.fn();
    renderScreen(1, { onStartGame });
    // Select Black
    fireEvent.click(screen.getByLabelText(/^Black$/));
    fireEvent.click(screen.getByTestId('start-game-button'));
    const callArgs = onStartGame.mock.calls[0] as unknown[];
    const flipped = callArgs[1] as boolean;
    expect(flipped).toBe(true);
  });

  it('difficulty selection works', () => {
    const onStartGame = vi.fn();
    renderScreen(1, { onStartGame });
    // Select vs CPU, then Hard
    fireEvent.click(screen.getByLabelText(/vs\. CPU/i));
    fireEvent.click(screen.getByLabelText(/^Hard$/));
    fireEvent.click(screen.getByTestId('start-game-button'));
    const callArgs = onStartGame.mock.calls[0] as unknown[];
    const players = callArgs[0] as { white: string; black: string };
    expect(players.black).toBe('CPU_HARD');
  });
});

// ===========================================================================
// 6.5 — Expanded Detail Panel
// ===========================================================================

describe('ChoiceDetailScreen — Expanded Detail Panel', () => {
  it('renders ExpandableDetailPanel with correct title', () => {
    renderScreen(1);
    expect(screen.getByRole('button', { name: /Strategy & Rules Detail/i })).toBeInTheDocument();
  });

  it('expanded panel shows detailed mechanics', () => {
    renderScreen(1);
    fireEvent.click(screen.getByRole('button', { name: /Strategy & Rules Detail/i }));
    const eventData = EVENT_DATA_MAP.get(CrazyEvent.KingForADay);
    expect(eventData).toBeDefined();
    expect(screen.getByText(eventData?.mechanicalEffect ?? '')).toBeInTheDocument();
  });

  it('expanded panel shows stacking notes', () => {
    renderScreen(1);
    fireEvent.click(screen.getByRole('button', { name: /Strategy & Rules Detail/i }));
    const eventData = EVENT_DATA_MAP.get(CrazyEvent.KingForADay);
    expect(eventData).toBeDefined();
    const firstNote = eventData?.stackingNotes[0] ?? '';
    expect(screen.getByText(firstNote)).toBeInTheDocument();
  });

  it('Extra Crazy expanded panel shows special content', () => {
    renderScreen(8);
    fireEvent.click(screen.getByRole('button', { name: /Strategy & Rules Detail/i }));
    expect(screen.getByText('How Extra Crazy Works')).toBeInTheDocument();
  });

  it('panel starts collapsed by default', () => {
    renderScreen(1);
    const toggleButton = screen.getByRole('button', { name: /Strategy & Rules Detail/i });
    expect(toggleButton.getAttribute('aria-expanded')).toBe('false');
  });
});

// ===========================================================================
// 6.6 — Edge Cases
// ===========================================================================

describe('ChoiceDetailScreen — Edge Cases', () => {
  it('renders fallback for invalid choiceNumber (0)', () => {
    renderScreen(0);
    expect(screen.getByText(/Mode not found/)).toBeInTheDocument();
  });

  it('renders fallback for invalid choiceNumber (41)', () => {
    renderScreen(41);
    expect(screen.getByText(/Mode not found/)).toBeInTheDocument();
  });

  it('renders fallback for NaN choiceNumber', () => {
    renderScreen(NaN);
    expect(screen.getByText(/Mode not found/)).toBeInTheDocument();
  });

  it('renders correctly for all 40 mode numbers', () => {
    for (let i = 1; i <= 40; i++) {
      const modeData = CHOICE_MODE_DATA.find((m) => m.choiceNumber === i);
      expect(modeData).toBeDefined();
      const { unmount } = renderScreen(i);
      expect(screen.getByRole('heading', { name: modeData?.displayName })).toBeInTheDocument();
      unmount();
    }
  });

  it('saved game resume button appears when savedGameExists=true', () => {
    renderScreen(1, { savedGameExists: true, onResumeSavedGame: vi.fn() });
    expect(screen.getByTestId('resume-game-button')).toBeInTheDocument();
  });

  it('saved game resume button absent when savedGameExists=false', () => {
    renderScreen(1, { savedGameExists: false });
    expect(screen.queryByTestId('resume-game-button')).not.toBeInTheDocument();
  });

  it('resume button calls onResumeSavedGame', () => {
    const onResumeSavedGame = vi.fn();
    renderScreen(1, { savedGameExists: true, onResumeSavedGame });
    fireEvent.click(screen.getByTestId('resume-game-button'));
    expect(onResumeSavedGame).toHaveBeenCalledOnce();
  });

  it('highlight squares applied for Sanctuary (mode 12)', () => {
    const { container } = renderScreen(12);
    // Sanctuary highlights near-corner squares: 1, 4, 29, 32
    expect(container.querySelector('[data-testid="highlight-1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="highlight-4"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="highlight-29"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="highlight-32"]')).toBeInTheDocument();
  });

  it('no highlight squares for standard modes', () => {
    const { container } = renderScreen(1);
    // No highlight-* test IDs should be present
    const highlights = container.querySelectorAll('[data-testid^="highlight-"]');
    expect(highlights).toHaveLength(0);
  });
});

// ===========================================================================
// 6.7 — Multiple Modes Spot Check
// ===========================================================================

describe('ChoiceDetailScreen — Multiple Modes Spot Check', () => {
  it('Revolution (mode 1) renders King for a Day event info', () => {
    renderScreen(1);
    expect(screen.getByRole('heading', { name: 'Revolution' })).toBeInTheDocument();
    expect(screen.getByText('King for a Day')).toBeInTheDocument();
  });

  it('Boom Box (mode 2) renders Live Grenade event info', () => {
    renderScreen(2);
    expect(screen.getByRole('heading', { name: 'Boom Box' })).toBeInTheDocument();
    expect(screen.getByText('Live Grenade')).toBeInTheDocument();
  });

  it('Mirror World (mode 5) renders Opposite Day event info', () => {
    renderScreen(5);
    expect(screen.getByRole('heading', { name: 'Mirror World' })).toBeInTheDocument();
    expect(screen.getByText('Opposite Day')).toBeInTheDocument();
  });

  it('Moonwalk (mode 9) renders Step-Back event info', () => {
    renderScreen(9);
    expect(screen.getByRole('heading', { name: 'Moonwalk' })).toBeInTheDocument();
    expect(screen.getByText('Step-Back')).toBeInTheDocument();
  });

  it('Rank and File (mode 40) renders Marching Orders event info', () => {
    renderScreen(40);
    expect(screen.getByRole('heading', { name: 'Rank and File' })).toBeInTheDocument();
    expect(screen.getByText('Marching Orders')).toBeInTheDocument();
  });
});

// ===========================================================================
// 6.8 — Integration Tests
// ===========================================================================

describe('ChoiceDetailScreen — Integration Tests', () => {
  it('all 40 CHOICE_MODE_DATA entries have valid event or null', () => {
    const validEvents = new Set(Object.values(CrazyEvent));
    for (const mode of CHOICE_MODE_DATA) {
      if (mode.event !== null) {
        expect(validEvents.has(mode.event)).toBe(true);
      }
    }
    expect(CHOICE_MODE_DATA).toHaveLength(40);
  });

  it('all 39 event-based modes have corresponding EVENT_DATA_MAP entries', () => {
    const eventModes = CHOICE_MODE_DATA.filter((m) => m.event !== null);
    expect(eventModes).toHaveLength(39);
    for (const mode of eventModes) {
      if (mode.event !== null) {
        expect(EVENT_DATA_MAP.get(mode.event)).toBeDefined();
      }
    }
  });

  it('all 40 modes can be rendered without errors', () => {
    for (let i = 1; i <= 40; i++) {
      const { unmount } = renderScreen(i);
      expect(screen.getByTestId('choice-detail-screen')).toBeInTheDocument();
      unmount();
    }
  });
});
