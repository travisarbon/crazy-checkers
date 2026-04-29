import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './global.css';
import App from './ui/App';
import { loadSettings } from './persistence/settings';
import { ensureEscalationLoaded } from './themes/escalationLoader';

// P4.2 — First-paint conditional load of the Margin Notes escalation
// stylesheet. We read the persisted theme synchronously (loadSettings
// is sync over localStorage); when the user's stored theme is
// margin-notes, we load the escalation chunk before the first React
// paint so the very first frame already has the tier-specific chrome.
// Cork/Current/Classic/Contrast/crazy-original users skip this entirely.
const initialSettings = loadSettings();
await ensureEscalationLoaded(initialSettings.themeId);

// Dev/test-only: expose __TEST_TRIGGER_EVENT on window for Playwright e2e tests.
// Tree-shaken from production builds.
if (import.meta.env.DEV) {
  void import('./test/testEventHook');
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
