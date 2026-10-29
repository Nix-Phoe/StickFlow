import { describe, expect, it } from 'vitest';

import { formatBytes, formatDuration } from './format';

/** Intl sépare par des espaces insécables (typographie française) : on les compare comme des espaces. */
const plain = (text: string): string => text.replace(/[  ]/g, ' ');

describe('formatDuration', () => {
  it('shows minutes and seconds, rounded up to the second', () => {
    expect(formatDuration(0.4)).toBe('0:01');
    expect(formatDuration(4)).toBe('0:04');
    expect(formatDuration(75.2)).toBe('1:16');
  });
});

describe('formatBytes', () => {
  it('uses the French units (o, ko, Mo, Go)', () => {
    expect(plain(formatBytes(512))).toBe('512 o');
    expect(plain(formatBytes(1536))).toBe('1,5 ko');
    expect(plain(formatBytes(12.4 * 1024 * 1024))).toBe('12,4 Mo');
    expect(plain(formatBytes(2 * 1024 ** 3))).toBe('2 Go');
  });
});
