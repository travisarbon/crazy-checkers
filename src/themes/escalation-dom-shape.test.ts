/**
 * P4.4 — DOM-shape regression for the escalation layer.
 *
 * Asserts the structural contract: every selector in
 * marginnotes.escalation.css that mentions data-mode is also
 * dual-scoped on data-theme='margin-notes' (so escalation never
 * paints over Cork/Current/Classic/Contrast/crazy-original), the
 * file declares rules for crazy/choice/chaos but not classic, and
 * the :root annotation tokens are NOT redeclared (P2.1 owns those
 * globally).
 *
 * The CSS source is read via fs.readFileSync rather than a Vite
 * `?raw` import — see the equivalent comment in
 * marginnotes-escalation.test.ts for the rationale.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const escalationCss = readFileSync(
  resolve(__dirname, 'marginnotes.escalation.css'),
  'utf-8',
);

const TIERS_WITH_RULES: readonly ('crazy' | 'choice' | 'chaos')[] = [
  'crazy',
  'choice',
  'chaos',
];

describe('Margin Notes escalation — DOM-shape contract (P4.4)', () => {
  it('the escalation CSS dual-scopes every selector on data-theme + data-mode', () => {
    // Strip /* ... */ comments so we only look at live selectors.
    const stripped = escalationCss.replace(/\/\*[\s\S]*?\*\//g, '');
    // Find every selector line (anything before a `{`) that mentions data-mode.
    const matches = stripped.match(/^[^@}{]*\[data-mode=[^\]]+\][^{]*\{/gm) ?? [];
    expect(matches.length).toBeGreaterThan(0);
    for (const selector of matches) {
      expect(
        selector,
        `selector "${selector.trim()}" must be dual-scoped on data-theme='margin-notes'`,
      ).toMatch(/\[data-theme=['"]margin-notes['"]\]/);
    }
  });

  it('declares rules for crazy, choice, and chaos tiers (classic is intentionally empty)', () => {
    for (const tier of TIERS_WITH_RULES) {
      expect(
        escalationCss,
        `expected at least one rule for data-mode='${tier}'`,
      ).toMatch(new RegExp(`\\[data-mode=['"]${tier}['"]\\]`));
    }
  });

  it('does not redeclare :root annotation tokens (P2.1 owns those globally)', () => {
    // The promoted file removed the :root block from the design-proposal
    // source so that P2.1's tokens in src/global.css are the single
    // source of truth.
    const stripped = escalationCss.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(stripped).not.toMatch(/^\s*:root\s*\{/m);
  });

  it('contains a prefers-reduced-motion guard block', () => {
    expect(escalationCss).toMatch(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/,
    );
  });
});
