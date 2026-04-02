import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import App from './App';

// Mock the AI worker to prevent real worker initialization
vi.mock('../ai/workerClient', () => ({
  requestAIMove: vi.fn(() => new Promise(() => {})),
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

  it('Classic → setup → start navigates to game', () => {
    render(<App />);

    // Click Classic to open setup dialog
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    expect(screen.getByTestId('game-setup-dialog')).toBeInTheDocument();

    // Click Start Game with defaults (Pass Around, White)
    fireEvent.click(screen.getByTestId('setup-start'));

    // Should now be on the game screen
    expect(screen.getByTestId('game-screen')).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole('button', { name: /back to main menu/i }));
    expect(screen.getByTestId('menu-screen')).toBeInTheDocument();
  });

  it('Main Menu from game returns to menu', () => {
    render(<App />);

    // Navigate to a game
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    fireEvent.click(screen.getByTestId('setup-start'));
    expect(screen.getByTestId('game-screen')).toBeInTheDocument();

    // Click Main Menu button
    fireEvent.click(screen.getByRole('button', { name: /return to main menu/i }));
    expect(screen.getByTestId('menu-screen')).toBeInTheDocument();
  });

  it('New Game from game stays in game', () => {
    render(<App />);

    // Navigate to a game
    fireEvent.click(screen.getByRole('button', { name: 'Classic' }));
    fireEvent.click(screen.getByTestId('setup-start'));
    expect(screen.getByTestId('game-screen')).toBeInTheDocument();

    // Click New Game — should confirm first
    window.confirm = vi.fn(() => true);
    fireEvent.click(screen.getByRole('button', { name: 'New Game' }));
    expect(screen.getByTestId('game-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-screen')).not.toBeInTheDocument();
  });
});
