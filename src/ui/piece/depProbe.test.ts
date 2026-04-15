/**
 * Dep-probe — enforce Task 27.5's dependency boundary.
 *
 * `src/ui/piece/**` may import only:
 *   - React / TS stdlib,
 *   - other `src/ui/piece/**` modules,
 *   - `src/themes/**`,
 *   - `src/engine/classified/pieceVocabulary` (the engine-layer join point),
 *
 * Any other import path is a layering violation.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (
      (entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
      !entry.endsWith('.test.ts') &&
      !entry.endsWith('.test.tsx')
    ) {
      acc.push(p);
    }
  }
  return acc;
}

const IMPORT_RE = /from ['"]([^'"]+)['"]/gu;

describe('src/ui/piece dep probe', () => {
  it('only imports from piece, themes, or pieceVocabulary', () => {
    const srcRoot = resolve(process.cwd(), 'src');
    const pieceRoot = join(srcRoot, 'ui', 'piece');
    const files = walk(pieceRoot);
    const allowedPrefixes = [
      join('ui', 'piece') + sep,
      'themes' + sep,
    ];
    const allowedContains = [
      join('engine', 'classified', 'pieceVocabulary'),
    ];
    const violations: Array<{ file: string; target: string }> = [];
    for (const file of files) {
      const body = readFileSync(file, 'utf8');
      for (const m of body.matchAll(IMPORT_RE)) {
        const spec = m[1];
        if (spec === undefined || !spec.startsWith('.')) continue;
        const abs = resolve(join(file, '..'), spec);
        if (!abs.startsWith(srcRoot + sep)) continue;
        const rel = abs.slice(srcRoot.length + 1);
        const allowed =
          allowedPrefixes.some((p) => rel.startsWith(p)) ||
          allowedContains.some((p) => rel.includes(p));
        if (!allowed) {
          violations.push({ file: file.slice(srcRoot.length + 1), target: spec });
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
