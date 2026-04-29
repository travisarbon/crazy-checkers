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
    localStorage.removeItem('crazy-checkers-unlock-state');
    localStorage.removeItem('crazy-checkers-code-unlocks');
    localStorage.removeItem('crazy-checkers-redemption-history');
  });
}

/**
 * Pre-seed the settings envelope so the next page load lands on Margin
 * Notes with the escalation flag on. Used by P4.4 escalation tests so
 * the chrome paints on first paint without clicking through Configure.
 */
export async function enableMarginNotesEscalation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const data = {
      themeId: 'margin-notes',
      animationSpeed: 1.0,
      moveConfirmation: false,
      masterVolume: 0.7,
      sfxVolume: 1.0,
      musicVolume: 0.5,
      muted: true,
      audioPackId: 'silent',
      marginNotesEscalation: true,
      timeControl: null,
    };
    localStorage.setItem(
      'crazy-checkers-settings',
      JSON.stringify({ version: 4, data }),
    );
  });
}

/**
 * Clear all IndexedDB data (games + challenges).
 */
export async function clearAppIndexedDb(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('crazy-checkers');
      req.onsuccess = () => { resolve(); };
      req.onerror = () => { resolve(); };
      req.onblocked = () => { resolve(); };
    });
  });
}

/**
 * Dismiss resume dialog if present.
 */
export async function dismissResumeDialog(page: Page): Promise<void> {
  const resumeDiscard = page.getByTestId('resume-discard');
  if (await resumeDiscard.isVisible({ timeout: 500 }).catch(() => false)) {
    await resumeDiscard.click();
  }
}

// ---------------------------------------------------------------------------
// Crazy mode helpers (Task 14.2)
// ---------------------------------------------------------------------------

/**
 * Start a Crazy mode Pass Around game.
 */
export async function startCrazyPassAroundGame(page: Page): Promise<void> {
  await page.goto('/');
  const resumeDiscard = page.getByTestId('resume-discard');
  if (await resumeDiscard.isVisible({ timeout: 500 }).catch(() => false)) {
    await resumeDiscard.click();
  }
  await page.getByRole('button', { name: 'Crazy' }).click();
  await page.getByTestId('game-setup-dialog').waitFor();
  // Pass Around is the default game type
  await page.getByTestId('setup-start').click();
  await page.getByTestId('game-screen').waitFor();
}

/**
 * Start a Crazy mode game vs CPU at the given difficulty.
 */
export async function startCrazyCpuGame(
  page: Page,
  difficulty: 'easy' | 'hard' = 'easy',
): Promise<void> {
  await page.goto('/');
  const resumeDiscard = page.getByTestId('resume-discard');
  if (await resumeDiscard.isVisible({ timeout: 500 }).catch(() => false)) {
    await resumeDiscard.click();
  }
  await page.getByRole('button', { name: 'Crazy' }).click();
  await page.getByTestId('game-setup-dialog').waitFor();
  await page.getByLabel('vs. CPU').check();
  await page.getByTestId('difficulty-fieldset').waitFor();
  if (difficulty === 'hard') {
    await page.getByLabel('Hard').check();
  }
  await page.getByTestId('setup-start').click();
  await page.getByTestId('game-screen').waitFor();
}

/**
 * Force-trigger a specific event via the browser console (test-only).
 * Requires the app to expose a __TEST_TRIGGER_EVENT hook when
 * running in dev mode.
 */
export async function forceEvent(
  page: Page,
  eventName: string,
): Promise<void> {
  await page.evaluate((name) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__TEST_TRIGGER_EVENT?.(name);
  }, eventName);
}

/**
 * Wait for event announcement to appear and optionally verify its text.
 */
export async function waitForEventAnnouncement(
  page: Page,
  expectedName?: string,
): Promise<void> {
  const announcement = page.getByTestId('event-announcement');
  await announcement.waitFor({ state: 'visible', timeout: 10000 });
  if (expectedName) {
    const nameEl = page.getByTestId('event-announcement-name');
    await nameEl.waitFor({ state: 'visible', timeout: 5000 });
  }
}

// ---------------------------------------------------------------------------
// Phase 3 Task 24.2 helpers
// ---------------------------------------------------------------------------

/**
 * Wait for a screen with the given testId to become visible.
 */
export async function waitForScreen(page: Page, testId: string): Promise<void> {
  await page.getByTestId(testId).waitFor({ state: 'visible', timeout: 10000 });
}

/** Generic menu → named button → screen navigation. */
async function gotoMenuAndClick(
  page: Page,
  buttonName: string,
  screenTestId: string,
): Promise<void> {
  await page.goto('/');
  await dismissResumeDialog(page);
  await page.getByRole('button', { name: buttonName }).click();
  await waitForScreen(page, screenTestId);
}

export async function navigateToChallenge(page: Page): Promise<void> {
  await gotoMenuAndClick(page, 'Challenge', 'challenge-screen');
}

export async function navigateToChoice(page: Page): Promise<void> {
  await gotoMenuAndClick(page, 'Choice', 'choice-screen');
}

export async function navigateToCareer(page: Page): Promise<void> {
  await gotoMenuAndClick(page, 'Career', 'career-screen');
}

export async function navigateToCogitate(page: Page): Promise<void> {
  await gotoMenuAndClick(page, 'Cogitate', 'cogitate-screen');
}

export async function navigateToCode(page: Page): Promise<void> {
  await gotoMenuAndClick(page, 'Code', 'code-screen');
}

