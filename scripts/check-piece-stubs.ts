#!/usr/bin/env tsx
/**
 * check-piece-stubs — Task 27.5 CI probe.
 *
 * Scans the production dist to assert that no piece marked `__PIECE_STUB__`
 * remains reachable from a registered Classified game. Until tier tasks
 * begin registering real art, this probe fails softly — it warns about stub
 * inclusion in the bundle but does not fail the build, because the scaffold
 * stubs legitimately live in the bundle for downstream tasks to consume.
 *
 * The probe becomes a hard fail the first time any Tier 1 registration
 * closes. At that point, this script's `ENFORCE = true` flag flips in a
 * follow-up commit per the Task 27.5 acceptance checklist.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets');
const ENFORCE = false;

function main(): void {
  if (!existsSync(DIST_ASSETS)) {
    console.error(
      `[check-piece-stubs] dist/assets not found — run \`npm run build\` first.`,
    );
    process.exit(1);
  }

  const files = readdirSync(DIST_ASSETS).filter((f) => f.endsWith('.js'));
  const stubbed: string[] = [];
  for (const f of files) {
    const body = readFileSync(join(DIST_ASSETS, f), 'utf8');
    if (body.includes('__PIECE_STUB__')) stubbed.push(f);
  }

  if (stubbed.length === 0) {
    console.log(`[check-piece-stubs] OK — no stubs in dist.`);
    return;
  }

  const msg = `[check-piece-stubs] ${String(stubbed.length)} bundle chunk(s) contain __PIECE_STUB__ markers: ${stubbed.join(', ')}.`;
  if (ENFORCE) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
  console.warn(
    '[check-piece-stubs] soft-warn only; the ENFORCE flag flips to true once Tier 1 piece art lands.',
  );
}

main();
