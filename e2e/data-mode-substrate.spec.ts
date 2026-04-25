import { test, expect } from '@playwright/test';
import { clearAppStorage } from './helpers';

/**
 * P1.3 — Margin Notes data-mode substrate.
 *
 * The escalation chrome (P4.2) keys off body[data-mode]. P1.3 only writes the
 * attribute; nothing reads it visually yet. With the opt-in flag enabled,
 * navigating across the gameplay-chaos ladder must keep body[data-mode] in
 * sync with the screen tier.
 */
test.describe('Margin Notes data-mode substrate', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await page.goto('/');
  });

  test('writes body[data-mode] across Menu → Crazy sub-menu → game', async ({
    page,
  }) => {
    // With the flag off (default), the attribute is absent.
    await expect(page.locator('body')).not.toHaveAttribute('data-mode', /.*/);

    // Enable the flag via Configure → Themes → Advanced.
    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByText('Advanced').click();
    await page
      .getByRole('switch', { name: /margin notes mode-tiered chrome/i })
      .click();
    await page.getByRole('button', { name: 'Back to previous screen' }).click();

    // Menu tier — quiet baseline.
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'menu');

    // Crazy sub-menu — marginalia tier.
    await page.getByRole('button', { name: 'Crazy' }).click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'crazy');

    // Start a Crazy game — same tier persists.
    await page.getByTestId('start-game-button').click();
    await expect(page.locator('body')).toHaveAttribute('data-mode', 'crazy');
  });

  test('attribute is absent when the flag is off', async ({ page }) => {
    await expect(page.locator('body')).not.toHaveAttribute('data-mode', /.*/);
    await page.getByRole('button', { name: 'Crazy' }).click();
    await expect(page.locator('body')).not.toHaveAttribute('data-mode', /.*/);
  });
});
