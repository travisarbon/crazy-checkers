#!/usr/bin/env tsx
/**
 * Task 28.7 — Tier 1 bundle-size CI gate.
 *
 * Builds a minimal ESM bundle rooted at `src/engine/classified/tier1/index.ts`
 * and its transitive Classified dependencies, then gzips the output and
 * compares to the published Tier 1 budget of 500 KB gzipped (Phase 4
 * Implementation Plan line 322 acceptance clause, line 1670 budget table).
 *
 * The bundle is emitted to `.tmp/tier1-bundle.js` (not the dist/ tree) to
 * avoid interfering with `vite build`. Running this script is side-effect
 * free beyond that temporary file.
 *
 * Exit 0 on pass, 1 on fail or build error.
 */

import { build } from 'esbuild';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BUDGET_BYTES_GZIPPED = 500 * 1024; // 500 KB per Phase 4 plan line 322.

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, '..', '..');
const ENTRY = join(
  REPO_ROOT,
  'src',
  'engine',
  'classified',
  'tier1',
  'index.ts',
);
const OUT_DIR = join(REPO_ROOT, '.tmp');
const OUT_FILE = join(OUT_DIR, 'tier1-bundle.js');

async function main(): Promise<void> {
  if (!existsSync(ENTRY)) {
    console.error(`[check-bundle-size] entry not found: ${ENTRY}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });

  try {
    await build({
      entryPoints: [ENTRY],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      target: 'es2020',
      minify: true,
      sourcemap: false,
      outfile: OUT_FILE,
      // Treat Phase 3 / Phase 1 infrastructure as external — it is already
      // part of the main bundle, so its cost is not attributable to Tier 1.
      // (Removing this would double-count shared infra and fail the gate
      // for reasons unrelated to Tier 1 size.)
      external: [
        'react',
        'react-dom',
        'zustand',
        'idb',
        'comlink',
      ],
      logLevel: 'warning',
    });
  } catch (err) {
    console.error('[check-bundle-size] esbuild failed:');
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const raw = readFileSync(OUT_FILE);
  const gzipped = gzipSync(raw, { level: 9 });

  const rawKb = Math.round(raw.length / 1024);
  const gzipKb = Math.round((gzipped.length / 1024) * 10) / 10;
  const budgetKb = BUDGET_BYTES_GZIPPED / 1024;

  // Persist the measurement alongside the bundle for CI log capture + the
  // Bundle_Size_Tier1.md evidence file to reference.
  const reportPath = join(OUT_DIR, 'tier1-bundle-size.json');
  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        entry: 'src/engine/classified/tier1/index.ts',
        rawBytes: raw.length,
        gzipBytes: gzipped.length,
        rawKb,
        gzipKb,
        budgetKb,
        budgetBytes: BUDGET_BYTES_GZIPPED,
        pass: gzipped.length <= BUDGET_BYTES_GZIPPED,
        measuredAt: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
  );

  if (gzipped.length > BUDGET_BYTES_GZIPPED) {
    console.error(
      `[check-bundle-size] FAIL: tier1 bundle ${String(gzipKb)} KB gzipped exceeds ${String(budgetKb)} KB budget (${String(gzipped.length)} / ${String(BUDGET_BYTES_GZIPPED)} bytes).`,
    );
    process.exit(1);
  }

  console.log(
    `[check-bundle-size] OK. tier1 bundle = ${String(rawKb)} KB raw, ${String(gzipKb)} KB gzipped (budget ${String(budgetKb)} KB).`,
  );
  console.log(`[check-bundle-size] report written to ${reportPath}`);
}

main().catch((err) => {
  console.error('[check-bundle-size] unexpected error:', err);
  process.exit(1);
});
