import { test, expect } from '@playwright/test';
import {
  clearAppIndexedDb,
  clearAppStorage,
  navigateToCode,
} from './helpers';

test.describe('Code Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await clearAppIndexedDb(page);
  });

  test('Code screen renders with input, disabled button, and empty history', async ({ page }) => {
    await navigateToCode(page);

    await expect(page.getByTestId('code-input')).toBeVisible();
    await expect(page.getByTestId('code-input')).toHaveValue('');
    await expect(page.getByTestId('redeem-button')).toBeDisabled();
    await expect(page.getByTestId('history-empty')).toBeVisible();
  });

  test('entering a valid code shows success and records redemption', async ({ page }) => {
    await navigateToCode(page);

    await page.getByTestId('code-input').fill('REVOLUTION');
    await expect(page.getByTestId('redeem-button')).toBeEnabled();
    await page.getByTestId('redeem-button').click();

    await expect(page.getByTestId('status-message')).toBeVisible({ timeout: 5000 });
    const status = await page.getByTestId('status-message').textContent();
    expect(status?.toLowerCase()).toContain('revolution');

    await expect(page.getByTestId('history-list')).toBeVisible();
  });

  test('entering an invalid code shows error message', async ({ page }) => {
    await navigateToCode(page);

    await page.getByTestId('code-input').fill('NOT-A-REAL-CODE-XYZ');
    await page.getByTestId('redeem-button').click();

    await expect(page.getByTestId('status-message')).toBeVisible({ timeout: 5000 });
    const status = await page.getByTestId('status-message').textContent();
    expect((status ?? '').toLowerCase()).toMatch(/invalid|not recognized|unknown/);
    await expect(page.getByTestId('history-empty')).toBeVisible();
  });

  test('entering a previously redeemed code shows already-unlocked feedback', async ({ page }) => {
    await navigateToCode(page);
    await page.getByTestId('code-input').fill('REVOLUTION');
    await page.getByTestId('redeem-button').click();
    await expect(page.getByTestId('status-message')).toBeVisible({ timeout: 5000 });

    await page.getByTestId('code-input').fill('REVOLUTION');
    await page.getByTestId('redeem-button').click();

    await expect(page.getByTestId('status-message')).toBeVisible({ timeout: 5000 });
    const status = await page.getByTestId('status-message').textContent();
    expect((status ?? '').toLowerCase()).toMatch(/already|already unlocked|redeemed/);
  });

  test('Chaos code changes the menu title to "Chaos Checkers"', async ({ page }) => {
    await navigateToCode(page);
    await page.getByTestId('code-input').fill('CHAOS');
    await page.getByTestId('redeem-button').click();
    await expect(page.getByTestId('status-message')).toBeVisible({ timeout: 5000 });

    await page.goto('/');
    await expect(page.getByTestId('menu-screen')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chaos Checkers');
    await expect(page.getByRole('button', { name: 'Chaos' })).toBeVisible();
  });

  test('code input is normalized (case-insensitive, whitespace ignored)', async ({ page }) => {
    await navigateToCode(page);
    await page.getByTestId('code-input').fill('  revolution  ');
    await page.getByTestId('redeem-button').click();

    await expect(page.getByTestId('status-message')).toBeVisible({ timeout: 5000 });
    const status = await page.getByTestId('status-message').textContent();
    expect((status ?? '').toLowerCase()).not.toMatch(/invalid|not recognized/);
  });

  test('UNLOCKALL code reveals Choice, Classified, and Chaos on menu', async ({ page }) => {
    await navigateToCode(page);
    await page.getByTestId('code-input').fill('UNLOCKALL');
    await page.getByTestId('redeem-button').click();
    await expect(page.getByTestId('status-message')).toBeVisible({ timeout: 5000 });

    await page.goto('/');
    await expect(page.getByTestId('menu-screen')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Choice' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Classified' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chaos' })).toBeVisible();
  });
});
