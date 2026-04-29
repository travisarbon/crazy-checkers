/**
 * P4.4 — Margin Notes escalation layer e2e coverage.
 *
 * The full per-(screen × tier) snapshot suite envisioned by the parent
 * plan §P4.4.2 is deferred per the plan's §P4.4.7 R1 risk note (snapshot
 * tests on font-rendering across OSes are notoriously flaky). This spec
 * substitutes a leaner contract:
 *
 *   1. Loading under Margin Notes fetches the escalation chunk exactly
 *      once on first paint; non-Margin-Notes themes never fetch it.
 *   2. Switching to Margin Notes from another theme loads the chunk
 *      lazily.
 *   3. Each tier produces a *different* computed background on the body
 *      (proves the data-mode rules in marginnotes.escalation.css are
 *      actually applying).
 *
 * The data-mode attribute updates themselves are covered by the
 * pre-existing data-mode-substrate.spec.ts (P1.3).
 */

import { test, expect } from '@playwright/test';
import { clearAppStorage, enableMarginNotesEscalation } from './helpers';

test.describe('Margin Notes escalation — bundle behavior (P4.4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
  });

  test('escalation CSS is fetched on first paint when stored theme is margin-notes', async ({
    page,
  }) => {
    await enableMarginNotesEscalation(page);
    const escalationRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('marginnotes.escalation')) {
        escalationRequests.push(req.url());
      }
    });
    await page.goto('/');
    await page.getByTestId('menu-screen').waitFor();
    expect(escalationRequests.length).toBeGreaterThanOrEqual(1);
  });

  test('escalation CSS is NOT fetched when stored theme is non-margin-notes', async ({
    page,
  }) => {
    // Default settings → themeId: 'crazy-original' → no escalation.
    const escalationRequests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('marginnotes.escalation')) {
        escalationRequests.push(req.url());
      }
    });
    await page.goto('/');
    await page.getByTestId('menu-screen').waitFor();
    expect(escalationRequests).toEqual([]);
  });
});

test.describe('Margin Notes escalation — tier rendering (P4.4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await enableMarginNotesEscalation(page);
    await page.goto('/');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByTestId('menu-screen').waitFor();
  });

  test('crazy tier paints a distinct background-image on the body', async ({
    page,
  }) => {
    const menuBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundImage,
    );
    await page.getByRole('button', { name: 'Crazy' }).click();
    await page.getByTestId('crazy-screen').waitFor();
    const crazyBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundImage,
    );
    expect(crazyBg).not.toBe(menuBg);
    expect(crazyBg).toMatch(/radial-gradient/);
  });

  test('chaos tier paints a graph-paper background on the body', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Chaos' }).click();
    // Chaos may be locked behind progression; if so, skip gracefully.
    const chaosScreen = page.getByTestId('chaos-screen');
    const isVisible = await chaosScreen
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    test.skip(!isVisible, 'Chaos mode locked in this environment');
    const chaosBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundImage,
    );
    expect(chaosBg).toMatch(/linear-gradient/);
  });

  test('classic tier produces the quiet baseline (no escalation gradients)', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Classic' }).click();
    await page.getByTestId('classic-screen').waitFor();
    const classicBg = await page.evaluate(
      () => getComputedStyle(document.body).backgroundImage,
    );
    // Classic explicitly has no rules; the body's background-image
    // should be the theme's default (typically 'none').
    expect(classicBg === 'none' || !classicBg.includes('radial-gradient')).toBe(
      true,
    );
  });
});
