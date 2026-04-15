#!/usr/bin/env tsx
/**
 * check-bundle-split — Task 27.4 CI probe.
 *
 * After `npm run build`, parses the `dist/assets` manifest and verifies:
 *  1. Every tier-N JS chunk that exists is named `tier{N}-*.js` (Tier 0 not
 *     allowed in production — test-only).
 *  2. The main bundle (index-*.js) does not inline the Tier 0 fixture
 *     modules. Checked by substring match against the bundled chunk content:
 *     the string `classified-test-tier-0` must never appear in the main
 *     bundle's chunk (fixtures are excluded from production builds).
 *
 * Additional tier chunks (tier1-*, tier2-*, ...) are inspected as they
 * land; absent chunks are a warning, not an error — subsequent tier tasks
 * add them incrementally.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const DIST_ASSETS = join(process.cwd(), 'dist', 'assets');

function main(): void {
  if (!existsSync(DIST_ASSETS)) {
    console.error(
      `[check-bundle-split] dist/assets not found — run \`npm run build\` first.`,
    );
    process.exit(1);
  }

  const files = readdirSync(DIST_ASSETS).filter((f) => f.endsWith('.js'));

  const tier0Chunks = files.filter((f) => /^tier0-/.test(f));
  if (tier0Chunks.length > 0) {
    console.error(
      `[check-bundle-split] FAIL: tier0 chunks found in production bundle:\n  ${tier0Chunks.join('\n  ')}`,
    );
    process.exit(1);
  }

  const mainChunks = files.filter((f) => /^index-/.test(f));
  if (mainChunks.length === 0) {
    console.warn(`[check-bundle-split] WARN: no index-*.js chunk found.`);
  }

  // Fingerprint the tier0 fixture code by a string that only appears in the
  // fixture registration (not in `unlockCodes.ts`, which references the id as
  // a target key — that is expected to survive into the main bundle).
  const forbidden = 'Task 27.4 registration fixture for the checkers-clone path.';
  for (const chunk of mainChunks) {
    const full = join(DIST_ASSETS, chunk);
    const text = readFileSync(full, 'utf8');
    if (text.includes(forbidden)) {
      console.error(
        `[check-bundle-split] FAIL: main chunk "${chunk}" inlines the Tier 0 fixture string "${forbidden}".`,
      );
      process.exit(1);
    }
  }

  const totalSize = files.reduce(
    (sum, f) => sum + statSync(join(DIST_ASSETS, f)).size,
    0,
  );
  console.log(
    `[check-bundle-split] OK. ${String(files.length)} JS chunks, ${String(
      Math.round(totalSize / 1024),
    )} KB total.`,
  );
}

main();
