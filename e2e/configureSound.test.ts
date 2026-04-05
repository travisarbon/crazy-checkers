/**
 * Task 14.2 — Playwright E2E Tests: Configure Screen Sound Controls.
 *
 * Validates audio controls on the Configure screen and during gameplay.
 */

import { test, expect } from '@playwright/test';
import { clearAppStorage } from './helpers';

test.describe('Configure screen — sound controls', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
  });

  test('Test 3.1 — Configure screen shows audio controls', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('menu-screen')).toBeVisible();

    // Click Configure
    await page.getByRole('button', { name: 'Configure' }).click();
    await expect(page.getByTestId('config-screen')).toBeVisible();

    // Sound toggle should be present
    const soundToggle = page.getByTestId('sound-toggle');
    await expect(soundToggle).toBeVisible();

    // Volume sliders should be present (master, sfx, music)
    await expect(page.locator('#master-volume')).toBeVisible();
    await expect(page.locator('#sfx-volume')).toBeVisible();
    await expect(page.locator('#music-volume')).toBeVisible();
  });

  test('Test 3.2 — Sound toggle persists across sessions', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Configure' }).click();
    await expect(page.getByTestId('config-screen')).toBeVisible();

    const soundToggle = page.getByTestId('sound-toggle');

    // Get initial state
    const initialState = await soundToggle.getAttribute('aria-checked');

    // Toggle sound
    await soundToggle.click();
    const toggledState = await soundToggle.getAttribute('aria-checked');
    expect(toggledState).not.toBe(initialState);

    // Navigate away and back
    await page.getByRole('button', { name: 'Back to main menu' }).click();
    await expect(page.getByTestId('menu-screen')).toBeVisible();

    await page.getByRole('button', { name: 'Configure' }).click();
    await expect(page.getByTestId('config-screen')).toBeVisible();

    // State should be preserved
    const restoredState = await page.getByTestId('sound-toggle').getAttribute('aria-checked');
    expect(restoredState).toBe(toggledState);

    // Toggle back
    await page.getByTestId('sound-toggle').click();
    const retoggledState = await page.getByTestId('sound-toggle').getAttribute('aria-checked');
    expect(retoggledState).toBe(initialState);
  });

  test('Test 3.3 — Audio does not auto-play on page load', async ({ page }) => {
    // Clear storage for fresh session
    await clearAppStorage(page);
    await page.goto('/');

    // Check that no audio elements are playing
    const isAudioPlaying = await page.evaluate(() => {
      // Check for active HTMLAudioElement nodes
      const audioElements = document.querySelectorAll('audio');
      for (const audio of audioElements) {
        if (!audio.paused) return true;
      }
      return false;
    });

    expect(isAudioPlaying).toBe(false);
  });

  test('Test 3.4 — Sound heading visible on Configure screen', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Configure' }).click();
    await expect(page.getByTestId('config-screen')).toBeVisible();

    // The Sound section heading should be visible
    await expect(page.locator('#sound-heading')).toBeVisible();
    await expect(page.locator('#sound-heading')).toContainText('Sound');
  });
});
