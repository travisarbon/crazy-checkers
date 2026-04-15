/**
 * Dependency-probe: asserts that the engine-layer BoardGeometry module and
 * its adjacency/coordinate subtrees do not drag in any UI code. Enforces the
 * acceptance criterion "no runtime dependency on React / DOM".
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname);

const FORBIDDEN = [/from ['"].*\/ui\//, /from ['"]react['"]/, /\.module\.css/];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(p));
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(p);
    }
  }
  return out;
}

describe('BoardGeometry dependency probe', () => {
  const targets = [
    path.join(ROOT, 'boardGeometry.ts'),
    ...walk(path.join(ROOT, 'adjacency')),
    ...walk(path.join(ROOT, 'coordinates')),
  ];

  for (const file of targets) {
    it(`${path.relative(ROOT, file)} has no UI imports`, () => {
      const src = fs.readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN) {
        expect(src).not.toMatch(pattern);
      }
    });
  }
});
