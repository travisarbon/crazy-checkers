/**
 * Tier 1 source-attestation test (Task 28.2.1 §5).
 *
 * Parses `sources.md` at test time and asserts that, for every row, the
 * runtime `DraughtsConfig` factory returns a value equal to the documented
 * one. Any drift between the source URL and the factory fails the test
 * with a file-path + field-name error.
 *
 * This is the regression shield that couples the configs to their cited
 * real-world rulebooks. A future refactor that inadvertently reverts a
 * correction fails here before it reaches the behavioural test battery.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createDraughtsConfig,
  type DraughtsConfig,
  type DraughtsGameId,
} from '../DraughtsConfig';

// Resolve relative to this test file so CI and local runs agree.
const thisFile = fileURLToPath(import.meta.url);
const SOURCES_PATH = resolve(dirname(thisFile), '..', 'sources.md');

interface SourceRow {
  readonly gameId: DraughtsGameId;
  readonly field: string;
  readonly rawValue: string;
}

function parseSourcesMd(contents: string): readonly SourceRow[] {
  const rows: SourceRow[] = [];
  const lines = contents.split('\n');
  for (const line of lines) {
    if (!line.startsWith('| ')) continue;
    // Skip header and separator rows.
    if (line.includes('Game | Rule | Value') || line.startsWith('|---')) continue;
    const parts = line.split('|').map((c) => c.trim());
    // Layout: ['', gameId, field, value, url, accessed, '']
    if (parts.length < 6) continue;
    const [, gameId, field, rawValue] = parts;
    if (!gameId || !field || !rawValue) continue;
    rows.push({ gameId: gameId as DraughtsGameId, field, rawValue });
  }
  return rows;
}

function interpret(raw: string): string | number | boolean | null {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw === 'null') return null;
  const n = Number(raw);
  if (!Number.isNaN(n) && /^-?\d+(\.\d+)?$/.test(raw)) return n;
  return raw;
}

function fieldValue(config: DraughtsConfig, field: string): unknown {
  return (config as unknown as Record<string, unknown>)[field];
}

describe('sources.md — Tier 1 config source attestation', () => {
  const contents = readFileSync(SOURCES_PATH, 'utf8');
  const rows = parseSourcesMd(contents);

  it('parses at least one row per Tier 1 game', () => {
    const gameIds = new Set(rows.map((r) => r.gameId));
    expect(gameIds.size).toBeGreaterThanOrEqual(10);
  });

  it.each(rows)(
    '$gameId.$field === $rawValue',
    ({ gameId, field, rawValue }) => {
      const config = createDraughtsConfig(gameId);
      const actual = fieldValue(config, field);
      const expected = interpret(rawValue);
      expect(actual).toBe(expected);
    },
  );
});
