import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './global.css';
import App from './ui/App';

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
