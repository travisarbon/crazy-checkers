import { test, expect } from '@playwright/test';
import { clearAppStorage } from './helpers';

/**
 * Injects a nearly-won game state into localStorage so we can quickly
 * trigger game-over by making a final capture.
 *
 * Board setup: White king on square 14 (row 3, col 2),
 * Black pawn on square 9 (row 2, col 1).
 * White can capture by jumping 14 → 5 (capturing square 9).
 *
 * White is active, human plays White, CPU Easy plays Black.
 */
function buildNearlyWonSavedGame(): string {
  // 32-square board: all null except white king at index 13 (sq 14)
  // and black pawn at index 9 (sq 10)
  const board: (null | { color: string; type: string })[] = new Array(32).fill(null);
  board[13] = { color: 'WHITE', type: 'KING' }; // square 14
  board[8] = { color: 'BLACK', type: 'PAWN' };  // square 9

  const savedGame = {
    version: 1,
    state: {
      board,
      activeColor: 'WHITE',
      status: 'IN_PROGRESS',
      result: null,
      players: { white: 'HUMAN', black: 'CPU_EASY' },
      moveHistory: [
        // Dummy previous move so the game isn't at ply 0
        { from: 18, path: [14], captured: [] },
      ],
      positionHashes: ['abc123', 'def456'],
      halfMoveClock: 0,
      plyCount: 1,
    },
    mode: 'classic',
    playerSetup: { white: 'HUMAN', black: 'CPU_EASY' },
    flipped: false,
    timestamp: Date.now(),
  };

  return JSON.stringify(savedGame);
}

test.describe('Game completion and game-over dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
  });

  test('shows game-over dialog after capturing last piece', async ({ page }) => {
    // Inject nearly-won game state
    await page.evaluate((gameJson) => {
      localStorage.setItem('crazy-checkers-saved-game', gameJson);
    }, buildNearlyWonSavedGame());

    // Reload to pick up the saved game
    await page.goto('/');

    // Resume the saved game
    await expect(page.getByTestId('resume-dialog')).toBeVisible();
    await page.getByTestId('resume-resume').click();
    await expect(page.getByTestId('game-screen')).toBeVisible();

    // Make the winning capture: White king at 14 jumps over Black pawn at 10 to land on 5
    await page.locator('[data-square="14"]').click();
    await page.locator('[data-square="5"]').click();

    // Wait for game-over dialog to appear (after animation)
    await expect(page.getByTestId('game-over-dialog')).toBeVisible({ timeout: 10000 });

    // Verify dialog shows a result
    const heading = page.locator('[id="game-over-heading"]');
    await expect(heading).toBeVisible();
    const headingText = await heading.textContent();
    expect(
      headingText === 'White Wins!' || headingText === 'Black Wins!' || headingText === 'Draw!',
    ).toBeTruthy();

    // Verify dialog displays a reason
    const reason = page.locator('[id="game-over-reason"]');
    await expect(reason).toBeVisible();
    const reasonText = await reason.textContent();
    expect(reasonText?.length).toBeGreaterThan(0);
  });

  test('New Game button returns to setup', async ({ page }) => {
    // Inject nearly-won game state
    await page.evaluate((gameJson) => {
      localStorage.setItem('crazy-checkers-saved-game', gameJson);
    }, buildNearlyWonSavedGame());

    await page.goto('/');
    await page.getByTestId('resume-resume').click();
    await page.getByTestId('game-screen').waitFor();

    // Make the winning capture
    await page.locator('[data-square="14"]').click();
    await page.locator('[data-square="5"]').click();

    await expect(page.getByTestId('game-over-dialog')).toBeVisible({ timeout: 10000 });

    // Click "Main Menu" to return
    await page.getByTestId('game-over-main-menu').click();
    await expect(page.getByTestId('menu-screen')).toBeVisible();
  });
});
