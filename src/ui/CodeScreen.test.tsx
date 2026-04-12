import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CodeScreen from './CodeScreen';
import { saveCodeUnlocks, loadCodeUnlocks } from '../persistence/unlockEvaluator';

function renderScreen(overrides: {
  onBack?: () => void;
  onCodeRedeemed?: () => void;
} = {}) {
  const onBack = overrides.onBack ?? vi.fn();
  const onCodeRedeemed = overrides.onCodeRedeemed ?? vi.fn();
  const utils = render(<CodeScreen onBack={onBack} onCodeRedeemed={onCodeRedeemed} />);
  return { ...utils, onBack, onCodeRedeemed };
}

function type(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  vi.useRealTimers();
});

describe('CodeScreen — rendering', () => {
  it('renders the input, Redeem button, and history panel', () => {
    renderScreen();
    expect(screen.getByTestId('code-input')).toBeInTheDocument();
    expect(screen.getByTestId('redeem-button')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Redemption history panel/i })).toBeInTheDocument();
  });

  it('disables Redeem while input is empty', () => {
    renderScreen();
    const button = screen.getByTestId('redeem-button');
    expect(button).toBeDisabled();
  });
});

describe('CodeScreen — redemption', () => {
  it('shows success for a valid code and triggers onCodeRedeemed', () => {
    const onCodeRedeemed = vi.fn();
    renderScreen({ onCodeRedeemed });
    type(screen.getByTestId('code-input'), 'REVOLUTION');
    fireEvent.click(screen.getByTestId('redeem-button'));

    const status = screen.getByTestId('status-message');
    expect(status.textContent).toMatch(/Unlocked/);
    expect(status.textContent).toMatch(/Revolution/);
    expect(onCodeRedeemed).toHaveBeenCalledTimes(1);
    expect(loadCodeUnlocks().has('choice-revolution')).toBe(true);
  });

  it('clears the input after redemption', () => {
    renderScreen();
    const input = screen.getByTestId('code-input');
    type(input, 'REVOLUTION');
    fireEvent.click(screen.getByTestId('redeem-button'));
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('shows Invalid code for unknown input and does not call onCodeRedeemed', () => {
    const onCodeRedeemed = vi.fn();
    renderScreen({ onCodeRedeemed });
    type(screen.getByTestId('code-input'), 'NOTACODE');
    fireEvent.click(screen.getByTestId('redeem-button'));

    expect(screen.getByTestId('status-message').textContent).toMatch(/Invalid/);
    expect(onCodeRedeemed).not.toHaveBeenCalled();
  });

  it('shows Already unlocked when targets are all present', () => {
    saveCodeUnlocks(new Set(['choice-revolution']));
    const onCodeRedeemed = vi.fn();
    renderScreen({ onCodeRedeemed });
    type(screen.getByTestId('code-input'), 'REVOLUTION');
    fireEvent.click(screen.getByTestId('redeem-button'));

    expect(screen.getByTestId('status-message').textContent).toMatch(/Already unlocked/);
    expect(onCodeRedeemed).not.toHaveBeenCalled();
  });

  it('submits via Enter key on the form', () => {
    const onCodeRedeemed = vi.fn();
    const { container } = renderScreen({ onCodeRedeemed });
    type(screen.getByTestId('code-input'), 'CHAOS');
    const form = container.querySelector('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);
    expect(screen.getByTestId('status-message').textContent).toMatch(/Unlocked/);
    expect(onCodeRedeemed).toHaveBeenCalled();
  });

  it('reports item count for batch codes', () => {
    renderScreen();
    type(screen.getByTestId('code-input'), 'TRACK1ALL');
    fireEvent.click(screen.getByTestId('redeem-button'));
    expect(screen.getByTestId('status-message').textContent).toMatch(/8 items/);
  });

  it('normalizes input (case and punctuation)', () => {
    renderScreen();
    type(screen.getByTestId('code-input'), '  Re-vo Lution! ');
    fireEvent.click(screen.getByTestId('redeem-button'));
    expect(screen.getByTestId('status-message').textContent).toMatch(/Unlocked/);
    expect(loadCodeUnlocks().has('choice-revolution')).toBe(true);
  });
});

describe('CodeScreen — history', () => {
  it('shows empty state initially', () => {
    renderScreen();
    fireEvent.click(screen.getByRole('button', { name: /Redemption history panel/i }));
    expect(screen.getByTestId('history-empty')).toBeInTheDocument();
  });

  it('appends successful redemptions and lists most recent first', () => {
    renderScreen();
    type(screen.getByTestId('code-input'), 'REVOLUTION');
    fireEvent.click(screen.getByTestId('redeem-button'));
    type(screen.getByTestId('code-input'), 'CHAOS');
    fireEvent.click(screen.getByTestId('redeem-button'));

    fireEvent.click(screen.getByRole('button', { name: /Redemption history panel/i }));
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]?.textContent).toMatch(/CHAOS/);
    expect(items[1]?.textContent).toMatch(/REVOLUTION/);
  });

  it('does not record invalid attempts', () => {
    renderScreen();
    type(screen.getByTestId('code-input'), 'NOPE');
    fireEvent.click(screen.getByTestId('redeem-button'));
    fireEvent.click(screen.getByRole('button', { name: /Redemption history panel/i }));
    expect(screen.queryByTestId('history-list')).not.toBeInTheDocument();
    expect(screen.getByTestId('history-empty')).toBeInTheDocument();
  });
});

describe('CodeScreen — status dismissal', () => {
  it('auto-dismisses the status message after 5 seconds', () => {
    vi.useFakeTimers();
    renderScreen();
    type(screen.getByTestId('code-input'), 'REVOLUTION');
    fireEvent.click(screen.getByTestId('redeem-button'));
    expect(screen.getByTestId('status-message')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByTestId('status-message')).not.toBeInTheDocument();
  });

  it('dismisses the status when the input regains focus', () => {
    renderScreen();
    const input = screen.getByTestId('code-input');
    type(input, 'NOPE');
    fireEvent.click(screen.getByTestId('redeem-button'));
    expect(screen.getByTestId('status-message')).toBeInTheDocument();
    fireEvent.focus(input);
    expect(screen.queryByTestId('status-message')).not.toBeInTheDocument();
  });
});
