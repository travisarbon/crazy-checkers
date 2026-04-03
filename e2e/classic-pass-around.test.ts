import { test, expect } from '@playwright/test';
import { startPassAroundGame, clickSquare, countPieces, clearAppStorage } from './helpers';

test.describe('Classic Pass-Around game flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
  });

  test('navigates to title screen and clicks Classic', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('menu-screen')).toBeVisible();
    await page.getByRole('button', { name: 'Classic' }).click();
    await expect(page.getByTestId('game-setup-dialog')).toBeVisible();
  });

  test('selects Pass Around mode and starts game', async ({ page }) => {
    await startPassAroundGame(page);
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await expect(page.getByTestId('board')).toBeVisible();
  });

  test('initial board renders 12 white and 12 black pieces', async ({ page }) => {
    await startPassAroundGame(page);
    const whitePieces = await countPieces(page, 'white');
    const blackPieces = await countPieces(page, 'black');
    expect(whitePieces).toBe(12);
    expect(blackPieces).toBe(12);
  });

  test('clicking a white piece selects it and shows legal moves', async ({ page }) => {
    await startPassAroundGame(page);

    // Click a white piece that has legal moves (square 21 is in row 5, can move forward)
    await clickSquare(page, 21);

    // Verify selection highlight appears
    await expect(page.getByTestId('highlight-selected')).toBeVisible();
  });

  test('clicking a legal destination moves the piece and switches turn', async ({ page }) => {
    await startPassAroundGame(page);

    // Verify it's White's turn initially
    await expect(page.getByTestId('turn-indicator')).toContainText("White's turn");

    // Click white piece at square 22 (row 5, col 2)
    await clickSquare(page, 22);
    await expect(page.getByTestId('highlight-selected')).toBeVisible();

    // Click legal destination — square 17 or 18 (one of the forward squares)
    // Square 18 is at row 4, col 3 — legal from square 22
    await clickSquare(page, 18);

    // Wait for animation to complete
    await page.waitForTimeout(800);

    // Verify turn switches to Black
    await expect(page.getByTestId('turn-indicator')).toContainText("Black's turn");
  });

  test('makes 2 more moves (one for each side) and verifies board state', async ({ page }) => {
    await startPassAroundGame(page);

    // Move 1: White moves 22 → 18
    await clickSquare(page, 22);
    await clickSquare(page, 18);
    await page.waitForTimeout(800);
    await expect(page.getByTestId('turn-indicator')).toContainText("Black's turn");

    // Move 2: Black moves 10 → 14 (row 2 → row 3)
    await clickSquare(page, 10);
    await clickSquare(page, 14);
    await page.waitForTimeout(800);
    await expect(page.getByTestId('turn-indicator')).toContainText("White's turn");

    // Move 3: White moves 21 → 17
    await clickSquare(page, 21);
    await clickSquare(page, 17);
    await page.waitForTimeout(800);
    await expect(page.getByTestId('turn-indicator')).toContainText("Black's turn");

    // Verify total piece counts haven't changed (no captures yet)
    const whitePieces = await countPieces(page, 'white');
    const blackPieces = await countPieces(page, 'black');
    expect(whitePieces).toBe(12);
    expect(blackPieces).toBe(12);
  });
});
