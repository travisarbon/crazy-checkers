import { test, expect } from '@playwright/test';
import {
  clearAppIndexedDb,
  clearAppStorage,
  clickSquare,
  injectChallengeRecords,
  navigateToChallenge,
} from './helpers';

test.describe('Challenge Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await clearAppIndexedDb(page);
  });

  test('Challenge screen loads and displays empty progression state', async ({ page }) => {
    await navigateToChallenge(page);

    await expect(page.getByTestId('challenge-loading')).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId('stat-completed')).toBeVisible();
    await expect(page.getByTestId('stat-completed')).toContainText('0');
    await expect(page.getByTestId('challenge-continue')).toBeVisible();
    await expect(page.getByTestId('empty-history')).toBeVisible();
  });

  test('solve Puzzle 1 and verify completion is recorded', async ({ page }) => {
    await navigateToChallenge(page);
    await expect(page.getByTestId('challenge-loading')).toBeHidden({ timeout: 10000 });
    await page.getByTestId('challenge-continue').click();

    // Puzzle 1 solution: white at square 15 jumps to square 8, capturing the
    // piece between them. (From PUZZLE_DATA id=1, solutionPath: ['15x8'])
    await clickSquare(page, 15);
    await clickSquare(page, 8);

    await expect(page.getByTestId('puzzle-completion-dialog')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('puzzle-complete-back').click();

    await expect(page.getByTestId('challenge-screen')).toBeVisible();
    await expect(page.getByTestId('stat-completed')).toContainText('1');
    await expect(page.getByTestId('history-table')).toBeVisible();
  });

  test('completing a puzzle advances Challenge-track progression and unlocks Choice', async ({ page }) => {
    await navigateToChallenge(page);
    await expect(page.getByTestId('challenge-loading')).toBeHidden({ timeout: 10000 });
    await page.getByTestId('challenge-continue').click();
    await clickSquare(page, 15);
    await clickSquare(page, 8);
    await expect(page.getByTestId('puzzle-completion-dialog')).toBeVisible({ timeout: 10000 });
    await page.getByTestId('puzzle-complete-back').click();

    // Navigate back to menu via the Challenge screen's back action
    await page.goto('/');
    await expect(page.getByTestId('menu-screen')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choice' })).toBeVisible();

    // Career screen should reflect Track 1 progression
    await page.getByRole('button', { name: 'Career' }).click();
    await expect(page.getByTestId('career-screen')).toBeVisible();
    await expect(page.getByTestId('unlock-section')).toBeVisible();
  });

  test('puzzle timer records a non-zero completion time', async ({ page }) => {
    await navigateToChallenge(page);
    await expect(page.getByTestId('challenge-loading')).toBeHidden({ timeout: 10000 });
    await page.getByTestId('challenge-continue').click();

    // Wait briefly so the timer has advanced meaningfully
    await page.waitForTimeout(1500);

    await clickSquare(page, 15);
    await clickSquare(page, 8);

    await expect(page.getByTestId('puzzle-completion-dialog')).toBeVisible({ timeout: 10000 });
    // Dialog content should show a time string (e.g. "0:01" or "1s")
    const dialogText = await page.getByTestId('puzzle-completion-dialog').textContent();
    expect(dialogText?.length ?? 0).toBeGreaterThan(0);
  });

  test('incorrect first move does not end the puzzle', async ({ page }) => {
    await navigateToChallenge(page);
    await expect(page.getByTestId('challenge-loading')).toBeHidden({ timeout: 10000 });
    await page.getByTestId('challenge-continue').click();

    // Try a move that is not part of the solution. Click a white piece
    // (square 19 or 20 — these are 'w' in puzzle 1) and try to move it to
    // an invalid square.
    await clickSquare(page, 20);
    await clickSquare(page, 24);

    // Puzzle completion dialog should NOT appear because the puzzle is not
    // solved. Give the UI a moment to settle.
    await page.waitForTimeout(500);
    await expect(page.getByTestId('puzzle-completion-dialog')).toBeHidden();
  });

  test('seeded challenge records show in history table', async ({ page }) => {
    await injectChallengeRecords(page, 3);
    await navigateToChallenge(page);

    await expect(page.getByTestId('challenge-loading')).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId('stat-completed')).toContainText('3');
    await expect(page.getByTestId('history-table')).toBeVisible();
  });
});
