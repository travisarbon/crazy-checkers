import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';
import { DEFAULT_SETTINGS } from './settings';

// Mock the AI worker to prevent real worker initialization
vi.mock('../ai/workerClient', () => ({
  requestAIMove: vi.fn(() => new Promise(() => {})),
}));

// Mock the unlock evaluator to prevent async side effects in tests
vi.mock('../persistence/unlockEvaluator', () => ({
  evaluateUnlocks: vi.fn(() =>
    Promise.resolve({
      choiceUnlocked: false,
      classifiedUnlocked: false,
      chaosUnlocked: false,
    }),
  ),
}));

// Mock matchMedia for GameScreen's useIsMobile hook
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
// Tests
// ---------------------------------------------------------------------------

describe('App', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initial screen is menu', () => {
    render(<App />);
    expect(screen.getByTestId('menu-screen')).toBeInTheDocument();
    expect(screen.getByText('Crazy Checkers')).toBeInTheDocument();
  });

  it('Classic button navigates to classic sub-menu screen', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    expect(screen.getByTestId('classic-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-screen')).not.toBeInTheDocument();
  });

  it('Configure button navigates to config screen', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByTestId('config-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-screen')).not.toBeInTheDocument();
  });

  it('Back from config returns to menu', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByTestId('config-screen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to previous screen/i }));
    expect(screen.getByTestId('menu-screen')).toBeInTheDocument();
  });

  // ── Sub-menu screen navigation ─────────────────────────────────────

  it.each([
    ['Classic', 'classic-screen'],
    ['Crazy', 'crazy-screen'],
    ['Challenge', 'challenge-screen'],
    ['Code', 'code-screen'],
    ['Cogitate', 'cogitate-screen'],
    ['Career', 'career-screen'],
  ])('%s navigates to %s', (label, testId) => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(screen.getByTestId(testId)).toBeInTheDocument();
    expect(screen.queryByTestId('menu-screen')).not.toBeInTheDocument();
  });

  it('Back from sub-menu returns to menu', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    expect(screen.getByTestId('classic-screen')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to previous screen/i }));
    expect(screen.getByTestId('menu-screen')).toBeInTheDocument();
  });

  it('Config screen still works after refactor', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Configure' }));
    expect(screen.getByTestId('config-screen')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configure' })).toBeInTheDocument();
  });

  it('Classic sub-menu has Start Game button', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    expect(screen.getByTestId('start-game-button')).toBeInTheDocument();
  });

  it('Classic Start Game launches game', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    fireEvent.click(screen.getByTestId('start-game-button'));
    expect(screen.getByTestId('game-screen')).toBeInTheDocument();
  });

  it('Crazy sub-menu has Start Game button', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Crazy' }));
    expect(screen.getByTestId('start-game-button')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// P1.3 / P6.3 — Margin Notes data-mode substrate.
// After P6.3 retirement, the substrate is gated on themeId === 'margin-notes'
// rather than the (now-vestigial) marginNotesEscalation flag.
// ---------------------------------------------------------------------------

describe('Margin Notes data-mode substrate (P1.3, P6.3)', () => {
  beforeEach(() => {
    delete document.body.dataset.mode;
    localStorage.clear();
  });

  afterEach(() => {
    delete document.body.dataset.mode;
  });

  it('writes data-mode when the active theme is margin-notes (default)', () => {
    // No persisted settings → DEFAULT_SETTINGS → themeId 'margin-notes' (P6.1).
    render(<App />);
    expect(document.body.dataset.mode).toBe('menu');
    fireEvent.click(screen.getByRole('button', { name: 'Crazy' }));
    expect(document.body.dataset.mode).toBe('crazy');
  });

  it('does not write data-mode when the active theme is non-margin-notes', () => {
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 4,
        data: { ...DEFAULT_SETTINGS, themeId: 'cork', marginNotesEscalation: false },
      }),
    );
    render(<App />);
    expect(document.body.dataset.mode).toBeUndefined();
    fireEvent.click(screen.getByRole('button', { name: 'Crazy' }));
    expect(document.body.dataset.mode).toBeUndefined();
  });

  it('clears data-mode when the active theme is changed away from margin-notes', () => {
    // First mount: margin-notes default, attribute is written.
    const { unmount } = render(<App />);
    expect(document.body.dataset.mode).toBe('menu');

    // Unmount fires the cleanup; attribute should be gone.
    unmount();
    expect(document.body.dataset.mode).toBeUndefined();

    // Re-mount under cork: attribute stays absent.
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({
        version: 4,
        data: { ...DEFAULT_SETTINGS, themeId: 'cork' },
      }),
    );
    render(<App />);
    expect(document.body.dataset.mode).toBeUndefined();
  });
});
