/**
 * P4.5 — Unit-test counterpart to scripts/audit-reduced-motion.ts.
 *
 * The audit script catches violations at lint time; this test catches
 * them at test time. The double coverage means a contributor running
 * either `npm run lint` or `npm run test` cannot land an uncovered
 * transform.
 *
 * The CSS source is read via fs.readFileSync rather than a Vite
 * `?raw` import because Vite's CSS-as-module transform under jsdom
 * inlines styles into the document instead of returning the raw
 * source string. fs.readFileSync gives us the bytes directly.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const escalationCss = readFileSync(
  resolve(__dirname, 'marginnotes.escalation.css'),
  'utf-8',
);

describe('Margin Notes escalation — reduced-motion guarantees (P4.5)', () => {
  it('contains a @media (prefers-reduced-motion: reduce) block', () => {
    expect(escalationCss).toMatch(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/,
    );
  });

  it('every transform-setting selector outside @media is reset inside the reduced-motion block', () => {
    const stripped = escalationCss.replace(/\/\*[\s\S]*?\*\//g, '');

    // Carve off the reduced-motion block.
    const reducedMatch = stripped.match(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*)\}\s*$/,
    );
    expect(reducedMatch, 'expected an @media reduced-motion block at file tail').toBeTruthy();
    const reducedBody = reducedMatch?.[1] ?? '';
    const beforeReduced = stripped.replace(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*?\n\}/,
      '',
    );

    // Walk top-level rules in the non-reduced section.
    const transformSelectors: string[] = [];
    let depth = 0;
    let buffer = '';
    let selectorBuffer = '';
    for (const char of beforeReduced) {
      if (char === '{') {
        if (depth === 0) {
          selectorBuffer = buffer.trim();
          buffer = '';
          depth++;
          continue;
        }
        depth++;
      } else if (char === '}') {
        depth--;
        if (depth === 0) {
          if (
            /transform\s*:\s*[^;]+/.test(buffer) &&
            !/transform\s*:\s*none/.test(buffer)
          ) {
            for (const sel of selectorBuffer.split(',')) {
              transformSelectors.push(sel.replace(/\s+/g, ' ').trim());
            }
          }
          buffer = '';
          selectorBuffer = '';
          continue;
        }
      }
      buffer += char;
    }

    // Collect selectors inside the reduced-motion body that have transform: none.
    const reducedTransformSelectors = new Set<string>();
    {
      let rDepth = 0;
      let rBuffer = '';
      let rSelector = '';
      for (const char of reducedBody) {
        if (char === '{') {
          if (rDepth === 0) {
            rSelector = rBuffer.trim();
            rBuffer = '';
            rDepth++;
            continue;
          }
          rDepth++;
        } else if (char === '}') {
          rDepth--;
          if (rDepth === 0) {
            if (/transform\s*:\s*none/.test(rBuffer)) {
              for (const sel of rSelector.split(',')) {
                reducedTransformSelectors.add(sel.replace(/\s+/g, ' ').trim());
              }
            }
            rBuffer = '';
            rSelector = '';
            continue;
          }
        }
        rBuffer += char;
      }
    }

    const uncovered = transformSelectors.filter(
      (sel) => !reducedTransformSelectors.has(sel),
    );
    expect(
      uncovered,
      `the following transform-setting selectors are not reset under reduced motion: ${uncovered.join(', ')}`,
    ).toEqual([]);
  });

  it('the reduced-motion block uses transform: none (not animation: none) as the canonical reset', () => {
    const reducedMatch = escalationCss.match(
      /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*)\}\s*$/,
    );
    const body = reducedMatch?.[1] ?? '';
    expect(body).toMatch(/transform\s*:\s*none/);
  });
});
