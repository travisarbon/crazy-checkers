/**
 * Tests for scripts/audit-css-colors.ts.
 *
 * Three describe blocks:
 *   1. Live tree is clean — runs the audit script against `src/ui/`
 *      and expects exit 0.
 *   2. No stale allowlist entries — every entry's `(file, lineHint)`
 *      still points at the literal it claims to whitelist.
 *   3. Planted leakage trips the script — write a fixture file with
 *      a hardcoded literal, run the script, expect exit 1.
 *
 * See: Documentation/UI Overhaul/P2.2-Audit-Hardcoded-Colors.md §8
 */

import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { allowlist } from './audit-css-colors.allowlist.ts';

const SCRIPT = 'tsx scripts/audit-css-colors.ts';

describe('audit-css-colors', () => {
  it('exits 0 on the live src/ui tree (no leakage at HEAD)', () => {
    expect(() => {
      execSync(SCRIPT, { stdio: 'pipe' });
    }).not.toThrow();
  });

  it('contains no stale allowlist entries', () => {
    for (const entry of allowlist) {
      expect(existsSync(entry.file)).toBe(true);
      const content = readFileSync(entry.file, 'utf8');
      const lines = content.split('\n');
      const start = Math.max(0, entry.lineHint - 1 - 2);
      const end = Math.min(lines.length, entry.lineHint - 1 + 3);
      const window = lines.slice(start, end).join('\n');
      expect(window).toContain(entry.value);
    }
  });

  it('exits non-zero when a fixture file contains a planted hex literal', () => {
    const fixtureDir = join(process.cwd(), 'src', 'ui', '__audit_fixture__');
    mkdirSync(fixtureDir, { recursive: true });
    const fixturePath = join(fixtureDir, 'planted.module.css');
    writeFileSync(fixturePath, '.bad { color: #ff0000; }\n', 'utf8');
    try {
      expect(() => {
        execSync(SCRIPT, { stdio: 'pipe' });
      }).toThrow();
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
});
