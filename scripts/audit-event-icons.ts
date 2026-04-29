#!/usr/bin/env tsx
/**
 * P5.1 — Per-event icon spec + budget audit.
 *
 * Walks src/data/eventIcons/ and asserts each event has a complete
 * triple ((id).svg + (id).annotation.svg + (id).metadata.json),
 * and that each pair conforms to the asset spec:
 *   - icon SVG declares viewBox="0 0 64 64"
 *   - annotation SVG declares viewBox="0 0 80 80"
 *   - combined unminified size is ≤ 4KB (gzipped budget proxy)
 *   - metadata.drawOnDurationMs is in [600, 900]
 *
 * Run as `npm run audit:event-icons`.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ICON_DIR = resolve(__dirname, '..', 'src/data/eventIcons');

const ICON_BUDGET_BYTES = 4 * 1024; // 4KB combined per event (unminified proxy for gzipped budget).

interface AuditFailure {
  readonly fileId: string;
  readonly reason: string;
}

const failures: AuditFailure[] = [];

const entries = readdirSync(ICON_DIR);
const fileIds = new Set<string>();
for (const entry of entries) {
  if (entry.endsWith('.svg') && !entry.endsWith('.annotation.svg')) {
    fileIds.add(entry.replace(/\.svg$/, ''));
  }
}

if (fileIds.size === 0) {
  console.error(`[audit-event-icons] FAIL — no .svg files found in ${ICON_DIR}`);
  process.exit(1);
}

for (const fileId of fileIds) {
  const iconPath = resolve(ICON_DIR, `${fileId}.svg`);
  const annoPath = resolve(ICON_DIR, `${fileId}.annotation.svg`);
  const metaPath = resolve(ICON_DIR, `${fileId}.metadata.json`);

  // Triple presence.
  let iconStat;
  let annoStat;
  let metaStat;
  try {
    iconStat = statSync(iconPath);
  } catch {
    failures.push({ fileId, reason: `missing icon file ${iconPath}` });
    continue;
  }
  try {
    annoStat = statSync(annoPath);
  } catch {
    failures.push({ fileId, reason: `missing annotation file ${annoPath}` });
    continue;
  }
  try {
    metaStat = statSync(metaPath);
  } catch {
    failures.push({ fileId, reason: `missing metadata file ${metaPath}` });
    continue;
  }

  // Spec: icon viewBox + annotation viewBox.
  const iconBody = readFileSync(iconPath, 'utf-8');
  const annoBody = readFileSync(annoPath, 'utf-8');
  if (!/viewBox=["']0 0 64 64["']/.test(iconBody)) {
    failures.push({ fileId, reason: `icon SVG must declare viewBox="0 0 64 64"` });
  }
  if (!/viewBox=["']0 0 80 80["']/.test(annoBody)) {
    failures.push({ fileId, reason: `annotation SVG must declare viewBox="0 0 80 80"` });
  }

  // Combined byte budget (unminified — gzipped is typically 30–40% of this).
  const combined = iconStat.size + annoStat.size;
  if (combined > ICON_BUDGET_BYTES) {
    failures.push({
      fileId,
      reason: `combined unminified size ${String(combined)}B exceeds the ${String(ICON_BUDGET_BYTES)}B budget`,
    });
  }

  // Metadata: drawOnDurationMs in [600, 900].
  let metadata: { drawOnDurationMs?: unknown };
  try {
    metadata = JSON.parse(readFileSync(metaPath, 'utf-8')) as typeof metadata;
  } catch (err) {
    failures.push({ fileId, reason: `metadata JSON parse failed: ${String(err)}` });
    continue;
  }
  const dur = metadata.drawOnDurationMs;
  if (typeof dur !== 'number' || dur < 600 || dur > 900) {
    failures.push({
      fileId,
      reason: `metadata.drawOnDurationMs must be a number in [600, 900], got ${String(dur)}`,
    });
  }
  void metaStat;
}

if (failures.length === 0) {
  console.log(`[audit-event-icons] OK — ${String(fileIds.size)} icon-pair(s) pass the asset spec.`);
  process.exit(0);
}

console.error(
  `[audit-event-icons] FAIL — ${String(failures.length)} spec violation(s):`,
);
for (const f of failures) {
  console.error(`  - ${f.fileId}: ${f.reason}`);
}
process.exit(1);
