import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// jsdom does not implement window.scrollTo. Stub it to silence the
// "Not implemented: Window's scrollTo() method" noise from every test
// that mounts a ModeScreenShell (which calls scrollTo on mount).
if (typeof window !== 'undefined') {
  window.scrollTo = vi.fn();
}
