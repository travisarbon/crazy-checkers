import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfigScreen from './ConfigScreen';
import BoardPreview from './BoardPreview';
import type { Settings } from './settings';
import { DEFAULT_SETTINGS } from './settings';
import { THEMES } from '../themes/theme';
import { AudioManagerContext } from '../audio/useAudioManager';
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

function renderConfig(
  overrides?: Partial<{
    settings: Settings;
    onSettingsChange: (s: Settings) => void;
    onBack: () => void;
    audioManager: AudioManager;
  }>,
) {
  const settings = overrides?.settings ?? { ...DEFAULT_SETTINGS };
  const onSettingsChange = overrides?.onSettingsChange ?? vi.fn();
  const onBack = overrides?.onBack ?? vi.fn();
  const audioManager = overrides?.audioManager ?? createMockAudioManager();
  return {
    settings,
    onSettingsChange,
    onBack,
    audioManager,
    ...render(
      <AudioManagerContext.Provider value={audioManager}>
        <ConfigScreen settings={settings} onSettingsChange={onSettingsChange} onBack={onBack} />
      </AudioManagerContext.Provider>,
    ),
  };
}

// ---------------------------------------------------------------------------
// Rendering tests
// ---------------------------------------------------------------------------

describe('ConfigScreen', () => {
  it('renders heading', () => {
    renderConfig();
    expect(screen.getByRole('heading', { name: 'Configure' })).toBeInTheDocument();
  });

  it('renders back button', () => {
    renderConfig();
    expect(screen.getByRole('button', { name: 'Back to previous screen' })).toBeInTheDocument();
  });

  it('renders five theme cards', () => {
    renderConfig();
    const themeGroup = screen.getByRole('radiogroup', { name: 'Theme selection' });
    const radios = Array.from(themeGroup.querySelectorAll('[role="radio"]'));
    expect(radios).toHaveLength(5);
  });

  it('renders animation speed slider', () => {
    renderConfig();
    expect(screen.getByRole('slider', { name: 'Animation speed' })).toBeInTheDocument();
  });

  it('renders move confirmation toggle', () => {
    renderConfig();
    const switches = screen.getAllByRole('switch');
    expect(switches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Require confirmation before executing a move')).toBeInTheDocument();
  });

  it('renders data section with all three action buttons enabled', () => {
    renderConfig();
    const exportBtn = screen.getByRole('button', { name: 'Export Data' });
    const importBtn = screen.getByRole('button', { name: 'Import Data' });
    const resetBtn = screen.getByRole('button', { name: 'Reset Progress' });
    expect(exportBtn).not.toBeDisabled();
    expect(importBtn).not.toBeDisabled();
    expect(resetBtn).not.toBeDisabled();
  });

  // ── Theme switching tests ───────────────────────────────────────────

  it('default theme (crazy) is selected', () => {
    renderConfig();
    const crazyCard = screen.getByRole('radio', { name: 'Crazy' });
    expect(crazyCard).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking Cork theme calls onSettingsChange', () => {
    const onSettingsChange = vi.fn();
    renderConfig({ onSettingsChange });
    fireEvent.click(screen.getByRole('radio', { name: 'Cork' }));
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      themeId: 'cork',
    });
  });

  it('clicking Contrast theme calls onSettingsChange', () => {
    const onSettingsChange = vi.fn();
    renderConfig({ onSettingsChange });
    fireEvent.click(screen.getByRole('radio', { name: 'Contrast' }));
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      themeId: 'contrast',
    });
  });

  it('selected theme has visual highlight (aria-checked)', () => {
    renderConfig({ settings: { ...DEFAULT_SETTINGS, themeId: 'current' } });
    const currentCard = screen.getByRole('radio', { name: 'Current' });
    expect(currentCard).toHaveAttribute('aria-checked', 'true');
    const crazyCard = screen.getByRole('radio', { name: 'Crazy' });
    expect(crazyCard).toHaveAttribute('aria-checked', 'false');
  });

  // ── Animation speed tests ───────────────────────────────────────────

  it('slider shows Normal label at default speed', () => {
    renderConfig();
    expect(screen.getByText('Normal')).toBeInTheDocument();
  });

  it('slider shows Fast hint at 0.5 speed', () => {
    renderConfig({ settings: { ...DEFAULT_SETTINGS, animationSpeed: 0.5 } });
    // "Fast" appears both as a slider endpoint label and as the dynamic hint
    const matches = screen.getAllByText('Fast');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('slider shows Slow hint at 2.0 speed', () => {
    renderConfig({ settings: { ...DEFAULT_SETTINGS, animationSpeed: 2.0 } });
    // "Slow" appears both as a slider endpoint label and as the dynamic hint
    const matches = screen.getAllByText('Slow');
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('moving slider calls onSettingsChange', () => {
    const onSettingsChange = vi.fn();
    renderConfig({ onSettingsChange });
    const slider = screen.getByRole('slider', { name: 'Animation speed' });
    fireEvent.change(slider, { target: { value: '2.0' } });
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ animationSpeed: 0.5 }));
  });

  // ── Move confirmation tests ─────────────────────────────────────────

  it('toggle default is off', () => {
    const { container } = renderConfig();
    const toggle = container.querySelector('#move-confirm-toggle');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking toggle calls onSettingsChange with moveConfirmation true', () => {
    const onSettingsChange = vi.fn();
    const { container } = renderConfig({ onSettingsChange });
    const toggle = container.querySelector('#move-confirm-toggle') as HTMLElement;
    fireEvent.click(toggle);
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      moveConfirmation: true,
    });
  });

  it('toggle reflects enabled state', () => {
    const { container } = renderConfig({ settings: { ...DEFAULT_SETTINGS, moveConfirmation: true } });
    const toggle = container.querySelector('#move-confirm-toggle');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  // ── Navigation tests ────────────────────────────────────────────────

  it('back button calls onBack', () => {
    const onBack = vi.fn();
    renderConfig({ onBack });
    fireEvent.click(screen.getByRole('button', { name: 'Back to previous screen' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // ── Sound section: Rendering tests ─────────────────────────────────

  it('renders Sound section heading', () => {
    renderConfig();
    expect(screen.getByRole('heading', { name: 'Sound' })).toBeInTheDocument();
  });

  it('renders Master Volume slider with correct ARIA attributes', () => {
    renderConfig();
    const slider = screen.getByRole('slider', { name: 'Master Volume' });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuetext', '70%');
  });

  it('renders SFX Volume slider with correct ARIA attributes', () => {
    renderConfig();
    const slider = screen.getByRole('slider', { name: 'SFX Volume' });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuetext', '100%');
  });

  it('renders Music Volume slider with correct ARIA attributes', () => {
    renderConfig();
    const slider = screen.getByRole('slider', { name: 'Music Volume' });
    expect(slider).toBeInTheDocument();
    expect(slider).toHaveAttribute('aria-valuetext', '50%');
  });

  it('renders Mute toggle', () => {
    renderConfig();
    const muteToggle = document.getElementById('mute-toggle') as HTMLElement;
    expect(muteToggle).toBeInTheDocument();
  });

  // ── Sound section: Interaction tests ───────────────────────────────

  it('Master slider change calls onSettingsChange with masterVolume', () => {
    const onSettingsChange = vi.fn();
    renderConfig({ onSettingsChange });
    const slider = screen.getByRole('slider', { name: 'Master Volume' });
    fireEvent.change(slider, { target: { value: '50' } });
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ masterVolume: 0.5 }),
    );
  });

  it('SFX slider change calls onSettingsChange with sfxVolume', () => {
    const onSettingsChange = vi.fn();
    renderConfig({ onSettingsChange });
    const slider = screen.getByRole('slider', { name: 'SFX Volume' });
    fireEvent.change(slider, { target: { value: '80' } });
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ sfxVolume: 0.8 }),
    );
  });

  it('Music slider change calls onSettingsChange with musicVolume', () => {
    const onSettingsChange = vi.fn();
    renderConfig({ onSettingsChange });
    const slider = screen.getByRole('slider', { name: 'Music Volume' });
    fireEvent.change(slider, { target: { value: '30' } });
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ musicVolume: 0.3 }),
    );
  });

  it('Mute toggle click calls onSettingsChange with muted true', () => {
    const onSettingsChange = vi.fn();
    renderConfig({ onSettingsChange });
    const muteToggle = document.getElementById('mute-toggle') as HTMLElement;
    fireEvent.click(muteToggle);
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ muted: true }),
    );
  });

  // ── Sound section: State reflection tests ──────────────────────────

  it('sliders reflect settings values', () => {
    renderConfig({
      settings: { ...DEFAULT_SETTINGS, masterVolume: 0.3, sfxVolume: 0.6, musicVolume: 0.9 },
    });
    expect(screen.getByRole('slider', { name: 'Master Volume' })).toHaveValue('30');
    expect(screen.getByRole('slider', { name: 'SFX Volume' })).toHaveValue('60');
    expect(screen.getByRole('slider', { name: 'Music Volume' })).toHaveValue('90');
  });

  it('Mute toggle reflects muted state with aria-checked true', () => {
    renderConfig({ settings: { ...DEFAULT_SETTINGS, muted: true } });
    const muteToggle = document.getElementById('mute-toggle') as HTMLElement;
    expect(muteToggle).toHaveAttribute('aria-checked', 'true');
  });

  it('sliders dimmed when muted', () => {
    const { container } = renderConfig({ settings: { ...DEFAULT_SETTINGS, muted: true } });
    const volumeSliders = container.querySelector('[data-muted="true"]');
    expect(volumeSliders).toBeInTheDocument();
  });

  // ── Sound section: Accessibility tests ─────────────────────────────

  it('volume sliders have aria-valuetext showing percentages', () => {
    renderConfig({
      settings: { ...DEFAULT_SETTINGS, masterVolume: 0.45, sfxVolume: 0.8, musicVolume: 0.2 },
    });
    expect(screen.getByRole('slider', { name: 'Master Volume' })).toHaveAttribute('aria-valuetext', '45%');
    expect(screen.getByRole('slider', { name: 'SFX Volume' })).toHaveAttribute('aria-valuetext', '80%');
    expect(screen.getByRole('slider', { name: 'Music Volume' })).toHaveAttribute('aria-valuetext', '20%');
  });

});

// ---------------------------------------------------------------------------
// BoardPreview tests
// ---------------------------------------------------------------------------

describe('BoardPreview', () => {
  const crazyTheme = THEMES['crazy'];
  const currentTheme = THEMES['current'];

  it('renders SVG with correct dimensions', () => {
    expect(crazyTheme).toBeDefined();
    if (!crazyTheme) return;
    const { container } = render(<BoardPreview theme={crazyTheme} size={80} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('80');
    expect(svg?.getAttribute('height')).toBe('80');
  });

  it('uses provided theme colors for board squares', () => {
    expect(currentTheme).toBeDefined();
    if (!currentTheme) return;
    const { container } = render(<BoardPreview theme={currentTheme} size={80} />);
    const rects = container.querySelectorAll('rect');
    const fills = Array.from(rects).map((r) => r.getAttribute('fill'));
    expect(fills).toContain(currentTheme.boardLight);
    expect(fills).toContain(currentTheme.boardDark);
  });
});
