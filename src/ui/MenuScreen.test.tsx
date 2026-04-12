import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { UnlockSnapshot } from '../persistence/unlockState';
import MenuScreen from './MenuScreen';

// Mock matchMedia for reduced-motion fallback
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const ALL_LOCKED: UnlockSnapshot = {
  choiceUnlocked: false,
  classifiedUnlocked: false,
  chaosUnlocked: false,
};

const ALL_UNLOCKED: UnlockSnapshot = {
  choiceUnlocked: true,
  classifiedUnlocked: true,
  chaosUnlocked: true,
};

const NO_NEW = { choice: false, classified: false, chaos: false };

function renderMenu(
  overrides?: Partial<{
    onConfigure: () => void;
    onNavigate: (kind: string) => void;
    unlockSnapshot: UnlockSnapshot;
    newlyUnlocked: { choice: boolean; classified: boolean; chaos: boolean };
    onUnlockAnimationEnd: (mode: 'choice' | 'classified' | 'chaos') => void;
    chaosUnlocked: boolean;
  }>,
) {
  const onConfigure = overrides?.onConfigure ?? vi.fn();
  const onNavigate = overrides?.onNavigate ?? vi.fn();
  const onUnlockAnimationEnd = overrides?.onUnlockAnimationEnd ?? vi.fn();
  return {
    onConfigure,
    onNavigate,
    onUnlockAnimationEnd,
    ...render(
      <MenuScreen
        onConfigure={onConfigure}
        onNavigate={onNavigate}
        unlockSnapshot={overrides?.unlockSnapshot ?? ALL_LOCKED}
        newlyUnlocked={overrides?.newlyUnlocked ?? NO_NEW}
        onUnlockAnimationEnd={onUnlockAnimationEnd}
        chaosUnlocked={overrides?.chaosUnlocked ?? false}
      />,
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MenuScreen', () => {
  it('renders game title', () => {
    renderMenu();
    expect(screen.getByText('Crazy Checkers')).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    renderMenu();
    expect(screen.getByText('A chaotic twist on a timeless classic')).toBeInTheDocument();
  });

  it('renders only 7 always-visible mode buttons when all locked', () => {
    renderMenu();
    const nav = screen.getByRole('navigation', { name: /game modes/i });
    const buttons = nav.querySelectorAll('button');
    expect(buttons).toHaveLength(7);
  });

  it('renders all 10 mode buttons when all unlocked', () => {
    renderMenu({ unlockSnapshot: ALL_UNLOCKED });
    const nav = screen.getByRole('navigation', { name: /game modes/i });
    const buttons = nav.querySelectorAll('button');
    expect(buttons).toHaveLength(10);
  });

  it('Choice unlocked → 8 buttons', () => {
    renderMenu({
      unlockSnapshot: { choiceUnlocked: true, classifiedUnlocked: false, chaosUnlocked: false },
    });
    const nav = screen.getByRole('navigation', { name: /game modes/i });
    const buttons = nav.querySelectorAll('button');
    expect(buttons).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Choice' })).toBeInTheDocument();
  });

  it('Classified unlocked → 8 buttons', () => {
    renderMenu({
      unlockSnapshot: { choiceUnlocked: false, classifiedUnlocked: true, chaosUnlocked: false },
    });
    const nav = screen.getByRole('navigation', { name: /game modes/i });
    const buttons = nav.querySelectorAll('button');
    expect(buttons).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Classified' })).toBeInTheDocument();
  });

  it('Chaos unlocked shows all 10 buttons when all gates met', () => {
    renderMenu({ unlockSnapshot: ALL_UNLOCKED });
    const nav = screen.getByRole('navigation', { name: /game modes/i });
    const buttons = nav.querySelectorAll('button');
    expect(buttons).toHaveLength(10);
  });

  it('Classic button is enabled', () => {
    renderMenu();
    const btn = screen.getByRole('button', { name: 'Classic' });
    expect(btn).not.toBeDisabled();
  });

  it('Configure button is enabled', () => {
    renderMenu();
    const btn = screen.getByRole('button', { name: 'Configure' });
    expect(btn).not.toBeDisabled();
  });

  it('Crazy button is enabled', () => {
    renderMenu();
    const btn = screen.getByRole('button', { name: 'Crazy' });
    expect(btn).not.toBeDisabled();
  });

  it('clicking Classic calls onNavigate with classic', () => {
    const onNavigate = vi.fn();
    renderMenu({ onNavigate });
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    expect(onNavigate).toHaveBeenCalledWith('classic');
  });

  it('clicking Crazy calls onNavigate with crazy', () => {
    const onNavigate = vi.fn();
    renderMenu({ onNavigate });
    fireEvent.click(screen.getByRole('button', { name: 'Crazy' }));
    expect(onNavigate).toHaveBeenCalledWith('crazy');
  });

  it('clicking Challenge calls onNavigate with challenge', () => {
    const onNavigate = vi.fn();
    renderMenu({ onNavigate });
    fireEvent.click(screen.getByRole('button', { name: 'Challenge' }));
    expect(onNavigate).toHaveBeenCalledWith('challenge');
  });

  it('clicking Configure calls onConfigure', () => {
    const onConfigure = vi.fn();
    renderMenu({ onConfigure });
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(onConfigure).toHaveBeenCalledOnce();
  });

  it('hidden modes are not rendered when locked', () => {
    renderMenu();
    expect(screen.queryByRole('button', { name: 'Choice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Classified' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chaos' })).not.toBeInTheDocument();
  });

  it('GameSetupDialog is not rendered when clicking Classic', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    expect(screen.queryByTestId('game-setup-dialog')).not.toBeInTheDocument();
  });

  // --- Progressive reveal tests ---

  it('newly unlocked Choice has unlockReveal class', () => {
    renderMenu({
      unlockSnapshot: { choiceUnlocked: true, classifiedUnlocked: false, chaosUnlocked: false },
      newlyUnlocked: { choice: true, classified: false, chaos: false },
    });
    const btn = screen.getByRole('button', { name: 'Choice' });
    expect(btn.className).toContain('unlockReveal');
  });

  it('non-newly-unlocked modes do not have unlockReveal class', () => {
    renderMenu({
      unlockSnapshot: { choiceUnlocked: true, classifiedUnlocked: false, chaosUnlocked: false },
      newlyUnlocked: { choice: false, classified: false, chaos: false },
    });
    const btn = screen.getByRole('button', { name: 'Choice' });
    expect(btn.className).not.toContain('unlockReveal');
  });

  it('reduced-motion fallback calls onUnlockAnimationEnd for newly unlocked mode', () => {
    // Mock prefers-reduced-motion: reduce so the useEffect fallback fires
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const onUnlockAnimationEnd = vi.fn();
    renderMenu({
      unlockSnapshot: { choiceUnlocked: true, classifiedUnlocked: false, chaosUnlocked: false },
      newlyUnlocked: { choice: true, classified: false, chaos: false },
      onUnlockAnimationEnd,
    });
    expect(onUnlockAnimationEnd).toHaveBeenCalledWith('choice');

    // Restore default mock
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  it('title shows "Chaos Checkers" when chaosUnlocked is true', () => {
    renderMenu({ unlockSnapshot: ALL_UNLOCKED, chaosUnlocked: true });
    expect(screen.getByText('Chaos Checkers')).toBeInTheDocument();
    expect(screen.queryByText('Crazy Checkers')).not.toBeInTheDocument();
  });

  it('title shows "Crazy Checkers" when chaosUnlocked is false', () => {
    renderMenu({ chaosUnlocked: false });
    expect(screen.getByText('Crazy Checkers')).toBeInTheDocument();
    expect(screen.queryByText('Chaos Checkers')).not.toBeInTheDocument();
  });

  it('Task 22.2: title reverts to "Crazy Checkers" when chaosUnlocked changes true → false', () => {
    const { rerender } = renderMenu({
      unlockSnapshot: ALL_UNLOCKED,
      chaosUnlocked: true,
    });
    expect(screen.getByText('Chaos Checkers')).toBeInTheDocument();

    rerender(
      <MenuScreen
        onConfigure={vi.fn()}
        onNavigate={vi.fn()}
        unlockSnapshot={ALL_LOCKED}
        newlyUnlocked={NO_NEW}
        onUnlockAnimationEnd={vi.fn()}
        chaosUnlocked={false}
      />,
    );
    expect(screen.getByText('Crazy Checkers')).toBeInTheDocument();
    expect(screen.queryByText('Chaos Checkers')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chaos' })).not.toBeInTheDocument();
  });

  it('Task 22.2: screen reader announcement includes title change text when Chaos newly unlocked', () => {
    renderMenu({
      unlockSnapshot: ALL_UNLOCKED,
      chaosUnlocked: true,
      newlyUnlocked: { choice: false, classified: false, chaos: true },
    });
    expect(
      screen.getByText(/Chaos mode unlocked!.*Chaos Checkers/i),
    ).toBeInTheDocument();
  });

  it('unlocked hidden modes are navigable via onNavigate', () => {
    const onNavigate = vi.fn();
    renderMenu({
      onNavigate,
      unlockSnapshot: ALL_UNLOCKED,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Choice' }));
    expect(onNavigate).toHaveBeenCalledWith('choice');
  });

  it('all visible mode buttons are focusable', () => {
    renderMenu({ unlockSnapshot: ALL_UNLOCKED });
    const nav = screen.getByRole('navigation', { name: /game modes/i });
    const buttons = nav.querySelectorAll('button');
    buttons.forEach((btn) => {
      expect(btn).not.toBeDisabled();
    });
  });
});
