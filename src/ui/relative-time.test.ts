import { describe, expect, it } from 'vitest';

import { relativeTime } from './relative-time';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const now = Date.UTC(2026, 9, 29, 12);
/** Intl sépare par des espaces insécables (typographie française) : on les compare comme des espaces. */
const plain = (text: string): string => text.replace(/[\u00a0\u202f]/g, ' ');

describe('relativeTime', () => {
  it('says « à l’instant » for less than a minute', () => {
    expect(plain(relativeTime(now - 20_000, now))).toBe('à l’instant');
  });

  it('counts minutes, hours and days in short French', () => {
    expect(plain(relativeTime(now - 5 * MINUTE, now))).toBe('il y a 5 min');
    expect(plain(relativeTime(now - 2 * HOUR, now))).toBe('il y a 2 h');
    expect(plain(relativeTime(now - 3 * DAY, now))).toBe('il y a 3 j');
  });

  it('gives the date for anything older than a month', () => {
    expect(plain(relativeTime(Date.UTC(2026, 0, 15, 12), now))).toBe('15 janv. 2026');
  });
});
