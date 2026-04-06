import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ModeScreenShell from './ModeScreenShell';
import { AudioManagerContext } from '../audio/useAudioManager';
import { SoundEvent } from '../audio/types';
import type { AudioManager } from '../audio/audioManager';

// ---------------------------------------------------------------------------
// Mock AudioManager
// ---------------------------------------------------------------------------

function createMockAudioManager(): AudioManager {
  return {
    play: vi.fn(),
    playMusic: vi.fn(),
    stopMusic: vi.fn(),
    updateSettings: vi.fn(),
    loadPack: vi.fn().mockResolvedValue(undefined),
    getPackId: vi.fn(() => 'default'),
    getCurrentMusicTrack: vi.fn(() => null),
    dispose: vi.fn(),
  } as unknown as AudioManager;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderShell(
  overrides?: Partial<{
    title: string;
    onBack: () => void;
    testId: string;
    audioManager: AudioManager;
    children: React.ReactNode;
  }>,
) {
  const onBack = overrides?.onBack ?? vi.fn();
  const audioManager = overrides?.audioManager ?? createMockAudioManager();
  return {
    onBack,
    audioManager,
    ...render(
      <AudioManagerContext.Provider value={audioManager}>
        <ModeScreenShell
          title={overrides?.title ?? 'Test Screen'}
          onBack={onBack}
          testId={overrides?.testId}
        >
          {overrides?.children ?? <p>Test content</p>}
        </ModeScreenShell>
      </AudioManagerContext.Provider>,
    ),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ModeScreenShell', () => {
  it('renders title', () => {
    renderShell({ title: 'My Mode' });
    expect(screen.getByRole('heading', { name: 'My Mode' })).toBeInTheDocument();
  });

  it('renders children', () => {
    renderShell({ children: <p>Child content here</p> });
    expect(screen.getByText('Child content here')).toBeInTheDocument();
  });

  it('back button calls onBack', () => {
    const onBack = vi.fn();
    renderShell({ onBack });
    fireEvent.click(screen.getByRole('button', { name: /back to previous screen/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('back button plays audio', () => {
    const audioManager = createMockAudioManager();
    renderShell({ audioManager });
    fireEvent.click(screen.getByRole('button', { name: /back to previous screen/i }));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(audioManager.play).toHaveBeenCalledWith(SoundEvent.MenuClick);
  });

  it('focus moves to title on mount', () => {
    renderShell({ title: 'Focused Title' });
    const heading = screen.getByRole('heading', { name: 'Focused Title' });
    expect(document.activeElement).toBe(heading);
  });

  it('title has tabIndex -1', () => {
    renderShell({ title: 'Tab Test' });
    const heading = screen.getByRole('heading', { name: 'Tab Test' });
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('back button is accessible', () => {
    renderShell();
    const btn = screen.getByRole('button', { name: /back to previous screen/i });
    expect(btn).toHaveAttribute('aria-label', 'Back to previous screen');
  });

  it('main content has role', () => {
    renderShell();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('custom testId applied', () => {
    renderShell({ testId: 'custom-shell' });
    expect(screen.getByTestId('custom-shell')).toBeInTheDocument();
  });

  it('default testId', () => {
    renderShell();
    expect(screen.getByTestId('mode-screen')).toBeInTheDocument();
  });
});
