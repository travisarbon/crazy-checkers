import { test, expect } from '@playwright/test';
import {
  buildPaddedBoardStates,
  clearAppIndexedDb,
  clearAppStorage,
  injectChallengeRecords,
  injectGameRecords,
  navigateToCareer,
  type SeededGameRecord,
} from './helpers';

function makeGame(overrides: Partial<SeededGameRecord>): SeededGameRecord {
  const now = Date.now();
  return {
    mode: overrides.mode ?? 'classic',
    playerWhite: overrides.playerWhite ?? 'HUMAN',
    playerBlack: overrides.playerBlack ?? 'CPU_EASY',
    result: overrides.result ?? 'WHITE_WIN',
    reason: overrides.reason ?? 'opponent-no-pieces',
    moves: overrides.moves ?? ['11-15', '22-18', '15x22'],
    boardStates: overrides.boardStates ?? buildPaddedBoardStates(3),
    startedAt: overrides.startedAt ?? now - 60_000,
    completedAt: overrides.completedAt ?? now,
    id: overrides.id,
  };
}

test.describe('Career Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await clearAppIndexedDb(page);
  });

  test('Career screen displays empty state with no games played', async ({ page }) => {
    await navigateToCareer(page);
    await expect(page.getByTestId('career-loading')).toBeHidden({ timeout: 10000 });

    // Either the empty state or the summary section with zeroes should show.
    const empty = page.getByTestId('career-empty');
    const summary = page.getByTestId('summary-section');
    const emptyVisible = await empty.isVisible().catch(() => false);
    const summaryVisible = await summary.isVisible().catch(() => false);
    expect(emptyVisible || summaryVisible).toBeTruthy();

    if (summaryVisible) {
      await expect(page.getByTestId('stat-total-games')).toContainText('0');
    }
  });

  test('Career screen displays stats after multiple games', async ({ page }) => {
    await injectGameRecords(page, [
      makeGame({ mode: 'classic', result: 'WHITE_WIN', id: 'g1' }),
      makeGame({ mode: 'crazy', result: 'BLACK_WIN', id: 'g2', playerWhite: 'HUMAN', playerBlack: 'CPU_HARD' }),
      makeGame({ mode: 'classic', result: 'WHITE_WIN', id: 'g3', playerWhite: 'HUMAN', playerBlack: 'HUMAN' }),
    ]);

    await navigateToCareer(page);
    await expect(page.getByTestId('career-loading')).toBeHidden({ timeout: 10000 });

    await expect(page.getByTestId('summary-section')).toBeVisible();
    await expect(page.getByTestId('stat-total-games')).toContainText('3');
  });

  test('Career screen shows unlock track progression', async ({ page }) => {
    await injectChallengeRecords(page, 1);
    await injectGameRecords(page, [
      makeGame({ mode: 'crazy', result: 'WHITE_WIN', playerBlack: 'CPU_HARD', id: 'gc1' }),
      makeGame({ mode: 'crazy', result: 'WHITE_WIN', playerBlack: 'CPU_HARD', id: 'gc2' }),
      makeGame({ mode: 'crazy', result: 'WHITE_WIN', playerBlack: 'CPU_HARD', id: 'gc3' }),
    ]);

    await navigateToCareer(page);
    await expect(page.getByTestId('career-loading')).toBeHidden({ timeout: 10000 });
    await expect(page.getByTestId('unlock-section')).toBeVisible();
  });

  test('Chaos Gate section displays requirement status', async ({ page }) => {
    await navigateToCareer(page);
    await expect(page.getByTestId('career-loading')).toBeHidden({ timeout: 10000 });

    await expect(page.getByTestId('chaos-gate-section')).toBeVisible();
    await expect(page.getByTestId('chaos-gate-challenges')).toBeVisible();
    await expect(page.getByTestId('chaos-gate-choice')).toBeVisible();
    await expect(page.getByTestId('chaos-gate-classified')).toBeVisible();
    await expect(page.getByTestId('chaos-gate-classified-hard')).toBeVisible();
    await expect(page.getByTestId('chaos-gate-unlocked')).toBeHidden();
  });

  test('Career stats reflect newly added game records', async ({ page }) => {
    await navigateToCareer(page);
    await expect(page.getByTestId('career-loading')).toBeHidden({ timeout: 10000 });

    // Navigate back and seed, then revisit
    await page.goto('/');
    await injectGameRecords(page, [makeGame({ id: 'g-new', mode: 'classic', result: 'WHITE_WIN' })]);

    await page.goto('/');
    await page.getByRole('button', { name: 'Career' }).click();
    await expect(page.getByTestId('career-screen')).toBeVisible();
    await expect(page.getByTestId('career-loading')).toBeHidden({ timeout: 10000 });

    await expect(page.getByTestId('summary-section')).toBeVisible();
    await expect(page.getByTestId('stat-total-games')).toContainText('1');
  });
});
