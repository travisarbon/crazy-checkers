/**
 * Dev/test-only event forcing hook for Playwright e2e tests.
 *
 * Exposes `window.__TEST_TRIGGER_EVENT(eventName)` which queues a specific
 * event as `globalThis.__TEST_FORCED_EVENT`. The selectRandomEvent function
 * checks for this value and uses it for one invocation, then clears it.
 *
 * This module is only imported in dev/test builds (gated by import.meta.env.DEV).
 * Tree-shaken from production builds.
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

import { CrazyEvent } from '../engine/types';
import { IMPLEMENTED_EVENTS } from '../engine/events';

if (typeof window !== 'undefined') {
  (window as any).__TEST_TRIGGER_EVENT = (eventName: string) => {
    const event = CrazyEvent[eventName as keyof typeof CrazyEvent];
    if (event && IMPLEMENTED_EVENTS.includes(event)) {
      (globalThis as any).__TEST_FORCED_EVENT = event;
    } else {
      console.warn(`__TEST_TRIGGER_EVENT: Unknown or unimplemented event "${eventName}"`);
    }
  };
}
