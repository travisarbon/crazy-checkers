/**
 * Live repro for the kinging-freezes-the-board bug.
 * Uses the dev server (started by playwright.config.ts).
 */

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('Russian Draughts: a click on a starting white piece highlights legal targets', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      errors.push(`${msg.type()}: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });

  await page.goto('/');
  const resumeDiscard = page.getByTestId('resume-discard');
  if (await resumeDiscard.isVisible({ timeout: 500 }).catch(() => false)) {
    await resumeDiscard.click();
  }

  // Unlock everything via Code mode.
  await page.getByRole('button', { name: 'Code' }).click();
  await page.getByRole('textbox').first().fill('UNLOCKALL');
  // Find a submit-style button.
  await page
    .getByRole('button')
    .filter({ hasText: /redeem|submit|apply|enter|unlock/i })
    .first()
    .click();
  // Back out to menu.
  await page.getByRole('button', { name: /Back/i }).first().click();

  // Open Classified.
  await page.getByRole('button', { name: 'Classified' }).click();
  // Click Russian Draughts (card index 1) — opens GalleryDialogBox.
  await page.getByTestId('classified-card-1').click();
  // Click Play in the dialog → navigates to detail.
  await page.getByTestId('gallery-play').click();
  // Start the game from the detail screen.
  await page.getByTestId('start-game-button').click();
  await page.getByTestId('classified-game-screen').waitFor();

  // Helper to click an algebraic-labeled cell.
  async function clickCell(label: string): Promise<void> {
    const target = page.getByLabel(`draughts ${label}`).first();
    await target.click();
    await page.waitForTimeout(50);
  }

  // Helper: how many legal-target circles are visible on the board?
  async function legalTargetCount(): Promise<number> {
    return page
      .locator('[data-testid="square-board-renderer"] > circle')
      .count();
  }

  // 1) Click a starting white piece — selection should produce highlights.
  await clickCell('c3');
  expect(await legalTargetCount()).toBeGreaterThan(0);
  await page.screenshot({ path: 'test-results/01-c3-selected.png' });

  // Play a deterministic kinging sequence (Pass-Around mode lets us
  // alternate sides freely). After this sequence, white should have a king.
  // The line below is ad-hoc — adjust to whatever pushes a white pawn
  // to rank 8. We pick simple non-capture diagonal advances to make
  // the sequence robust against optional-capture variations.
  // Note: Russian Draughts requires capture when available, so we have
  // to avoid creating capture opportunities along the way.
  //
  // Actual sequence (white moves first, then black):
  //   c3-d4, h6-g5, d4-e5, g5-f4 (interferes), …
  //
  // The simplest kinging: walk white pawn at b2 forward via odd files
  // (a3, b4, c5, d6, e7, f8 — but b2 to b4 is two squares; we move
  // diagonally). Try a different walk:
  //
  //   c3-b4, b6-a5, b4-c5, a5-b4, c5-d6, b4-c3 (impossible — c3 is taken
  //   by another white piece).
  //
  // Easier: move white g3→f4, black h6→g5, white f4→e5, then black
  // forces a capture since e5 attacks d6/f6. Let's just play random
  // pseudo-legal moves and screenshot until a king appears.
  // Iterate: pick the active side's first piece that has any legal move,
  // then click a legal-target circle. Repeat until a king appears.
  const maxMoves = 80;
  let kingFound = false;

  // Get all dark-cell aria labels — the labels are deterministic for an
  // 8x8 PDN board.
  const allCells: string[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue; // dark squares only
      const file = 'abcdefgh'[c]!;
      const rank = String(8 - r);
      allCells.push(`draughts ${file}${rank}`);
    }
  }

  for (let i = 0; i < maxMoves; i++) {
    let moved = false;
    // Try each dark cell as a candidate selection — first cell that
    // shows legal-target highlights when clicked is a piece of the
    // active color.
    for (const cellLabel of allCells) {
      const cell = page.getByLabel(cellLabel).first();
      await cell.click();
      await page.waitForTimeout(20);
      const targets = await legalTargetCount();
      if (targets === 0) continue;
      // Click the first legal-target circle.
      const circle = page
        .locator('[data-testid="square-board-renderer"] > circle')
        .first();
      const box = await circle.boundingBox();
      if (!box) continue;
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(30);
      moved = true;
      break;
    }
    if (!moved) break;

    const kings = await page.locator('[data-piece-id^="king-"]').count();
    if (kings > 0) {
      kingFound = true;
      console.log(`King appeared after ${String(i + 1)} moves.`);
      break;
    }
  }

  await page.screenshot({ path: 'test-results/02-after-king-appears.png' });
  expect(kingFound).toBe(true);

  // Now: click the king's cell (via aria-label) and verify legal targets show.
  // Find the king's aria-label — read from the piece's parent cell. We can
  // find the king's transform and infer the cell, or simpler: use the
  // king piece's aria-label.
  const kingAria = await page
    .locator('[data-piece-id^="king-"]')
    .first()
    .getAttribute('aria-label');
  console.log('King aria-label:', kingAria);

  // The king's aria-label is `White king on square N` — we need to find
  // the cell. Map by inspecting all dark cells: click each, see if it
  // shows highlights, with the king's color matching the active turn.
  // Simpler: use the geometry of the piece's transform.
  const kingTransform = await page
    .locator('[data-piece-id^="king-"]')
    .first()
    .getAttribute('transform');
  console.log('King transform:', kingTransform);
  const m = /translate\((\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\)/.exec(
    kingTransform ?? '',
  );
  expect(m).not.toBeNull();
  const kingX = Number(m![1]);
  const kingY = Number(m![2]);
  // 8x8 board with size 480 → cell 60. Cell column = (kingX-30)/60.
  const col = Math.round((kingX - 30) / 60);
  const row = Math.round((kingY - 30) / 60);
  const file = 'abcdefgh'[col]!;
  const rank = String(8 - row);
  const kingCellLabel = `draughts ${file}${rank}`;
  console.log('King cell label:', kingCellLabel);

  // Make sure the active turn matches the king's color (so the user can
  // click the king and it gets selected).
  const turnAfter = await page.getByTestId('classified-turn').textContent();
  console.log('Turn after kinging:', turnAfter);

  // If the kinger isn't to move, play any move to flip turn.
  // (Skip: just attempt to click and see if highlights appear.)

  await page.getByLabel(kingCellLabel).first().click();
  await page.waitForTimeout(150);

  const targetsAfterKingClick = await legalTargetCount();
  console.log('Legal targets after clicking king cell:', targetsAfterKingClick);
  await page.screenshot({ path: 'test-results/03-after-king-click.png' });

  expect(errors).toEqual([]);
  expect(targetsAfterKingClick).toBeGreaterThan(0);
});
