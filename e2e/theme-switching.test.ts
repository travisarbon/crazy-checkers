import { test, expect } from '@playwright/test';
import { clearAppStorage } from './helpers';

test.describe('Theme switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    // Reload so defaults take effect after clearing storage
    await page.goto('/');
  });

  test('navigates to Configure screen and sees theme options', async ({ page }) => {
    await page.getByRole('button', { name: 'Configure' }).click();
    await expect(page.getByTestId('config-screen')).toBeVisible();
    // Verify theme radio group is visible
    await expect(page.getByRole('radiogroup', { name: 'Theme selection' })).toBeVisible();
  });

  test('switching theme changes CSS custom properties', async ({ page }) => {
    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByTestId('config-screen').waitFor();

    // Read the current board-dark color (default theme is "crazy")
    const initialBoardDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--board-dark').trim(),
    );

    // Select a different theme — Classic
    await page.getByRole('radio', { name: 'Classic' }).click();

    // Read the new board-dark color
    const newBoardDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--board-dark').trim(),
    );

    // Colors should have changed
    expect(newBoardDark).not.toBe(initialBoardDark);
  });

  test('selected theme renders on the game board', async ({ page }) => {
    // Switch to Classic theme
    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByRole('radio', { name: 'Classic' }).click();

    // Read the expected board-dark color
    const expectedBoardDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--board-dark').trim(),
    );

    // Navigate back and start a game
    await page.getByRole('button', { name: 'Back to main menu' }).click();
    await page.getByRole('button', { name: 'Classic' }).click();
    await page.getByTestId('setup-start').click();
    await page.getByTestId('game-screen').waitFor();

    // Verify the board uses the same theme colors
    const gameBoardDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--board-dark').trim(),
    );
    expect(gameBoardDark).toBe(expectedBoardDark);
  });

  test('theme persists after page reload', async ({ page }) => {
    // Switch to Cork theme
    await page.getByRole('button', { name: 'Configure' }).click();
    await page.getByRole('radio', { name: 'Cork' }).click();

    const corkBoardDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--board-dark').trim(),
    );

    // Reload the page
    await page.reload();
    await page.getByTestId('menu-screen').waitFor();

    // Verify the theme colors are still applied
    const afterReloadBoardDark = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--board-dark').trim(),
    );
    expect(afterReloadBoardDark).toBe(corkBoardDark);

    // Also verify via the config screen that Cork is still selected
    await page.getByRole('button', { name: 'Configure' }).click();
    const corkRadio = page.getByRole('radio', { name: 'Cork' });
    await expect(corkRadio).toHaveAttribute('aria-checked', 'true');
  });
});
