import { test, expect } from '@playwright/test';
import { startPassAroundGame, clearAppStorage } from './helpers';

test.describe('Keyboard-only game flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
  });

  test('can navigate board and make moves with keyboard', async ({ page }) => {
    await startPassAroundGame(page);

    // Tab into the board area — the board SVG is focusable via its grid cells
    const board = page.getByTestId('board');

    // Focus the board by clicking it first, then use keyboard
    // Start by focusing a square — click on a white piece square to enter the board
    await page.locator('[data-square="1"]').focus();

    // Navigate down to the white pieces using arrow keys
    // Square 1 is at row 0, col 1 — need to get to row 5+ for white pieces
    // Use ArrowDown repeatedly to reach white piece territory
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowDown');
    }

    // We should now be around row 5 (white piece area, squares 21-24)
    // Get the currently focused square number
    let focusedSquare = await page.evaluate(() => {
      const el = document.activeElement;
      return el?.getAttribute('data-square') ?? null;
    });

    // Navigate to find a white piece — use arrow keys to explore
    // Keep navigating until we find a square with a white piece
    let foundWhitePiece = false;
    for (let attempts = 0; attempts < 16; attempts++) {
      const label = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.getAttribute('aria-label') ?? '';
      });
      if (label.includes('white')) {
        foundWhitePiece = true;
        break;
      }
      // Alternate between right and down to explore
      await page.keyboard.press(attempts % 2 === 0 ? 'ArrowRight' : 'ArrowDown');
    }
    expect(foundWhitePiece).toBeTruthy();

    // Record which square we're on
    focusedSquare = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-square') ?? null,
    );
    expect(focusedSquare).not.toBeNull();

    // Press Enter to select the piece
    await page.keyboard.press('Enter');

    // Verify piece is selected (highlight-selected should appear)
    await expect(page.getByTestId('highlight-selected')).toBeVisible();

    // Navigate to a legal destination — legal-dot indicators should be visible
    await expect(page.locator('[data-testid="legal-dot"]').first()).toBeVisible();

    // Navigate with arrow keys to find a legal destination
    let foundLegalDest = false;
    for (let attempts = 0; attempts < 8; attempts++) {
      await page.keyboard.press('ArrowUp');
      const isLegal = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return false;
        // Check if this square has a legal-dot child
        return el.querySelector('[data-testid="legal-dot"]') !== null;
      });
      if (isLegal) {
        foundLegalDest = true;
        break;
      }
    }
    expect(foundLegalDest).toBeTruthy();

    // Press Enter to confirm the move
    await page.keyboard.press('Enter');

    // Wait for animation
    await page.waitForTimeout(800);

    // Verify turn switched to Black
    await expect(page.getByTestId('turn-indicator')).toContainText("Black's turn");
  });

  test('Escape deselects the current selection', async ({ page }) => {
    await startPassAroundGame(page);

    // Focus a white piece directly
    await page.locator('[data-square="22"]').focus();
    await page.keyboard.press('Enter');

    // Verify selection
    await expect(page.getByTestId('highlight-selected')).toBeVisible();

    // Press Escape to deselect
    await page.keyboard.press('Escape');

    // Verify deselection — no selected highlight
    await expect(page.getByTestId('highlight-selected')).not.toBeVisible();
    // Legal move dots should also disappear
    await expect(page.locator('[data-testid="legal-dot"]')).not.toBeVisible();
  });

  test('can make multiple moves using only keyboard', async ({ page }) => {
    await startPassAroundGame(page);

    // Use moves carefully chosen to avoid triggering forced captures.
    // Move 1: White 22 → 18
    await page.locator('[data-square="22"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('highlight-selected')).toBeVisible();
    await page.locator('[data-square="18"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    await expect(page.getByTestId('turn-indicator')).toContainText("Black's turn");

    // Move 2: Black 9 → 13
    await page.locator('[data-square="9"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-square="13"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    await expect(page.getByTestId('turn-indicator')).toContainText("White's turn");

    // Move 3: White 24 → 20
    await page.locator('[data-square="24"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-square="20"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    await expect(page.getByTestId('turn-indicator')).toContainText("Black's turn");

    // Move 4: Black 10 → 15 (avoids forced captures since White at 18
    // can't jump to occupied sq 11)
    await page.locator('[data-square="10"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('[data-square="15"]').focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    await expect(page.getByTestId('turn-indicator')).toContainText("White's turn");
  });
});
