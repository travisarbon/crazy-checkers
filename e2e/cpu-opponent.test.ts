import { test, expect } from '@playwright/test';
import { startCpuGame, clickSquare, clearAppStorage } from './helpers';

test.describe('CPU opponent responds', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
  });

  test('starts Classic game vs Easy CPU', async ({ page }) => {
    await startCpuGame(page, 'easy');
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await expect(page.getByTestId('turn-indicator')).toContainText("White's turn");
  });

  test('CPU responds after human move', async ({ page }) => {
    await startCpuGame(page, 'easy');

    // Make a legal opening move as White: 22 → 18
    await clickSquare(page, 22);
    await clickSquare(page, 18);

    // Wait for CPU move to complete — turn returns to White.
    // The thinking indicator may appear/disappear too quickly to reliably assert,
    // so we wait directly for the turn switch.
    await expect(page.getByTestId('turn-indicator')).toContainText("White's turn", {
      timeout: 15000,
    });

    // Verify a Black piece has moved by checking the last-move highlight
    await expect(page.getByTestId('highlight-last-move').first()).toBeVisible();
  });
});
