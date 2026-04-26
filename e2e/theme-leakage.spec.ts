import { test, expect } from '@playwright/test';
import { clearAppStorage } from './helpers';

/**
 * P2.2 — Cross-theme leakage check.
 *
 * For each of the six shipped themes, navigate to a representative screen and
 * capture a screenshot. After every theme has been visited, assert that no
 * (themeA, themeB) pair produced byte-identical screenshots of the same
 * screen. A zero-byte diff would mean the screen does not respond to a theme
 * switch — i.e. some visual surface is leaking colors that bypass the theme
 * tokens.
 *
 * The assertion is intentionally minimal: it verifies *responsiveness*, not
 * pixel-perfect correctness. Phase 3 snapshot tests will pin exact baseline
 * images for each surface.
 *
 * See: Documentation/UI Overhaul/P2.2-Audit-Hardcoded-Colors.md §5 Step 10
 */

const THEME_LABELS = [
  'Classic',
  'Contrast',
  'Cork',
  'Crazy (Original)',
  'Current',
  'Margin Notes',
] as const;
type ThemeLabel = (typeof THEME_LABELS)[number];

interface ScreenSpec {
  readonly name: string;
}

const SCREENS: readonly ScreenSpec[] = [
  { name: 'menu' },
  { name: 'configure' },
];

const screenshots = new Map<ThemeLabel, Map<string, Buffer>>();

test.describe('Margin Notes — cross-theme leakage check (P2.2)', () => {
  test.beforeAll(() => {
    screenshots.clear();
  });

  for (const theme of THEME_LABELS) {
    test(`theme=${theme} renders distinctly on every primary screen`, async ({
      page,
    }) => {
      await page.goto('/');
      await clearAppStorage(page);
      await page.goto('/');

      // Open Configure → Themes radiogroup, select the theme.
      await page.getByRole('button', { name: 'Configure' }).click();
      await page.getByTestId('config-screen').waitFor();
      const themeGroup = page.getByRole('radiogroup', { name: 'Theme selection' });
      await themeGroup.getByRole('radio', { name: theme, exact: true }).click();

      // Wait for the theme's CSS custom properties to land on :root.
      await page.waitForFunction(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--ui-bg').trim() !== '';
      });

      const themeMap = new Map<string, Buffer>();

      // Screen 1 — Configure (still here)
      themeMap.set(
        'configure',
        await page.screenshot({ animations: 'disabled' }),
      );

      // Screen 2 — Menu
      await page.getByRole('button', { name: 'Back to previous screen' }).click();
      await page.getByTestId('menu-screen').waitFor();
      themeMap.set('menu', await page.screenshot({ animations: 'disabled' }));

      screenshots.set(theme, themeMap);
    });
  }

  test('every (themeA, themeB) pair produces a non-zero pixel diff on each screen', async () => {
    for (let i = 0; i < THEME_LABELS.length; i += 1) {
      for (let j = i + 1; j < THEME_LABELS.length; j += 1) {
        const themeA = THEME_LABELS[i] as ThemeLabel;
        const themeB = THEME_LABELS[j] as ThemeLabel;
        const a = screenshots.get(themeA);
        const b = screenshots.get(themeB);
        expect(a, `screenshots missing for theme=${themeA}`).toBeDefined();
        expect(b, `screenshots missing for theme=${themeB}`).toBeDefined();
        if (!a || !b) continue;
        for (const screen of SCREENS) {
          const aBuf = a.get(screen.name);
          const bBuf = b.get(screen.name);
          expect(aBuf, `screen=${screen.name} missing for theme=${themeA}`).toBeDefined();
          expect(bBuf, `screen=${screen.name} missing for theme=${themeB}`).toBeDefined();
          if (!aBuf || !bBuf) continue;
          // PNG encoding is deterministic on identical pixel input. If two themes
          // produce byte-identical buffers, the screen rendered the same despite
          // different theme tokens — a leakage signal.
          expect(
            aBuf.equals(bBuf),
            `theme=${themeA} and theme=${themeB} produced identical screenshots on screen=${screen.name}`,
          ).toBe(false);
        }
      }
    }
  });
});
