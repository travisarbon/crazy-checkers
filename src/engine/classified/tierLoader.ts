/**
 * Classified tier loader — dynamic-import bridge (Task 27.4 §4.1).
 *
 * `loadClassifiedTier(tierNumber)` imports the tier's index module which
 * registers every game in its tier at import time. Vite code-splits each
 * dynamic `import('./tierN/index')` into its own chunk so Tier 1 bundles
 * never pull Tier 6 / Tier 7 code.
 *
 * Tier task owners create their own `src/engine/classified/tier{N}/index.ts`;
 * Task 27.4 ships Tier 0 only (test fixtures).
 */

const loaded = new Map<number, Promise<void>>();

/**
 * Dynamic-import the tier index module. Repeated calls return the same
 * in-flight promise (idempotent). Unknown tiers reject with a typed error.
 */
export function loadClassifiedTier(tierNumber: number): Promise<void> {
  const cached = loaded.get(tierNumber);
  if (cached) return cached;

  const promise: Promise<void> = (async () => {
    switch (tierNumber) {
      case 0: {
        const mod = await import('./tier0/index');
        mod.registerTier0();
        return;
      }
      case 1: {
        const mod = await import('./tier1/index');
        mod.registerTier1();
        return;
      }
      case 2:
      case 3:
      case 4:
      case 5:
      case 6:
      case 7: {
        const taskNumber = 27 + tierNumber; // 29, 30, 31, 32, 33, 34
        throw new Error(
          `loadClassifiedTier(${String(tierNumber)}): tier not yet authored ` +
            `(Tier ${String(tierNumber)} lands in Task ${String(taskNumber)}).`,
        );
      }
      default:
        throw new Error(
          `loadClassifiedTier(${String(tierNumber)}): invalid tier number (expected 0..7)`,
        );
    }
  })();

  loaded.set(tierNumber, promise);
  return promise;
}

/** Test-only helper: drops the loader cache so each test starts from zero. */
export function _clearTierLoaderCache(): void {
  loaded.clear();
}
