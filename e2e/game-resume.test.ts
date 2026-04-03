import { test, expect } from '@playwright/test';
import { startPassAroundGame, clickSquare, clearAppStorage } from './helpers';

test.describe('Game resume after tab close', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
  });

  test('resume prompt appears after navigating away and back', async ({ page }) => {
    // Start a Pass Around game and make a few moves
    await startPassAroundGame(page);

    // Move 1: White 22 → 18
    await clickSquare(page, 22);
    await clickSquare(page, 18);
    await page.waitForTimeout(800);

    // Move 2: Black 10 → 14
    await clickSquare(page, 10);
    await clickSquare(page, 14);
    await page.waitForTimeout(800);

    // Move 3: White 24 → 20
    await clickSquare(page, 24);
    await clickSquare(page, 20);
    await page.waitForTimeout(800);

    // Verify saved game exists in localStorage
    const hasSavedGame = await page.evaluate(() =>
      localStorage.getItem('crazy-checkers-saved-game') !== null,
    );
    expect(hasSavedGame).toBeTruthy();

    // Navigate away (simulates closing tab)
    await page.goto('about:blank');

    // Reopen the app
    await page.goto('/');

    // Verify resume dialog appears
    await expect(page.getByTestId('resume-dialog')).toBeVisible();
  });

  test('clicking Resume restores the saved game state', async ({ page }) => {
    // Start game and make moves
    await startPassAroundGame(page);

    // Move 1: White 22 → 18
    await clickSquare(page, 22);
    await clickSquare(page, 18);
    await page.waitForTimeout(800);

    // Move 2: Black 10 → 14
    await clickSquare(page, 10);
    await clickSquare(page, 14);
    await page.waitForTimeout(800);

    // Move 3: White 24 → 20
    await clickSquare(page, 24);
    await clickSquare(page, 20);
    await page.waitForTimeout(800);

    // Record the board state by checking which squares have pieces
    const boardStateBefore = await page.evaluate(() => {
      const squares: Record<string, string> = {};
      document.querySelectorAll('[data-square]').forEach((el) => {
        const sq = el.getAttribute('data-square');
        const label = el.getAttribute('aria-label');
        if (sq && label && !label.includes('empty')) {
          squares[sq] = label;
        }
      });
      return squares;
    });

    // Navigate away
    await page.goto('about:blank');

    // Reopen
    await page.goto('/');
    await expect(page.getByTestId('resume-dialog')).toBeVisible();

    // Click Resume
    await page.getByTestId('resume-resume').click();
    await expect(page.getByTestId('game-screen')).toBeVisible();

    // Verify the board state matches
    const boardStateAfter = await page.evaluate(() => {
      const squares: Record<string, string> = {};
      document.querySelectorAll('[data-square]').forEach((el) => {
        const sq = el.getAttribute('data-square');
        const label = el.getAttribute('aria-label');
        if (sq && label && !label.includes('empty')) {
          squares[sq] = label;
        }
      });
      return squares;
    });

    expect(boardStateAfter).toEqual(boardStateBefore);
  });

  test('clicking Discard removes saved game and stays on menu', async ({ page }) => {
    // Start game and make a move
    await startPassAroundGame(page);
    await clickSquare(page, 22);
    await clickSquare(page, 18);
    await page.waitForTimeout(800);

    // Navigate away and back
    await page.goto('about:blank');
    await page.goto('/');

    await expect(page.getByTestId('resume-dialog')).toBeVisible();

    // Click Discard
    await page.getByTestId('resume-discard').click();

    // Resume dialog should disappear, menu stays
    await expect(page.getByTestId('resume-dialog')).not.toBeVisible();
    await expect(page.getByTestId('menu-screen')).toBeVisible();

    // Verify saved game is cleared
    const hasSavedGame = await page.evaluate(() =>
      localStorage.getItem('crazy-checkers-saved-game') !== null,
    );
    expect(hasSavedGame).toBeFalsy();
  });
});
