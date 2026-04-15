/**
 * Dep-probe — Task 27.4 §10.9.
 *
 * Enforces the engine ↔ UI isolation rule for the Classified registry
 * subtree:
 *  - No `src/engine/classified/**` file imports from `src/ui/**`.
 *  - The only `src/engine/**` file outside `classified/` allowed to import
 *    the registry is `src/engine/game.ts` (the dispatch site).
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const CLASSIFIED_DIR = resolve(REPO_ROOT, 'src', 'engine', 'classified');
const ENGINE_DIR = resolve(REPO_ROOT, 'src', 'engine');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

describe('registry dep-probe', () => {
  it('no src/engine/classified file imports from src/ui/**', () => {
    const files = walk(CLASSIFIED_DIR);
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/from\s+['"].*\/ui\//.test(text)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('only src/engine/game.ts imports the Classified registry from outside classified/', () => {
    const files = walk(ENGINE_DIR).filter(
      (f) => !f.startsWith(CLASSIFIED_DIR) && !/boardGeometry\.cogitateShim/.test(f),
    );
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      if (/from\s+['"].*classified\//.test(text)) {
        if (!file.endsWith('game.ts')) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
