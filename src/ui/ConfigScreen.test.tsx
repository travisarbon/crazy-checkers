import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfigScreen from './ConfigScreen';
import BoardPreview from './BoardPreview';
import type { Settings } from './settings';
import { DEFAULT_SETTINGS } from './settings';
import { THEMES } from '../themes/theme';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderConfig(overrides?: Partial<{
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  onBack: () => void;
}>) {
  const settings = overrides?.settings ?? { ...DEFAULT_SETTINGS };
  const onSettingsChange = overrides?.onSettingsChange ?? vi.fn();
  const onBack = overrides?.onBack ?? vi.fn();
  return {
    settings,
    onSettingsChange,
    onBack,
    ...render(
      <ConfigScreen
        settings={settings}
        onSettingsChange={onSettingsChange}
        onBack={onBack}
      />,
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
    expect(screen.getByRole('button', { name: 'Back to main menu' })).toBeInTheDocument();
  });

  it('renders three theme cards', () => {
    renderConfig();
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('renders animation speed slider', () => {
    renderConfig();
    expect(screen.getByRole('slider', { name: 'Animation speed' })).toBeInTheDocument();
  });

  it('renders move confirmation toggle', () => {
    renderConfig();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('renders data section with disabled buttons', () => {
    renderConfig();
    const exportBtn = screen.getByRole('button', { name: 'Export Data' });
    const resetBtn = screen.getByRole('button', { name: 'Reset Progress' });
    expect(exportBtn).toBeDisabled();
    expect(resetBtn).toBeDisabled();
  });

  // ── Theme switching tests ───────────────────────────────────────────

  it('default theme (classic) is selected', () => {
    renderConfig();
    const classicCard = screen.getByRole('radio', { name: 'Classic' });
    expect(classicCard).toHaveAttribute('aria-checked', 'true');
  });

  it('clicking Modern theme calls onSettingsChange', () => {
    const onSettingsChange = vi.fn();
    renderConfig({ onSettingsChange });
    fireEvent.click(screen.getByRole('radio', { name: 'Modern' }));
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      themeId: 'modern',
    });
  });

  it('clicking High Contrast theme calls onSettingsChange', () => {
    const onSettingsChange = vi.fn();
    renderConfig({ onSettingsChange });
    fireEvent.click(screen.getByRole('radio', { name: 'High Contrast' }));
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      themeId: 'high-contrast',
    });
  });

  it('selected theme has visual highlight (aria-checked)', () => {
    renderConfig({ settings: { ...DEFAULT_SETTINGS, themeId: 'modern' } });
    const modernCard = screen.getByRole('radio', { name: 'Modern' });
    expect(modernCard).toHaveAttribute('aria-checked', 'true');
    const classicCard = screen.getByRole('radio', { name: 'Classic' });
    expect(classicCard).toHaveAttribute('aria-checked', 'false');
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
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ animationSpeed: 0.5 }),
    );
  });

  // ── Move confirmation tests ─────────────────────────────────────────

  it('toggle default is off', () => {
    renderConfig();
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  });

  it('clicking toggle calls onSettingsChange with moveConfirmation true', () => {
    const onSettingsChange = vi.fn();
    renderConfig({ onSettingsChange });
    fireEvent.click(screen.getByRole('switch'));
    expect(onSettingsChange).toHaveBeenCalledWith({
      ...DEFAULT_SETTINGS,
      moveConfirmation: true,
    });
  });

  it('toggle reflects enabled state', () => {
    renderConfig({ settings: { ...DEFAULT_SETTINGS, moveConfirmation: true } });
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  // ── Navigation tests ────────────────────────────────────────────────

  it('back button calls onBack', () => {
    const onBack = vi.fn();
    renderConfig({ onBack });
    fireEvent.click(screen.getByRole('button', { name: 'Back to main menu' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// BoardPreview tests
// ---------------------------------------------------------------------------

describe('BoardPreview', () => {
  const classicTheme = THEMES['classic'];
  const modernTheme = THEMES['modern'];

  it('renders SVG with correct dimensions', () => {
    expect(classicTheme).toBeDefined();
    if (!classicTheme) return;
    const { container } = render(<BoardPreview theme={classicTheme} size={80} />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('80');
    expect(svg?.getAttribute('height')).toBe('80');
  });

  it('uses provided theme colors for board squares', () => {
    expect(modernTheme).toBeDefined();
    if (!modernTheme) return;
    const { container } = render(<BoardPreview theme={modernTheme} size={80} />);
    const rects = container.querySelectorAll('rect');
    const fills = Array.from(rects).map((r) => r.getAttribute('fill'));
    expect(fills).toContain(modernTheme.boardLight);
    expect(fills).toContain(modernTheme.boardDark);
  });
});
