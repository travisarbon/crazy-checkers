import { test, expect } from '@playwright/test';
import {
  buildPaddedBoardStates,
  clearAppIndexedDb,
  clearAppStorage,
  injectGameRecords,
  navigateToCogitate,
  type SeededGameRecord,
} from './helpers';

function makeReplayableGame(): SeededGameRecord {
  const now = Date.now();
  return {
    id: 'replay-target',
    mode: 'classic',
    playerWhite: 'HUMAN',
    playerBlack: 'CPU_EASY',
    result: 'WHITE_WIN',
    reason: 'opponent-no-pieces',
    moves: ['11-15', '22-18', '15-19', '18-14', '19-23', '26-22'],
    boardStates: buildPaddedBoardStates(6),
    startedAt: now - 120_000,
    completedAt: now,
  };
}

test.describe('Cogitate Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await clearAppIndexedDb(page);
  });

  test('Cogitate home screen displays all four tool cards', async ({ page }) => {
    await navigateToCogitate(page);
    await expect(page.getByTestId('cogitate-home')).toBeVisible();

    await expect(page.getByTestId('cogitate-tool-replay')).toBeVisible();
    await expect(page.getByTestId('cogitate-tool-analysis')).toBeVisible();
    await expect(page.getByTestId('cogitate-tool-training')).toBeVisible();
    await expect(page.getByTestId('cogitate-tool-freeplay')).toBeVisible();
  });

  test('Free Play launch button is always enabled', async ({ page }) => {
    await navigateToCogitate(page);
    await expect(page.getByTestId('cogitate-tool-freeplay-launch')).toBeEnabled();
  });

  test('Replay tool opens when a seeded game record exists', async ({ page }) => {
    await injectGameRecords(page, [makeReplayableGame()]);
    await navigateToCogitate(page);

    const replayLaunch = page.getByTestId('cogitate-tool-replay-launch');
    await expect(replayLaunch).toBeEnabled({ timeout: 10000 });
    await replayLaunch.click();

    await expect(page.getByTestId('replay-tool')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('replay-transport-bar')).toBeVisible();
    await expect(page.getByTestId('replay-ply-readout')).toBeVisible();
    await expect(page.getByTestId('replay-game-metadata')).toBeVisible();
  });

  test('Replay tool supports forward and backward navigation', async ({ page }) => {
    await injectGameRecords(page, [makeReplayableGame()]);
    await navigateToCogitate(page);

    await page.getByTestId('cogitate-tool-replay-launch').click();
    await expect(page.getByTestId('replay-tool')).toBeVisible({ timeout: 10000 });

    const forward = page.getByTestId('replay-forward');
    const back = page.getByTestId('replay-back');
    const readout = page.getByTestId('replay-ply-readout');

    const initialText = (await readout.textContent()) ?? '';
    await forward.click();
    await page.waitForTimeout(100);
    const afterForward = (await readout.textContent()) ?? '';
    expect(afterForward).not.toBe(initialText);

    await back.click();
    await page.waitForTimeout(100);
    const afterBack = (await readout.textContent()) ?? '';
    expect(afterBack).toBe(initialText);
  });

  test('Analysis tool opens with a seeded game record', async ({ page }) => {
    await injectGameRecords(page, [makeReplayableGame()]);
    await navigateToCogitate(page);

    const analysisLaunch = page.getByTestId('cogitate-tool-analysis-launch');
    await expect(analysisLaunch).toBeEnabled({ timeout: 10000 });
    await analysisLaunch.click();

    await expect(page.getByTestId('analysis-tool')).toBeVisible({ timeout: 10000 });
  });

  test('Cogitate back navigation returns to home', async ({ page }) => {
    await injectGameRecords(page, [makeReplayableGame()]);
    await navigateToCogitate(page);

    await page.getByTestId('cogitate-tool-replay-launch').click();
    await expect(page.getByTestId('replay-tool')).toBeVisible({ timeout: 10000 });

    // Navigate back via the browser's back button (the app listens for popstate)
    await page.goBack();
    await expect(page.getByTestId('cogitate-home')).toBeVisible({ timeout: 5000 });
  });
});