/**
 * Navigate to the Code screen, enter a code, and submit it.
 */
export async function redeemCode(page: Page, code: string): Promise<void> {
  await navigateToCode(page);
  await page.getByTestId('code-input').fill(code);
  await page.getByTestId('redeem-button').click();
  await page.getByTestId('status-message').waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Seed code-based unlocks directly in localStorage (faster than redeeming via UI).
 */
export async function seedCodeUnlocks(
  page: Page,
  modeIds: readonly string[],
): Promise<void> {
  await page.evaluate((ids) => {
    localStorage.setItem('crazy-checkers-code-unlocks', JSON.stringify([...ids].sort()));
  }, modeIds);
}

/**
 * Set the viewport size to a preset breakpoint.
 */
export async function setViewport(
  page: Page,
  size: 'mobile' | 'mobile-wide' | 'desktop' | 'large-desktop',
): Promise<void> {
  const sizes = {
    mobile: { width: 375, height: 667 },
    'mobile-wide': { width: 390, height: 844 },
    desktop: { width: 1280, height: 720 },
    'large-desktop': { width: 1440, height: 900 },
  } as const;
  await page.setViewportSize(sizes[size]);
}

/**
 * Seed `count` solved challenge records into IndexedDB.
 * Uses puzzleIds 1..count to satisfy the unlock evaluator which counts distinct
 * solved puzzleIds.
 */
export async function injectChallengeRecords(
  page: Page,
  count: number,
): Promise<void> {
  await page.evaluate(async (n) => {
    const records = Array.from({ length: n }, (_, idx) => ({
      id: `seed-challenge-${String(idx + 1)}`,
      puzzleId: idx + 1,
      solved: true,
      solveTimeMs: 5000,
      rating: 3,
      movesPlayed: ['11-15'],
      attemptNumber: 1,
      completedAt: Date.now() - (n - idx) * 1000,
    }));

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('crazy-checkers', 3);
      req.onupgradeneeded = () => {
        const upgradeDb = req.result;
        if (!upgradeDb.objectStoreNames.contains('games')) {
          const store = upgradeDb.createObjectStore('games', { keyPath: 'id' });
          store.createIndex('by-mode', 'mode');
          store.createIndex('by-completedAt', 'completedAt');
          store.createIndex('by-result', 'result');
        }
        if (!upgradeDb.objectStoreNames.contains('challenges')) {
          const challengeStore = upgradeDb.createObjectStore('challenges', { keyPath: 'id' });
          challengeStore.createIndex('by-puzzleId', 'puzzleId');
          challengeStore.createIndex('by-completedAt', 'completedAt');
        }
      };
      req.onsuccess = () => { resolve(req.result); };
      req.onerror = () => { reject(req.error); };
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('challenges', 'readwrite');
      const store = tx.objectStore('challenges');
      for (const record of records) {
        store.put(record);
      }
      tx.oncomplete = () => { resolve(); };
      tx.onerror = () => { reject(tx.error); };
    });
    db.close();
  }, count);
}

export interface SeededGameRecord {
  id?: string;
  mode: string;
  playerWhite: string;
  playerBlack: string;
  result: string;
  reason: string;
  moves: string[];
  boardStates: string[];
  startedAt: number;
  completedAt: number;
}

/**
 * Seed game records into IndexedDB.
 */
export async function injectGameRecords(
  page: Page,
  records: readonly SeededGameRecord[],
): Promise<void> {
  await page.evaluate(async (rawRecords) => {
    const withIds = rawRecords.map((r, idx) => ({
      ...r,
      id: r.id ?? `seed-game-${String(idx + 1)}`,
    }));

    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('crazy-checkers', 3);
      req.onupgradeneeded = () => {
        const upgradeDb = req.result;
        if (!upgradeDb.objectStoreNames.contains('games')) {
          const store = upgradeDb.createObjectStore('games', { keyPath: 'id' });
          store.createIndex('by-mode', 'mode');
          store.createIndex('by-completedAt', 'completedAt');
          store.createIndex('by-result', 'result');
        }
        if (!upgradeDb.objectStoreNames.contains('challenges')) {
          const challengeStore = upgradeDb.createObjectStore('challenges', { keyPath: 'id' });
          challengeStore.createIndex('by-puzzleId', 'puzzleId');
          challengeStore.createIndex('by-completedAt', 'completedAt');
        }
      };
      req.onsuccess = () => { resolve(req.result); };
      req.onerror = () => { reject(req.error); };
    });

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('games', 'readwrite');
      const store = tx.objectStore('games');
      for (const record of withIds) {
        store.put(record);
      }
      tx.oncomplete = () => { resolve(); };
      tx.onerror = () => { reject(tx.error); };
    });
    db.close();
  }, records as unknown as SeededGameRecord[]);
}

/**
 * Build the canonical 32-char initial board state snapshot.
 * (Black pawns on 1–12, white pawns on 21–32.)
 */
export function initialBoardSnapshot(): string {
  return 'bbbbbbbbbbbb........wwwwwwwwwwww';
}

/**
 * Build a minimal GameRecord snapshot list of length `plies + 1`, starting
 * from the initial board and leaving it unchanged (suitable for Replay UI
 * smoke tests that verify navigation, not move accuracy).
 */
export function buildPaddedBoardStates(plies: number): string[] {
  const init = initialBoardSnapshot();
  return new Array(plies + 1).fill(init);
}
