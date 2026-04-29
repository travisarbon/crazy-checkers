import { test, expect } from '@playwright/test';
import { clearAppStorage, enableMarginNotesEscalation } from './helpers';

/**
 * P1.3 / P6.3 — Margin Notes data-mode substrate.
 *
 * Originally added in P1.3 with an opt-in toggle (Configure → Themes →
 * Advanced) gating the body[data-mode] write. After the P6.3 (Phase A)
 * cutover, the toggle is retired: data-mode is written for any user
 * whose active theme is `margin-notes`, and absent for any other theme.
 *
 * The escalation chrome (CSS in src/themes/marginnotes.escalation.css)
 * keys off the substrate.
 */
test.describe('Margin Notes data-mode substrate (post-P6.3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
  });

  test('writes body[data-mode] when active theme is margin-notes', async ({
    page,
  }) => {
    await enableMarginNotesEscalation(page);
    await page.goto('/');
    await page.getByTestId('menu-screen').waitFor();

    // Menu tier — quiet baseline.
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'menu');

    // Crazy sub-menu — marginalia tier.
    await page.getByRole('button', { name: 'Crazy' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'crazy');

    // Start a Crazy game — same tier persists.
    await page.getByTestId('start-game-button').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'crazy');
  });

  test('attribute is absent when active theme is non-margin-notes', async ({
    page,
  }) => {
    // Seed cork as the stored theme.
    await page.evaluate(() => {
      const data = {
        themeId: 'cork',
        animationSpeed: 1.0,
        moveConfirmation: false,
        masterVolume: 0.7,
        sfxVolume: 1.0,
        musicVolume: 0.5,
        muted: true,
        audioPackId: 'silent',
        marginNotesEscalation: false,
        timeControl: null,
      };
      localStorage.setItem(
        'crazy-checkers-settings',
        JSON.stringify({ version: 4, data }),
      );
    });
    await page.goto('/');
    await page.getByTestId('menu-screen').waitFor();
    await expect(page.locator('body')).not.toHaveAttribute('data-mode', /.*/);
    await page.getByRole('button', { name: 'Crazy' }).click();
    await expect(page.locator('body')).not.toHaveAttribute('data-mode', /.*/);
  });
});
