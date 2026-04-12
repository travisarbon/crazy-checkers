import { describe, it, expect } from 'vitest';
import {
  UNLOCK_CODES,
  lookupCode,
  normalizeCode,
} from './unlockCodes';
import { CHOICE_MODE_DATA } from '../persistence/choiceModeData';
import { CLASSIFIED_PLACEHOLDER_DATA } from '../persistence/classifiedPlaceholderData';

function kebab(displayName: string): string {
  return displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

describe('normalizeCode', () => {
  it('trims, uppercases, and strips non-alphanumerics', () => {
    expect(normalizeCode(' rEvo-lution! ')).toBe('REVOLUTION');
    expect(normalizeCode('hop, skip, jump')).toBe('HOPSKIPJUMP');
    expect(normalizeCode('UNLOCK_ALL')).toBe('UNLOCKALL');
  });

  it('returns an empty string for whitespace-only input', () => {
    expect(normalizeCode('   ')).toBe('');
    expect(normalizeCode('')).toBe('');
  });
});

describe('UNLOCK_CODES mapping table', () => {
  it('contains a code for each of the 40 Choice modes', () => {
    for (const def of CHOICE_MODE_DATA) {
      const code = normalizeCode(def.displayName);
      expect(UNLOCK_CODES[code], `missing code for ${def.displayName}`).toBeDefined();
      expect(UNLOCK_CODES[code]?.targets).toEqual([`choice-${kebab(def.displayName)}`]);
    }
  });

  it('contains 5 track batch codes, each with exactly 8 targets', () => {
    for (let i = 1; i <= 5; i += 1) {
      const key = `TRACK${String(i)}ALL`;
      const entry = UNLOCK_CODES[key];
      expect(entry, `missing ${key}`).toBeDefined();
      const targets = entry?.targets;
      expect(Array.isArray(targets)).toBe(true);
      if (Array.isArray(targets)) {
        expect(targets).toHaveLength(8);
      }
    }
  });

  it('track batch targets cover all 40 Choice IDs exactly once', () => {
    const allChoiceIds = CHOICE_MODE_DATA.map((m) => `choice-${kebab(m.displayName)}`);
    const batched: string[] = [];
    for (const i of [1, 2, 3, 4, 5]) {
      const entry = UNLOCK_CODES[`TRACK${String(i)}ALL`];
      if (!entry) continue;
      const targets = entry.targets;
      if (targets === 'ALL') continue;
      for (const t of targets) batched.push(t);
    }
    expect(batched.sort()).toEqual(allChoiceIds.sort());
  });

  it('ALLCHOICE resolves to all 40 Choice mode IDs', () => {
    const result = lookupCode('ALLCHOICE');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.resolvedTargets).toHaveLength(40);
    }
  });

  it('contains per-Classified codes CLASSIFIED01..CLASSIFIED64', () => {
    for (let i = 1; i <= 64; i += 1) {
      const code = `CLASSIFIED${String(i).padStart(2, '0')}`;
      const entry = UNLOCK_CODES[code];
      expect(entry, `missing ${code}`).toBeDefined();
      expect(entry?.targets).toEqual([`classified-${String(i)}`]);
    }
  });

  it('ALLCLASSIFIED resolves to all 64 Classified IDs', () => {
    const result = lookupCode('ALLCLASSIFIED');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.resolvedTargets).toHaveLength(CLASSIFIED_PLACEHOLDER_DATA.length);
    }
  });

  it('CHAOS resolves to [chaos]', () => {
    const result = lookupCode('CHAOS');
    expect(result.found).toBe(true);
    if (result.found) expect(result.resolvedTargets).toEqual(['chaos']);
  });

  it('CLASSIFIED resolves to [classified]', () => {
    const result = lookupCode('CLASSIFIED');
    expect(result.found).toBe(true);
    if (result.found) expect(result.resolvedTargets).toEqual(['classified']);
  });

  it('UNLOCKALL includes the master marker plus all registered IDs', () => {
    const result = lookupCode('UNLOCKALL');
    expect(result.found).toBe(true);
    if (result.found) {
      expect(result.resolvedTargets).toContain('all');
      expect(result.resolvedTargets).toContain('choice');
      expect(result.resolvedTargets).toContain('classified');
      expect(result.resolvedTargets).toContain('chaos');
      // At least 40 Choice + 64 Classified + core markers
      expect(result.resolvedTargets.length).toBeGreaterThanOrEqual(108);
    }
  });

  it('every entry has at least one target (or ALL)', () => {
    for (const [code, entry] of Object.entries(UNLOCK_CODES)) {
      if (entry.targets === 'ALL') continue;
      expect(entry.targets.length, `${code} has empty targets`).toBeGreaterThan(0);
    }
  });
});

describe('lookupCode', () => {
  it('returns not-found for empty / whitespace input', () => {
    expect(lookupCode('').found).toBe(false);
    expect(lookupCode('   ').found).toBe(false);
  });

  it('returns not-found for unknown codes', () => {
    expect(lookupCode('NOTACODE').found).toBe(false);
    expect(lookupCode('XYZ').found).toBe(false);
  });

  it('is case- and whitespace-insensitive', () => {
    const a = lookupCode('revolution');
    const b = lookupCode('  Revolution  ');
    const c = lookupCode('REVO-LUTION');
    expect(a.found && b.found && c.found).toBe(true);
    if (a.found && b.found && c.found) {
      expect(a.resolvedTargets).toEqual(['choice-revolution']);
      expect(b.resolvedTargets).toEqual(['choice-revolution']);
      expect(c.resolvedTargets).toEqual(['choice-revolution']);
    }
  });
});
