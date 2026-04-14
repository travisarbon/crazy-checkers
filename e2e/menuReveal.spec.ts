import { test, expect, type Page } from '@playwright/test';
import {
  clearAppIndexedDb,
  clearAppStorage,
  injectChallengeRecords,
  navigateToChallenge,
  navigateToChoice,
  navigateToCareer,
  navigateToCogitate,
  navigateToCode,
  seedCodeUnlocks,
  setViewport,
} from './helpers';

async function hasHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
}

test.describe('Menu progressive reveal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await clearAppIndexedDb(page);
  });

  test('initial menu shows only always-visible modes', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('menu-screen')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Classic' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Crazy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Challenge' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Code' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cogitate' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Career' })).toBeVisible();

    await expect(page.getByRole('button', { name: 'Choice' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Classified' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Chaos' })).toHaveCount(0);

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crazy Checkers');
  });

  test('seeding 1 solved challenge reveals Choice on menu', async ({ page }) => {
    await injectChallengeRecords(page, 1);
    await page.goto('/');
    await expect(page.getByTestId('menu-screen')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Choice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Classified' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Chaos' })).toHaveCount(0);
  });

  test('seeding 100 solved challenges reveals Classified on menu', async ({ page }) => {
    await injectChallengeRecords(page, 100);
    await page.goto('/');
    await expect(page.getByTestId('menu-screen')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Choice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Classified' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chaos' })).toHaveCount(0);
  });

  test('Chaos code unlocks Chaos mode and changes the title', async ({ page }) => {
    await seedCodeUnlocks(page, ['chaos']);
    await page.goto('/');
    await expect(page.getByTestId('menu-screen')).toBeVisible();

    await expect(page.getByRole('button', { name: 'Chaos' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chaos Checkers');
  });

  test('UNLOCKALL reveals every mode on menu', async ({ page }) => {
    await seedCodeUnlocks(page, ['all', 'choice', 'classified', 'chaos']);
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Choice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Classified' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chaos' })).toBeVisible();
  });
});

test.describe('Responsive layout — mobile viewport', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await clearAppIndexedDb(page);
    await setViewport(page, 'mobile');
  });

  test('Challenge screen fits within mobile viewport', async ({ page }) => {
    await injectChallengeRecords(page, 1);
    await navigateToChallenge(page);
    await expect(page.getByTestId('challenge-loading')).toBeHidden({ timeout: 10000 });

    await expect(page.getByTestId('challenge-screen')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test('Choice gallery fits within mobile viewport', async ({ page }) => {
    await seedCodeUnlocks(page, ['choice', 'choice-revolution']);
    await navigateToChoice(page);
    await expect(page.getByTestId('choice-loading')).toBeHidden({ timeout: 10000 });

    await expect(page.getByTestId('choice-screen')).toBeVisible();
    await expect(page.getByTestId('choice-track-legend')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test('Career screen fits within mobile viewport', async ({ page }) => {
    await navigateToCareer(page);
    await expect(page.getByTestId('career-loading')).toBeHidden({ timeout: 10000 });

    await expect(page.getByTestId('career-screen')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test('Cogitate screen fits within mobile viewport', async ({ page }) => {
    await navigateToCogitate(page);

    await expect(page.getByTestId('cogitate-home')).toBeVisible();
    await expect(page.getByTestId('cogitate-tool-replay')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test('Code screen fits within mobile viewport', async ({ page }) => {
    await navigateToCode(page);

    await expect(page.getByTestId('code-input')).toBeVisible();
    await expect(page.getByTestId('redeem-button')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});

test.describe('Responsive layout — desktop viewport', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await clearAppIndexedDb(page);
    await setViewport(page, 'desktop');
  });

  test('Challenge screen at desktop has no horizontal overflow', async ({ page }) => {
    await navigateToChallenge(page);
    await expect(page.getByTestId('challenge-loading')).toBeHidden({ timeout: 10000 });
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test('Choice gallery at desktop has no horizontal overflow', async ({ page }) => {
    await seedCodeUnlocks(page, ['choice', 'choice-revolution']);
    await navigateToChoice(page);
    await expect(page.getByTestId('choice-loading')).toBeHidden({ timeout: 10000 });
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test('Career screen at desktop has no horizontal overflow', async ({ page }) => {
    await navigateToCareer(page);
    await expect(page.getByTestId('career-loading')).toBeHidden({ timeout: 10000 });
    expect(await hasHorizontalScroll(page)).toBe(false);
  });

  test('Cogitate at desktop has no horizontal overflow', async ({ page }) => {
    await navigateToCogitate(page);
    await expect(page.getByTestId('cogitate-home')).toBeVisible();
    expect(await hasHorizontalScroll(page)).toBe(false);
  });
});
