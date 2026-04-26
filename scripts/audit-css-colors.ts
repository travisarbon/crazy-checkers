#!/usr/bin/env tsx
/**
 * audit-css-colors — Phase 2 P2.2 audit gate.
 *
 * Scans every `*.module.css` file under `src/ui/` for hardcoded color
 * literals (hex, rgb/rgba, hsl/hsla, named colors used in color
 * properties). Fails on any literal not on the documented allowlist.
 *
 * Exit codes:
 *   0 — every literal is on the allowlist (or there are none).
 *   1 — at least one violation. A markdown table of violations is
 *       printed to stderr.
 *
 * See: Documentation/UI Overhaul/P2.2-Audit-Hardcoded-Colors.md
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import process from 'node:process';

import { allowlist } from './audit-css-colors.allowlist.ts';

const ROOT = join(process.cwd(), 'src', 'ui');

// Hex literal: word-boundary-safe so we don't match inside identifiers.
const HEX_RE = /(?<![\w-])#[0-9A-Fa-f]{3,8}\b/g;
// Color functions that wrap raw color literals.
const FUNC_RE = /\b(?:rgba?|hsla?)\s*\(/g;
// CSS color properties that must take a token, not a named color.
const COLOR_PROPS =
  /\b(?:color|background(?:-color)?|border(?:-(?:top|right|bottom|left))?(?:-color)?|fill|stroke|box-shadow|text-shadow|outline(?:-color)?|caret-color|accent-color|column-rule-color|text-decoration-color)\s*:/;
const NAMED_COLORS = new Set<string>([
  'white',
  'black',
  'red',
  'green',
  'blue',
  'gray',
  'grey',
  'yellow',
  'orange',
  'purple',
]);

interface Violation {
  file: string;
  line: number;
  value: string;
  property: string;
}

function* walkCssModules(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      yield* walkCssModules(full);
    } else if (full.endsWith('.module.css')) {
      yield full;
    }
  }
}

function toRelPosix(file: string): string {
  return posix.normalize(relative(process.cwd(), file).split(sep).join('/'));
}

function isAllowlisted(file: string, line: number, value: string): boolean {
  return allowlist.some(
    (entry) =>
      entry.file === file &&
      Math.abs(entry.lineHint - line) <= 2 &&
      entry.value === value,
  );
}

function scanFile(file: string): Violation[] {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  const violations: Violation[] = [];
  const rel = toRelPosix(file);
  let inBlockComment = false;
  let inSvgDataUri = false;

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i] ?? '';
    let line = raw;

    // Strip block-comment regions (rolling state across lines).
    if (inBlockComment) {
      const end = line.indexOf('*/');
      if (end < 0) continue;
      line = line.slice(end + 2);
      inBlockComment = false;
    }
    while (true) {
      const start = line.indexOf('/*');
      if (start < 0) break;
      const end = line.indexOf('*/', start + 2);
      if (end < 0) {
        line = line.slice(0, start);
        inBlockComment = true;
        break;
      }
      line = line.slice(0, start) + line.slice(end + 2);
    }

    // Skip lines inside a multi-line SVG data URI. The opener can also close
    // on the same line (single-line URI); we toggle the state accordingly.
    if (inSvgDataUri) {
      const closeIdx = line.indexOf('")');
      if (closeIdx < 0) continue;
      line = line.slice(closeIdx + 2);
      inSvgDataUri = false;
    }
    while (line.includes('data:image/svg+xml')) {
      const openIdx = line.indexOf('data:image/svg+xml');
      const closeIdx = line.indexOf('")', openIdx);
      if (closeIdx < 0) {
        line = line.slice(0, openIdx);
        inSvgDataUri = true;
        break;
      }
      line = line.slice(0, openIdx) + line.slice(closeIdx + 2);
    }

    const propertyMatch = line.match(COLOR_PROPS);
    const property = propertyMatch ? propertyMatch[0].replace(/:$/, '').trim() : '(none)';

    let m: RegExpExecArray | null;
    HEX_RE.lastIndex = 0;
    while ((m = HEX_RE.exec(line)) !== null) {
      const value = m[0];
      if (!isAllowlisted(rel, i + 1, value)) {
        violations.push({ file: rel, line: i + 1, value, property });
      }
    }
    FUNC_RE.lastIndex = 0;
    while ((m = FUNC_RE.exec(line)) !== null) {
      const value = m[0];
      if (!isAllowlisted(rel, i + 1, value)) {
        violations.push({ file: rel, line: i + 1, value, property });
      }
    }
    // Named-color scan only for property-bearing lines, to avoid
    // false-positives from selectors like `.colorDot.white { ... }`.
    if (propertyMatch) {
      // Find the colon that opens the value, then scan after it.
      const colonIdx = line.indexOf(':', line.search(COLOR_PROPS));
      if (colonIdx >= 0) {
        const valueRegion = line.slice(colonIdx + 1);
        for (const word of NAMED_COLORS) {
          const re = new RegExp(`(?<![\\w-])${word}(?![\\w-])`, 'g');
          let nm: RegExpExecArray | null;
          while ((nm = re.exec(valueRegion)) !== null) {
            if (!isAllowlisted(rel, i + 1, word)) {
              violations.push({ file: rel, line: i + 1, value: word, property });
            }
          }
        }
      }
    }
  }
  return violations;
}

function main(): void {
  const violations: Violation[] = [];
  for (const file of walkCssModules(ROOT)) {
    violations.push(...scanFile(file));
  }
  if (violations.length === 0) {
    console.log('[audit-css-colors] OK. No hardcoded colors found in src/ui/**/*.module.css.');
    return;
  }
  console.error(
    '[audit-css-colors] FAIL. The following hardcoded colors must be replaced with CSS custom properties:\n',
  );
  console.error('| File | Line | Property | Value |');
  console.error('|---|---|---|---|');
  for (const v of violations) {
    console.error(`| ${v.file} | ${String(v.line)} | ${v.property} | \`${v.value}\` |`);
  }
  console.error(`\nTotal violations: ${String(violations.length)}.`);
  console.error(
    'See Documentation/UI Overhaul/P2.2-Audit-Hardcoded-Colors.md §3.4 for the mapping table.',
  );
  process.exit(1);
}

main();
