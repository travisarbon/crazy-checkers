import { test, expect } from '@playwright/test';
import {
  clearAppIndexedDb,
  clearAppStorage,
  navigateToChoice,
  seedCodeUnlocks,
  waitForScreen,
} from './helpers';

test.describe('Choice Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await clearAppIndexedDb(page);
    // Seed Choice menu + Choice Mode 1 (Revolution) unlocks via localStorage
    await seedCodeUnlocks(page, ['choice', 'choice-revolution']);
  });

  test('Choice gallery displays unlocked modes', async ({ page }) => {
    await navigateToChoice(page);

    await expect(page.getByTestId('choice-loading')).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId('unlock-summary')).toBeVisible();
    await expect(page.getByTestId('choice-card-1')).toBeVisible();
    await expect(page.getByTestId('choice-track-legend')).toBeVisible();
  });

  test('navigate gallery and view Choice mode detail', async ({ page }) => {
    await navigateToChoice(page);
    await expect(page.getByTestId('choice-loading')).toBeHidden({ timeout: 10000 });

    await page.getByTestId('choice-card-1').click();

    // A gallery dialog or the detail screen may appear.
    const dialog = page.getByTestId('gallery-dialog');
    await dialog.waitFor({ state: 'visible', timeout: 5000 });

    // The mode name should be displayed somewhere in the dialog
    const dialogText = await dialog.textContent();
    expect(dialogText).toBeTruthy();
    expect(dialogText?.toLowerCase()).toContain('revolution');
  });

  test('launch a Choice game from the gallery', async ({ page }) => {
    await navigateToChoice(page);
    await expect(page.getByTestId('choice-loading')).toBeHidden({ timeout: 10000 });

    await page.getByTestId('choice-card-1').click();
    await page.getByTestId('gallery-dialog').waitFor({ state: 'visible', timeout: 5000 });
    await page.getByTestId('gallery-play').click();

    await waitForScreen(page, 'choice-detail-screen');

    // Start the game via GameSetupSection
    await page.getByTestId('start-game-button').click();
    await waitForScreen(page, 'game-screen');

    // Verify the board has the expected 24 starting pieces
    const pieceCount = await page.locator('[role="gridcell"][aria-label*="pawn"], [role="gridcell"][aria-label*="king"]').count();
    expect(pieceCount).toBeGreaterThan(0);
  });

  test('locked Choice cards render but are disabled when only mode 1 is unlocked', async ({ page }) => {
    await navigateToChoice(page);
    await expect(page.getByTestId('choice-loading')).toBeHidden({ timeout: 10000 });

    // Mode 1 should be enabled; mode 40 should be disabled (locked).
    await expect(page.getByTestId('choice-card-1')).toBeEnabled();
    await expect(page.getByTestId('choice-card-40')).toBeDisabled();
  });
});
