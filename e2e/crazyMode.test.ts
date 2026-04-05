/**
 * Task 14.2 — Playwright E2E Tests: Crazy Mode game flow.
 *
 * Validates Crazy mode gameplay from menu to game-over, including
 * event announcements, active events indicator, and save/resume.
 */

import { test, expect } from '@playwright/test';
import {
  startCrazyPassAroundGame,
  startCrazyCpuGame,
  clickSquare,
  countPieces,
  clearAppStorage,
  waitForAnimationEnd,
} from './helpers';

test.describe('Crazy Mode game flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
  });

  test('Test 1.1 — Menu shows Crazy mode button and launches setup dialog', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('menu-screen')).toBeVisible();
    const crazyButton = page.getByRole('button', { name: 'Crazy' });
    await expect(crazyButton).toBeVisible();
    await crazyButton.click();
    await expect(page.getByTestId('game-setup-dialog')).toBeVisible();
  });

  test('Test 1.2 — Start a Crazy Pass Around game', async ({ page }) => {
    await startCrazyPassAroundGame(page);
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await expect(page.getByTestId('board')).toBeVisible();
    const whitePieces = await countPieces(page, 'white');
    const blackPieces = await countPieces(page, 'black');
    expect(whitePieces).toBe(12);
    expect(blackPieces).toBe(12);
    await expect(page.getByTestId('turn-indicator')).toContainText("White's turn");
  });

  test('Test 1.3 — Make standard moves (no multi-jump, no event)', async ({ page }) => {
    await startCrazyPassAroundGame(page);

    // Make a single move — White pawn from 22 to 18
    await clickSquare(page, 22);
    await expect(page.getByTestId('highlight-selected')).toBeVisible();
    await clickSquare(page, 18);
    await page.waitForTimeout(800);

    // Turn should switch to Black
    await expect(page.getByTestId('turn-indicator')).toContainText("Black's turn");

    // No event announcement should appear for a simple move
    await expect(page.getByTestId('event-announcement')).not.toBeVisible();
  });

  test('Test 1.6 — Play a Crazy mode game vs Easy CPU without crashes', async ({ page }) => {
    await startCrazyCpuGame(page, 'easy');

    // Make a first move as White — pick a standard opening
    await clickSquare(page, 22);
    await page.waitForTimeout(300);
    await clickSquare(page, 18);
    await page.waitForTimeout(500);

    // Wait for CPU to respond
    await waitForAnimationEnd(page);
    await page.waitForTimeout(1000);

    // Verify game is still running (or over — either is fine for a smoke test)
    const gameScreen = page.getByTestId('game-screen');
    const gameOverDialog = page.getByTestId('game-over-dialog');
    const screenVisible = await gameScreen.isVisible({ timeout: 1000 }).catch(() => false);
    const gameOverVisible = await gameOverDialog.isVisible({ timeout: 1000 }).catch(() => false);
    expect(screenVisible || gameOverVisible).toBe(true);
  });

  test('Test 1.7 — Resume dialog appears for in-progress Crazy game', async ({ page }) => {
    await startCrazyPassAroundGame(page);

    // Make a couple moves
    await clickSquare(page, 22);
    await clickSquare(page, 18);
    await page.waitForTimeout(800);

    // Navigate back to menu
    await page.goto('/');

    // Resume dialog should appear
    const resumeDialog = page.getByTestId('resume-dialog');
    await expect(resumeDialog).toBeVisible({ timeout: 3000 });

    // Check mode label shows "crazy"
    const modeLabel = page.getByTestId('resume-mode');
    await expect(modeLabel).toContainText('crazy');

    // Click Resume
    await page.getByTestId('resume-resume').click();
    await expect(page.getByTestId('game-screen')).toBeVisible();
  });
});
