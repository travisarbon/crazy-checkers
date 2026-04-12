import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadRedemptionHistory,
  appendRedemption,
  clearRedemptionHistory,
  type RedemptionRecord,
} from './redemptionHistory';

const KEY = 'crazy-checkers-redemption-history';

function makeRecord(partial: Partial<RedemptionRecord> = {}): RedemptionRecord {
  return {
    code: 'REVOLUTION',
    description: 'Choice Mode: Revolution',
    newUnlocksCount: 1,
    timestamp: 1_700_000_000_000,
    ...partial,
  };
}

describe('redemptionHistory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('returns an empty array when no data is stored', () => {
    expect(loadRedemptionHistory()).toEqual([]);
  });

  it('round-trips a single record', () => {
    const record = makeRecord();
    appendRedemption(record);
    expect(loadRedemptionHistory()).toEqual([record]);
  });

  it('appends records in chronological order', () => {
    const r1 = makeRecord({ code: 'REVOLUTION', timestamp: 1 });
    const r2 = makeRecord({ code: 'CHAOS', timestamp: 2 });
    const r3 = makeRecord({ code: 'UNLOCKALL', timestamp: 3 });
    appendRedemption(r1);
    appendRedemption(r2);
    appendRedemption(r3);
    expect(loadRedemptionHistory()).toEqual([r1, r2, r3]);
  });

  it('clears history', () => {
    appendRedemption(makeRecord());
    expect(loadRedemptionHistory()).toHaveLength(1);
    clearRedemptionHistory();
    expect(loadRedemptionHistory()).toEqual([]);
  });

  it('returns empty for corrupt JSON', () => {
    localStorage.setItem(KEY, '{not json');
    expect(loadRedemptionHistory()).toEqual([]);
  });

  it('returns empty when version mismatches', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 99, records: [] }));
    expect(loadRedemptionHistory()).toEqual([]);
  });

  it('returns empty when records have missing fields', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ version: 1, records: [{ code: 'X' }] }),
    );
    expect(loadRedemptionHistory()).toEqual([]);
  });

  it('returns empty when records is not an array', () => {
    localStorage.setItem(KEY, JSON.stringify({ version: 1, records: 'bad' }));
    expect(loadRedemptionHistory()).toEqual([]);
  });

  it('swallows setItem failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => {
      appendRedemption(makeRecord());
    }).not.toThrow();
  });

  it('swallows removeItem failures', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(() => {
      clearRedemptionHistory();
    }).not.toThrow();
  });
});
