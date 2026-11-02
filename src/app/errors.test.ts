import { describe, expect, it } from 'vitest';

import { isReportableError } from './errors';

describe('isReportableError', () => {
  it('reports the errors of the app', () => {
    expect(isReportableError({ message: 'Uncaught TypeError: x is undefined', filename: 'https://stickflow.app/assets/index-abc.js' })).toBe(true);
    expect(isReportableError({ reason: new Error('Échec du chargement') })).toBe(true);
  });

  it('ignores harmless browser noise and errors of browser extensions', () => {
    expect(isReportableError({ message: 'ResizeObserver loop completed with undelivered notifications.' })).toBe(false);
    expect(isReportableError({ message: 'ResizeObserver loop limit exceeded' })).toBe(false);
    expect(isReportableError({ message: 'Error', filename: 'chrome-extension://abc/content.js' })).toBe(false);
    expect(isReportableError({ message: 'Error', filename: 'moz-extension://abc/content.js' })).toBe(false);
  });

  it('ignores a cancelled operation (AbortError)', () => {
    expect(isReportableError({ reason: new DOMException('stop', 'AbortError') })).toBe(false);
  });
});
