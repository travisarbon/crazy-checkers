/**
 * Task 22.2 — integration test for the Code unlock → Chaos reveal flow.
 *
 * Drives the persistence layer the same way `CodeScreen` does (addCodeUnlock
 * for the `'chaos'` target) and asserts that the async `evaluateUnlocks()`
 * shell reflects the new state, that MenuScreen renders the "Chaos Checkers"
 * title, and that resetting persistence reverts both the snapshot and the
 * title.
 */

import 'fake-indexeddb/auto';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MenuScreen from '../ui/MenuScreen';
import {
  addCodeUnlock,
  evaluateUnlocks,
  saveCodeUnlocks,
} from '../persistence/unlockEvaluator';
import { clearUnlockState } from '../persistence/unlockState';

// Mock matchMedia for MenuScreen's reduced-motion fallback.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const NO_NEW = { choice: false, classified: false, chaos: false };

function renderMenuWithSnapshot(snapshot: Awaited<ReturnType<typeof evaluateUnlocks>>): void {
  render(
    <MenuScreen
      onConfigure={vi.fn()}
      onNavigate={vi.fn()}
      unlockSnapshot={snapshot}
      newlyUnlocked={NO_NEW}
      onUnlockAnimationEnd={vi.fn()}
      chaosUnlocked={snapshot.chaosUnlocked}
    />,
  );
}

describe('Code unlock → Chaos reveal flow (Task 22.2)', () => {
  beforeEach(() => {
    localStorage.clear();
    clearUnlockState();
    saveCodeUnlocks(new Set());
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('entering the CHAOS code flips the snapshot and changes the menu title', async () => {
    // Baseline: no unlocks → Chaos locked, title is "Crazy Checkers".
    let snapshot = await evaluateUnlocks();
    expect(snapshot.chaosUnlocked).toBe(false);

    renderMenuWithSnapshot(snapshot);
    expect(screen.getByText('Crazy Checkers')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chaos' })).not.toBeInTheDocument();
    cleanup();

    // Simulate a CHAOS code redemption (CodeScreen does this via addCodeUnlock).
    expect(addCodeUnlock('chaos')).toBe(true);

    snapshot = await evaluateUnlocks();
    expect(snapshot.chaosUnlocked).toBe(true);

    renderMenuWithSnapshot(snapshot);
    expect(screen.getByText('Chaos Checkers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chaos' })).toBeInTheDocument();
  });

  it('resetting persisted state reverts the title and hides the Chaos button', async () => {
    addCodeUnlock('chaos');
    let snapshot = await evaluateUnlocks();
    expect(snapshot.chaosUnlocked).toBe(true);

    renderMenuWithSnapshot(snapshot);
    expect(screen.getByText('Chaos Checkers')).toBeInTheDocument();
    cleanup();

    // Data reset: clear unlock state and code unlocks (ConfigScreen reset flow).
    clearUnlockState();
    saveCodeUnlocks(new Set());

    snapshot = await evaluateUnlocks();
    expect(snapshot.chaosUnlocked).toBe(false);

    renderMenuWithSnapshot(snapshot);
    expect(screen.getByText('Crazy Checkers')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Chaos' })).not.toBeInTheDocument();
  });

  it('UNLOCKALL master code also reveals Chaos and changes the title', async () => {
    // UnlockEvaluator activates masterUnlockActive when the 'all' marker is present.
    addCodeUnlock('all');

    const snapshot = await evaluateUnlocks();
    expect(snapshot.chaosUnlocked).toBe(true);

    renderMenuWithSnapshot(snapshot);
    expect(screen.getByText('Chaos Checkers')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chaos' })).toBeInTheDocument();
  });
});
