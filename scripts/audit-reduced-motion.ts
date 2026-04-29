#!/usr/bin/env tsx
/**
 * P4.5 — Reduced-motion audit.
 *
 * Walks `src/themes/marginnotes.escalation.css` and asserts every
 * selector that sets `transform` outside an `@media` block is also
 * reset to `transform: none` inside the file's
 * `@media (prefers-reduced-motion: reduce)` block.
 *
 * The audit is mechanical: a future contributor cannot land a new
 * tier-rotation rule without also adding the corresponding
 * reduced-motion guard, because this script is chained into
 * `npm run lint`.
 *
 * Exit code 0 = pass; non-zero = uncovered transform.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ESCALATION_CSS_PATH = resolve(
  process.cwd(),
  'src/themes/marginnotes.escalation.css',
);

interface Block {
  readonly selectorList: string;
  readonly body: string;
}

/**
 * Splits CSS source into top-level blocks (selectors + body braces).
 * Naive — does not handle nested at-rules other than the single
 * @media block at the file's tail. Sufficient for the escalation
 * CSS, which by P4.2's promotion rules is a flat structure.
 */
function parseTopLevelBlocks(css: string): { regular: Block[]; reducedMotionBody: string } {
  const regular: Block[] = [];
  let reducedMotionBody = '';

  // Strip /* ... */ comments to simplify scanning.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');

  // Match @media (prefers-reduced-motion: reduce) { ... } first.
  const reducedMatch = stripped.match(
    /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{([\s\S]*)\}\s*$/,
  );
  if (reducedMatch && reducedMatch[1]) {
    reducedMotionBody = reducedMatch[1];
  }

  // Strip the reduced-motion block from the source for the regular pass.
  const withoutReduced = stripped.replace(
    /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)\s*\{[\s\S]*?\n\}/,
    '',
  );

  // Walk top-level rules. Track brace depth so we don't accidentally
  // capture other @media bodies (none today, but defensive).
  let depth = 0;
  let buffer = '';
  let selectorBuffer = '';
  for (const char of withoutReduced) {
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
        regular.push({ selectorList: selectorBuffer, body: buffer });
        buffer = '';
        selectorBuffer = '';
        continue;
      }
    }
    buffer += char;
  }

  return { regular, reducedMotionBody };
}

/**
 * Returns true if a CSS body contains a `transform:` declaration that
 * is not `transform: none`.
 */
function hasNonNoneTransform(body: string): boolean {
  // Match `transform:` followed by something that is NOT immediately
  // `none`. Allow whitespace.
  const matches = body.match(/transform\s*:\s*[^;]+/g) ?? [];
  return matches.some((m) => !/transform\s*:\s*none/.test(m));
}

/**
 * Returns true if the reduced-motion body contains a `transform: none`
 * rule whose selector list matches `selector` exactly (after whitespace
 * normalization).
 */
function isCoveredByReducedMotion(
  selector: string,
  reducedMotionBody: string,
): boolean {
  // Walk every `selector { transform: none; }` block in reducedMotionBody.
  let depth = 0;
  let buffer = '';
  let selectorBuffer = '';
  const blocks: { selectorList: string; body: string }[] = [];
  for (const char of reducedMotionBody) {
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
        blocks.push({ selectorList: selectorBuffer, body: buffer });
        buffer = '';
        selectorBuffer = '';
        continue;
      }
    }
    buffer += char;
  }

  // Normalize selector for comparison.
  const target = normalizeSelector(selector);

  for (const block of blocks) {
    if (!/transform\s*:\s*none/.test(block.body)) continue;
    const reducedSelectors = block.selectorList
      .split(',')
      .map((s) => normalizeSelector(s));
    if (reducedSelectors.includes(target)) return true;
  }
  return false;
}

function normalizeSelector(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function main(): number {
  let css: string;
  try {
    css = readFileSync(ESCALATION_CSS_PATH, 'utf-8');
  } catch (err) {
    console.error(`[audit-reduced-motion] could not read ${ESCALATION_CSS_PATH}:`, err);
    return 1;
  }

  const { regular, reducedMotionBody } = parseTopLevelBlocks(css);

  if (!reducedMotionBody) {
    console.error(
      '[audit-reduced-motion] FAIL — no @media (prefers-reduced-motion: reduce) block found.',
    );
    return 1;
  }

  const offenders: string[] = [];
  for (const block of regular) {
    if (!hasNonNoneTransform(block.body)) continue;

    // The selectorList may contain commas — each comma-separated
    // selector must be individually covered.
    const selectors = block.selectorList.split(',').map((s) => s.trim());
    for (const selector of selectors) {
      if (!isCoveredByReducedMotion(selector, reducedMotionBody)) {
        offenders.push(selector);
      }
    }
  }

  if (offenders.length === 0) {
    console.log(
      `[audit-reduced-motion] OK — every transform-setting selector in marginnotes.escalation.css is covered by the reduced-motion guard.`,
    );
    return 0;
  }

  console.error(
    `[audit-reduced-motion] FAIL — the following ${String(offenders.length)} selector(s) set transform but are NOT covered by the reduced-motion @media block:`,
  );
  for (const sel of offenders) {
    console.error(`  - ${sel}`);
  }
  console.error(
    '\nAdd each selector to the @media (prefers-reduced-motion: reduce) block in src/themes/marginnotes.escalation.css with `transform: none`.',
  );
  return 1;
}

const exitCode = main();
process.exit(exitCode);
