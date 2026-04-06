import { describe, it, expect } from 'vitest';
import { EVENT_DATA, EVENT_DATA_MAP } from './eventData';
import { CrazyEvent } from '../engine/types';
import { EVENT_DISPLAY_NAMES, EVENT_FLAVOR_TEXT, EVENT_DURATIONS } from '../engine/events';

describe('eventData', () => {
  it('all 40 events present', () => {
    expect(EVENT_DATA).toHaveLength(40);
  });

  it('no duplicate event types', () => {
    const types = EVENT_DATA.map((e) => e.eventType);
    expect(new Set(types).size).toBe(40);
  });

  it('event numbers sequential 1–40', () => {
    const numbers = EVENT_DATA.map((e) => e.eventNumber).sort((a, b) => a - b);
    for (let i = 0; i < 40; i++) {
      expect(numbers[i]).toBe(i + 1);
    }
  });

  it('names match engine constants', () => {
    for (const e of EVENT_DATA) {
      expect(e.name).toBe(EVENT_DISPLAY_NAMES[e.eventType]);
    }
  });

  it('flavor text matches engine constants', () => {
    for (const e of EVENT_DATA) {
      expect(e.flavorText).toBe(EVENT_FLAVOR_TEXT[e.eventType]);
    }
  });

  it('duration plies match engine constants', () => {
    for (const e of EVENT_DATA) {
      expect(e.durationPlies).toBe(EVENT_DURATIONS[e.eventType]);
    }
  });

  it('all fields populated', () => {
    for (const e of EVENT_DATA) {
      expect(e.mechanicalEffect.length).toBeGreaterThan(0);
      expect(e.choiceModeName.length).toBeGreaterThan(0);
      expect(e.choiceModeDescription.length).toBeGreaterThan(0);
    }
  });

  it('tiers valid', () => {
    for (const e of EVENT_DATA) {
      expect([1, 2, 3]).toContain(e.tier);
    }
  });

  it('MAP lookup works', () => {
    const entry = EVENT_DATA_MAP.get(CrazyEvent.KingForADay);
    expect(entry).toBeDefined();
    expect(entry?.name).toBe('King for a Day');
    expect(entry?.eventNumber).toBe(1);
  });
});
