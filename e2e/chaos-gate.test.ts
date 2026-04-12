/**
 * Task 22.2 — Chaos unlock gate end-to-end tests.
 *
 * Covers the user-facing flow: default locked state, CHAOS code unlocks
 * Chaos mode (title change + button reveal), UNLOCKALL likewise unlocks
 * it, and clearing persisted state hides Chaos again.
 */

import { test, expect, type Page } from '@playwright/test';

async function resetState(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.clear();
  });
  await page.reload();
  // Dismiss the resume dialog if present.
  const resumeDiscard = page.getByTestId('resume-discard');
  if (await resumeDiscard.isVisible({ timeout: 500 }).catch(() => false)) {
    await resumeDiscard.click();
  }
  await expect(page.getByTestId('menu-screen')).toBeVisible();
}

async function redeemCode(page: Page, code: string): Promise<void> {
  await page.getByRole('button', { name: 'Code' }).click();
  await expect(page.getByTestId('code-screen')).toBeVisible();
  await page.getByTestId('code-input').fill(code);
  await page.getByTestId('redeem-button').click();
  await expect(page.getByTestId('status-message')).toContainText(/Unlocked/i);
  // Navigate back to the menu via the shell back button.
  await page.getByRole('button', { name: /back/i }).click();
  await expect(page.getByTestId('menu-screen')).toBeVisible();
}

test.describe('Chaos Gate (Task 22.2)', () => {
  test.beforeEach(async ({ page }) => {
    await resetState(page);
  });

  test('title is "Crazy Checkers" and Chaos button is hidden by default', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crazy Checkers');
    await expect(page.getByRole('button', { name: 'Chaos' })).toHaveCount(0);
  });

  test('CHAOS code unlocks Chaos mode and changes the title', async ({ page }) => {
    await redeemCode(page, 'CHAOS');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chaos Checkers');
    const chaosButton = page.getByRole('button', { name: 'Chaos' });
    await expect(chaosButton).toBeVisible();
  });

  test('Chaos screen is navigable after CHAOS unlock', async ({ page }) => {
    await redeemCode(page, 'CHAOS');

    await page.getByRole('button', { name: 'Chaos' }).click();
    await expect(page.getByTestId('chaos-screen')).toBeVisible();
    await expect(page.getByTestId('chaos-glow')).toBeVisible();
  });

  test('UNLOCKALL master code also unlocks Chaos and changes the title', async ({ page }) => {
    await redeemCode(page, 'UNLOCKALL');

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chaos Checkers');
    await expect(page.getByRole('button', { name: 'Chaos' })).toBeVisible();
  });

  test('clearing persisted state reverts the title and hides the Chaos button', async ({ page }) => {
    await redeemCode(page, 'CHAOS');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chaos Checkers');

    // Simulate a full data reset (ConfigScreen Reset Progress flow).
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    const resumeDiscard = page.getByTestId('resume-discard');
    if (await resumeDiscard.isVisible({ timeout: 500 }).catch(() => false)) {
      await resumeDiscard.click();
    }

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crazy Checkers');
    await expect(page.getByRole('button', { name: 'Chaos' })).toHaveCount(0);
  });
});
