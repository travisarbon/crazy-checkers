/**
 * Shared helpers for Playwright e2e tests.
 */

import type { Page } from '@playwright/test';

/**
 * Start a Pass Around (two-player) Classic game.
 * Navigates from menu → setup dialog → game screen.
 */
export async function startPassAroundGame(page: Page): Promise<void> {
  await page.goto('/');
  // Dismiss resume dialog if present
  const resumeDiscard = page.getByTestId('resume-discard');
  if (await resumeDiscard.isVisible({ timeout: 500 }).catch(() => false)) {
    await resumeDiscard.click();
  }
  await page.getByRole('button', { name: 'Classic' }).click();
  await page.getByTestId('game-setup-dialog').waitFor();
  // Pass Around is the default game type
  await page.getByTestId('setup-start').click();
  await page.getByTestId('game-screen').waitFor();
}

/**
 * Start a Classic game vs CPU at the given difficulty.
 */
export async function startCpuGame(
  page: Page,
  difficulty: 'easy' | 'hard' = 'easy',
): Promise<void> {
  await page.goto('/');
  // Dismiss resume dialog if present
  const resumeDiscard = page.getByTestId('resume-discard');
  if (await resumeDiscard.isVisible({ timeout: 500 }).catch(() => false)) {
    await resumeDiscard.click();
  }
  await page.getByRole('button', { name: 'Classic' }).click();
  await page.getByTestId('game-setup-dialog').waitFor();
  // Select "vs. CPU"
  await page.getByLabel('vs. CPU').check();
  // Select difficulty
  await page.getByTestId('difficulty-fieldset').waitFor();
  if (difficulty === 'hard') {
    await page.getByLabel('Hard').check();
  }
  // White is selected by default (human plays white)
  await page.getByTestId('setup-start').click();
  await page.getByTestId('game-screen').waitFor();
}

/**
 * Click a board square by its square number (1-32).
 */
export async function clickSquare(page: Page, sq: number): Promise<void> {
  await page.locator(`[data-square="${sq}"]`).click();
}

/**
 * Count pieces of a given color currently on the board.
 */
export async function countPieces(
  page: Page,
  color: 'white' | 'black',
): Promise<number> {
  const ariaPattern = color === 'white' ? /white (pawn|king)/ : /black (pawn|king)/;
  const cells = page.locator('[role="gridcell"]');
  const count = await cells.count();
  let pieceCount = 0;
  for (let i = 0; i < count; i++) {
    const label = await cells.nth(i).getAttribute('aria-label');
    if (label && ariaPattern.test(label)) {
      pieceCount++;
    }
  }
  return pieceCount;
}

/**
 * Wait for any board animation to finish (no animating pieces visible).
 */
export async function waitForAnimationEnd(page: Page): Promise<void> {
  // Wait a brief moment for animations to start, then wait for board stability
  await page.waitForTimeout(100);
  // Wait until turn indicator no longer says "Thinking..."
  await page.waitForFunction(() => {
    const indicator = document.querySelector('[data-testid="turn-indicator"]');
    return indicator && !indicator.textContent?.includes('Thinking');
  }, { timeout: 15000 }).catch(() => { /* may not be thinking */ });
}

/**
 * Clear all app-related localStorage keys.
 */
export async function clearAppStorage(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('crazy-checkers-settings');
    localStorage.removeItem('crazy-checkers-saved-game');
    localStorage.removeItem('crazy-checkers-game-history');
  });
}
