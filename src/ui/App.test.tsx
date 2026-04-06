import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

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
