import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ensureEscalationLoaded,
  isEscalationLoaded,
  __resetEscalationLoadedForTests,
} from './escalationLoader';

// Mock the dynamic import so jsdom (which has no full CSSOM) doesn't
// fail when the loader tries to inject the stylesheet.
vi.mock('./marginnotes.escalation.css', () => ({}));

describe('escalationLoader (P4.2)', () => {
  beforeEach(() => {
    __resetEscalationLoadedForTests();
  });

  it('loads the escalation CSS exactly once for margin-notes', async () => {
    expect(isEscalationLoaded()).toBe(false);
    await ensureEscalationLoaded('margin-notes');
    expect(isEscalationLoaded()).toBe(true);

    // Subsequent calls are no-ops.
    await ensureEscalationLoaded('margin-notes');
    await ensureEscalationLoaded('margin-notes');
    expect(isEscalationLoaded()).toBe(true);
  });

  it('does not load for non-margin-notes themes', async () => {
    await ensureEscalationLoaded('cork');
    await ensureEscalationLoaded('classic');
    await ensureEscalationLoaded('crazy-original');
    expect(isEscalationLoaded()).toBe(false);
  });

  it('does not load when called with an empty string or unknown id', async () => {
    await ensureEscalationLoaded('');
    await ensureEscalationLoaded('unknown-theme-id');
    expect(isEscalationLoaded()).toBe(false);
  });

  it('after a non-margin-notes call, switching to margin-notes still loads once', async () => {
    await ensureEscalationLoaded('cork');
    expect(isEscalationLoaded()).toBe(false);
    await ensureEscalationLoaded('margin-notes');
    expect(isEscalationLoaded()).toBe(true);
  });

  it('reset helper restores the unloaded state for sequential test runs', async () => {
    await ensureEscalationLoaded('margin-notes');
    expect(isEscalationLoaded()).toBe(true);
    __resetEscalationLoadedForTests();
    expect(isEscalationLoaded()).toBe(false);
  });
});
