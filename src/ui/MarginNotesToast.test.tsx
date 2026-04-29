/**
 * P6.4 — One-time toast component coverage.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarginNotesToast from './MarginNotesToast';
import { shouldShowMarginNotesToast as shouldShowToast } from './marginNotesToastVisibility';
import { DEFAULT_SETTINGS } from './settings';
import type { Settings } from './settings';

const NON_DEFAULT_THEME_SETTINGS: Settings = {
  ...DEFAULT_SETTINGS,
  themeId: 'cork',
};

describe('shouldShowToast (P6.4)', () => {
  it('returns false when active theme is margin-notes', () => {
    expect(shouldShowToast({ ...DEFAULT_SETTINGS, themeId: 'margin-notes' })).toBe(false);
  });

  it('returns true when active theme is non-margin-notes and never dismissed', () => {
    expect(shouldShowToast(NON_DEFAULT_THEME_SETTINGS)).toBe(true);
  });

  it('returns false when explicitly dismissed', () => {
    expect(
      shouldShowToast({ ...NON_DEFAULT_THEME_SETTINGS, marginNotesToastDismissed: true }),
    ).toBe(false);
  });

  it('returns false when older than 30 days', () => {
    const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000;
    expect(
      shouldShowToast({
        ...NON_DEFAULT_THEME_SETTINGS,
        marginNotesToastFirstSeenAt: thirtyOneDaysAgo,
      }),
    ).toBe(false);
  });

  it('returns true within the 30-day window', () => {
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
    expect(
      shouldShowToast({
        ...NON_DEFAULT_THEME_SETTINGS,
        marginNotesToastFirstSeenAt: fifteenDaysAgo,
      }),
    ).toBe(true);
  });
});

describe('MarginNotesToast component (P6.4)', () => {
  it('does not render when active theme is margin-notes', () => {
    render(
      <MarginNotesToast
        settings={{ ...DEFAULT_SETTINGS, themeId: 'margin-notes' }}
        onSettingsChange={vi.fn()}
      />,
    );
    expect(screen.queryByTestId('margin-notes-toast')).toBeNull();
  });

  it('renders for non-default themes when not dismissed', () => {
    render(
      <MarginNotesToast
        settings={NON_DEFAULT_THEME_SETTINGS}
        onSettingsChange={vi.fn()}
      />,
    );
    expect(screen.getByTestId('margin-notes-toast')).toBeInTheDocument();
  });

  it('clicking "Try it" switches theme to margin-notes and dismisses', () => {
    const onSettingsChange = vi.fn();
    render(
      <MarginNotesToast
        settings={NON_DEFAULT_THEME_SETTINGS}
        onSettingsChange={onSettingsChange}
      />,
    );
    fireEvent.click(screen.getByTestId('margin-notes-toast-try'));
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        themeId: 'margin-notes',
        marginNotesToastDismissed: true,
      }),
    );
  });

  it('clicking "Dismiss" sets the dismissed flag', () => {
    const onSettingsChange = vi.fn();
    render(
      <MarginNotesToast
        settings={NON_DEFAULT_THEME_SETTINGS}
        onSettingsChange={onSettingsChange}
      />,
    );
    fireEvent.click(screen.getByTestId('margin-notes-toast-dismiss'));
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ marginNotesToastDismissed: true }),
    );
  });

  it('Esc key dismisses', () => {
    const onSettingsChange = vi.fn();
    render(
      <MarginNotesToast
        settings={NON_DEFAULT_THEME_SETTINGS}
        onSettingsChange={onSettingsChange}
      />,
    );
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onSettingsChange).toHaveBeenCalledWith(
      expect.objectContaining({ marginNotesToastDismissed: true }),
    );
  });
});
