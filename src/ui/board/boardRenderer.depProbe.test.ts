/**
 * Dep-probe — no engine module may import from `src/ui/board/**`.
 *
 * The engine layer (BoardGeometry, adjacency, coordinates, classified state)
 * is the source of truth; the renderer layer consumes from engine, never the
 * other way around. A leak would pull React into the engine bundle.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, acc);
    else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) acc.push(p);
  }
  return acc;
}

describe('board renderer dep probe', () => {
  it('no src/engine/** file imports from src/ui/board/**', () => {
    const root = join(process.cwd(), 'src', 'engine');
    const files = walk(root);
    const offenders: string[] = [];
    for (const file of files) {
      const body = readFileSync(file, 'utf8');
      if (/from ['"][^'"]*ui\/board/u.test(body)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
